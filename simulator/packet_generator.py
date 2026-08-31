"""
Cortexion Simulator — Packet Generator

Generates realistic V2VBeacon binary packets with configurable
driving patterns, routes, and cabin events. Used to develop and
test the entire software stack without physical hardware.

Output: raw 21-byte binary packets matching firmware/common/packet.h
"""

import struct
import math
import time
import random
from typing import Optional

PROTO_VERSION = 0x01
BEACON_SIZE = 21
BEACON_FORMAT = '<BHiiB B B B B I B'  # little-endian, packed

# Hazard flags
HAZARD_HARSH_BRAKE  = 0x01
HAZARD_HARSH_ACCEL  = 0x02
HAZARD_LOW_FUEL     = 0x04
HAZARD_ENGINE_FAULT = 0x08
HAZARD_NO_GPS_FIX   = 0x10

# Cabin status
CABIN_NONE = 0
CABIN_PRESENCE_OK = 1
CABIN_NO_MOVEMENT = 2
CABIN_POSSIBLE_DISTRESS = 3
CABIN_UNKNOWN = 4


def crc8(data: bytes) -> int:
    """CRC8 matching firmware implementation (polynomial 0x07)."""
    crc = 0x00
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ 0x07) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc


def build_beacon(
    vehicle_id: int = 1,
    lat: float = 28.6139,
    lon: float = 77.2090,
    speed_kmh: int = 0,
    heading_deg: float = 0.0,
    driving_score: int = 80,
    hazard_flags: int = 0,
    cabin_status: int = CABIN_PRESENCE_OK,
    timestamp_ms: Optional[int] = None,
) -> bytes:
    """Build a 21-byte V2VBeacon binary packet with valid CRC."""
    if timestamp_ms is None:
        timestamp_ms = int(time.time() * 1000) & 0xFFFFFFFF

    lat_e6 = int(lat * 1_000_000)
    lon_e6 = int(lon * 1_000_000)
    heading_div2 = int((heading_deg % 360) / 2)

    # Pack without CRC first (20 bytes)
    data = struct.pack(
        '<BHiiB B B B B I',
        PROTO_VERSION,
        vehicle_id,
        lat_e6,
        lon_e6,
        min(255, max(0, speed_kmh)),
        heading_div2,
        min(100, max(0, driving_score)),
        hazard_flags,
        cabin_status,
        timestamp_ms & 0xFFFFFFFF,
    )

    # Append CRC
    return data + bytes([crc8(data)])


class VehicleSimulator:
    """Simulates a vehicle moving along a route with realistic OBD behavior."""

    def __init__(
        self,
        vehicle_id: int = 1,
        start_lat: float = 28.6139,
        start_lon: float = 77.2090,
        heading: float = 0.0,
    ):
        self.vehicle_id = vehicle_id
        self.lat = start_lat
        self.lon = start_lon
        self.heading = heading
        self.speed = 0.0
        self.target_speed = 0.0
        self.driving_score = 85
        self.cabin_status = CABIN_PRESENCE_OK
        self.hazard_flags = 0
        self.timestamp = int(time.time() * 1000)
        self._accel_noise = 0.0

    def update(self, dt_sec: float = 0.5) -> bytes:
        """Advance simulation by dt_sec and return a beacon packet."""
        # Speed changes toward target with some noise
        speed_diff = self.target_speed - self.speed
        accel = min(5.0, max(-8.0, speed_diff * 0.3 + random.gauss(0, 0.5)))
        self.speed = max(0, self.speed + accel * dt_sec)
        self._accel_noise = accel

        # Position update (simple flat-earth approximation)
        if self.speed > 0:
            heading_rad = math.radians(self.heading)
            speed_ms = self.speed / 3.6
            dlat = math.cos(heading_rad) * speed_ms * dt_sec / 111320
            dlon = math.sin(heading_rad) * speed_ms * dt_sec / (111320 * math.cos(math.radians(self.lat)))
            self.lat += dlat
            self.lon += dlon

        # Hazard detection
        self.hazard_flags = 0
        if accel < -6.0:
            self.hazard_flags |= HAZARD_HARSH_BRAKE
            self.driving_score = max(0, self.driving_score - 4)
        elif accel > 5.0:
            self.hazard_flags |= HAZARD_HARSH_ACCEL
            self.driving_score = max(0, self.driving_score - 3)
        else:
            self.driving_score = min(100, self.driving_score + 1)

        self.timestamp += int(dt_sec * 1000)

        return build_beacon(
            vehicle_id=self.vehicle_id,
            lat=self.lat,
            lon=self.lon,
            speed_kmh=int(self.speed),
            heading_deg=self.heading,
            driving_score=self.driving_score,
            hazard_flags=self.hazard_flags,
            cabin_status=self.cabin_status,
            timestamp_ms=self.timestamp,
        )

    def set_target_speed(self, kmh: float):
        self.target_speed = max(0, min(120, kmh))

    def trigger_harsh_brake(self):
        self.target_speed = max(0, self.speed - 30)

    def trigger_distress(self):
        self.cabin_status = CABIN_POSSIBLE_DISTRESS

    def clear_distress(self):
        self.cabin_status = CABIN_PRESENCE_OK


if __name__ == '__main__':
    # Quick test
    sim = VehicleSimulator(vehicle_id=1, start_lat=28.6139, start_lon=77.2090)
    sim.set_target_speed(40)

    for i in range(10):
        packet = sim.update(0.5)
        print(f"Packet {i+1}: {len(packet)} bytes, hex={packet.hex()}")
