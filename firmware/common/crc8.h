/**
 * CRC8 — Polynomial 0x07 (x⁸ + x² + x + 1)
 *
 * Used for V2V beacon integrity checks over LoRa.
 * NOT a security mechanism — see docs/architecture.md for security posture.
 */

#ifndef CORTEXION_CRC8_H
#define CORTEXION_CRC8_H

#include <stdint.h>
#include <stddef.h>

#define CRC8_POLYNOMIAL 0x07
#define CRC8_INIT       0x00

/**
 * Compute CRC8 over a byte buffer.
 *
 * @param data  Pointer to data buffer
 * @param len   Number of bytes to process
 * @return      CRC8 checksum
 */
inline uint8_t crc8_compute(const uint8_t* data, size_t len) {
  uint8_t crc = CRC8_INIT;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t b = 0; b < 8; b++) {
      crc = (crc & 0x80)
        ? static_cast<uint8_t>((crc << 1) ^ CRC8_POLYNOMIAL)
        : static_cast<uint8_t>(crc << 1);
    }
  }
  return crc;
}

#endif // CORTEXION_CRC8_H
