# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Cortexion, please report it responsibly.

### How to Report

1. **Do NOT open a public GitHub issue** for security vulnerabilities.
2. Email: **security@cortexion.dev** (or open a private security advisory on GitHub)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix & Disclosure**: Within 30 days (coordinated disclosure)

## Known Security Posture

> **This is a research-grade prototype, not a certified safety system.**

### Explicitly Scoped Limitations

| Component | Security Status | Notes |
|-----------|----------------|-------|
| LoRa V2V Broadcast | **Unauthenticated, unencrypted** | Point-to-point broadcast. Optional HMAC available but not default. Acceptable for controlled demo environments. |
| ELM327 WiFi Network | **Open, unencrypted** | Inherent to the device hardware — not introduced by this project. |
| WebSocket API | **No authentication** | Designed for local-network demo use. Add JWT/API keys for any deployment beyond localhost. |
| CSI Sensing | **Privacy-sensitive** | Detects presence/movement without cameras. Requires explicit consent from occupants. Local-only processing — no raw data leaves the device. |

### For Production Deployment

This project would require:
- ISO 26262 functional-safety certification for any ADAS claims
- End-to-end encryption on all wireless links
- Authentication on all API endpoints
- Privacy impact assessment for cabin sensing
- Regulatory compliance review per jurisdiction

These are **out of scope** for the research prototype but documented here as a roadmap for production hardening.
