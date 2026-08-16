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
#include "packet.h"
#include "pins.h"

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

      if (xSemaphoreTake(spiBusMutex, pdMS_TO_TICKS(100))) {
        LoRa.setSpreadingFactor(sf);

        uint32_t txStart = millis();
        LoRa.beginPacket();
        LoRa.write(reinterpret_cast<uint8_t*>(&beacon), sizeof(V2VBeacon));
        LoRa.endPacket();
        uint32_t actualAirtime = millis() - txStart;

        dutyGuard.recordTransmit(actualAirtime);
        xSemaphoreGive(spiBusMutex);

        txCount++;
        if (txCount % 20 == 0) {
          Serial.printf("[LORA-TX] Beacon #%lu sent (SF%d, %lums, duty=%.1f%%)\n",
                        txCount, sf, actualAirtime, dutyGuard.usagePercent());
        }
      }
    }
  }
}
