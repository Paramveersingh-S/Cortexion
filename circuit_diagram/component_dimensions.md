# Component Dimensions (Referenced from Robu.in)

Below are the standard physical footprint dimensions for the primary modules to be used in the 3D KiCad layout. These dimensions are based on typical modules stocked on Robu.in.

## 1. Microcontrollers
*   **ESP32 WROOM-32 DevKit V1 (Hub Node)**
    *   Dimensions: **51.5 mm × 28.3 mm**
    *   Header spacing: 2.54 mm pitch, 15 pins per side.
*   **ESP32-S3 DevKitC-1 (Sense Node)**
    *   Dimensions: **50.8 mm × 25.4 mm**
    *   Header spacing: 2.54 mm pitch, 22 pins per side.

## 2. RF / Wireless Modules
*   **SX1278 Ra-02 LoRa Module (433MHz / 868MHz)**
    *   Dimensions: **25 mm × 21 mm** (Breakout board)
    *   *Note: The raw SMD module without breakout is 17 mm × 16 mm.*
*   **NEO-6M GPS Module (with ceramic antenna)**
    *   Dimensions: **36 mm × 26 mm**
    *   Antenna module: 25 mm × 25 mm.

## 3. Sensors & Peripherals
*   **MPU-6050 IMU Breakout**
    *   Dimensions: **20.8 mm × 15.3 mm**
*   **2.4" TFT Display (SPI ST7789 / ILI9341)**
    *   Dimensions: **60 mm × 42 mm**
    *   Active display area: ~49 mm × 36 mm.

## 4. ELM327 / OBD-II Interface Components
*   **ELM327 IC (DIP-28)**
    *   Dimensions: **~35 mm × 7.5 mm**
*   **MCP2551 CAN Transceiver (DIP-8)**
    *   Dimensions: **~10 mm × 7.5 mm**
*   **78L05 5V Voltage Regulator (TO-92)**
    *   Dimensions: **~4.5 mm diameter × 4.5 mm height** (THT)
*   **DB9 Female / Male Connectors (for OBD to RS232)**
    *   Dimensions: **~31 mm × 12.5 mm**

These dimensions dictate the mechanical constraints for our modular PCB stack-up. The Hub PCB will accommodate headers for the ESP32 WROOM-32, SX1278, NEO-6M, MPU6050, TFT display, and the ELM327 physical IC circuit. A separate header connection will route to the Sense PCB.
