import { describe, it, expect } from 'vitest';
import { computeHazardLevel } from '../src/hazard-fusion.js';

describe('Hazard Fusion Rule Engine', () => {
  it('returns low hazard for normal conditions', () => {
    const result = computeHazardLevel({
      ownScore: 85,
      ownSpeed: 40,
      ownHazards: {},
      cabinStatus: 'presence_ok',
      peer: null,
    });
    expect(result.level).toBe('low');
    expect(result.reasons).toHaveLength(0);
  });

  it('returns high hazard for driver distress', () => {
    const result = computeHazardLevel({
      ownScore: 80,
      ownSpeed: 0,
      ownHazards: {},
      cabinStatus: 'possible_distress',
    });
    expect(result.level).toBe('high');
    expect(result.reasons).toContain('Cabin sensor flagged extended inactivity (possible distress)');
  });

  it('returns medium hazard for low driving score', () => {
    const result = computeHazardLevel({
      ownScore: 45,
      ownSpeed: 60,
      ownHazards: { harshBrake: true },
    });
    expect(result.level).toMatch(/medium|high/);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns high hazard for fast-closing peer', () => {
    const result = computeHazardLevel({
      ownScore: 70,
      ownSpeed: 50,
      ownHazards: {},
      peer: { vehicleId: 2, speedKmh: 60, hazards: {} },
      peerDistance: 20,
    });
    expect(result.level).toMatch(/high/);
    expect(result.reasons.some(r => r.includes('30m'))).toBe(true);
  });

  it('returns high hazard for peer harsh braking nearby', () => {
    const result = computeHazardLevel({
      ownScore: 80,
      ownSpeed: 40,
      ownHazards: {},
      peer: { vehicleId: 2, speedKmh: 10, hazards: { harshBrake: true } },
      peerDistance: 50,
    });
    expect(result.level).toMatch(/medium|high/);
    expect(result.reasons.some(r => r.includes('harsh braking'))).toBe(true);
  });

  it('always returns reasons array', () => {
    const result = computeHazardLevel({});
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(typeof result.level).toBe('string');
    expect(typeof result.score).toBe('number');
  });
});
