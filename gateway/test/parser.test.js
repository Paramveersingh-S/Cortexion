import { describe, it, expect } from 'vitest';
import { parseBeacon, serializeBeacon, BEACON_SIZE } from '../src/parser.js';
import { crc8 } from '../src/crc8.js';

describe('CRC8', () => {
  it('computes correct CRC for known input', () => {
    const data = Buffer.from([0x01, 0x02, 0x03]);
    expect(crc8(data)).toBe(0x48);
  });

  it('returns 0 for empty input', () => {
    expect(crc8(Buffer.alloc(0))).toBe(0);
  });

  it('handles single byte', () => {
    expect(crc8(Buffer.from([0xFF]))).toBeDefined();
    expect(typeof crc8(Buffer.from([0xFF]))).toBe('number');
  });
});

describe('parseBeacon', () => {
  const validBeacon = {
    vehicleId: 1,
    lat: 28.6139,
    lon: 77.2090,
    speedKmh: 45,
    headingDeg: 180,
    drivingScore: 85,
    hazardFlags: 0,
    cabinStatusCode: 1,
    timestampMs: 123456,
  };

  it('roundtrips a valid beacon', () => {
    const buf = serializeBeacon(validBeacon);
    expect(buf.length).toBe(BEACON_SIZE);

    const parsed = parseBeacon(buf);
    expect(parsed.error).toBeUndefined();
    expect(parsed.vehicleId).toBe(1);
    expect(parsed.lat).toBeCloseTo(28.6139, 4);
    expect(parsed.lon).toBeCloseTo(77.2090, 4);
    expect(parsed.speedKmh).toBe(45);
    expect(parsed.headingDeg).toBe(180);
    expect(parsed.drivingScore).toBe(85);
    expect(parsed.cabinStatus).toBe('presence_ok');
  });

  it('rejects beacon with bad CRC', () => {
    const buf = serializeBeacon(validBeacon);
    buf[20] = 0xFF;  // Corrupt CRC
    const parsed = parseBeacon(buf);
    expect(parsed.error).toBe('crc_mismatch');
  });

  it('rejects beacon with unknown proto version', () => {
    const buf = serializeBeacon(validBeacon);
    buf[0] = 0xFF;  // Bad version
    buf[20] = crc8(buf.subarray(0, 20));  // Fix CRC for the new content
    const parsed = parseBeacon(buf);
    expect(parsed.error).toBe('unknown_version');
  });

  it('rejects undersized buffer', () => {
    const parsed = parseBeacon(Buffer.alloc(10));
    expect(parsed).toBeNull();
  });

  it('decodes hazard flags correctly', () => {
    const beacon = { ...validBeacon, hazardFlags: 0x03 };  // harsh_brake + harsh_accel
    const buf = serializeBeacon(beacon);
    const parsed = parseBeacon(buf);
    expect(parsed.hazards.harshBrake).toBe(true);
    expect(parsed.hazards.harshAccel).toBe(true);
    expect(parsed.hazards.lowFuel).toBe(false);
  });

  it('handles Delhi coordinates (Indian use case)', () => {
    const beacon = { ...validBeacon, lat: 28.7041, lon: 77.1025 };
    const buf = serializeBeacon(beacon);
    const parsed = parseBeacon(buf);
    expect(parsed.lat).toBeCloseTo(28.7041, 4);
    expect(parsed.lon).toBeCloseTo(77.1025, 4);
  });
});
