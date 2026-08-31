import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const otaRouter = express.Router();

const FIRMWARE_DIR = path.join(__dirname, '../firmware_bin');

// Ensure directory exists
if (!fs.existsSync(FIRMWARE_DIR)) {
  fs.mkdirSync(FIRMWARE_DIR, { recursive: true });
}

// Simulated firmware metadata
// In production, this would be in a database
const firmwareMeta = {
  version: '2.1.0',
  releaseNotes: 'Added AES-128 encryption and OTA support.',
  binFile: 'firmware_v2.1.0.bin',
};

// Endpoint for ESP32 to check if an update is available
otaRouter.get('/check', (req, res) => {
  const currentVersion = req.query.version;
  if (!currentVersion) {
    return res.status(400).json({ error: 'Missing version parameter' });
  }

  // Simple semver check (assuming format x.y.z)
  if (currentVersion !== firmwareMeta.version) {
    res.json({
      updateAvailable: true,
      latestVersion: firmwareMeta.version,
      releaseNotes: firmwareMeta.releaseNotes,
      downloadUrl: `/api/ota/download`,
    });
  } else {
    res.json({ updateAvailable: false });
  }
});

// Endpoint for ESP32 to download the binary
otaRouter.get('/download', (req, res) => {
  const filePath = path.join(FIRMWARE_DIR, firmwareMeta.binFile);
  
  if (!fs.existsSync(filePath)) {
    // In dev mode, return a 404. In prod, we'd actually send the bin file.
    return res.status(404).send('Firmware binary not found on server.');
  }

  res.download(filePath, firmwareMeta.binFile);
});
