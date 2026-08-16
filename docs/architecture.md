# Cortexion — System Architecture

> Deep technical reference for the system design decisions behind Cortexion.

## Overview

Cortexion is a three-pillar connected-vehicle intelligence platform:

1. **Vehicle Intelligence** — OBD-II diagnostics, driving behavior scoring, real-time recommendations
2. **V2V Safety Mesh** — LoRa-based peer-to-peer hazard broadcast with no internet dependency
3. **Camera-Free Cabin Sensing** — WiFi CSI-based occupant monitoring (presence, breathing, distress detection)

## System Topology

```
┌─────────────────────────────────────────┐
│           VEHICLE MODULE (×2)           │
│                                         │
│  ELM327 WiFi  ◄──► ESP32 "Hub"         │
│  OBD-II dongle     ├─ OBD polling       │
│  (car's own AP)    ├─ GPS (NEO-6M)      │
│                    ├─ IMU (MPU6050)      │
│                    ├─ Driving score      │
│                    ├─ LoRa TX/RX (SX1278)│──┐
│                    └─ TFT display        │  │
│                                         │  │ LoRa P2P
│  ESP32-S3 "Sense"                       │  │ V2V beacon
│  ├─ WiFi CSI (RuView)                  │  │ (~1-2 Hz)
│  ├─ Presence/breathing/distress         │  │
│  └─ UART → Hub                         │  │
└──────────────────┬──────────────────────┘  │
                   │                          │
                   ▼                          ▼
┌─────────────────────────────────────────────────┐
│              BASE STATION (laptop)              │
│  LoRa receiver (SX1278, USB-serial)             │
│  → Node.js Gateway (serial → MQTT)              │
│  → Mosquitto MQTT Broker                        │
│  → Express Backend (REST + WebSocket)            │
│  → PostgreSQL / SQLite                           │
└──────────────────┬──────────────────────────────┘
                   │ WiFi / HTTP / WS
                   ▼
┌─────────────────────────────────────────────────┐
│           WEB DASHBOARD (Next.js)               │
│  ├─ Live map (both vehicles)                    │
│  ├─ Driving score gauges                        │
│  ├─ Alert feed (hazards, distress)              │
│  ├─ Cabin status panels                         │
│  └─ Congestion overlay                          │
└─────────────────────────────────────────────────┘
```

## Concurrency Model (Firmware)

The ESP32 Hub runs 7 FreeRTOS tasks across dual cores:

| Task | Core | Priority | Purpose |
|------|------|----------|---------|
| `obdTask` | 0 | 2 | WiFi OBD polling (co-located with WiFi stack) |
| `gpsTask` | 0 | 1 | UART NMEA parsing |
| `senseUartTask` | 0 | 1 | UART from Sense node |
| `fusionTask` | 1 | 3 | **Central state — sole writer of g_state** |
| `loraTxTask` | 1 | 2 | LoRa transmit with duty-cycle guard |
| `loraRxTask` | 1 | 2 | LoRa receive + CRC validation |
| `screenTask` | 1 | 1 | TFT display rendering |

**Critical invariant:** Only `fusionTask` writes to shared state (`g_state`). All other tasks communicate exclusively via FreeRTOS queues. This makes "stale data on screen" a single-file debugging problem.

**SPI bus contention:** LoRa (SX1278) and TFT display both use SPI. A `spiBusMutex` semaphore guards all SPI transactions.

## Data Flow

```
OBD PID response → obdQueue → fusionTask → loraTxQueue → LoRa TX
GPS NMEA fix     → gpsQueue → fusionTask ↗
IMU sample       → imuQueue → fusionTask ↗
Sense UART       → senseQueue → fusionTask ↗
                                fusionTask → screenQueue → TFT display
LoRa RX          → loraRxQueue → fusionTask (peer tracking)
```

## Failure Resilience

| Failure | Detection | Response |
|---------|-----------|----------|
| ELM327 WiFi drops | 3 consecutive timeouts (2s each) | Force disconnect + reconnect |
| GPS cold start | `!gps.location.isValid()` | Gate LoRa TX of position, broadcast hazard-only beacon |
| LoRa packet loss | No ACK in broadcast mode | 1-2 Hz beacon rate makes single loss invisible; "peer signal lost" after 3 missed intervals |
| Sense node crash | No heartbeat for 6s | `cabin_status = UNKNOWN` (not "keep last value") |
| SPI bus contention | N/A (prevented) | `spiBusMutex` on all SPI transactions |
| 12V brownout | ESP32 built-in brownout detector | 470µF bulk capacitor on 5V rail |

## ML Architecture

| Problem | Right Tool | Why |
|---------|-----------|-----|
| Instant harsh-brake alert | Deterministic threshold (edge) | Zero-latency, zero-network-dependency |
| Refined event severity | Learned GBM model (server) | Generalizes past noisy thresholds; non-safety-critical |
| Road congestion from 2 vehicles | EWMA estimator (**not ML**) | Insufficient independent samples for any model |
| Cabin wellness/distress | Transfer learning on pretrained embedding | Training CSI from scratch is a multi-year research problem |
| Overall hazard level | Transparent rule engine (**not ML**) | No ground truth for real collisions; auditable reasoning |

## Regulatory Compliance

- **India IN865 (865–867 MHz)**: License-exempt, 1% duty cycle, 30 dBm cap
- **India 433 MHz**: License-exempt, lower power limits
- **915 MHz (US) / 868 MHz (EU)**: **NOT legal in India**
- Duty cycle enforced programmatically via `DutyCycleGuard` class
