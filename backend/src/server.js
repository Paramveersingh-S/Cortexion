/**
 * Cortexion Backend — Express + WebSocket + MQTT Server
 *
 * Central backend service that:
 * 1. Subscribes to MQTT for incoming V2V beacons from the gateway
 * 2. Stores telemetry in SQLite
 * 3. Runs hazard fusion and congestion estimation
 * 4. Broadcasts updates via WebSocket to all connected dashboards
 * 5. Serves REST API for historical data
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import mqtt from 'mqtt';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import { insertTelemetry, insertAlert, getVehicleHistory,
         getLatestByVehicle, getAllVehiclesLatest,
         getAlerts, getAlertStats,
         insertMmWaveReading, getMmWaveHistory } from './db.js';
import { computeHazardLevel } from './hazard-fusion.js';
import { CongestionEstimator, computeSegmentId } from './congestion-estimator.js';
import { otaRouter } from './ota-server.js';

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3001');
const WS_PORT = parseInt(process.env.WS_PORT || '8081');
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';

// ── State ───────────────────────────────────────────────────────
const vehicleState = new Map();   // vehicleId → latest beacon
const mmwaveState = new Map();    // vehicleId → latest mmWave data
const congestion = new CongestionEstimator();
let wsClients = new Set();

// ── Express App ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// OTA Firmware Updates
app.use('/api/ota', otaRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    vehicles: vehicleState.size,
    wsClients: wsClients.size,
    uptime: process.uptime(),
  });
});

// Vehicle endpoints
app.get('/api/vehicles', (req, res) => {
  try {
    const vehicles = getAllVehiclesLatest();
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vehicles/:id/latest', (req, res) => {
  const state = vehicleState.get(parseInt(req.params.id));
  if (!state) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(state);
});

app.get('/api/vehicles/:id/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '200');
    const rows = getVehicleHistory(parseInt(req.params.id), limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alert endpoints
app.get('/api/alerts', (req, res) => {
  try {
    const alerts = getAlerts(req.query.since, parseInt(req.query.limit || '100'));
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts/stats', (req, res) => {
  try {
    res.json(getAlertStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Congestion endpoints
app.get('/api/congestion', (req, res) => {
  res.json(congestion.getAllSegments());
});

app.get('/api/congestion/:segmentId', (req, res) => {
  res.json(congestion.getLevel(req.params.segmentId));
});

// mmWave endpoints
app.get('/api/mmwave/:vehicleId/latest', (req, res) => {
  const state = mmwaveState.get(parseInt(req.params.vehicleId));
  if (!state) return res.status(404).json({ error: 'No mmWave data for this vehicle' });
  res.json(state);
});

app.get('/api/mmwave/:vehicleId/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '100');
    const rows = getMmWaveHistory(parseInt(req.params.vehicleId), limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start HTTP server
app.listen(HTTP_PORT, () => {
  console.log(`[BACKEND] REST API listening on http://localhost:${HTTP_PORT}`);
});

// ── WebSocket Server ────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`[WS] Client connected (total: ${wsClients.size})`);

  // Send current state to new client
  for (const [id, state] of vehicleState) {
    ws.send(JSON.stringify({ type: 'beacon', data: state }));
  }

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WS] Client disconnected (total: ${wsClients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Client error:', err.message);
    wsClients.delete(ws);
  });
});

console.log(`[BACKEND] WebSocket server on ws://localhost:${WS_PORT}`);

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const ws of wsClients) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

// ── MQTT Subscription ───────────────────────────────────────────
console.log(`[BACKEND] Connecting to MQTT at ${MQTT_URL}...`);
const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: 'cortexion-backend',
  clean: true,
  reconnectPeriod: 5000,
});

mqttClient.on('connect', () => {
  console.log('[BACKEND] MQTT connected');
  mqttClient.subscribe('v2v/+/beacon');
  mqttClient.subscribe('v2v/+/mmwave');
});

mqttClient.on('message', async (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());

    // ── mmWave data handling ──────────────────────────────────────
    if (topic.includes('/mmwave')) {
      mmwaveState.set(data.vehicleId, data);

      try {
        insertMmWaveReading(data);
      } catch (err) {
        // Non-critical — don't break the live pipeline
      }

      broadcast({ type: 'mmwave', data });
      return;
    }

    // ── Beacon data handling (existing) ──────────────────────────
    const beacon = data;

    // Store in memory
    vehicleState.set(beacon.vehicleId, beacon);

    // Persist to database (don't let DB errors kill the live pipeline)
    try {
      insertTelemetry(beacon);
    } catch (err) {
      console.error('[DB] Write failed, continuing:', err.message);
    }

    // Update congestion estimator
    if (beacon.lat && beacon.lon) {
      const segId = computeSegmentId(beacon.lat, beacon.lon);
      congestion.update(segId, beacon.speedKmh);
    }

    // Run hazard fusion
    const peerBeacons = Array.from(vehicleState.values())
      .filter(v => v.vehicleId !== beacon.vehicleId);

    const peer = peerBeacons.length > 0 ? peerBeacons[0] : null;
    let peerDistance = Infinity;

    if (peer && beacon.lat && beacon.lon && peer.lat && peer.lon) {
      peerDistance = haversineDistance(beacon.lat, beacon.lon, peer.lat, peer.lon);
    }

    const hazard = computeHazardLevel({
      ownScore: beacon.drivingScore,
      ownSpeed: beacon.speedKmh,
      ownHazards: beacon.hazards || {},
      cabinStatus: beacon.cabinStatus,
      peer,
      peerDistance,
    });

    // Log alerts for significant hazards
    if (hazard.level !== 'low') {
      try {
        insertAlert({
          vehicleId: beacon.vehicleId,
          alertType: hazard.reasons[0] || 'hazard',
          severity: hazard.level,
          details: `Score: ${hazard.score}`,
          hazardLevel: hazard.level,
          hazardReasons: hazard.reasons,
        });
      } catch (err) {
        // Non-critical, continue
      }
    }

    // Broadcast to all WebSocket clients
    broadcast({
      type: 'beacon',
      data: { ...beacon, hazard, peerDistance: isFinite(peerDistance) ? Math.round(peerDistance) : null },
    });

  } catch (err) {
    console.error('[BACKEND] Message processing error:', err.message);
  }
});

mqttClient.on('error', (err) => {
  console.error('[BACKEND] MQTT error:', err.message);
});

// ── Haversine Distance ──────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

console.log('[BACKEND] Cortexion Backend started');
