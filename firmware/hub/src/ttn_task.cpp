#include <Arduino.h>
#include <SPI.h>
#include <lmic.h>
#include <hal/hal.h>
#include "packet.h"
#include "pins.h"
#include "config.h"

extern SemaphoreHandle_t spiBusMutex;
extern bool triggerTtnDistress;
extern uint8_t distressHazardCode;

// TTN ABP Credentials (from TTN Console)
static const PROGMEM u1_t NWKSKEY[16] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
static const u1_t PROGMEM APPSKEY[16] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
static const u4_t DEVADDR = 0x00000000;

// LMIC requires these to be defined
void os_getArtEui (u1_t* buf) { }
void os_getDevEui (u1_t* buf) { }
void os_getDevKey (u1_t* buf) { }

// LMIC pin mapping
const lmic_pinmap lmic_pins = {
    .nss = PIN_LORA_CS,
    .rxtx = LMIC_UNUSED_PIN,
    .rst = PIN_LORA_RST,
    .dio = {PIN_LORA_DIO0, LMIC_UNUSED_PIN, LMIC_UNUSED_PIN}, // We only map DIO0 for basic TX
};

static bool lmicInitialized = false;

void onEvent (ev_t ev) {
    switch(ev) {
        case EV_TXCOMPLETE:
            Serial.println(F("[TTN] EV_TXCOMPLETE (Distress sent)"));
            triggerTtnDistress = false; // Reset trigger
            break;
        default:
            break;
    }
}

void ttnTask(void* pv) {
    while (true) {
        if (triggerTtnDistress) {
            Serial.println("[TTN] Distress triggered. Suspending P2P LoRa...");
            
            // Take absolute control of the SPI bus from P2P LoRa
            if (xSemaphoreTake(spiBusMutex, portMAX_DELAY)) {
                
                if (!lmicInitialized) {
                    os_init();
                    LMIC_reset();
                    
                    uint8_t appskey[sizeof(APPSKEY)];
                    uint8_t nwkskey[sizeof(NWKSKEY)];
                    memcpy_P(appskey, APPSKEY, sizeof(APPSKEY));
                    memcpy_P(nwkskey, NWKSKEY, sizeof(NWKSKEY));
                    
                    LMIC_setSession (0x1, DEVADDR, nwkskey, appskey);
                    
                    // EU868 / IN865 setup depending on region config
                    #if defined(CFG_in866)
                      LMIC_setupChannel(0, 865062500, DR_RANGE_MAP(DR_SF12, DR_SF7),  BAND_CENTI);
                    #else
                      LMIC_setupChannel(0, 868100000, DR_RANGE_MAP(DR_SF12, DR_SF7),  BAND_CENTI);
                    #endif
                    
                    LMIC_setLinkCheckMode(0);
                    LMIC_setDrTxpow(DR_SF10, 14); // SF10 for better penetration
                    lmicInitialized = true;
                }
                
                // 4-byte minimal payload: [Vehicle ID LSB, Vehicle ID MSB, Hazard Code, 0x00]
                uint8_t distressPayload[4];
                distressPayload[0] = VEHICLE_ID & 0xFF;
                distressPayload[1] = (VEHICLE_ID >> 8) & 0xFF;
                distressPayload[2] = distressHazardCode;
                distressPayload[3] = 0x00;
                
                // Queue the packet
                LMIC_setTxData2(1, distressPayload, sizeof(distressPayload), 0);
                
                // Drive the LMIC state machine until TX is done
                while (triggerTtnDistress) {
                    os_runloop_once();
                    vTaskDelay(pdMS_TO_TICKS(10));
                }
                
                // Release SPI bus back to P2P LoRa tasks
                // They will re-init the SX1278 for standard P2P mode on next loop
                xSemaphoreGive(spiBusMutex);
            }
        }
        
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
