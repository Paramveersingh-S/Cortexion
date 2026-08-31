/**
 * Cortexion — Configuration Template
 *
 * Copy this file to config.h and fill in your values.
 * config.h is gitignored — NEVER commit credentials.
 *
 * For the provisioning captive portal (stretch goal), these values
 * can be set at runtime instead of compile-time.
 */

#ifndef CORTEXION_CONFIG_H
#define CORTEXION_CONFIG_H

// ── Vehicle Identity ────────────────────────────────────────────
#define VEHICLE_ID          1       // Unique per vehicle (1 or 2 for demo)

// ── ELM327 WiFi OBD-II ─────────────────────────────────────────
#define ELM327_SSID         "WiFi_OBDII"      // Your ELM327 adapter's SSID
#define ELM327_PASSWORD     ""                 // Usually empty for ELM327
#define ELM327_IP           "192.168.0.10"     // Verify against your specific adapter
#define ELM327_PORT         35000              // Standard ELM327 TCP port

// ── LoRa Radio (SX1278) ────────────────────────────────────────
#define LORA_FREQUENCY      433E6   // 433 MHz (India-legal default)
                                    // or 866E6 for IN865 band
#define LORA_TX_POWER       17      // dBm (max 20 for SX1278)
#define LORA_BANDWIDTH      125E3   // 125 kHz standard
#define LORA_CODING_RATE    5       // 4/5

// ── LoRa Pin Mapping ───────────────────────────────────────────
// For Heltec WiFi LoRa 32 v2 (adjust for your specific board)
#define LORA_CS_PIN         18
#define LORA_RST_PIN        14
#define LORA_DIO0_PIN       26

// ── GPS (NEO-6M) ───────────────────────────────────────────────
#define GPS_RX_PIN          16      // ESP32 RX ← GPS TX
#define GPS_TX_PIN          17      // ESP32 TX → GPS RX
#define GPS_BAUD            9600

// ── Sense Node UART ─────────────────────────────────────────────
#define SENSE_RX_PIN        25      // ESP32 RX ← Sense TX
#define SENSE_TX_PIN        33      // ESP32 TX → Sense RX (unused but reserved)
#define SENSE_BAUD          115200

// ── IMU (MPU6050) ───────────────────────────────────────────────
#define IMU_SDA_PIN         21
#define IMU_SCL_PIN         22

// ── TFT Display (ST7789/ILI9341) ───────────────────────────────
// Uses same SPI bus as LoRa — guarded by spiBusMutex
#define TFT_CS_PIN          5
#define TFT_DC_PIN          2
#define TFT_RST_PIN         4

// ── Buzzer & LED ────────────────────────────────────────────────
#define BUZZER_PIN          12
#define LED_PIN             13

// ── Optional HMAC Key (for V2V authentication) ─────────────────
// 8-byte pre-shared key for truncated HMAC (optional, see docs/architecture.md)
// Uncomment and fill in to enable HMAC on beacon packets
// #define HMAC_KEY           {0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07}

// ── End-to-End Encryption (AES-128-CTR) ────────────────────────
// 16-byte pre-shared key for fleet encryption.
// Change this for your production fleet!
const uint8_t LORA_AES_KEY[16] = {
  0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
  0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c
};

#endif // CORTEXION_CONFIG_H
