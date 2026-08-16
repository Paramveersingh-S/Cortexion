/**
 * Cortexion — V2V Beacon Wire Protocol
 *
 * 21-byte compact binary packet for LoRa V2V broadcast.
 * Fixed-point coordinates, CRC8 integrity, version-tagged.
 *
 * See docs/wire-protocol.md for the full specification.
 */

#ifndef CORTEXION_PACKET_H
#define CORTEXION_PACKET_H

#include <stdint.h>
#include <stddef.h>
#include "crc8.h"

// ── Protocol Version ────────────────────────────────────────────
#define CORTEXION_PROTO_VERSION 0x01

// ── Hazard Flag Bitfield ────────────────────────────────────────
#define HAZARD_HARSH_BRAKE    (1 << 0)
#define HAZARD_HARSH_ACCEL    (1 << 1)
#define HAZARD_LOW_FUEL       (1 << 2)
#define HAZARD_ENGINE_FAULT   (1 << 3)
#define HAZARD_NO_GPS_FIX     (1 << 4)

// ── Cabin Status Enum ───────────────────────────────────────────
enum CabinStatus : uint8_t {
  CABIN_NONE             = 0,  // No cabin sensing / node offline
  CABIN_PRESENCE_OK      = 1,  // Driver present, normal activity
  CABIN_NO_MOVEMENT      = 2,  // No movement for 45+ seconds
  CABIN_POSSIBLE_DISTRESS = 3, // Extended inactivity + abnormal pattern
  CABIN_UNKNOWN          = 4   // Sense node heartbeat lost (6s+ timeout)
};

// ── V2V Beacon Packet ───────────────────────────────────────────
#pragma pack(push, 1)
struct V2VBeacon {
  uint8_t   proto_version;   // Always CORTEXION_PROTO_VERSION
  uint16_t  vehicle_id;      // Unique vehicle identifier
  int32_t   lat_e6;          // Latitude × 1,000,000 (fixed-point)
  int32_t   lon_e6;          // Longitude × 1,000,000 (fixed-point)
  uint8_t   speed_kmh;       // 0–255 km/h
  uint8_t   heading_div2;    // Actual degrees / 2 (0–180 → 0°–360°)
  uint8_t   driving_score;   // 0–100
  uint8_t   hazard_flags;    // Bitfield: see HAZARD_* defines
  uint8_t   cabin_status;    // CabinStatus enum
  uint32_t  timestamp_ms;    // millis() at TX time
  uint8_t   crc8;            // CRC8 over bytes 0–19
};
#pragma pack(pop)

// Compile-time size check — catches accidental struct growth immediately
static_assert(sizeof(V2VBeacon) == 21, "V2VBeacon size changed — check wire protocol");

// ── Beacon Utilities ────────────────────────────────────────────

/**
 * Compute and set the CRC8 field on a beacon before transmission.
 */
inline void beacon_seal(V2VBeacon& beacon) {
  beacon.proto_version = CORTEXION_PROTO_VERSION;
  beacon.crc8 = crc8_compute(reinterpret_cast<const uint8_t*>(&beacon),
                              sizeof(V2VBeacon) - 1);
}

/**
 * Validate a received beacon's CRC8 and proto_version.
 * Returns true if the beacon is valid and should be processed.
 */
inline bool beacon_validate(const V2VBeacon& beacon) {
  if (beacon.proto_version != CORTEXION_PROTO_VERSION) return false;
  uint8_t expected = crc8_compute(reinterpret_cast<const uint8_t*>(&beacon),
                                   sizeof(V2VBeacon) - 1);
  return beacon.crc8 == expected;
}

/**
 * Decode fixed-point lat/lon to double.
 */
inline double beacon_lat(const V2VBeacon& b) { return b.lat_e6 / 1000000.0; }
inline double beacon_lon(const V2VBeacon& b) { return b.lon_e6 / 1000000.0; }

/**
 * Decode heading from div2 encoding.
 */
inline uint16_t beacon_heading_deg(const V2VBeacon& b) { return (uint16_t)b.heading_div2 * 2; }

// ── Internal Data Structures (inter-task queues) ────────────────

struct OBDReading {
  float    rpm;
  float    speed_kmh;
  float    throttle_pct;
  float    coolant_temp_c;
  float    engine_load_pct;
  uint32_t timestamp_ms;
};

struct GPSFix {
  int32_t  lat_e6;
  int32_t  lon_e6;
  float    speed_kmh;
  float    heading_deg;
  bool     valid;
  uint32_t timestamp_ms;
};

struct IMUReading {
  float    accel_x;      // m/s² — forward axis
  float    accel_y;      // m/s² — lateral axis
  float    accel_z;      // m/s² — vertical axis
  float    gyro_z;       // rad/s — yaw rate
  uint32_t timestamp_ms;
};

struct CabinStatusMsg {
  CabinStatus status;
  uint32_t    timestamp_ms;
  bool        heartbeat_valid;  // false if sense node heartbeat timed out
};

// ── Driving Event Detection ─────────────────────────────────────

struct DrivingEvent {
  bool  harsh_brake;
  bool  harsh_accel;
  float accel_kmh_s;    // Acceleration in km/h per second
  float jerk;           // Rate of change of acceleration
};

// Thresholds — calibrated from bench logs, not arbitrary
// -12 km/h/s ≈ -0.34g braking; 10 km/h/s ≈ 0.28g acceleration
#define HARSH_BRAKE_THRESHOLD  -12.0f
#define HARSH_ACCEL_THRESHOLD   10.0f

#endif // CORTEXION_PACKET_H
