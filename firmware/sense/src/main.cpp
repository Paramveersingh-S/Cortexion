/**
 * Cortexion Sense Node — Main Entry Point (ESP32-S3)
 *
 * This node's job is intentionally narrow:
 * 1. Connect to the ELM327's WiFi AP (or Hub's AP)
 * 2. Run RuView CSI firmware for cabin sensing
 * 3. Parse RuView output into compact cabin status
 * 4. Forward status + heartbeat to Hub over UART
 *
 * We treat RuView as a component with a clean interface,
 * the same way we treat the ELM327. Don't try to re-implement
 * or modify RuView's CSI pipeline.
 */

#include <Arduino.h>
#include <WiFi.h>
#include "crc8.h"

// Forward declarations
void uartBridgeLoop();
void ruviewParserLoop();

// ── Configuration ───────────────────────────────────────────────
#ifndef SENSE_WIFI_SSID
  #define SENSE_WIFI_SSID     "WiFi_OBDII"   // Same AP as Hub's OBD connection
#endif
#ifndef SENSE_WIFI_PASSWORD
  #define SENSE_WIFI_PASSWORD ""
#endif

// UART to Hub
#define HUB_UART_TX_PIN  17    // Sense TX → Hub RX
#define HUB_UART_RX_PIN  18    // Sense RX ← Hub TX (unused but reserved)
#define HUB_UART_BAUD    115200

// Frame protocol
#define FRAME_START_BYTE  0xAA

// ── Global State ────────────────────────────────────────────────
static uint8_t currentCabinStatus = 0;  // CABIN_NONE
static uint32_t lastHeartbeatMs = 0;
static uint32_t lastRuViewUpdateMs = 0;
static bool wifiConnected = false;

// ── RuView Output Parsing ───────────────────────────────────────
// RuView outputs semantic primitives. We parse and classify them
// into our compact cabin status enum.

struct RuViewEvent {
  bool  presence;
  float breathing_rate;       // breaths per minute (0 if not detected)
  uint32_t secondsSinceMovement;
  bool  possibleDistress;
  bool  valid;
};

static RuViewEvent lastRuViewEvent = {};

// Simulated RuView CSI processing
// In production, this reads from RuView's MQTT output or serial debug stream.
// The actual CSI pipeline runs on the ESP32-S3's dual cores.
void processCSIData() {
  // RuView's firmware handles the actual CSI extraction and inference.
  // This function would subscribe to RuView's local MQTT topic or
  // parse its serial output stream.
  //
  // For the real hardware deployment:
  // 1. Flash RuView's esp32-csi-node.bin via esptool
  // 2. Provision it onto the ELM327's WiFi network
  // 3. RuView publishes to local MQTT topics:
  //    - ruview/presence      (bool)
  //    - ruview/breathing     (float, BPM)
  //    - ruview/motion        (bool)
  //    - ruview/distress      (bool)
  // 4. This node subscribes and translates to our cabin status enum
}

uint8_t classifyCabinStatus(const RuViewEvent& ev) {
  if (!ev.valid || !ev.presence) return 0;  // CABIN_NONE
  if (ev.possibleDistress) return 3;         // CABIN_POSSIBLE_DISTRESS
  if (ev.secondsSinceMovement > 45) return 2; // CABIN_NO_MOVEMENT
  return 1;                                   // CABIN_PRESENCE_OK
}

// ── UART Frame Transmission ────────────────────────────────────

void sendStatusFrame(uint8_t status) {
  uint8_t crc = crc8_compute(&status, 1);
  Serial1.write(FRAME_START_BYTE);
  Serial1.write(status);
  Serial1.write(crc);
}

// ── WiFi Connection ─────────────────────────────────────────────

bool connectToAP() {
  Serial.printf("[SENSE] Connecting to %s...\n", SENSE_WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(SENSE_WIFI_SSID, SENSE_WIFI_PASSWORD);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[SENSE] WiFi connected — IP: %s\n", WiFi.localIP().toString().c_str());
    wifiConnected = true;
    return true;
  }

  Serial.println("[SENSE] WiFi connection failed");
  wifiConnected = false;
  return false;
}

// ── Setup & Loop ────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println(F("\n╔═══════════════════════════════════════╗"));
  Serial.println(F("║   CORTEXION — Cabin Sense Node        ║"));
  Serial.println(F("║   ESP32-S3 + RuView CSI v1.0.0        ║"));
  Serial.println(F("╚═══════════════════════════════════════╝"));

  // Initialize UART to Hub
  Serial1.begin(HUB_UART_BAUD, SERIAL_8N1, HUB_UART_RX_PIN, HUB_UART_TX_PIN);
  Serial.println("[SENSE] UART to Hub initialized");

  // Connect to WiFi (ELM327's AP)
  connectToAP();

  // Initialize RuView CSI subsystem
  // In production: configure CSI callbacks, start sensing pipeline
  Serial.println("[SENSE] RuView CSI subsystem initialized");

  lastHeartbeatMs = millis();
}

void loop() {
  // ── Process CSI data from RuView ──────────────────────────────
  processCSIData();

  // ── Classify and transmit cabin status ────────────────────────
  if (lastRuViewEvent.valid) {
    uint8_t newStatus = classifyCabinStatus(lastRuViewEvent);
    if (newStatus != currentCabinStatus || millis() - lastRuViewUpdateMs > 1000) {
      currentCabinStatus = newStatus;
      sendStatusFrame(currentCabinStatus);
      lastRuViewUpdateMs = millis();
      lastHeartbeatMs = millis();

      Serial.printf("[SENSE] Cabin status: %d (presence=%d, still=%lus, distress=%d)\n",
                    currentCabinStatus, lastRuViewEvent.presence,
                    lastRuViewEvent.secondsSinceMovement,
                    lastRuViewEvent.possibleDistress);
    }
  }

  // ── Heartbeat — send even without new sensing events ──────────
  // This lets the Hub distinguish "node alive, status unchanged"
  // from "node crashed/hung"
  if (millis() - lastHeartbeatMs > 2000) {
    sendStatusFrame(currentCabinStatus);
    lastHeartbeatMs = millis();
  }

  // ── WiFi reconnect ────────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED && wifiConnected) {
    Serial.println("[SENSE] WiFi lost — reconnecting...");
    wifiConnected = false;
    connectToAP();
  }

  delay(50);  // 20 Hz main loop
}
