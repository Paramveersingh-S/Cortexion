/**
 * Cortexion Hub — OBD Polling Task
 *
 * Connects to the ELM327 WiFi adapter (which runs its own AP) as a
 * WiFi STA client, then polls OBD-II PIDs over TCP at ~5 Hz.
 *
 * Reconnect handling: tracks consecutive failures and forces a full
 * WiFi disconnect/reconnect after 3 failures. This is the single
 * most common failure mode during demos — the ELM327's WiFi is
 * notoriously flaky under the hood of a running car.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <ELMduino.h>
#include "packet.h"

// Configuration — override in config.h (gitignored)
#ifndef ELM327_SSID
  #define ELM327_SSID     "WiFi_OBDII"
#endif
#ifndef ELM327_PASSWORD
  #define ELM327_PASSWORD ""
#endif
#ifndef ELM327_IP
  #define ELM327_IP       "192.168.0.10"
#endif
#ifndef ELM327_PORT
  #define ELM327_PORT     35000
#endif

extern QueueHandle_t obdQueue;

// ── WiFi + ELM327 Connection ────────────────────────────────────

static WiFiClient obdClient;
static ELM327 elm;
static uint8_t consecutiveFailures = 0;
static bool wifiConnected = false;

static bool connectWiFi() {
  Serial.printf("[OBD] Connecting to %s...\n", ELM327_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ELM327_SSID, ELM327_PASSWORD);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    vTaskDelay(pdMS_TO_TICKS(250));
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[OBD] WiFi connected — IP: %s\n", WiFi.localIP().toString().c_str());
    wifiConnected = true;
    return true;
  }

  Serial.println("[OBD] WiFi connection failed");
  wifiConnected = false;
  return false;
}

static bool connectELM() {
  if (!wifiConnected) {
    if (!connectWiFi()) return false;
  }

  IPAddress elmIP;
  elmIP.fromString(ELM327_IP);

  Serial.printf("[OBD] Connecting to ELM327 at %s:%d...\n", ELM327_IP, ELM327_PORT);

  if (!obdClient.connect(elmIP, ELM327_PORT)) {
    Serial.println("[OBD] TCP connection to ELM327 failed");
    return false;
  }

  if (!elm.begin(obdClient, /*debug=*/false, /*timeout_ms=*/2000)) {
    Serial.println("[OBD] ELM327 initialization failed");
    obdClient.stop();
    return false;
  }

  Serial.println("[OBD] ELM327 connected and ready");
  return true;
}

// ── PID Polling ─────────────────────────────────────────────────

static bool pollPID(float& out, std::function<float()> pidFunc, const char* name) {
  float val = pidFunc();
  if (elm.nb_rx_state == ELM_SUCCESS) {
    out = val;
    consecutiveFailures = 0;
    return true;
  }

  if (elm.nb_rx_state == ELM_TIMEOUT || elm.nb_rx_state == ELM_NO_RESPONSE) {
    consecutiveFailures++;
    Serial.printf("[OBD] %s failed (consecutive: %d)\n", name, consecutiveFailures);
  }
  return false;
}

// ── Task Entry Point ────────────────────────────────────────────

void obdTask(void* pv) {
  vTaskDelay(pdMS_TO_TICKS(1000));  // Let WiFi stack settle
  connectELM();

  OBDReading reading = {};

  while (true) {
    // Poll RPM
    float rpm = elm.rpm();
    if (elm.nb_rx_state == ELM_SUCCESS) {
      reading.rpm = rpm;
      consecutiveFailures = 0;
    } else if (elm.nb_rx_state == ELM_TIMEOUT || elm.nb_rx_state == ELM_NO_RESPONSE) {
      consecutiveFailures++;
    }

    // Poll Speed
    float speed = elm.kph();
    if (elm.nb_rx_state == ELM_SUCCESS) {
      reading.speed_kmh = speed;
      consecutiveFailures = 0;
    }

    // Poll Throttle Position
    float throttle = elm.throttle();
    if (elm.nb_rx_state == ELM_SUCCESS) {
      reading.throttle_pct = throttle;
    }

    // Poll Coolant Temperature
    float coolant = elm.engineCoolantTemp();
    if (elm.nb_rx_state == ELM_SUCCESS) {
      reading.coolant_temp_c = coolant;
    }

    // Poll Engine Load
    float load = elm.engineLoad();
    if (elm.nb_rx_state == ELM_SUCCESS) {
      reading.engine_load_pct = load;
    }

    reading.timestamp_ms = millis();

    // Send to fusion task via queue
    xQueueOverwrite(obdQueue, &reading);

    // ── Reconnect logic ─────────────────────────────────────────
    if (consecutiveFailures >= 3 || !obdClient.connected()) {
      Serial.println("[OBD] Connection lost — reconnecting...");
      obdClient.stop();
      WiFi.disconnect(true);
      wifiConnected = false;
      vTaskDelay(pdMS_TO_TICKS(500));
      if (connectELM()) {
        consecutiveFailures = 0;
        Serial.println("[OBD] Reconnected successfully");
      } else {
        Serial.println("[OBD] Reconnect failed — retrying in 2s");
        vTaskDelay(pdMS_TO_TICKS(2000));
      }
    }

    vTaskDelay(pdMS_TO_TICKS(200));  // ~5 Hz poll rate
  }
}
