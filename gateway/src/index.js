/**
 * Cortexion Gateway — Serial-to-MQTT Bridge
 *
 * Reads raw V2VBeacon binary packets from the base station LoRa
 * module over USB-serial, validates CRC8, parses to JSON, and
 * publishes to MQTT topics for the backend to consume.
 *
 * MQTT topics:
 *   v2v/{vehicleId}/beacon — parsed beacon JSON
 *   v2v/gateway/status     — gateway health/stats
 */

import { SerialPort } from 'serialport';
import mqtt from 'mqtt';
import { parseBeacon, BEACON_SIZE } from './parser.js';
import 'dotenv/config';

const SERIAL_PATH = process.env.SERIAL_PATH || 'COM3';
const SERIAL_BAUD = parseInt(process.env.SERIAL_BAUD || '115200');
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const STATS_INTERVAL_MS = 10000;

// ── Stats tracking ──────────────────────────────────────────────
const stats = {
  packetsReceived: 0,
  packetsValid: 0,
  crcErrors: 0,
  versionErrors: 0,
  parseErrors: 0,
  startedAt: new Date().toISOString(),
};

// ── MQTT Connection ─────────────────────────────────────────────
console.log(`[GATEWAY] Connecting to MQTT broker at ${MQTT_URL}...`);
const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: 'cortexion-gateway',
  clean: true,
  reconnectPeriod: 5000,
});

mqttClient.on('connect', () => {
  console.log('[GATEWAY] MQTT connected');
  mqttClient.publish('v2v/gateway/status', JSON.stringify({
    status: 'online',
    startedAt: stats.startedAt,
  }), { retain: true });
});

mqttClient.on('error', (err) => {
  console.error('[GATEWAY] MQTT error:', err.message);
});

// ── Serial Port Connection ──────────────────────────────────────
console.log(`[GATEWAY] Opening serial port ${SERIAL_PATH} at ${SERIAL_BAUD} baud...`);

let port;
try {
  port = new SerialPort({
    path: SERIAL_PATH,
    baudRate: SERIAL_BAUD,
    autoOpen: true,
  });
} catch (err) {
  console.error(`[GATEWAY] Failed to open serial port: ${err.message}`);
}

const tcpPort = parseInt(process.env.SIM_PORT || '9000');
console.log('[GATEWAY] Running in simulation mode — use the simulator to inject packets');
import('net').then(({ createServer }) => {
  const server = createServer((socket) => {
    console.log('[GATEWAY] Simulator connected via TCP');
    processStream(socket);
  });
  server.listen(tcpPort, () => {
    console.log(`[GATEWAY] TCP simulator listener on port ${tcpPort}`);
  });
});

// ── Stream Processing ───────────────────────────────────────────
function processStream(stream) {
  let buffer = Buffer.alloc(0);

  stream.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= BEACON_SIZE) {
      const packet = buffer.subarray(0, BEACON_SIZE);
      buffer = buffer.subarray(BEACON_SIZE);
      stats.packetsReceived++;

      const beacon = parseBeacon(packet);

      if (!beacon) {
        stats.parseErrors++;
        continue;
      }

      if (beacon.error === 'crc_mismatch') {
        stats.crcErrors++;
        console.warn(`[GATEWAY] CRC mismatch (computed=${beacon.computed}, received=${beacon.received})`);
        continue;
      }

      if (beacon.error === 'unknown_version') {
        stats.versionErrors++;
        console.warn(`[GATEWAY] Unknown proto_version ${beacon.version} — dropping`);
        continue;
      }

      stats.packetsValid++;

      // Inject simulated engine temp and battery voltage for OBD data
      beacon.engineTemp = Math.round((85 + (Math.random() * 10 - 5)) * 10) / 10; // 80 to 90 C
      beacon.batteryVoltage = Math.round((13.5 + (Math.random() * 1.0 - 0.5)) * 10) / 10; // 13.0 to 14.0 V

      // Publish to MQTT
      const topic = `v2v/${beacon.vehicleId}/beacon`;
      const payload = JSON.stringify(beacon);
      mqttClient.publish(topic, payload);

      if (stats.packetsValid % 20 === 1) {
        console.log(`[GATEWAY] Vehicle ${beacon.vehicleId}: ${beacon.speedKmh} km/h, ` +
                     `score=${beacon.drivingScore}, cabin=${beacon.cabinStatus}`);
      }
    }
  });

  stream.on('error', (err) => {
    console.error('[GATEWAY] Stream error:', err.message);
  });

  stream.on('close', () => {
    console.log('[GATEWAY] Stream closed');
  });
}

if (port) {
  port.on('open', () => {
    console.log('[GATEWAY] Serial port opened');
    processStream(port);
  });

  port.on('error', (err) => {
    console.error('[GATEWAY] Serial port error:', err.message);
  });
}

// ── Periodic Stats ──────────────────────────────────────────────
setInterval(() => {
  mqttClient.publish('v2v/gateway/status', JSON.stringify({
    status: 'online',
    ...stats,
    uptimeMs: Date.now() - new Date(stats.startedAt).getTime(),
  }));
}, STATS_INTERVAL_MS);

console.log('[GATEWAY] Cortexion Gateway started');
