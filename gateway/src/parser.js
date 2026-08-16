/**
 * Cortexion Gateway — Beacon Parser
 *
 * Parses raw 21-byte V2VBeacon binary packets into JSON objects.
 * Matches the wire protocol defined in firmware/common/packet.h
 * and documented in docs/wire-protocol.md.
 */

import { crc8 } from './crc8.js';

export const BEACON_SIZE = 21;
export const PROTO_VERSION = 0x01;

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

  // CRC validation
  const computedCrc = crc8(buf.subarray(0, 20));
  const receivedCrc = buf[20];
  if (computedCrc !== receivedCrc) {
    return { error: 'crc_mismatch', computed: computedCrc, received: receivedCrc };
  }

  // Proto version check
  const protoVersion = buf.readUInt8(0);
  if (protoVersion !== PROTO_VERSION) {
    return { error: 'unknown_version', version: protoVersion };
  }

  // Parse fields
  const hazardFlags = buf.readUInt8(14);

  return {
    protoVersion,
    vehicleId: buf.readUInt16LE(1),
    lat: buf.readInt32LE(3) / 1e6,
    lon: buf.readInt32LE(7) / 1e6,
    speedKmh: buf.readUInt8(11),
    headingDeg: buf.readUInt8(12) * 2,
    drivingScore: buf.readUInt8(13),
    hazardFlags,
    hazards: {
      harshBrake: !!(hazardFlags & HAZARD_FLAGS.HARSH_BRAKE),
      harshAccel: !!(hazardFlags & HAZARD_FLAGS.HARSH_ACCEL),
      lowFuel: !!(hazardFlags & HAZARD_FLAGS.LOW_FUEL),
      engineFault: !!(hazardFlags & HAZARD_FLAGS.ENGINE_FAULT),
      noGpsFix: !!(hazardFlags & HAZARD_FLAGS.NO_GPS_FIX),
    },
    cabinStatus: CABIN_STATUS[buf.readUInt8(15)] || 'unknown',
    cabinStatusCode: buf.readUInt8(15),
    timestampMs: buf.readUInt32LE(16),
    receivedAt: new Date().toISOString(),
  };
}

/**
 * Serialize a beacon object back to a 21-byte buffer.
 * Useful for testing and the simulator.
 */
export function serializeBeacon(beacon) {
  const buf = Buffer.alloc(BEACON_SIZE);
  buf.writeUInt8(PROTO_VERSION, 0);
  buf.writeUInt16LE(beacon.vehicleId || 1, 1);
  buf.writeInt32LE(Math.round((beacon.lat || 0) * 1e6), 3);
  buf.writeInt32LE(Math.round((beacon.lon || 0) * 1e6), 7);
  buf.writeUInt8(Math.min(255, Math.max(0, beacon.speedKmh || 0)), 11);
  buf.writeUInt8(Math.floor((beacon.headingDeg || 0) / 2), 12);
  buf.writeUInt8(Math.min(100, Math.max(0, beacon.drivingScore || 80)), 13);
  buf.writeUInt8(beacon.hazardFlags || 0, 14);
  buf.writeUInt8(beacon.cabinStatusCode || 0, 15);
  buf.writeUInt32LE(beacon.timestampMs || Date.now(), 16);
  buf.writeUInt8(crc8(buf.subarray(0, 20)), 20);
  return buf;
}
