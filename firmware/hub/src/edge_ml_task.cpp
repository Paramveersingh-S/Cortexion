/**
 * Cortexion Hub — Edge ML Distributed Inference Task
 *
 * This task is part of a distributed Edge ML pipeline where weights 
 * are split between the Sense Node (ESP32-S3) and the Hub Node (ESP32-WROOM).
 * 
 * Pipeline:
 * 1. Sense Node runs the early layers (Conv2D) on the raw CSI data.
 * 2. Sense Node sends intermediate activation tensors over UART to the Hub.
 * 3. Hub Node runs the final Dense/Classification layers.
 * 4. Hub Node broadcasts the severity score over LoRa.
 */

#include <Arduino.h>
#include "config.h"

// TODO: Include TensorFlow Lite Micro headers once the library is added to platformio.ini
// #include "tensorflow/lite/micro/all_ops_resolver.h"
// #include "tensorflow/lite/micro/micro_interpreter.h"
// #include "tensorflow/lite/schema/schema_generated.h"
// #include "model_data_head.h" // The split model weights

extern QueueHandle_t senseQueue;

void edgeMlTask(void* pv) {
  Serial.println("[EDGE-ML] Initializing distributed ML engine...");

  // Pseudo-code for TFLite Micro Initialization
  // const tflite::Model* model = tflite::GetModel(g_model_data);
  // static tflite::MicroInterpreter static_interpreter(model, resolver, tensor_arena, arena_size, error_reporter);
  // static_interpreter.AllocateTensors();

  while (true) {
    // Wait for intermediate tensor from Sense Node via UART
    // (In reality, we receive `CabinStatus` struct, we would expand this to take tensor chunks)
    
    // float intermediate_tensor[128]; 
    // if (xQueueReceive(senseQueue, &intermediate_tensor, portMAX_DELAY) == pdTRUE) {
        
        // Copy to input tensor
        // interpreter->input(0)->data.f = intermediate_tensor;

        // Run inference
        // if (interpreter->Invoke() != kTfLiteOk) { ... }

        // Read output
        // float severity = interpreter->output(0)->data.f[0];

        // Serial.printf("[EDGE-ML] Distributed inference complete. Severity: %.2f\n", severity);
    // }
    
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}
