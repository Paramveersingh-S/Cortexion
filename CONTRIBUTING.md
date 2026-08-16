# Contributing to Cortexion

Thank you for your interest in contributing to Cortexion! This document provides guidelines and information for contributors.

## 🏗️ Project Structure

```
cortexion/
├── firmware/          # ESP32 firmware (PlatformIO)
│   ├── hub/           # Main vehicle controller
│   ├── sense/         # WiFi CSI sensing node
│   └── common/        # Shared protocol & utilities
├── gateway/           # LoRa → MQTT bridge (Node.js)
├── backend/           # API server (Express + WebSocket)
├── web/               # Dashboard (Next.js)
├── ml/                # ML pipeline (Python)
├── simulator/         # Hardware simulator for dev
└── docs/              # Technical documentation
```

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18.x | Gateway, Backend, Web |
| Python | ≥ 3.10 | ML pipeline, Simulator |
| PlatformIO | ≥ 6.x | Firmware compilation |
| Docker | ≥ 24.x | Infrastructure (optional) |

### First-Time Setup

```bash
# Clone the repository
git clone https://github.com/Paramveersingh-S/vigilante.git
cd vigilante

# Install all dependencies
npm run setup  # runs npm install in gateway/, backend/, web/

# Python ML environment
cd ml && pip install -r requirements.txt

# Start development stack
docker-compose up -d  # or use scripts/start-dev.sh
```

## 📝 How to Contribute

### 1. Find or Create an Issue

- Check [existing issues](https://github.com/Paramveersingh-S/vigilante/issues)
- For new features, open an issue first to discuss the approach
- Look for `good first issue` and `help wanted` labels

### 2. Fork & Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/issue-description
```

### Branch Naming Convention

| Prefix | Purpose |
|--------|---------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation |
| `test/` | Tests |
| `refactor/` | Code refactoring |
| `ci/` | CI/CD changes |

### 3. Code Standards

#### C++ (Firmware)
- Follow the existing FreeRTOS task pattern
- All shared state access through queues or mutex-guarded `fusionTask`
- Use `static_assert` for struct sizes
- Test packet code with `pio test`

#### JavaScript/TypeScript (Gateway, Backend, Web)
- ESM modules (`import`/`export`)
- Vitest for testing
- Descriptive variable names over comments

#### Python (ML)
- Type hints on all function signatures
- Docstrings explaining *why*, not *what*
- pytest for testing
- Session-level splits for ML evaluation (never row-level on time-series)

### 4. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(component): short description

Longer explanation of what and why (not how).

Closes #123
```

**Components**: `firmware/hub`, `firmware/sense`, `firmware/common`, `gateway`, `backend`, `web`, `ml`, `simulator`, `docs`, `ci`

### 5. Pull Request

- Fill out the PR template completely
- Ensure all CI checks pass
- Request review from at least one maintainer
- Keep PRs focused — one feature/fix per PR

## 🧪 Testing

```bash
# Firmware native tests
cd firmware/hub && pio test -e native

# Gateway tests
cd gateway && npm test

# Backend tests
cd backend && npm test

# ML tests
cd ml && pytest tests/ -v

# Web build check
cd web && npm run build

# Full integration
./scripts/start-dev.sh && npm run test:integration
```

## 🔒 Security

- Never commit secrets, API keys, or WiFi credentials
- Use `config.h` (gitignored) for firmware secrets
- Use `.env` (gitignored) for service secrets
- See [SECURITY.md](SECURITY.md) for vulnerability reporting

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
