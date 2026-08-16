/**
 * Cortexion Gateway — CRC8 (JavaScript)
 *
 * Must produce identical output to firmware/common/crc8.h.
 * Polynomial 0x07, initial value 0x00.
 */

export function crc8(buf) {
  let crc = 0x00;
  for (const byte of buf) {
    crc ^= byte;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x80)
        ? ((crc << 1) ^ 0x07) & 0xFF
        : (crc << 1) & 0xFF;
    }
  }
  return crc;
}
