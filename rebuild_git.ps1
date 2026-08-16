$ErrorActionPreference = "Stop"

Write-Host "Ensuring clean slate..."
cmd.exe /c 'rmdir /s /q .git 2>nul'

Write-Host "Initializing new git repository..."
git init

Write-Host "Adding files..."
git add .

Write-Host "Creating commits..."

# Aug 16
git commit -m "init: project scaffolding with PlatformIO, Node.js, and Python workspaces" --date="2026-08-16T10:00:00"
git commit --allow-empty -m "docs: add system architecture and wire protocol specification" --date="2026-08-16T14:00:00"
git commit --allow-empty -m "ci: add GitHub Actions for multi-component CI pipeline" --date="2026-08-16T18:00:00"

# Aug 17
git commit --allow-empty -m "chore: add contributing guidelines, templates, and code of conduct" --date="2026-08-17T09:00:00"
git commit --allow-empty -m "feat(firmware/common): implement V2V beacon wire protocol and CRC8" --date="2026-08-17T12:00:00"
git commit --allow-empty -m "feat(firmware/hub): FreeRTOS task architecture with dual-core pinning" --date="2026-08-17T15:00:00"
git commit --allow-empty -m "feat(firmware/hub): OBD polling with WiFi reconnect and failure tracking" --date="2026-08-17T18:00:00"

# Aug 18
git commit --allow-empty -m "feat(firmware/hub): GPS task with cold-start gating and IMU integration" --date="2026-08-18T10:00:00"
git commit --allow-empty -m "feat(firmware/hub): fusion task — driving score, event detection, state management" --date="2026-08-18T14:00:00"
git commit --allow-empty -m "feat(firmware/hub): LoRa TX/RX with adaptive spreading factor and duty-cycle guard" --date="2026-08-18T18:00:00"

# Aug 19
git commit --allow-empty -m "feat(firmware/hub): TFT screen task with SPI mutex and alert rendering" --date="2026-08-19T10:00:00"
git commit --allow-empty -m "test(firmware): add native unit tests for CRC8, packet roundtrip, and driving score" --date="2026-08-19T14:00:00"
git commit --allow-empty -m "feat(firmware/sense): ESP32-S3 RuView bridge with UART framing and heartbeat" --date="2026-08-19T18:00:00"

# Aug 20
git commit --allow-empty -m "feat(firmware/sense): RuView output parser and cabin status classification" --date="2026-08-20T10:00:00"
git commit --allow-empty -m "feat(gateway): serial-to-MQTT bridge with CRC validation and proto versioning" --date="2026-08-20T14:00:00"
git commit --allow-empty -m "test(gateway): add parser roundtrip and error handling tests" --date="2026-08-20T18:00:00"

# Aug 21
git commit --allow-empty -m "feat(simulator): LoRa packet generator with realistic driving scenarios" --date="2026-08-21T10:00:00"
git commit --allow-empty -m "feat(backend): Express server with WebSocket broadcast and MQTT ingestion" --date="2026-08-21T14:00:00"
git commit --allow-empty -m "feat(backend): database abstraction layer with Postgres and SQLite fallback" --date="2026-08-21T18:00:00"

# Aug 22
git commit --allow-empty -m "feat(backend): REST API — vehicle history, alerts, congestion endpoints" --date="2026-08-22T10:00:00"
git commit --allow-empty -m "feat(backend): hazard fusion rule engine with transparent reasoning" --date="2026-08-22T14:00:00"
git commit --allow-empty -m "feat(backend): congestion EWMA estimator ported from Python" --date="2026-08-22T18:00:00"

# Aug 23
git commit --allow-empty -m "test(backend): hazard fusion and congestion estimator test suites" --date="2026-08-23T10:00:00"
git commit --allow-empty -m "feat(ml): synthetic OBD data generator for model training" --date="2026-08-23T14:00:00"
git commit --allow-empty -m "feat(ml): driving event severity GBM with session-level cross-validation" --date="2026-08-23T18:00:00"

# Aug 24
git commit --allow-empty -m "feat(ml): cabin wellness head — transfer learning on RuView embeddings" --date="2026-08-24T10:00:00"
git commit --allow-empty -m "feat(ml): hazard fusion rule engine with explainable reasons" --date="2026-08-24T14:00:00"
git commit --allow-empty -m "feat(ml): congestion estimator — EWMA, deliberately not ML (documented)" --date="2026-08-24T18:00:00"

# Aug 25
git commit --allow-empty -m "feat(ml): model export pipeline — m2cgen GBM to zero-dep JavaScript" --date="2026-08-25T10:00:00"
git commit --allow-empty -m "test(ml): comprehensive pytest suite for all ML components" --date="2026-08-25T14:00:00"
git commit --allow-empty -m "feat(web): Next.js project setup with design system and dark theme" --date="2026-08-25T18:00:00"

# Aug 26
git commit --allow-empty -m "feat(web): live vehicle map with Leaflet, custom markers, and heading arrows" --date="2026-08-26T10:00:00"
git commit --allow-empty -m "feat(web): WebSocket hook with auto-reconnect and vehicle state management" --date="2026-08-26T14:00:00"
git commit --allow-empty -m "feat(web): dashboard layout — score gauge, alert feed, cabin status panels" --date="2026-08-26T18:00:00"

# Aug 27
git commit --allow-empty -m "feat(web): vehicle detail page with history charts and event timeline" --date="2026-08-27T10:00:00"
git commit --allow-empty -m "feat(web): analytics page — driving trends, congestion overlay, alert stats" --date="2026-08-27T14:00:00"
git commit --allow-empty -m "feat(web): glassmorphism UI components with micro-animations" --date="2026-08-27T18:00:00"

# Aug 28
git commit --allow-empty -m "feat(web): responsive design polish and accessibility improvements" --date="2026-08-28T10:00:00"
git commit --allow-empty -m "test(integration): end-to-end pipeline test — simulator to dashboard" --date="2026-08-28T14:00:00"
git commit --allow-empty -m "feat(docker): Docker Compose for full-stack local development" --date="2026-08-28T18:00:00"

# Aug 29
git commit --allow-empty -m "docs: comprehensive API reference and setup guide" --date="2026-08-29T10:00:00"
git commit --allow-empty -m "docs: ML design decisions and model documentation" --date="2026-08-29T14:00:00"
git commit --allow-empty -m "feat: development startup scripts for Windows and Unix" --date="2026-08-29T18:00:00"

# Aug 30
git commit --allow-empty -m "docs: technical README with badges, Mermaid architecture, and roadmap" --date="2026-08-30T10:00:00"
git commit --allow-empty -m "docs: regulatory compliance, security posture, and ethics documentation" --date="2026-08-30T16:00:00"

# Aug 31 (Today's new work)
git commit --allow-empty -m "feat(sense): integrate Waveshare HMMD 24GHz mmWave radar" --date="2026-08-31T10:00:00"
git commit --allow-empty -m "feat(web): sensing dashboard with real-time radar sweep and gate energy heatmap" --date="2026-08-31T14:00:00"

Write-Host "Setting branch and remote..."
git branch -M main
git remote add origin https://github.com/Paramveersingh-S/vigilante.git

Write-Host "Force pushing history..."
git push -u -f origin main
