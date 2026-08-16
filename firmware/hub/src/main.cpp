/**
 * Cortexion Hub — Main Entry Point
 *
 * Initializes FreeRTOS queues, semaphores, and spawns 7 tasks across
 * the ESP32's dual cores. After setup(), loop() is deleted — all real
 * work happens in the pinned tasks.
 *
 * Core 0: WiFi stack + OBD polling + GPS + Sense UART + IMU
 * Core 1: Fusion (highest priority) + LoRa TX/RX + Screen
 *
 * Critical invariant: ONLY fusionTask writes to g_state.
 * All other tasks communicate exclusively via FreeRTOS queues.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <SPI.h>
#include <LoRa.h>
#include <TinyGPSPlus.h>
#include "packet.h"
#include "pins.h"

// ── Forward declarations for task functions ─────────────────────
void obdTask(void* pv);
void gpsTask(void* pv);
void imuTask(void* pv);
void senseUartTask(void* pv);
void fusionTask(void* pv);
void loraTxTask(void* pv);
void loraRxTask(void* pv);
void screenTask(void* pv);

// ── Global FreeRTOS primitives ──────────────────────────────────
QueueHandle_t obdQueue;
QueueHandle_t gpsQueue;
QueueHandle_t imuQueue;
QueueHandle_t senseQueue;
QueueHandle_t loraTxQueue;
QueueHandle_t loraRxQueue;
SemaphoreHandle_t stateMutex;
SemaphoreHandle_t spiBusMutex;

// ── Shared vehicle state (written ONLY by fusionTask) ───────────
struct VehicleState {
  // OBD
  float    rpm;
  float    speed_kmh;
  float    throttle_pct;
  float    coolant_temp_c;
  float    engine_load_pct;
  bool     obd_connected;

  // GPS
  int32_t  lat_e6;
  int32_t  lon_e6;
  float    gps_speed_kmh;
  float    heading_deg;
  bool     gps_valid;

  // IMU
  float    accel_forward;
  float    accel_lateral;

  // Driving analysis
  uint8_t  driving_score;
  uint8_t  hazard_flags;
  float    last_accel_kmh_s;

  // Cabin sensing
  CabinStatus cabin_status;
  uint32_t    sense_last_heartbeat_ms;

  // Peer tracking
  V2VBeacon  last_peer_beacon;
  uint32_t   peer_last_seen_ms;
  bool       peer_active;

  // System
  uint32_t uptime_ms;
};

VehicleState g_state = {};

void setup() {
  Serial.begin(115200);
  Serial.println(F("\n╔═══════════════════════════════════════╗"));
  Serial.println(F("║   CORTEXION — Vehicle Intelligence    ║"));
  Serial.println(F("║   Hub Controller v1.0.0               ║"));
  Serial.println(F("╚═══════════════════════════════════════╝"));

  // Initialize state
  g_state.driving_score = 80;  // Start at 80, not 100 — avoids false "perfect" display
  g_state.cabin_status = CABIN_UNKNOWN;

  // Create FreeRTOS queues
  obdQueue    = xQueueCreate(4, sizeof(OBDReading));
  gpsQueue    = xQueueCreate(4, sizeof(GPSFix));
  imuQueue    = xQueueCreate(8, sizeof(IMUReading));
  senseQueue  = xQueueCreate(4, sizeof(CabinStatusMsg));
  loraTxQueue = xQueueCreate(4, sizeof(V2VBeacon));
  loraRxQueue = xQueueCreate(8, sizeof(V2VBeacon));

  // Create mutexes
  stateMutex  = xSemaphoreCreateMutex();
  spiBusMutex = xSemaphoreCreateMutex();

  if (!obdQueue || !gpsQueue || !imuQueue || !senseQueue ||
      !loraTxQueue || !loraRxQueue || !stateMutex || !spiBusMutex) {
    Serial.println(F("[FATAL] Failed to create FreeRTOS primitives"));
    while (true) { delay(1000); }
  }

  // ── Pin WiFi/OBD-heavy work to Core 0 (alongside WiFi stack) ──
  xTaskCreatePinnedToCore(obdTask,       "obd",    4096, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(gpsTask,       "gps",    2048, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(imuTask,       "imu",    2048, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(senseUartTask, "sense",  2048, NULL, 1, NULL, 0);

  // ── Pin latency-sensitive LoRa/screen work to Core 1 ──────────
  xTaskCreatePinnedToCore(fusionTask,    "fusion", 8192, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(loraTxTask,    "loraTx", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(loraRxTask,    "loraRx", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(screenTask,    "screen", 4096, NULL, 1, NULL, 1);

  Serial.println(F("[INIT] All tasks started — Hub operational"));
}

void loop() {
  // All real work happens in FreeRTOS tasks above.
  // Delete the Arduino loop task to free its stack.
  vTaskDelete(NULL);
}
