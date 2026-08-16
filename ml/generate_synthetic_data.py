"""
Cortexion ML — Synthetic Data Generator

Generates realistic synthetic OBD/GPS session logs for model training.
Since no real car data is available during development, this creates
physically plausible driving sessions with labeled events.

Output: CSV files matching the schema expected by train_event_severity.py
"""

import numpy as np
import pandas as pd
import os
from pathlib import Path

DATA_DIR = Path(__file__).parent / 'data'
DATA_DIR.mkdir(exist_ok=True)


def generate_session(
    label: str,
    duration_sec: float = 300,
    sample_hz: float = 5.0,
    driving_style: str = 'normal',
) -> pd.DataFrame:
    """
    Generate a synthetic OBD/GPS driving session.

    Args:
        label: Session label for identification
        duration_sec: Session duration in seconds
        sample_hz: OBD polling rate
        driving_style: 'normal', 'aggressive', or 'mixed'

    Returns:
        DataFrame with columns matching real OBD logs
    """
    dt = 1.0 / sample_hz
    n_samples = int(duration_sec * sample_hz)

    # Generate speed profile based on driving style
    speed = np.zeros(n_samples)
    target_speed = 0.0
    current_speed = 0.0

    # Base noise levels by style
    noise_scale = {'normal': 0.3, 'aggressive': 1.0, 'mixed': 0.6}[driving_style]
    brake_probability = {'normal': 0.005, 'aggressive': 0.02, 'mixed': 0.01}[driving_style]

    for i in range(n_samples):
        # Periodically change target speed (simulating traffic)
        if np.random.random() < 0.01:
            target_speed = np.random.choice([0, 20, 30, 40, 50, 60, 70])

        # Harsh braking events
        if np.random.random() < brake_probability and current_speed > 20:
            target_speed = max(0, current_speed - np.random.uniform(20, 40))

        # Smooth acceleration/deceleration
        diff = target_speed - current_speed
        accel = np.clip(diff * 0.3, -15, 8) + np.random.normal(0, noise_scale)
        current_speed = max(0, current_speed + accel * dt)
        speed[i] = current_speed

    # Generate correlated OBD signals
    rpm = 800 + speed * 40 + np.random.normal(0, 50, n_samples)
    rpm = np.clip(rpm, 700, 6500)

    throttle = np.clip(speed / 80 * 100 + np.random.normal(0, 5, n_samples), 0, 100)

    coolant_temp = 85 + np.random.normal(0, 3, n_samples)
    coolant_temp = np.clip(coolant_temp, 60, 110)

    engine_load = np.clip(throttle * 0.8 + np.random.normal(0, 5, n_samples), 0, 100)

    # GPS coordinates (start at a Delhi location, move roughly northeast)
    lat_base = 28.6139
    lon_base = 77.2090
    heading = 45 + np.cumsum(np.random.normal(0, 0.5, n_samples))

    lat = lat_base + np.cumsum(
        np.cos(np.radians(heading)) * speed / 3.6 * dt / 111320
    )
    lon = lon_base + np.cumsum(
        np.sin(np.radians(heading)) * speed / 3.6 * dt / (111320 * np.cos(np.radians(lat_base)))
    )

    timestamps = np.arange(n_samples) * dt * 1000  # milliseconds

    df = pd.DataFrame({
        'timestamp_ms': timestamps.astype(int),
        'speed_kmh': np.round(speed, 1),
        'rpm': np.round(rpm, 0).astype(int),
        'throttle_pct': np.round(throttle, 1),
        'coolant_temp_c': np.round(coolant_temp, 1),
        'engine_load_pct': np.round(engine_load, 1),
        'lat': np.round(lat, 6),
        'lon': np.round(lon, 6),
        'heading_deg': np.round(heading % 360, 1),
    })

    return df


def generate_all_training_data():
    """Generate a complete set of training sessions."""
    sessions = [
        ('session_normal_1', 300, 'normal'),
        ('session_normal_2', 300, 'normal'),
        ('session_aggressive_1', 300, 'aggressive'),
        ('session_aggressive_2', 300, 'aggressive'),
        ('session_mixed_1', 300, 'mixed'),
        ('session_mixed_2', 300, 'mixed'),
    ]

    for label, duration, style in sessions:
        print(f"Generating {label} ({style}, {duration}s)...")
        df = generate_session(label, duration, driving_style=style)
        filepath = DATA_DIR / f'{label}.csv'
        df.to_csv(filepath, index=False)
        print(f"  → {filepath} ({len(df)} samples)")

    print(f"\nGenerated {len(sessions)} training sessions in {DATA_DIR}")


if __name__ == '__main__':
    generate_all_training_data()
