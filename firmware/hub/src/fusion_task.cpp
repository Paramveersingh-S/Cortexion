/**
 * Cortexion Hub — Fusion Task
 *
 * THE central state machine. This is the ONLY task that writes to g_state.
 * All other tasks communicate with fusion exclusively through FreeRTOS queues.
 *
 * Responsibilities:
 * 1. Receive OBD, GPS, IMU, and cabin data from queues
 * 2. Compute driving events (harsh brake/accel detection)
 * 3. Update driving score (deterministic, edge-side)
 * 4. Set hazard flags
 * 5. Prepare and enqueue V2V beacon for LoRa TX
 * 6. Process received peer beacons from LoRa RX
 * 7. Generate alerts for the screen task
 *
 * Driving score logic stays deterministic on purpose — a hazard alert
 * to the other vehicle must work with zero network dependency and zero
 * latency. The learned severity model runs server-side for dashboard
 * trend analysis, where 200ms of latency doesn't matter.
 */

#include <Arduino.h>
#include <math.h>
#include "packet.h"

// External references to shared state and queues
extern struct VehicleState g_state;
extern QueueHandle_t obdQueue, gpsQueue, imuQueue, senseQueue;
extern QueueHandle_t loraTxQueue, loraRxQueue;
extern SemaphoreHandle_t stateMutex;

// ── Vehicle identity (from config) ──────────────────────────────
#ifndef VEHICLE_ID
  #define VEHICLE_ID 1
#endif

// ── Driving Event Detection ─────────────────────────────────────

static DrivingEvent detectEvent(float prevSpeed, float currSpeed, float dtSec) {
  DrivingEvent ev = {};
  if (dtSec <= 0.001f) return ev;

  ev.accel_kmh_s = (currSpeed - prevSpeed) / dtSec;
  ev.harsh_brake = ev.accel_kmh_s < HARSH_BRAKE_THRESHOLD;
  ev.harsh_accel = ev.accel_kmh_s > HARSH_ACCEL_THRESHOLD;

  return ev;
}

static uint8_t updateDrivingScore(uint8_t current, const DrivingEvent& ev) {
  int delta = 0;
  if (ev.harsh_brake) {
    delta -= 4;  // Harsh braking is the most dangerous event
  } else if (ev.harsh_accel) {
    delta -= 3;  // Aggressive acceleration is bad but less dangerous
  } else {
    delta += 1;  // Slow recovery back toward 100 during smooth driving
  }

  int newScore = (int)current + delta;
  if (newScore < 0) newScore = 0;
  if (newScore > 100) newScore = 100;
  return (uint8_t)newScore;
}

// ── Hazard Flag Computation ─────────────────────────────────────

static uint8_t computeHazardFlags(const DrivingEvent& ev, bool gpsValid) {
  uint8_t flags = 0;
  if (ev.harsh_brake) flags |= HAZARD_HARSH_BRAKE;
  if (ev.harsh_accel) flags |= HAZARD_HARSH_ACCEL;
  if (!gpsValid)      flags |= HAZARD_NO_GPS_FIX;
  // LOW_FUEL and ENGINE_FAULT would be set from OBD DTCs (future extension)
  return flags;
}

// ── Peer Distance Computation ───────────────────────────────────

static float haversineDistanceM(int32_t lat1_e6, int32_t lon1_e6,
                                  int32_t lat2_e6, int32_t lon2_e6) {
  const float R = 6371000.0f;  // Earth radius in meters
  float lat1 = lat1_e6 / 1000000.0f * M_PI / 180.0f;
  float lat2 = lat2_e6 / 1000000.0f * M_PI / 180.0f;
  float dlat = (lat2_e6 - lat1_e6) / 1000000.0f * M_PI / 180.0f;
  float dlon = (lon2_e6 - lon1_e6) / 1000000.0f * M_PI / 180.0f;

  float a = sinf(dlat / 2) * sinf(dlat / 2) +
            cosf(lat1) * cosf(lat2) * sinf(dlon / 2) * sinf(dlon / 2);
  float c = 2.0f * atan2f(sqrtf(a), sqrtf(1 - a));
  return R * c;
}

// ── Beacon Construction ─────────────────────────────────────────

static V2VBeacon buildBeacon() {
  V2VBeacon beacon = {};
  beacon.vehicle_id   = VEHICLE_ID;
  beacon.lat_e6       = g_state.lat_e6;
  beacon.lon_e6       = g_state.lon_e6;
  beacon.speed_kmh    = (uint8_t)min(255.0f, max(0.0f, g_state.speed_kmh));
  beacon.heading_div2 = (uint8_t)(fmodf(g_state.heading_deg, 360.0f) / 2.0f);
  beacon.driving_score = g_state.driving_score;
  beacon.hazard_flags  = g_state.hazard_flags;
  beacon.cabin_status  = g_state.cabin_status;
  beacon.timestamp_ms  = millis();
  beacon_seal(beacon);  // Sets proto_version and computes CRC8
  return beacon;
}

// ── Task Entry Point ────────────────────────────────────────────

void fusionTask(void* pv) {
  Serial.println("[FUSION] Starting central state machine");

  float prevSpeed = 0;
  uint32_t prevTimestamp = millis();
  uint32_t lastBeaconTime = 0;
  uint32_t beaconIntervalMs = 1000;  // 1 Hz default, 500ms when moving

  OBDReading obd = {};
  GPSFix gps = {};
  IMUReading imu = {};
  CabinStatusMsg cabin = {};
  V2VBeacon peerBeacon = {};

  while (true) {
    // ── 1. Receive data from all sensor tasks ───────────────────
    bool obdUpdated = xQueueReceive(obdQueue, &obd, 0) == pdTRUE;
    bool gpsUpdated = xQueueReceive(gpsQueue, &gps, 0) == pdTRUE;
    bool imuUpdated = xQueueReceive(imuQueue, &imu, 0) == pdTRUE;
    bool cabinUpdated = xQueueReceive(senseQueue, &cabin, 0) == pdTRUE;
    bool peerUpdated = xQueueReceive(loraRxQueue, &peerBeacon, 0) == pdTRUE;

    // ── 2. Update shared state under mutex ──────────────────────
    if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(10))) {

      // OBD data
      if (obdUpdated) {
        g_state.rpm = obd.rpm;
        g_state.speed_kmh = obd.speed_kmh;
        g_state.throttle_pct = obd.throttle_pct;
        g_state.coolant_temp_c = obd.coolant_temp_c;
        g_state.engine_load_pct = obd.engine_load_pct;
        g_state.obd_connected = true;
      }

      // GPS data
      if (gpsUpdated) {
        g_state.lat_e6 = gps.lat_e6;
        g_state.lon_e6 = gps.lon_e6;
        g_state.gps_speed_kmh = gps.speed_kmh;
        g_state.heading_deg = gps.heading_deg;
        g_state.gps_valid = gps.valid;
      }

      // IMU data
      if (imuUpdated) {
        g_state.accel_forward = imu.accel_x;
        g_state.accel_lateral = imu.accel_y;
      }

      // Cabin status
      if (cabinUpdated) {
        g_state.cabin_status = cabin.status;
        g_state.sense_last_heartbeat_ms = cabin.timestamp_ms;
      }

      // ── 3. Driving event detection ────────────────────────────
      if (obdUpdated) {
        float dt = (obd.timestamp_ms - prevTimestamp) / 1000.0f;
        DrivingEvent ev = detectEvent(prevSpeed, obd.speed_kmh, dt);

        g_state.driving_score = updateDrivingScore(g_state.driving_score, ev);
        g_state.hazard_flags = computeHazardFlags(ev, g_state.gps_valid);
        g_state.last_accel_kmh_s = ev.accel_kmh_s;

        prevSpeed = obd.speed_kmh;
        prevTimestamp = obd.timestamp_ms;

        if (ev.harsh_brake) {
          Serial.printf("[FUSION] HARSH BRAKE detected: %.1f km/h/s (score: %d)\n",
                        ev.accel_kmh_s, g_state.driving_score);
        }
      }

      // ── 4. Peer beacon processing ─────────────────────────────
      if (peerUpdated) {
        g_state.last_peer_beacon = peerBeacon;
        g_state.peer_last_seen_ms = millis();
        g_state.peer_active = true;

        // Compute distance to peer
        if (g_state.gps_valid) {
          float dist = haversineDistanceM(
            g_state.lat_e6, g_state.lon_e6,
            peerBeacon.lat_e6, peerBeacon.lon_e6
          );
          Serial.printf("[FUSION] Peer %d: %.0fm away, %d km/h, score=%d, cabin=%d\n",
                        peerBeacon.vehicle_id, dist, peerBeacon.speed_kmh,
                        peerBeacon.driving_score, peerBeacon.cabin_status);

          // Alert if peer is close and has hazard
          if (dist < 100.0f && (peerBeacon.hazard_flags & HAZARD_HARSH_BRAKE)) {
            Serial.println("[FUSION] ⚠️  NEARBY VEHICLE BRAKING HARD");
          }
        }
      }

      // Check for peer timeout (3 missed intervals ≈ 3s)
      if (g_state.peer_active && millis() - g_state.peer_last_seen_ms > 3000) {
        Serial.println("[FUSION] Peer signal lost");
        g_state.peer_active = false;
      }

      g_state.uptime_ms = millis();
      xSemaphoreGive(stateMutex);
    }

    // ── 5. Prepare and send V2V beacon ──────────────────────────
    beaconIntervalMs = (g_state.speed_kmh > 5.0f) ? 500 : 1000;

    if (millis() - lastBeaconTime >= beaconIntervalMs) {
      V2VBeacon beacon = buildBeacon();
      xQueueOverwrite(loraTxQueue, &beacon);
      lastBeaconTime = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(50));  // 20 Hz fusion loop
  }
}
