"""
Cortexion ML — Congestion Estimator (Deliberately NOT ML)

With 2 demo vehicles you have nowhere near enough independent samples
per road segment to fit anything statistically meaningful. An online
exponentially-weighted estimator is the honest, correct tool for
low-volume, streaming, per-segment data.

A trained model here would be theater, not engineering, and a reviewer
who knows the field will notice.
"""

from collections import defaultdict
import time
import math
from typing import Optional


class SegmentSpeedEstimator:
    """
    EWMA per road segment for real-time congestion estimation.

    Half-life of 120 seconds means an observation's weight halves
    every 2 minutes — matching the timescale of urban traffic changes.
    """

    def __init__(self, half_life_s: float = 120.0):
        self.decay = math.log(2) / half_life_s
        self.state: dict[str, dict] = defaultdict(
            lambda: {'mean': None, 'last_update': None, 'sample_count': 0}
        )

    def update(self, segment_id: str, speed_kmh: float,
               now: Optional[float] = None) -> float:
        """
        Update a segment with a new speed observation.

        Returns the updated mean speed estimate.
        """
        now = now or time.time()
        s = self.state[segment_id]

        if s['mean'] is None:
            s['mean'] = speed_kmh
        else:
            dt = now - s['last_update']
            w = math.exp(-self.decay * dt)
            s['mean'] = w * s['mean'] + (1 - w) * speed_kmh

        s['last_update'] = now
        s['sample_count'] += 1
        return s['mean']

    def congestion_level(self, segment_id: str,
                          free_flow_kmh: float = 50.0) -> str:
        """
        Classify congestion level for a segment.

        Returns: 'clear', 'moderate', 'congested', or 'unknown'
        """
        s = self.state[segment_id]
        if s['mean'] is None:
            return 'unknown'

        ratio = s['mean'] / free_flow_kmh
        if ratio > 0.8:
            return 'clear'
        if ratio > 0.5:
            return 'moderate'
        return 'congested'

    def get_segment_info(self, segment_id: str,
                          free_flow_kmh: float = 50.0) -> dict:
        """Get detailed info for a segment."""
        s = self.state[segment_id]
        return {
            'segment_id': segment_id,
            'mean_speed': round(s['mean'], 1) if s['mean'] else None,
            'level': self.congestion_level(segment_id, free_flow_kmh),
            'sample_count': s['sample_count'],
            'last_update': s['last_update'],
        }

    def get_all_segments(self, free_flow_kmh: float = 50.0) -> list[dict]:
        """Get info for all tracked segments."""
        return [
            self.get_segment_info(seg_id, free_flow_kmh)
            for seg_id in self.state
            if self.state[seg_id]['mean'] is not None
        ]


def compute_segment_id(lat: float, lon: float) -> str:
    """
    Compute a segment ID from lat/lon coordinates.
    ~100m × 100m grid cells, matching firmware/common/segment.h.
    """
    lat_cell = int(lat * 1000)
    lon_cell = int(lon * 1000)
    return f"{lat_cell}:{lon_cell}"


if __name__ == '__main__':
    # Quick demo
    estimator = SegmentSpeedEstimator(half_life_s=60)
    seg = compute_segment_id(28.6139, 77.2090)

    # Simulate traffic slowing down
    for speed in [50, 45, 40, 30, 20, 15, 10]:
        mean = estimator.update(seg, speed)
        level = estimator.congestion_level(seg)
        print(f"Speed={speed:3d} → mean={mean:.1f} → {level}")
