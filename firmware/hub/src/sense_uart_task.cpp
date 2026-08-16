/**
 * Cortexion Hub — Sense Node UART Task
 *
 * Receives cabin status from the ESP32-S3 Sense node over UART2.
 * The Sense node sends a 3-byte frame: [0xAA] [status] [crc8]
 * plus periodic heartbeats even when status hasn't changed.
 *
 * If no heartbeat arrives for 6 seconds, the Hub treats cabin_status
 * as UNKNOWN — NOT as "keep last value". Silently freezing on stale
 * data is worse than honestly reporting "I don't know."
 */

#include <Arduino.h>
#include "packet.h"
#include "crc8.h"
#include "pins.h"

extern QueueHandle_t senseQueue;

#define SENSE_FRAME_START 0xAA
#define SENSE_FRAME_SIZE  3      // start(1) + status(1) + crc8(1)
#define SENSE_HEARTBEAT_TIMEOUT_MS 6000

static HardwareSerial senseSerial(2);  // UART2

void senseUartTask(void* pv) {
  senseSerial.begin(115200, SERIAL_8N1, PIN_SENSE_RX, PIN_SENSE_TX);
  Serial.println("[SENSE] UART initialized — listening for Sense node...");

  CabinStatusMsg msg = {};
  msg.status = CABIN_UNKNOWN;
  msg.heartbeat_valid = false;
  uint32_t lastHeartbeatMs = millis();
  uint8_t frameBuf[SENSE_FRAME_SIZE];
  uint8_t frameIdx = 0;

  while (true) {
    // Read available bytes from Sense node
    while (senseSerial.available() > 0) {
      uint8_t byte = senseSerial.read();

      if (frameIdx == 0) {
        // Waiting for frame start byte
        if (byte == SENSE_FRAME_START) {
          frameBuf[0] = byte;
          frameIdx = 1;
        }
        continue;
      }

      frameBuf[frameIdx++] = byte;

      if (frameIdx >= SENSE_FRAME_SIZE) {
        // Full frame received — validate CRC
        uint8_t status = frameBuf[1];
        uint8_t received_crc = frameBuf[2];
        uint8_t computed_crc = crc8_compute(&status, 1);

        if (received_crc == computed_crc && status <= CABIN_UNKNOWN) {
          msg.status = static_cast<CabinStatus>(status);
          msg.timestamp_ms = millis();
          msg.heartbeat_valid = true;
          lastHeartbeatMs = millis();

          xQueueOverwrite(senseQueue, &msg);
        } else {
          Serial.printf("[SENSE] Bad frame: status=0x%02X crc=0x%02X (expected 0x%02X)\n",
                        status, received_crc, computed_crc);
        }

        frameIdx = 0;
      }
    }

    // ── Heartbeat timeout detection ─────────────────────────────
    if (millis() - lastHeartbeatMs > SENSE_HEARTBEAT_TIMEOUT_MS) {
      if (msg.heartbeat_valid) {
        Serial.println("[SENSE] Heartbeat lost — marking cabin status as UNKNOWN");
        msg.status = CABIN_UNKNOWN;
        msg.heartbeat_valid = false;
        msg.timestamp_ms = millis();
        xQueueOverwrite(senseQueue, &msg);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(50));  // 20 Hz check rate
  }
}
