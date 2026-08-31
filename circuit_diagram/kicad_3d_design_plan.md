# KiCad 3D Layout Plan

This document provides a structured methodology for translating the 2D pinout and schematics into a fully realized 3D PCB layout using KiCad.

## 1. PCB Stackup & Form Factor

Based on user constraints, the design will employ a **Modular Board Architecture**:
*   **Main Hub Board**: Will house the ELM327 physical circuitry (including CAN transceivers), 12V-to-5V power regulation, ESP32 WROOM-32 (Hub), LoRa transceiver, GPS, and MPU6050.
*   **Sense Board**: A physically decoupled board housing only the ESP32-S3 (Sense Node). This prevents interference to the sensitive CSI signals from the LoRa radio transmissions. It will connect to the Hub board via a standard 4-pin JST-XH or header cable (5V, GND, TX, RX).

## 2. KiCad Footprint Selection (Robu.in Standard)
To ensure compatibility with Indian suppliers (like Robu.in) and ease of assembly:

### Microcontrollers
*   `ESP32-WROOM-32`: Standard ESP32 footprint (`RF_Module:ESP32-WROOM-32`)
*   `ESP32-S3-WROOM-1`: (`RF_Module:ESP32-S3-WROOM-1`)

### ELM327 & OBD Interfaces
*   `ELM327`: DIP-28 or SOIC-28 footprint (`Package_DIP:DIP-28_W7.62mm`)
*   `MCP2551`: DIP-8 or SOIC-8 footprint (`Package_DIP:DIP-8_W7.62mm`)
*   `DB9 Connector`: Right-angle DB9 Female for OBD interface (`Connector_D-Sub:DSUB-9_Female_Horizontal_P2.77x2.84mm_EdgePinOffset4.94mm_Housed_MountingHolesOffset7.48mm`)

### Peripherals
*   `SX1278 (Ra-02)`: Using standard 2.0mm or 2.54mm pitch headers (`Connector_PinHeader_2.54mm:PinHeader_1x08_P2.54mm_Vertical`) if using the breakout, or the raw SMD module (`RF_Module:LoRa_Ra-02_SMD`).
*   `MPU6050`: 8-pin 2.54mm pitch header (`Connector_PinHeader_2.54mm:PinHeader_1x08_P2.54mm_Vertical`)
*   `NEO-6M`: 4-pin 2.54mm pitch header for standard GPS breakout

## 3. Placement & Routing Strategies

*   **RF Isolation**: Ensure the WiFi antenna sections of both ESP32 modules overhang the edge of the PCB. Do not route any copper or place ground planes underneath the antenna keep-out zones.
*   **Power Traces**: The 12V line from the OBD-II port should be thick (>0.5mm) and strictly routed to the Buck Converter/78L05. The 5V output and 3.3V LDO traces need sufficient width to handle the ESP32 WiFi transmission spikes (up to ~500mA each).
*   **LoRa Traces**: If using the raw SMD Ra-02 module, ensure the antenna trace is impedance matched (50 ohms) to the SMA connector.

## 4. 3D Model Integration

In KiCad's 3D Viewer (`Alt+3`):
1.  Open the Footprint Properties for each major component.
2.  Navigate to the **3D Models** tab.
3.  Assign `.step` or `.wrl` files.
4.  *Note:* You can find accurate 3D models for components like the NEO-6M, ESP32, and Ra-02 on GrabCAD or SnapEDA to ensure the final render reflects reality exactly.
