#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include "config.h"

// Define OTA AP details (typically a mobile hotspot)
#ifndef OTA_SSID
  #define OTA_SSID "Cortexion-OTA"
  #define OTA_PASS "cortexion123"
#endif

#define CURRENT_VERSION "2.0.0"

// Assumes the backend is running on a laptop or cloud server
#ifndef OTA_SERVER_URL
  #define OTA_SERVER_URL "http://192.168.43.1:3001/api/ota/download"
#endif

// Triggered externally by button or app
extern bool triggerOtaUpdate;

void otaTask(void* pv) {
  while (true) {
    if (triggerOtaUpdate) {
      Serial.println("[OTA] Update triggered. Disconnecting from ELM327...");
      
      // Disconnect from current OBD-II WiFi
      WiFi.disconnect();
      delay(1000);
      
      Serial.printf("[OTA] Connecting to OTA WiFi: %s\n", OTA_SSID);
      WiFi.begin(OTA_SSID, OTA_PASS);
      
      int attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[OTA] Connected to internet. Starting HTTP update...");
        
        WiFiClient client;
        // This will block and reboot the ESP32 if successful
        t_httpUpdate_return ret = httpUpdate.update(client, OTA_SERVER_URL);
        
        switch (ret) {
          case HTTP_UPDATE_FAILED:
            Serial.printf("[OTA] HTTP_UPDATE_FAILED Error (%d): %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
            break;
          case HTTP_UPDATE_NO_UPDATES:
            Serial.println("[OTA] HTTP_UPDATE_NO_UPDATES");
            break;
          case HTTP_UPDATE_OK:
            Serial.println("[OTA] HTTP_UPDATE_OK"); // Will reboot before this
            break;
        }
      } else {
        Serial.println("\n[OTA] Failed to connect to OTA WiFi.");
      }
      
      triggerOtaUpdate = false; // Reset trigger
      
      // Reconnect to ELM327
      Serial.println("[OTA] Reconnecting to ELM327...");
      WiFi.disconnect();
      delay(1000);
      WiFi.begin(ELM327_SSID, ELM327_PASSWORD);
    }
    
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}
