/**
 * Cortexion Backend — Congestion Estimator
 *
 * Exponentially-weighted moving average (EWMA) per road segment.
 * DELIBERATELY NOT ML — with 2 demo vehicles, there are nowhere
 * near enough independent samples per road segment to fit anything.
 *
 * An EWMA that decays old observations handles the temporal aspect
 * (traffic changes over minutes) and is the standard tool for
 * streaming, low-volume estimation.
 */

const DEFAULT_HALF_LIFE_S = 120;  // 2 minutes
const DEFAULT_FREE_FLOW_KMH = 50; // Assumed free-flow speed for urban roads

export class CongestionEstimator {
  constructor(halfLifeS = DEFAULT_HALF_LIFE_S) {
    this.decay = Math.log(2) / halfLifeS;
    this.segments = new Map();
  }

  /**
   * Update a segment with a new speed observation.
   * @param {string} segmentId - Road segment identifier
   * @param {number} speedKmh - Observed speed
   * @param {number} [now] - Timestamp in seconds (defaults to Date.now()/1000)
   * @returns {number} Updated mean speed estimate
   */
  update(segmentId, speedKmh, now = Date.now() / 1000) {
    let seg = this.segments.get(segmentId);

    if (!seg) {
      seg = { mean: speedKmh, lastUpdate: now, sampleCount: 1 };
      this.segments.set(segmentId, seg);
      return speedKmh;
    }

    const dt = now - seg.lastUpdate;
    const w = Math.exp(-this.decay * dt);
    seg.mean = w * seg.mean + (1 - w) * speedKmh;
    seg.lastUpdate = now;
    seg.sampleCount++;

    return seg.mean;
  }

  /**
   * Get the congestion level for a segment.
   * @param {string} segmentId
   * @param {number} [freeFlowKmh] - Expected free-flow speed
   * @returns {{ level: string, ratio: number, meanSpeed: number, sampleCount: number }}
   */
  getLevel(segmentId, freeFlowKmh = DEFAULT_FREE_FLOW_KMH) {
    const seg = this.segments.get(segmentId);

    if (!seg) {
      return { level: 'unknown', ratio: null, meanSpeed: null, sampleCount: 0 };
    }

    const ratio = seg.mean / freeFlowKmh;
    let level;
    if (ratio > 0.8) level = 'clear';
    else if (ratio > 0.5) level = 'moderate';
    else level = 'congested';

    return {
      level,
      ratio: Math.round(ratio * 100) / 100,
      meanSpeed: Math.round(seg.mean * 10) / 10,
      sampleCount: seg.sampleCount,
    };
  }

  /**
   * Get all segments with their congestion levels.
   */
  getAllSegments(freeFlowKmh = DEFAULT_FREE_FLOW_KMH) {
    const result = {};
    for (const [id, _] of this.segments) {
      result[id] = this.getLevel(id, freeFlowKmh);
    }
    return result;
  }
}

/**
 * Compute a segment ID from lat/lon coordinates.
 * ~100m × 100m grid cells, matching firmware/common/segment.h.
 */
export function computeSegmentId(lat, lon) {
  const latCell = Math.floor(lat * 1000);
  const lonCell = Math.floor(lon * 1000);
  return `${latCell}:${lonCell}`;
}
