# Pinout and Wiring Guide

This document details the pin mappings between the ESP32 Hub, ESP32-S3 Sense node, ELM327 physical IC, and peripheral modules for the KiCad 2D/3D design.

## 1. ESP32 Hub (WROOM-32) Connections

### LoRa (SX1278 SPI)
*   **SCK**: GPIO 18
*   **MISO**: GPIO 19
*   **MOSI**: GPIO 23
*   **NSS/CS**: GPIO 5
*   **RST**: GPIO 14
*   **DIO0**: GPIO 26

### TFT Display (ST7789 SPI)
*   **SCK**: GPIO 18 (Shared SPI)
*   **MOSI**: GPIO 23 (Shared SPI)
*   **CS**: GPIO 15
*   **DC**: GPIO 2
*   **RST**: GPIO 4
*   **BL (Backlight)**: 3.3V

### GPS (NEO-6M UART)
*   **TX**: GPIO 16 (RX2 on ESP32)
*   **RX**: GPIO 17 (TX2 on ESP32)

### IMU (MPU6050 I2C)
*   **SDA**: GPIO 21
*   **SCL**: GPIO 22

### Connection to ESP32-S3 Sense Board (UART)
*   **TX**: GPIO 33 -> RX on Sense Board
*   **RX**: GPIO 32 <- TX on Sense Board

### Connection to ELM327 (UART for OBD Data)
*   **RX**: GPIO 34 <- ELM327 Pin 17 (RS232 Tx)
*   **TX**: GPIO 35 -> ELM327 Pin 18 (RS232 Rx)

---

## 2. ESP32-S3 Sense Board Connections
This board is kept physically modular and connects to the Hub board via a standard 4-pin header (VCC, GND, TX, RX).
*   **VCC**: 5V (from 12V Buck Converter)
*   **GND**: Common Ground
*   **RX (GPIO 44)**: Connected to Hub TX
*   **TX (GPIO 43)**: Connected to Hub RX

---

## 3. ELM327 Physical OBD Circuitry
The ELM327 Demonstration Circuit uses MCP2551 for CAN communication.

*   **CAN-H (Pin 6 of OBD-II)** -> MCP2551 Pin 7 (CANH)
*   **CAN-L (Pin 14 of OBD-II)** -> MCP2551 Pin 6 (CANL)
*   **ELM327 Pin 24 (CAN TX)** -> MCP2551 Pin 1 (TXD)
*   **ELM327 Pin 23 (CAN RX)** -> MCP2551 Pin 4 (RXD)
*   **Power**: OBD-II Pin 16 (12V) goes to a 78L05 linear regulator to provide 5V for the ELM327 and MCP2551.
