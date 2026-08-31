/**
 * Cortexion Gateway — Beacon Parser
 *
 * Parses raw 21-byte V2VBeacon binary packets into JSON objects.
 * Matches the wire protocol defined in firmware/common/packet.h
 * and documented in docs/wire-protocol.md.
 */

import crypto from 'crypto';
import { crc8 } from './crc8.js';

export const BEACON_SIZE = 29; // 8-byte nonce + 21-byte payload
export const PAYLOAD_SIZE = 21;
export const PROTO_VERSION = 0x01;

// 16-byte PSK matching firmware/common/config_template.h
const LORA_AES_KEY = Buffer.from([
  0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
  0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c
]);

export const HAZARD_FLAGS = {
  HARSH_BRAKE:   0x01,
  HARSH_ACCEL:   0x02,
  LOW_FUEL:      0x04,
  ENGINE_FAULT:  0x08,
  NO_GPS_FIX:    0x10,
};

export const CABIN_STATUS = {
  0: 'none',
  1: 'presence_ok',
  2: 'no_movement',
  3: 'possible_distress',
  4: 'unknown',
};

/**
 * Parse a 21-byte buffer into a beacon object.
 * Returns null if CRC check fails or proto_version is unknown.
 */
export function parseBeacon(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < BEACON_SIZE) {
    return null;
  }

  // ── AES-128-CTR Decryption ─────────────────────
  const nonce = buf.subarray(0, 8);
  const encryptedPayload = buf.subarray(8, 29);
  
  const iv = Buffer.alloc(16, 0);
  nonce.copy(iv, 0, 0, 8);
  
  const decipher = crypto.createDecipheriv('aes-128-ctr', LORA_AES_KEY, iv);
  const decryptedPayload = Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);

  // CRC validation
  const computedCrc = crc8(decryptedPayload.subarray(0, 20));
  const receivedCrc = decryptedPayload[20];
  if (computedCrc !== receivedCrc) {
    return { error: 'crc_mismatch', computed: computedCrc, received: receivedCrc };
  }

  // Proto version check
  const protoVersion = decryptedPayload.readUInt8(0);
  if (protoVersion !== PROTO_VERSION) {
    return { error: 'unknown_version', version: protoVersion };
  }

  // Parse fields
  const hazardFlags = decryptedPayload.readUInt8(14);

  return {
    protoVersion,
    vehicleId: decryptedPayload.readUInt16LE(1),
    lat: decryptedPayload.readInt32LE(3) / 1e6,
    lon: decryptedPayload.readInt32LE(7) / 1e6,
    speedKmh: decryptedPayload.readUInt8(11),
    headingDeg: decryptedPayload.readUInt8(12) * 2,
    drivingScore: decryptedPayload.readUInt8(13),
    hazardFlags,
    hazards: {
      harshBrake: !!(hazardFlags & HAZARD_FLAGS.HARSH_BRAKE),
      harshAccel: !!(hazardFlags & HAZARD_FLAGS.HARSH_ACCEL),
      lowFuel: !!(hazardFlags & HAZARD_FLAGS.LOW_FUEL),
      engineFault: !!(hazardFlags & HAZARD_FLAGS.ENGINE_FAULT),
      noGpsFix: !!(hazardFlags & HAZARD_FLAGS.NO_GPS_FIX),
    },
    cabinStatus: CABIN_STATUS[decryptedPayload.readUInt8(15)] || 'unknown',
    cabinStatusCode: decryptedPayload.readUInt8(15),
    timestampMs: decryptedPayload.readUInt32LE(16),
    receivedAt: new Date().toISOString(),
  };
}

/**
 * Serialize a beacon object back to a 21-byte buffer.
 * Useful for testing and the simulator.
 */
export function serializeBeacon(beacon) {
  const payload = Buffer.alloc(PAYLOAD_SIZE);
  payload.writeUInt8(PROTO_VERSION, 0);
  payload.writeUInt16LE(beacon.vehicleId || 1, 1);
  payload.writeInt32LE(Math.round((beacon.lat || 0) * 1e6), 3);
  payload.writeInt32LE(Math.round((beacon.lon || 0) * 1e6), 7);
  payload.writeUInt8(Math.min(255, Math.max(0, beacon.speedKmh || 0)), 11);
  payload.writeUInt8(Math.floor((beacon.headingDeg || 0) / 2), 12);
  payload.writeUInt8(Math.min(100, Math.max(0, beacon.drivingScore || 80)), 13);
  payload.writeUInt8(beacon.hazardFlags || 0, 14);
  payload.writeUInt8(beacon.cabinStatusCode || 0, 15);
  payload.writeUInt32LE(beacon.timestampMs || Date.now(), 16);
  payload.writeUInt8(crc8(payload.subarray(0, 20)), 20);

  const nonce = crypto.randomBytes(8);
  const iv = Buffer.alloc(16, 0);
  nonce.copy(iv, 0, 0, 8);

  const cipher = crypto.createCipheriv('aes-128-ctr', LORA_AES_KEY, iv);
  const encryptedPayload = Buffer.concat([cipher.update(payload), cipher.final()]);

  return Buffer.concat([nonce, encryptedPayload]);
}
