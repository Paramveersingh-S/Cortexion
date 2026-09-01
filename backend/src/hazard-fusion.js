/**
 * Cortexion Backend — Hazard Fusion Rule Engine
 *
 * Combines own-vehicle risk, peer V2V telemetry, and cabin status
 * into a single hazard level with transparent, auditable reasoning.
 *
 * DELIBERATELY NOT an ML model. There is no ethical way to collect
 * labeled real near-collision data for this project, and a black-box
 * model making safety-adjacent calls with no ground truth is worse
 * engineering than a rule set you can point to and explain.
 *
 * Returning `reasons` alongside the level isn't decoration — when a
 * judge asks "why did it say high hazard," you answer from the log.
 */

/**
 * @param {Object} params
 * @param {number} params.ownScore - Own vehicle driving score (0-100)
 * @param {number} params.ownSpeed - Own vehicle speed in km/h
 * @param {Object} params.ownHazards - Own hazard flags
 * @param {string} params.cabinStatus - Cabin status string
 * @param {Object|null} params.peer - Peer beacon data (null if no peer)
 * @param {number} params.peerDistance - Distance to peer in meters
 * @returns {{ level: string, score: number, reasons: string[] }}
 */
export function computeHazardLevel({
  ownScore = 80,
  ownSpeed = 0,
  ownHazards = {},
  cabinStatus = 'none',
  peer = null,
  peerDistance = Infinity,
}) {
  let score = 0;
  const reasons = [];

  // ── Own vehicle assessment ────────────────────────────────────
  if (ownScore < 40) {
    score += 3;
    reasons.push(`Own driving score critically low (${ownScore})`);
  } else if (ownScore < 60) {
    score += 2;
    reasons.push(`Own driving score below threshold (${ownScore})`);
  }

  if (ownHazards.harshBrake) {
    score += 2;
    reasons.push('Own vehicle harsh braking detected');
  }

  if (ownHazards.harshAccel) {
    score += 1;
    reasons.push('Own vehicle harsh acceleration detected');
  }

  if (ownSpeed > 80) {
    score += 1;
    reasons.push(`High speed (${ownSpeed} km/h)`);
  }

  // ── Cabin assessment ──────────────────────────────────────────
  if (cabinStatus === 'possible_distress') {
    score += 6;
    reasons.push('Cabin sensor flagged extended inactivity (possible distress)');
  } else if (cabinStatus === 'no_movement') {
    score += 1;
    reasons.push('No driver movement detected for 45+ seconds');
  }

  // ── Peer vehicle assessment ───────────────────────────────────
  if (peer) {
    const peerClosingSpeed = ownSpeed + (peer.speedKmh || 0);

    if (peerDistance < 30 && peerClosingSpeed > 40) {
      score += 6;
      reasons.push(`Fast-closing vehicle within 30m (${Math.round(peerDistance)}m, ${peerClosingSpeed} km/h closing)`);
    } else if (peerDistance < 100 && peerClosingSpeed > 20) {
      score += 2;
      reasons.push(`Vehicle approaching within 100m (${Math.round(peerDistance)}m)`);
    }

    if (peer.hazards?.harshBrake) {
      score += 3;
      reasons.push(`Peer vehicle (V${peer.vehicleId}) harsh braking`);
    }

    if (peer.cabinStatus === 'possible_distress') {
      score += 2;
      reasons.push(`Peer vehicle (V${peer.vehicleId}) driver may be in distress`);
    }

    if (peer.drivingScore < 40) {
      score += 1;
      reasons.push(`Peer vehicle (V${peer.vehicleId}) driving score critically low`);
    }
  }

  // ── Compute final level ───────────────────────────────────────
  let level;
  if (score >= 6) level = 'high';
  else if (score >= 3) level = 'medium';
  else level = 'low';

  return { level, score, reasons };
}

/**
 * Feeds recent telemetry into the ML Event Severity Model to refine
 * hazard evaluation based on context, reducing false positives from sensor noise.
 */
import { score as predictSeverity } from './severity-model.js';

export function evaluateMLSeverity(speedHistoryKmh) {
    if (!speedHistoryKmh || speedHistoryKmh.length < 5) return null;
    
    // Calculate basic features from the last 5 seconds (assuming ~1Hz beacons)
    const speeds = speedHistoryKmh.slice(-5);
    const dt = 1.0; // Assume 1s intervals for simplicity in this demo integration
    
    const accel1 = (speeds[1] - speeds[0]) / dt;
    const accel2 = (speeds[2] - speeds[1]) / dt;
    const accel3 = (speeds[3] - speeds[2]) / dt;
    const accel4 = (speeds[4] - speeds[3]) / dt;
    
    const jerk = (accel4 - accel3) / dt;
    
    const accels = [accel1, accel2, accel3, accel4];
    const accelMean = accels.reduce((a,b)=>a+b, 0) / 4;
    const accelVar = accels.reduce((a,b)=>a + Math.pow(b - accelMean, 2), 0) / 4;
    const accelRollStd = Math.sqrt(accelVar);
    
    const speedMean = speeds.reduce((a,b)=>a+b, 0) / 5;
    
    // Input format: [accel_kmh_s, jerk, rpm_delta, throttle_delta, accel_roll_std, speed_roll_mean]
    // RPM/Throttle omitted in this basic integration as they aren't always available over LoRa
    const input = [accel4, jerk, 0, 0, accelRollStd, speedMean];
    
    const [probNormal, probHarsh] = predictSeverity(input);
    return { probHarsh, isHarsh: probHarsh > 0.5, features: { accel: accel4, jerk, accelRollStd } };
}
