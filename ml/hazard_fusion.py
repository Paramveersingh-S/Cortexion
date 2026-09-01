"""
Cortexion ML — Hazard Fusion Rule Engine (Python reference)

Transparent, auditable rule engine combining own-vehicle risk, peer
V2V telemetry, and cabin status into a single hazard level.

This is the Python reference implementation. The production version
runs in JavaScript (backend/src/hazard-fusion.js) for zero-latency
inline execution.

DELIBERATELY NOT an end-to-end model. See docs/ml-design.md for why.
"""


def compute_hazard_level(
    own_score: int = 80,
    own_speed: float = 0,
    own_harsh_brake: bool = False,
    own_harsh_accel: bool = False,
    cabin_status: str = 'none',
    peer_closing_speed_kmh: float = 0,
    peer_distance_m: float = float('inf'),
    peer_harsh_brake: bool = False,
    peer_cabin_status: str = 'none',
    peer_driving_score: int = 80,
) -> tuple[str, int, list[str]]:
    """
    Compute hazard level with transparent reasoning.

    Returns:
        (level, score, reasons) where level ∈ {'low', 'medium', 'high'}
        and reasons is a list of human-readable strings explaining the score.
    """
    score = 0
    reasons: list[str] = []

    # Own vehicle assessment
    if own_score < 40:
        score += 3
        reasons.append(f'Own driving score critically low ({own_score})')
    elif own_score < 60:
        score += 2
        reasons.append(f'Own driving score below threshold ({own_score})')

    if own_harsh_brake:
        score += 2
        reasons.append('Own vehicle harsh braking detected')

    if own_harsh_accel:
        score += 1
        reasons.append('Own vehicle harsh acceleration detected')

    if own_speed > 80:
        score += 1
        reasons.append(f'High speed ({own_speed} km/h)')

    # Cabin assessment
    if cabin_status == 'possible_distress':
        score += 6
        reasons.append('Cabin sensor flagged extended inactivity (possible distress)')
    elif cabin_status == 'no_movement':
        score += 1
        reasons.append('No driver movement detected for 45+ seconds')

    # Peer vehicle assessment
    if peer_distance_m < 30 and peer_closing_speed_kmh > 40:
        score += 6
        reasons.append(f'Fast-closing vehicle within 30m ({peer_distance_m:.0f}m, '
                        f'{peer_closing_speed_kmh} km/h closing)')
    elif peer_distance_m < 100 and peer_closing_speed_kmh > 20:
        score += 2
        reasons.append(f'Vehicle approaching within 100m ({peer_distance_m:.0f}m)')

    if peer_harsh_brake:
        score += 3
        reasons.append('Peer vehicle harsh braking')

    if peer_cabin_status == 'possible_distress':
        score += 2
        reasons.append('Peer vehicle driver may be in distress')

    if peer_driving_score < 40:
        score += 1
        reasons.append('Peer vehicle driving score critically low')

    # Final level
    if score >= 6:
        level = 'high'
    elif score >= 3:
        level = 'medium'
    else:
        level = 'low'

    return level, score, reasons


if __name__ == '__main__':
    # Example: peer braking hard nearby
    level, score, reasons = compute_hazard_level(
        own_score=75,
        own_speed=50,
        peer_closing_speed_kmh=90,
        peer_distance_m=25,
        peer_harsh_brake=True,
    )
    print(f"Hazard: {level} (score={score})")
    for r in reasons:
        print(f"  • {r}")
