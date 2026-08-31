# Vigilante Hardware Bill of Materials (Modular / Plug-and-Play)

Since you are buying pre-assembled development boards and modules, this drastically simplifies your shopping list and eliminates the need for soldering tiny capacitors, crystals, and voltage regulators! 

## 1. Microcontrollers (Dev Boards)
| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **1** | ESP32 NodeMCU DevKitC V4 | Main Hub MCU. Includes built-in USB-to-UART, 3.3V regulators, and boot buttons. Just plug it in via USB! |
| **1** | ESP32-S3 DevKitC | Sense Board MCU. Also fully assembled and ready to plug in. |

## 2. Vehicle Interface (The OBD Connection)
*Choose one of the following options based on your preference:*

| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **Option A (Easiest)** | ELM327 Bluetooth OBD-II Dongle | A standard commercial Bluetooth OBD-II reader. Your ESP32 Hub can connect to it wirelessly via Bluetooth (Classic/BLE), meaning **zero hardwiring** to the car is required! |
| **Option B (Wired)** | SN65HVD230 CAN Bus Module | A pre-built CAN transceiver breakout board. You wire this to the ESP32, and splice it into a generic "OBD-II Male to Open Wire" cable to connect to pins 6 and 14. |

## 3. Sensors & Peripherals (Breakout Boards)
*All of these should be purchased as "Breakout Boards" (pre-soldered onto a small circuit board with pins).*

| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **1** | SX1278 LoRa Module | SPI LoRa breakout board. Usually comes with a small spring or SMA antenna. |
| **1** | 2.4" SPI TFT Display | ILI9341 based display module with pre-soldered header pins. |
| **1** | MPU6050 Module | 6-DOF IMU breakout board (already contains the required I2C pull-up resistors). |
| **1** | NEO-6M GPS Module | UART GPS breakout. Usually includes a small square ceramic active antenna. |
| **1** | HLK-LD2410B | 24GHz mmWave Human Presence Radar Sensor (buy the one that includes header pins). |

## 4. Power & Prototyping
Because the Dev Boards take 5V via USB, you don't need to build a custom 12V-to-5V regulator circuit!

| Quantity | Component Name | Description |
| :---: | :--- | :--- |
| **1** | 12V Dual USB Car Charger | A standard car cigarette lighter USB charger. Use this to power your ESP32 Hub safely. |
| **2** | Micro-USB or USB-C Cable | To power and program the ESP32 dev boards. Check which port your specific dev boards have! |
| **1** | Dupont Jumper Wires Kit | A box of Male-to-Male, Male-to-Female, and Female-to-Female jumper wires for connecting the modules. |
| **2** | Solderless Breadboards | For assembling and testing the circuit without soldering. |
| **1** | 4-Pin JST-XH Cable (Optional) | If you still want a clean cable connection between the Hub board and the Sense board. |
