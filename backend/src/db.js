/**
 * Cortexion Backend — Database Abstraction Layer
 *
 * Uses SQLite (via better-sqlite3) for zero-config local development.
 * Designed to be swappable to PostgreSQL for production.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'cortexion.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    initSchema();
    console.log(`[DB] SQLite database opened at ${DB_PATH}`);
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      lat REAL,
      lon REAL,
      speed_kmh INTEGER,
      heading_deg INTEGER,
      driving_score INTEGER,
      hazard_flags INTEGER,
      cabin_status TEXT,
      cabin_status_code INTEGER,
      timestamp_ms INTEGER,
      received_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time
    ON vehicle_telemetry (vehicle_id, received_at DESC);

    CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      details TEXT,
      hazard_level TEXT,
      hazard_reasons TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_time
    ON alert_log (created_at DESC);

    CREATE TABLE IF NOT EXISTS training_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_label TEXT,
      started_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mmwave_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      present INTEGER,
      target_distance_mm INTEGER,
      target_distance_m REAL,
      gate_energies TEXT,
      max_energy_gate INTEGER,
      motion_state TEXT,
      received_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mmwave_vehicle_time
    ON mmwave_readings (vehicle_id, received_at DESC);
  `);
}

// ── Query Helpers ───────────────────────────────────────────────

export function insertTelemetry(beacon) {
  const stmt = getDb().prepare(`
    INSERT INTO vehicle_telemetry
      (vehicle_id, lat, lon, speed_kmh, heading_deg, driving_score,
       hazard_flags, cabin_status, cabin_status_code, timestamp_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    beacon.vehicleId, beacon.lat, beacon.lon,
    beacon.speedKmh, beacon.headingDeg, beacon.drivingScore,
    beacon.hazardFlags, beacon.cabinStatus, beacon.cabinStatusCode,
    beacon.timestampMs
  );
}

export function insertAlert(alert) {
  const stmt = getDb().prepare(`
    INSERT INTO alert_log (vehicle_id, alert_type, severity, details, hazard_level, hazard_reasons)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    alert.vehicleId, alert.alertType, alert.severity,
    alert.details, alert.hazardLevel,
    JSON.stringify(alert.hazardReasons || [])
  );
}

export function getVehicleHistory(vehicleId, limit = 200) {
  return getDb().prepare(
    `SELECT * FROM vehicle_telemetry WHERE vehicle_id = ?
     ORDER BY received_at DESC LIMIT ?`
  ).all(vehicleId, limit);
}

export function getLatestByVehicle(vehicleId) {
  return getDb().prepare(
    `SELECT * FROM vehicle_telemetry WHERE vehicle_id = ?
     ORDER BY received_at DESC LIMIT 1`
  ).get(vehicleId);
}

export function getAllVehiclesLatest() {
  return getDb().prepare(`
    SELECT t.* FROM vehicle_telemetry t
    INNER JOIN (
      SELECT vehicle_id, MAX(received_at) as max_time
      FROM vehicle_telemetry
      GROUP BY vehicle_id
    ) latest ON t.vehicle_id = latest.vehicle_id AND t.received_at = latest.max_time
  `).all();
}

export function getAlerts(since = null, limit = 100) {
  if (since) {
    return getDb().prepare(
      `SELECT * FROM alert_log WHERE created_at > ? ORDER BY created_at DESC LIMIT ?`
    ).all(since, limit);
  }
  return getDb().prepare(
    `SELECT * FROM alert_log ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
}

export function getAlertStats() {
  return getDb().prepare(`
    SELECT
      alert_type,
      severity,
      COUNT(*) as count,
      MAX(created_at) as last_occurred
    FROM alert_log
    GROUP BY alert_type, severity
    ORDER BY count DESC
  `).all();
}

// ── mmWave Data ─────────────────────────────────────────────────

export function insertMmWaveReading(data) {
  const stmt = getDb().prepare(`
    INSERT INTO mmwave_readings
      (vehicle_id, present, target_distance_mm, target_distance_m,
       gate_energies, max_energy_gate, motion_state)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    data.vehicleId, data.present ? 1 : 0, data.targetDistMm,
    data.targetDistM, JSON.stringify(data.gateEnergy),
    data.maxEnergyGate, data.motionState
  );
}

export function getMmWaveHistory(vehicleId, limit = 100) {
  return getDb().prepare(
    `SELECT * FROM mmwave_readings WHERE vehicle_id = ?
     ORDER BY received_at DESC LIMIT ?`
  ).all(vehicleId, limit);
}
