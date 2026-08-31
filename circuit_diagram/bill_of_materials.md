# Vigilante Hardware Bill of Materials (BOM)

This is the complete shopping list to build the custom PCB for the Vehicle Telemetry Hub and the external Radar Sense Node.

## 1. Microcontrollers
| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **1** | ESP32-WROOM-32 | The main hub microcontroller module (Surface mount). |
| **1** | ESP32-S3-WROOM-1 | The sense board microcontroller module (Surface mount). |

## 2. OBD & CAN Interface
| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **1** | ELM327 | OBD-II to RS232 Interpreter IC (usually DIP-28 or SOIC-28). |
| **1** | MCP2551 | High-Speed CAN Transceiver IC (usually DIP-8 or SOIC-8). |
| **1** | OBD-II Connector | 16-pin Male OBD-II plug (to connect directly to the car). |

## 3. Modules & Sensors
| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **1** | SX1278 LoRa Module | SPI LoRa module (Ensure you buy the frequency legal for your region: 433MHz, 868MHz, or 915MHz). |
| **1** | 2.4" SPI TFT Display | ILI9341 or generic SPI TFT screen. |
| **1** | MPU6050 Module | 6-DOF Accelerometer/Gyro (Buy the breakout board, it already has the required pull-up resistors and capacitors). |
| **1** | NEO-6M GPS Module | UART GPS module (Should include a small ceramic active antenna). |
| **1** | HLK-LD2410 | 24GHz mmWave Human Presence Radar Sensor module. |

## 4. Power Supply & Logic Shifting
| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **1** | LM7805 or 78L05 | 12V to 5V Linear Voltage Regulator. |
| **2** | AMS1117-3.3 | 5V to 3.3V Low Drop-Out (LDO) Regulator (One for the Main Hub, one for the Sense Board). |
| **1** | Logic Level Shifter | 4-Channel Bi-directional Logic Level Converter (e.g. BSS138 based). To protect the ESP32 from the ELM327's 5V signals. |

## 5. Passive Components (Resistors & Capacitors)
| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **1** | 4.00MHz Crystal | Crystal oscillator required for the ELM327. |
| **2** | 27pF Ceramic Capacitor | Load capacitors for the 4.00MHz crystal. |
| **4** | 10uF Capacitor | Ceramic or Electrolytic. Used for the power supply regulators. |
| **5** | 0.1uF Ceramic Capacitor | Used for regulator decoupling and the ESP32 EN auto-boot circuit. |
| **2** | 10kΩ Resistor | Pull-up resistor for the ESP32 EN pin and general logic use. |

## 6. Connectors & Miscellaneous
| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **2** | 4-Pin JST-XH Header | Male PCB-mount headers to connect the Hub and Sense boards. |
| **1** | 4-Pin JST-XH Cable | Pre-crimped female-to-female cable to run between the two boards. |
| **2** | Tactile Push Button | Small SMD or Through-hole buttons for ESP32 Boot/Reset switches. |
| **1** | LoRa Antenna | SMA or IPEX antenna matched to your SX1278 frequency. |

> [!TIP]
> **Prototyping vs PCB:** If you intend to test this on a breadboard before manufacturing the custom PCB, it is highly recommended to buy **ESP32 NodeMCU Dev Boards** instead of the bare WROOM modules. The Dev boards already contain the 3.3V regulators, boot buttons, and USB-to-UART chips, which will save you a lot of headache during initial programming and testing!
