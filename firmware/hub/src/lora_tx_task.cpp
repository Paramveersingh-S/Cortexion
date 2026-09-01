/**
 * Cortexion Hub — LoRa TX Task
 *
 * Transmits V2V beacon packets over LoRa with:
 * - Adaptive spreading factor (SF7 when moving for Doppler resistance,
 *   SF11 when stationary for maximum range)
 * - Duty cycle enforcement (1% per rolling hour, India IN865/433 MHz)
 * - SPI bus mutex (shared with TFT display)
 */

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <mbedtls/aes.h>
#include "packet.h"
#include "pins.h"
#include "config.h"

extern QueueHandle_t loraTxQueue;
extern SemaphoreHandle_t spiBusMutex;

// ── Duty Cycle Guard ────────────────────────────────────────────
// India IN865/433 MHz: 1% duty cycle per rolling hour.
// A 21-byte beacon at SF7 has ~30ms airtime, at SF11 ~200ms.
// This guard blocks TX if the hour's budget is exhausted.

class DutyCycleGuard {
  uint32_t windowStartMs = 0;
  uint32_t airtimeUsedMs = 0;
  static const uint32_t WINDOW_MS = 3600000;   // 1 hour
  static const uint32_t BUDGET_MS = 36000;     // 1% of 1 hour = 36 seconds

public:
  bool canTransmit(uint32_t estAirtimeMs) {
    uint32_t now = millis();
    if (now - windowStartMs > WINDOW_MS) {
      windowStartMs = now;
      airtimeUsedMs = 0;
    }
    return (airtimeUsedMs + estAirtimeMs) <= BUDGET_MS;
  }

  void recordTransmit(uint32_t actualMs) {
    airtimeUsedMs += actualMs;
  }

  float usagePercent() const {
    return (float)airtimeUsedMs / (float)BUDGET_MS * 100.0f;
  }
};

// ── LoRa Configuration ─────────────────────────────────────────

#ifndef LORA_FREQUENCY
  #define LORA_FREQUENCY 433E6
#endif
#ifndef LORA_TX_POWER
  #define LORA_TX_POWER 17
#endif
#ifndef LORA_BANDWIDTH
  #define LORA_BANDWIDTH 125E3
#endif

static DutyCycleGuard dutyGuard;

/**
 * Estimate airtime for a given payload size and spreading factor.
 * Simplified formula — accurate enough for duty cycle budgeting.
 */
static uint32_t estimateAirtimeMs(size_t payloadBytes, uint8_t sf) {
  // Rough estimates based on LoRa calculator for BW=125kHz, CR=4/5
  float symbolDurationUs;
  switch (sf) {
    case 7:  symbolDurationUs = 1024;  break;   // ~1ms per symbol
    case 8:  symbolDurationUs = 2048;  break;
    case 9:  symbolDurationUs = 4096;  break;
    case 10: symbolDurationUs = 8192;  break;
    case 11: symbolDurationUs = 16384; break;
    case 12: symbolDurationUs = 32768; break;
    default: symbolDurationUs = 1024;
  }

  // Preamble (8 symbols) + header + payload
  float preambleUs = 12.25f * symbolDurationUs;
  float payloadSymbols = 8.0f + max(0.0f, ceilf(
    (8.0f * payloadBytes - 4.0f * sf + 28.0f + 16.0f) /
    (4.0f * (sf - 2))
  ) * 5.0f);
  float totalUs = preambleUs + payloadSymbols * symbolDurationUs;
  return (uint32_t)(totalUs / 1000.0f) + 1;
}

// ── LoRa Initialization ────────────────────────────────────────

static bool initLoRa() {
  LoRa.setPins(PIN_LORA_CS, PIN_LORA_RST, PIN_LORA_DIO0);

  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("[LORA-TX] LoRa init failed!");
    return false;
  }

  LoRa.setTxPower(LORA_TX_POWER);
  LoRa.setSignalBandwidth(LORA_BANDWIDTH);
  LoRa.setCodingRate4(5);  // 4/5
  LoRa.setSpreadingFactor(7);  // Default, changed dynamically
  LoRa.enableCrc();

  Serial.printf("[LORA-TX] Initialized at %.1f MHz, %d dBm\n",
                LORA_FREQUENCY / 1e6, LORA_TX_POWER);
  return true;
}

// ── Task Entry Point ────────────────────────────────────────────

void loraTxTask(void* pv) {
  vTaskDelay(pdMS_TO_TICKS(2000));  // Let system stabilize

  // Initialize LoRa under SPI mutex
  if (xSemaphoreTake(spiBusMutex, pdMS_TO_TICKS(5000))) {
    if (!initLoRa()) {
      xSemaphoreGive(spiBusMutex);
      Serial.println("[LORA-TX] Aborting task — LoRa hardware not available");
      vTaskDelete(NULL);
      return;
    }
    xSemaphoreGive(spiBusMutex);
  }

  V2VBeacon beacon;
  uint32_t txCount = 0;

  while (true) {
    if (xQueueReceive(loraTxQueue, &beacon, portMAX_DELAY) == pdTRUE) {
      // Adaptive spreading factor based on vehicle speed
      // SF7: Doppler-resistant, lower range — use when moving
      // SF11: Maximum range — use when stationary for range demo
      uint8_t sf = (beacon.speed_kmh > 5) ? 7 : 11;

      uint32_t estAirtime = estimateAirtimeMs(sizeof(beacon), sf);

      if (!dutyGuard.canTransmit(estAirtime)) {
        Serial.printf("[LORA-TX] Duty cycle budget exhausted (%.1f%%) — skipping\n",
                      dutyGuard.usagePercent());
        continue;
      }

      // ── Listen-Before-Talk (CSMA) & Jitter ──
      // Add random jitter to avoid repeated collisions if two vehicles sync up
      uint32_t jitterMs = esp_random() % 100;
      vTaskDelay(pdMS_TO_TICKS(jitterMs));

      bool channelClear = false;
      for (int retries = 0; retries < 3; retries++) {
        if (xSemaphoreTake(spiBusMutex, pdMS_TO_TICKS(100))) {
          // If a packet is available, it means the channel is busy right now
          // (lora_rx_task will read it on its next cycle)
          int packetSize = LoRa.parsePacket();
          if (packetSize > 0) {
            xSemaphoreGive(spiBusMutex); // Channel busy, give back mutex
          } else {
            channelClear = true; // Channel is clear, keep the mutex for transmission
            break; 
          }
        }
        
        // Channel was busy, exponential backoff
        uint32_t backoff = 50 + (esp_random() % (50 * (1 << retries)));
        Serial.printf("[LORA-TX] Channel busy, backing off for %lums\n", backoff);
        vTaskDelay(pdMS_TO_TICKS(backoff));
      }

      if (!channelClear) {
        Serial.println("[LORA-TX] Channel busy after max retries — dropping beacon");
        continue;
      }

      // At this point, we HOLD the spiBusMutex and the channel is clear!
      LoRa.setSpreadingFactor(sf);

        uint32_t txStart = millis();

        // ── AES-128-CTR Encryption ─────────────────────
        uint8_t nonce[V2V_NONCE_SIZE];
        uint32_t r1 = esp_random();
        uint32_t r2 = esp_random();
        memcpy(nonce, &r1, 4);
        memcpy(nonce + 4, &r2, 4);

        mbedtls_aes_context aes;
        mbedtls_aes_init(&aes);
        mbedtls_aes_setkey_enc(&aes, LORA_AES_KEY, 128);

        uint8_t stream_block[16] = {0};
        size_t nc_off = 0;
        uint8_t nonce_counter[16] = {0};
        memcpy(nonce_counter, nonce, 8);

        uint8_t encrypted_payload[sizeof(V2VBeacon)];
        mbedtls_aes_crypt_ctr(&aes, sizeof(V2VBeacon), &nc_off, nonce_counter, stream_block, 
                              reinterpret_cast<uint8_t*>(&beacon), encrypted_payload);
        mbedtls_aes_free(&aes);
        // ──────────────────────────────────────────────

        LoRa.beginPacket();
        LoRa.write(nonce, V2V_NONCE_SIZE);
        LoRa.write(encrypted_payload, sizeof(V2VBeacon));
        LoRa.endPacket();
        uint32_t actualAirtime = millis() - txStart;

        dutyGuard.recordTransmit(actualAirtime);
        xSemaphoreGive(spiBusMutex);

        txCount++;
        if (txCount % 20 == 0) {
          Serial.printf("[LORA-TX] Beacon #%lu sent (SF%d, %lums, duty=%.1f%%)\n",
                        txCount, sf, actualAirtime, dutyGuard.usagePercent());
        }
      } // end if (channelClear) -> Note: spiBusMutex was released inside the transmission block
    }
  }
}

