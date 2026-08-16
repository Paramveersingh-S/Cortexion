/**
 * Cortexion Hub — GPS Task
 *
 * Parses NEO-6M NMEA sentences over UART1 and sends GPSFix
 * structs to the fusion task. Handles cold start gracefully:
 * reports gps_valid=false until a real fix is acquired, so the
 * LoRa TX task doesn't broadcast lat=0/lon=0 (which would show
 * the car off the coast of West Africa on the dashboard map).
 */

#include <Arduino.h>
#include <TinyGPSPlus.h>
#include "packet.h"
#include "pins.h"

extern QueueHandle_t gpsQueue;

static TinyGPSPlus gps;
static HardwareSerial gpsSerial(1);  // UART1

void gpsTask(void* pv) {
  gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  Serial.println("[GPS] UART initialized — waiting for fix...");

  GPSFix fix = {};
  uint32_t lastFixTime = 0;
  bool hadFirstFix = false;

  while (true) {
    // Read all available NMEA data
    while (gpsSerial.available() > 0) {
      char c = gpsSerial.read();
      gps.encode(c);
    }

    // Build fix message
    fix.valid = gps.location.isValid() && gps.location.isUpdated();

    if (fix.valid) {
      fix.lat_e6 = static_cast<int32_t>(gps.location.lat() * 1000000.0);
      fix.lon_e6 = static_cast<int32_t>(gps.location.lng() * 1000000.0);
      fix.speed_kmh = gps.speed.kmph();
      fix.heading_deg = gps.course.deg();
      fix.timestamp_ms = millis();
      lastFixTime = millis();

      if (!hadFirstFix) {
        Serial.printf("[GPS] First fix acquired: %.6f, %.6f\n",
                      gps.location.lat(), gps.location.lng());
        hadFirstFix = true;
      }
    } else {
      // Stale fix detection — if we had a fix but lost it for >10s
      if (hadFirstFix && millis() - lastFixTime > 10000) {
        fix.valid = false;
        Serial.println("[GPS] Fix lost — position data stale");
      }
    }

    fix.timestamp_ms = millis();
    xQueueOverwrite(gpsQueue, &fix);

    vTaskDelay(pdMS_TO_TICKS(100));  // 10 Hz NMEA parse rate
  }
}
