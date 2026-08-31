# Cortexion ISO 26262 Compliance Roadmap

As a vehicle-to-vehicle (V2V) hazard detection system, Cortexion handles data that can impact driver behavior and safety. This document outlines the roadmap for bringing the system into compliance with the ISO 26262 standard for functional safety in road vehicles.

## 1. System Definition and Item Classification

**Current Status**: Cortexion operates as an aftermarket advisory system. It does not actively control steering, braking, or acceleration.
**Target ASIL (Automotive Safety Integrity Level)**: **ASIL A / QM (Quality Management)**
- Because the system is purely informational (driver advisory) and the driver retains full control, the highest safety requirement is to ensure the system does not distract the driver or provide false hazard alerts that could induce unsafe reactions.
- The core telemetry loop targets QM, while the ML fusion engine that generates hazard alerts targets ASIL A.

## 2. Hardware Level (ESP32 & Sensors)

### Current Architecture
- Single ESP32-WROOM-32 (Dual-core).
- Single SX1278 LoRa transceiver.
- No hardware watchdog or redundant power supply.

### Roadmap to Compliance (Hardware Redundancy)
- [ ] **Dual MCU Architecture**: Introduce a safety supervisor MCU (e.g., an automotive-grade STM32) to monitor the ESP32 via a heartbeat mechanism.
- [ ] **Hardware Watchdog**: Enable the ESP32 RTC Watchdog Timer (WDT) in FreeRTOS to reset the system if the fusion task hangs.
- [ ] **Sensor Diagnostics**: Implement self-test routines for the MPU6050 and ELM327 on boot.

## 3. Software Level (Firmware & Backend)

### MISRA C++:2008 Compliance
The C++ firmware running on the ESP32 hub must adhere to automotive coding standards.
- [ ] Run static analysis (e.g., Cppcheck, SonarQube) against MISRA C++:2008 rules.
- [ ] Refactor dynamic memory allocation (no `new`/`malloc` after boot) in the FreeRTOS tasks.
- [ ] Enforce strict typing in the V2V packet packing/unpacking routines.

### Failure Mode and Effects Analysis (FMEA)
| Component | Failure Mode | Effect on System | Mitigation Strategy (Roadmap) |
| :--- | :--- | :--- | :--- |
| **GPS (NEO-6M)** | Complete loss of signal | Cannot determine vehicle location | Fall back to OBD-II speed; broadcast `NO_GPS_FIX` flag. |
| **LoRa TX** | Stuck in transmit mode | Blocks channel for other vehicles | Hardware duty-cycle limiter; task timeout WDT. |
| **ML Fusion** | Inference loop crash | Missed hazard alerts | Isolate ML in a dedicated FreeRTOS task; auto-restart on panic. |

## 4. Verification and Validation (V&V)

- [x] **Unit Testing**: Native execution of CRC8 and packet validation logic.
- [ ] **Hardware-in-the-Loop (HIL)**: Connect the ESP32 to a simulated OBD-II environment and measure reaction time to synthetic collision events.
- [ ] **Fault Injection**: Deliberately corrupt SPI buses in testing to ensure the mutex architecture safely recovers.
