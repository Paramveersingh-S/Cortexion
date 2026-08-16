/**
 * Cortexion — Road Segment ID Computation
 *
 * Generates a deterministic segment ID from lat/lon coordinates
 * using a simplified geohash-style quantization. This assigns
 * nearby coordinates to the same segment for congestion estimation.
 *
 * Resolution: ~100m × 100m grid cells at mid-latitudes.
 * This is intentionally coarse — congestion is a road-segment-level
 * phenomenon, not a point-level one.
 */

#ifndef CORTEXION_SEGMENT_H
#define CORTEXION_SEGMENT_H

#include <stdint.h>

// Grid resolution in degrees (~111m per 0.001° latitude)
#define SEGMENT_RESOLUTION  0.001

/**
 * Compute a 32-bit segment ID from fixed-point lat/lon.
 *
 * @param lat_e6  Latitude × 1,000,000
 * @param lon_e6  Longitude × 1,000,000
 * @return        32-bit segment identifier (upper 16 = lat cell, lower 16 = lon cell)
 */
inline uint32_t compute_segment_id(int32_t lat_e6, int32_t lon_e6) {
  // Quantize to ~100m grid cells
  // 0.001° ≈ 111m latitude, varies for longitude but close enough for this application
  int16_t lat_cell = static_cast<int16_t>(lat_e6 / 1000);  // 0.001° resolution
  int16_t lon_cell = static_cast<int16_t>(lon_e6 / 1000);

  return (static_cast<uint32_t>(static_cast<uint16_t>(lat_cell)) << 16) |
          static_cast<uint32_t>(static_cast<uint16_t>(lon_cell));
}

/**
 * Format segment ID as a human-readable string for logging/display.
 * Returns a static buffer — not thread-safe, use only for debug output.
 */
inline const char* segment_id_str(uint32_t segment_id) {
  static char buf[16];
  int16_t lat_cell = static_cast<int16_t>(segment_id >> 16);
  int16_t lon_cell = static_cast<int16_t>(segment_id & 0xFFFF);
  snprintf(buf, sizeof(buf), "%d:%d", lat_cell, lon_cell);
  return buf;
}

#endif // CORTEXION_SEGMENT_H
