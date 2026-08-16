/**
 * Cortexion Hub — IMU Task (MPU6050)
 *
 * Reads accelerometer and gyroscope data from the MPU6050 over I2C.
 * Provides independent harsh-braking/acceleration detection that
 * doesn't rely on OBD polling rate — the IMU samples at 100 Hz,
 * while OBD maxes out at ~5 Hz, so the IMU catches transient events
 * the OBD data might miss entirely.
 */

#include <Arduino.h>
#include <Wire.h>
#include "packet.h"
#include "pins.h"

extern QueueHandle_t imuQueue;

// MPU6050 I2C address
#define MPU6050_ADDR 0x68

// MPU6050 register addresses
#define MPU6050_REG_PWR_MGMT_1  0x6B
#define MPU6050_REG_ACCEL_XOUT_H 0x3B
#define MPU6050_REG_ACCEL_CONFIG 0x1C
#define MPU6050_REG_GYRO_CONFIG  0x1B

// Scale factors
#define ACCEL_SCALE_4G  8192.0f   // LSB/g at ±4g range
#define GYRO_SCALE_500  65.5f     // LSB/(°/s) at ±500°/s range

static bool initMPU6050() {
  Wire.begin(PIN_IMU_SDA, PIN_IMU_SCL);
  Wire.setClock(400000);  // 400 kHz I2C fast mode

  // Wake up MPU6050
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_REG_PWR_MGMT_1);
  Wire.write(0x00);  // Clear sleep bit
  if (Wire.endTransmission(true) != 0) {
    Serial.println("[IMU] MPU6050 not found — skipping IMU");
    return false;
  }

  // Set accelerometer range to ±4g (good for vehicle dynamics)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_REG_ACCEL_CONFIG);
  Wire.write(0x08);  // ±4g
  Wire.endTransmission(true);

  // Set gyroscope range to ±500°/s
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_REG_GYRO_CONFIG);
  Wire.write(0x08);  // ±500°/s
  Wire.endTransmission(true);

  Serial.println("[IMU] MPU6050 initialized (±4g accel, ±500°/s gyro)");
  return true;
}

static void readMPU6050(IMUReading& reading) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_REG_ACCEL_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 14, true);

  if (Wire.available() < 14) return;

  int16_t ax = (Wire.read() << 8) | Wire.read();
  int16_t ay = (Wire.read() << 8) | Wire.read();
  int16_t az = (Wire.read() << 8) | Wire.read();
  int16_t temp_raw = (Wire.read() << 8) | Wire.read();  // Skip temperature
  int16_t gx = (Wire.read() << 8) | Wire.read();
  int16_t gy = (Wire.read() << 8) | Wire.read();
  int16_t gz = (Wire.read() << 8) | Wire.read();

  // Convert to physical units
  // Note: axis mapping depends on IMU mounting orientation in the vehicle
  // Default assumes: X = forward, Y = lateral (left), Z = up
  reading.accel_x = (float)ax / ACCEL_SCALE_4G * 9.81f;   // m/s²
  reading.accel_y = (float)ay / ACCEL_SCALE_4G * 9.81f;   // m/s²
  reading.accel_z = (float)az / ACCEL_SCALE_4G * 9.81f;   // m/s²
  reading.gyro_z  = (float)gz / GYRO_SCALE_500;            // °/s → yaw rate
  reading.timestamp_ms = millis();
}

void imuTask(void* pv) {
  vTaskDelay(pdMS_TO_TICKS(500));  // Let I2C bus settle

  if (!initMPU6050()) {
    // IMU is optional — task exits gracefully if not present
    Serial.println("[IMU] Task exiting — IMU not available");
    vTaskDelete(NULL);
    return;
  }

  IMUReading reading = {};

  while (true) {
    readMPU6050(reading);
    xQueueOverwrite(imuQueue, &reading);
    vTaskDelay(pdMS_TO_TICKS(10));  // 100 Hz sampling
  }
}
