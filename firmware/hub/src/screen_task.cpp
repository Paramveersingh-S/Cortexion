/**
 * Cortexion Hub — Screen Task (TFT Display)
 *
 * Renders the driver-facing display with:
 * - Current speed and driving score
 * - Hazard alerts (harsh braking from peer, distress)
 * - Cabin status indicator
 * - Peer vehicle info (distance, status)
 * - System status (GPS fix, LoRa link, OBD connection)
 *
 * Uses the same SPI bus as LoRa — all draw operations are
 * guarded by spiBusMutex. Renders at ~5 FPS to avoid
 * starving LoRa of SPI time.
 */

#include <Arduino.h>
#include <SPI.h>
#include <TFT_eSPI.h>
#include "packet.h"
#include "pins.h"

extern struct VehicleState g_state;
extern SemaphoreHandle_t stateMutex;
extern SemaphoreHandle_t spiBusMutex;

static TFT_eSPI tft = TFT_eSPI();

// ── Color Palette ───────────────────────────────────────────────
#define CLR_BG         TFT_BLACK
#define CLR_TEXT       TFT_WHITE
#define CLR_ACCENT     0x07FF    // Cyan
#define CLR_GOOD       0x07E0    // Green
#define CLR_WARN       0xFD20    // Orange
#define CLR_DANGER     0xF800    // Red
#define CLR_DIMMED     0x4208    // Dark grey

// ── Score Color Mapping ─────────────────────────────────────────
static uint16_t scoreColor(uint8_t score) {
  if (score >= 80) return CLR_GOOD;
  if (score >= 50) return CLR_WARN;
  return CLR_DANGER;
}

static const char* cabinStatusStr(CabinStatus s) {
  switch (s) {
    case CABIN_PRESENCE_OK:      return "OK";
    case CABIN_NO_MOVEMENT:      return "STILL";
    case CABIN_POSSIBLE_DISTRESS: return "ALERT!";
    case CABIN_UNKNOWN:          return "N/A";
    default:                     return "---";
  }
}

static uint16_t cabinStatusColor(CabinStatus s) {
  switch (s) {
    case CABIN_PRESENCE_OK:      return CLR_GOOD;
    case CABIN_NO_MOVEMENT:      return CLR_WARN;
    case CABIN_POSSIBLE_DISTRESS: return CLR_DANGER;
    default:                     return CLR_DIMMED;
  }
}

// ── Screen Layout ───────────────────────────────────────────────
// For a 240×320 display (portrait orientation)

static void drawHeader() {
  tft.setTextColor(CLR_ACCENT, CLR_BG);
  tft.setTextSize(1);
  tft.setCursor(4, 4);
  tft.print("CORTEXION");
  tft.drawFastHLine(0, 16, 240, CLR_ACCENT);
}

static void drawSpeed(float speed) {
  tft.setTextSize(4);
  tft.setTextColor(CLR_TEXT, CLR_BG);
  tft.setCursor(20, 30);
  tft.printf("%3d", (int)speed);
  tft.setTextSize(2);
  tft.setCursor(140, 40);
  tft.print("km/h");
}

static void drawScore(uint8_t score) {
  uint16_t color = scoreColor(score);
  tft.setTextSize(3);
  tft.setTextColor(color, CLR_BG);
  tft.setCursor(20, 85);
  tft.printf("Score: %3d", score);
  // Score bar
  tft.fillRect(20, 120, 200, 8, CLR_DIMMED);
  tft.fillRect(20, 120, score * 2, 8, color);
}

static void drawCabinStatus(CabinStatus status) {
  tft.drawFastHLine(0, 140, 240, CLR_DIMMED);
  tft.setTextSize(1);
  tft.setTextColor(CLR_DIMMED, CLR_BG);
  tft.setCursor(4, 148);
  tft.print("CABIN:");
  tft.setTextSize(2);
  tft.setTextColor(cabinStatusColor(status), CLR_BG);
  tft.setCursor(60, 145);
  tft.printf("%-8s", cabinStatusStr(status));
}

static void drawPeerInfo(bool active, const V2VBeacon& peer) {
  tft.drawFastHLine(0, 170, 240, CLR_DIMMED);
  tft.setTextSize(1);
  tft.setTextColor(CLR_DIMMED, CLR_BG);
  tft.setCursor(4, 178);
  tft.print("PEER:");

  if (active) {
    tft.setTextSize(2);
    tft.setTextColor(CLR_TEXT, CLR_BG);
    tft.setCursor(60, 175);
    tft.printf("V%d %3dkm/h", peer.vehicle_id, peer.speed_kmh);

    // Peer hazard indicator
    if (peer.hazard_flags & HAZARD_HARSH_BRAKE) {
      tft.setTextColor(CLR_DANGER, CLR_BG);
      tft.setCursor(4, 200);
      tft.setTextSize(2);
      tft.print("!! PEER BRAKING !!");
    }

    if (peer.cabin_status == CABIN_POSSIBLE_DISTRESS) {
      tft.setTextColor(CLR_DANGER, CLR_BG);
      tft.setCursor(4, 220);
      tft.setTextSize(2);
      tft.print("!! PEER DISTRESS !!");
    }
  } else {
    tft.setTextSize(1);
    tft.setTextColor(CLR_DIMMED, CLR_BG);
    tft.setCursor(60, 180);
    tft.print("No peer in range");
  }
}

static void drawSystemStatus(bool obdOk, bool gpsOk) {
  tft.drawFastHLine(0, 250, 240, CLR_DIMMED);
  tft.setTextSize(1);
  tft.setCursor(4, 258);
  tft.setTextColor(obdOk ? CLR_GOOD : CLR_DANGER, CLR_BG);
  tft.printf("OBD:%s", obdOk ? "OK " : "ERR");
  tft.setCursor(80, 258);
  tft.setTextColor(gpsOk ? CLR_GOOD : CLR_WARN, CLR_BG);
  tft.printf("GPS:%s", gpsOk ? "FIX" : "---");
}

// ── Task Entry Point ────────────────────────────────────────────

void screenTask(void* pv) {
  vTaskDelay(pdMS_TO_TICKS(2000));  // Let other tasks start

  if (xSemaphoreTake(spiBusMutex, pdMS_TO_TICKS(5000))) {
    tft.init();
    tft.setRotation(0);  // Portrait
    tft.fillScreen(CLR_BG);
    drawHeader();
    xSemaphoreGive(spiBusMutex);
  }

  Serial.println("[SCREEN] TFT display initialized");

  while (true) {
    // Read state snapshot under mutex
    VehicleState snap;
    if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(50))) {
      snap = g_state;  // Copy entire struct
      xSemaphoreGive(stateMutex);
    } else {
      vTaskDelay(pdMS_TO_TICKS(200));
      continue;
    }

    // Render under SPI mutex
    if (xSemaphoreTake(spiBusMutex, pdMS_TO_TICKS(100))) {
      drawSpeed(snap.speed_kmh);
      drawScore(snap.driving_score);
      drawCabinStatus(snap.cabin_status);
      drawPeerInfo(snap.peer_active, snap.last_peer_beacon);
      drawSystemStatus(snap.obd_connected, snap.gps_valid);
      xSemaphoreGive(spiBusMutex);
    }

    vTaskDelay(pdMS_TO_TICKS(200));  // ~5 FPS — fast enough for human reading
  }
}
