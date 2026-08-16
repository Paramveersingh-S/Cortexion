"""
Cortexion ML — Test Suite
"""

import pytest
import numpy as np
from ml.congestion_estimator import SegmentSpeedEstimator, compute_segment_id
from ml.hazard_fusion import compute_hazard_level


class TestCongestionEstimator:
    def test_initial_observation(self):
        est = SegmentSpeedEstimator()
        mean = est.update('seg1', 50.0, now=0)
        assert mean == 50.0

    def test_ewma_convergence(self):
        est = SegmentSpeedEstimator(half_life_s=10)
        # Feed constant 30 km/h observations
        for i in range(100):
            est.update('seg1', 30.0, now=i)
        assert abs(est.state['seg1']['mean'] - 30.0) < 1.0

    def test_congestion_levels(self):
        est = SegmentSpeedEstimator()
        est.update('fast', 45.0, now=0)
        est.update('slow', 15.0, now=0)
        est.update('moderate', 30.0, now=0)

        assert est.congestion_level('fast', 50) == 'clear'
        assert est.congestion_level('slow', 50) == 'congested'
        assert est.congestion_level('moderate', 50) == 'moderate'
        assert est.congestion_level('unknown_seg', 50) == 'unknown'

    def test_segment_id(self):
        seg_id = compute_segment_id(28.6139, 77.2090)
        assert ':' in seg_id
        # Same location should give same ID
        assert compute_segment_id(28.6139, 77.2090) == seg_id
        # Different location should give different ID
        assert compute_segment_id(28.7041, 77.1025) != seg_id


class TestHazardFusion:
    def test_low_hazard_normal(self):
        level, score, reasons = compute_hazard_level(own_score=85, own_speed=40)
        assert level == 'low'
        assert len(reasons) == 0

    def test_high_hazard_distress(self):
        level, score, reasons = compute_hazard_level(
            own_score=80, cabin_status='possible_distress'
        )
        assert level == 'high'
        assert any('distress' in r for r in reasons)

    def test_medium_hazard_low_score(self):
        level, score, reasons = compute_hazard_level(own_score=45)
        assert level in ('medium', 'high')

    def test_peer_harsh_braking(self):
        level, score, reasons = compute_hazard_level(
            own_score=80,
            peer_harsh_brake=True,
            peer_distance_m=50,
        )
        assert score >= 3
        assert any('braking' in r.lower() for r in reasons)

    def test_reasons_always_returned(self):
        level, score, reasons = compute_hazard_level()
        assert isinstance(reasons, list)
        assert isinstance(level, str)
        assert isinstance(score, int)

    def test_fast_closing_vehicle(self):
        level, score, reasons = compute_hazard_level(
            own_speed=50,
            peer_closing_speed_kmh=100,
            peer_distance_m=20,
        )
        assert level == 'high'
