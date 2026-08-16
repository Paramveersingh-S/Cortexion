# V2V Beacon Wire Protocol — Specification v1

## Overview

The V2V beacon is a compact 21-byte binary packet broadcast over LoRa at 1–2 Hz between vehicles in the Cortexion mesh.

## Design Principles

1. **Fixed-point coordinates** — `int32` lat/lon × 1,000,000 instead of IEEE-754 float. Same size, but explicit and portable across byte-order assumptions.
2. **Version byte** — enables safe protocol evolution without silent misparses.
3. **CRC8** — detects corruption from RF noise. Not a security mechanism.
4. **21 bytes total** — well within LoRa's 243-byte payload limit, leaving room for future extensions.

## Packet Layout

```
Offset  Size  Field             Encoding
──────  ────  ────────────────  ──────────────────────────────────
0       1     proto_version     uint8  (always 0x01 for v1)
1       2     vehicle_id        uint16_le
3       4     lat_e6            int32_le  (latitude × 1,000,000)
7       4     lon_e6            int32_le  (longitude × 1,000,000)
11      1     speed_kmh         uint8  (0–255 km/h)
12      1     heading_div2      uint8  (actual_degrees / 2, 0–180 → 0°–360°)
13      1     driving_score     uint8  (0–100)
14      1     hazard_flags      uint8  (bitfield, see below)
15      1     cabin_status      uint8  (enum, see below)
16      4     timestamp_ms      uint32_le (millis() at TX time)
20      1     crc8              CRC8 over bytes 0–19 (polynomial 0x07)
──────  ────
Total:  21 bytes
```

## Hazard Flags Bitfield

```
Bit 0:  harsh_brake     (deceleration < -12 km/h/s ≈ -0.34g)
Bit 1:  harsh_accel     (acceleration > 10 km/h/s)
Bit 2:  low_fuel        (fuel level < 10%)
Bit 3:  engine_fault    (MIL / check-engine light active)
Bit 4:  no_gps_fix      (position data is invalid / stale)
Bit 5:  reserved
Bit 6:  reserved
Bit 7:  reserved
```

## Cabin Status Enum

| Value | Meaning | Description |
|-------|---------|-------------|
| 0 | `NONE` | No cabin sensing available / node offline |
| 1 | `PRESENCE_OK` | Driver present, normal activity detected |
| 2 | `NO_MOVEMENT` | No movement detected for 45+ seconds |
| 3 | `POSSIBLE_DISTRESS` | Extended inactivity + abnormal pattern |
| 4 | `UNKNOWN` | Sense node heartbeat lost (6s+ timeout) |

## CRC8 Algorithm

Polynomial: `0x07` (x⁸ + x² + x + 1)
Initial value: `0x00`
Input/output reflection: none

```
crc = 0x00
for each byte in data[0..19]:
    crc ^= byte
    for bit in 0..7:
        if crc & 0x80:
            crc = (crc << 1) ^ 0x07
        else:
            crc = crc << 1
        crc &= 0xFF
```

## Transmission Parameters

| Parameter | Moving (>5 km/h) | Stationary |
|-----------|-------------------|------------|
| Spreading Factor | SF7 | SF11 |
| Bandwidth | 125 kHz | 125 kHz |
| Coding Rate | 4/5 | 4/5 |
| TX Interval | 500ms (2 Hz) | 1000ms (1 Hz) |
| Approx. Airtime | ~30ms | ~200ms |
| Effective Range | ~200–500m | ~2–5 km |

## Duty Cycle Compliance

India IN865/433 MHz: 1% duty cycle per rolling hour (36,000ms of 3,600,000ms).
Enforced by `DutyCycleGuard` class in firmware — TX is blocked if budget exhausted.
