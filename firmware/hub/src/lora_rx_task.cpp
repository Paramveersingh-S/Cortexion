/**
 * Cortexion Hub — LoRa RX Task
 *
 * Listens for incoming V2V beacons from other vehicles.
 * Validates CRC8, checks proto_version, and forwards valid
 * beacons to the fusion task for peer tracking and alerts.
 *
 * Uses the same SPI bus as TX and screen — guarded by spiBusMutex.
 */

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <mbedtls/aes.h>
#include "packet.h"
#include "pins.h"
#include "config.h"

extern QueueHandle_t loraRxQueue;
extern SemaphoreHandle_t spiBusMutex;

#ifndef VEHICLE_ID
  #define VEHICLE_ID 1
#endif

void loraRxTask(void* pv) {
  vTaskDelay(pdMS_TO_TICKS(3000));  // Let TX task initialize LoRa first
  Serial.println("[LORA-RX] Listening for V2V beacons...");

  uint32_t rxCount = 0;
  uint32_t crcFails = 0;
  uint32_t versionFails = 0;

  while (true) {
    int packetSize = 0;

    // Check for incoming packet under SPI mutex
    if (xSemaphoreTake(spiBusMutex, pdMS_TO_TICKS(50))) {
      packetSize = LoRa.parsePacket();

      if (packetSize == V2V_ENCRYPTED_SIZE) {
        uint8_t nonce[V2V_NONCE_SIZE];
        uint8_t encrypted_payload[sizeof(V2VBeacon)];

        for (int i = 0; i < V2V_NONCE_SIZE && LoRa.available(); i++) {
          nonce[i] = LoRa.read();
        }
        for (int i = 0; i < sizeof(V2VBeacon) && LoRa.available(); i++) {
          encrypted_payload[i] = LoRa.read();
        }

        int rssi = LoRa.packetRssi();
        float snr = LoRa.packetSnr();

        xSemaphoreGive(spiBusMutex);

        // ── AES-128-CTR Decryption ─────────────────────
        V2VBeacon beacon;
        mbedtls_aes_context aes;
        mbedtls_aes_init(&aes);
        mbedtls_aes_setkey_enc(&aes, LORA_AES_KEY, 128);

        uint8_t stream_block[16] = {0};
        size_t nc_off = 0;
        uint8_t nonce_counter[16] = {0};
        memcpy(nonce_counter, nonce, V2V_NONCE_SIZE);

        mbedtls_aes_crypt_ctr(&aes, sizeof(V2VBeacon), &nc_off, nonce_counter, stream_block, 
                              encrypted_payload, reinterpret_cast<uint8_t*>(&beacon));
        mbedtls_aes_free(&aes);
        // ──────────────────────────────────────────────

        // Validate beacon
        if (!beacon_validate(beacon)) {
          if (beacon.proto_version != CORTEXION_PROTO_VERSION) {
            versionFails++;
            Serial.printf("[LORA-RX] Unknown proto_version %d (expected %d) — dropping\n",
                          beacon.proto_version, CORTEXION_PROTO_VERSION);
          } else {
            crcFails++;
            Serial.println("[LORA-RX] CRC mismatch — dropping corrupted packet");
          }
          continue;
        }

        // Don't process our own beacons (shouldn't happen with point-to-point
        // but can if using omnidirectional antennas at close range)
        if (beacon.vehicle_id == VEHICLE_ID) {
          continue;
        }

        rxCount++;
        if (rxCount % 10 == 1) {
          Serial.printf("[LORA-RX] Beacon from vehicle %d: %d km/h, score=%d "
                        "(RSSI=%d, SNR=%.1f)\n",
                        beacon.vehicle_id, beacon.speed_kmh,
                        beacon.driving_score, rssi, snr);
        }

        // Forward to fusion task
        xQueueOverwrite(loraRxQueue, &beacon);

      } else {
        xSemaphoreGive(spiBusMutex);

        if (packetSize > 0 && packetSize != V2V_ENCRYPTED_SIZE) {
          Serial.printf("[LORA-RX] Unexpected packet size: %d (expected %d)\n",
                        packetSize, (int)V2V_ENCRYPTED_SIZE);
        }
      }
    }

    vTaskDelay(pdMS_TO_TICKS(10));  // Check at 100 Hz for low latency
  }
}
