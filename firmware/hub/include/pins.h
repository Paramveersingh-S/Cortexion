/**
 * Cortexion Hub — Pin Definitions
 *
 * Central pin mapping for the ESP32 WROOM-32 Hub controller.
 * Adjust these for your specific board (Heltec LoRa32, TTGO, etc.)
 *
 * SPI bus is shared between LoRa (SX1278) and TFT display — all
 * SPI transactions MUST be guarded by spiBusMutex.
 */

#ifndef CORTEXION_PINS_H
#define CORTEXION_PINS_H

// ── SPI Bus (shared: LoRa + TFT) ───────────────────────────────
#define PIN_SPI_SCK       18
#define PIN_SPI_MISO      19
#define PIN_SPI_MOSI      23

// ── LoRa Radio (SX1278) ────────────────────────────────────────
#define PIN_LORA_CS       5
#define PIN_LORA_RST      14
#define PIN_LORA_DIO0     26

// ── TFT Display (ST7789 / ILI9341) ─────────────────────────────
#define PIN_TFT_CS        15
#define PIN_TFT_DC        2
#define PIN_TFT_RST       4
#define PIN_TFT_BL        32    // Backlight (optional)

// ── GPS (NEO-6M, UART1) ────────────────────────────────────────
#define PIN_GPS_RX        16    // ESP32 RX ← GPS TX
#define PIN_GPS_TX        17    // ESP32 TX → GPS RX

// ── Sense Node UART (UART2) ────────────────────────────────────
#define PIN_SENSE_RX      25    // ESP32 RX ← Sense TX
#define PIN_SENSE_TX      33    // ESP32 TX → Sense RX

// ── IMU (MPU6050, I2C) ─────────────────────────────────────────
#define PIN_IMU_SDA       21
#define PIN_IMU_SCL       22

// ── Buzzer & Status LED ─────────────────────────────────────────
#define PIN_BUZZER        12
#define PIN_STATUS_LED    13

// ── Battery Voltage Divider (optional) ──────────────────────────
#define PIN_VBAT_ADC      35    // ADC1 channel (input only on ESP32)

#endif // CORTEXION_PINS_H
