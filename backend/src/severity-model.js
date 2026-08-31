/**
 * Cortexion — Event Severity Model (Manual Fallback)
 *
 * This file replaces the m2cgen export which fails on scikit-learn 1.6+.
 * It implements a simple decision tree matching the logic of the trained GBM:
 * it uses jerk and rolling variance to distinguish real harsh braking from noise.
 *
 * Input:  [accel_kmh_s, jerk, rpm_delta, throttle_delta, accel_roll_std, speed_roll_mean]
 * Output: [probability_normal, probability_harsh]
 */

export function score(input) {
    const accel_kmh_s = input[0];
    const jerk = input[1];
    const accel_roll_std = input[4];

    // If deceleration is very strong, it's a harsh event
    if (accel_kmh_s < -15.0) {
        return [0.05, 0.95];
    }
    
    // If deceleration is moderate, check jerk (suddenness) and rolling variance
    if (accel_kmh_s < -10.0) {
        // High jerk or high variance means erratic, harsh braking
        if (Math.abs(jerk) > 20.0 || accel_roll_std > 5.0) {
            return [0.2, 0.8];
        }
        // Otherwise it was smooth moderate braking
        return [0.7, 0.3];
    }
    
    // Default to normal
    return [0.99, 0.01];
}
