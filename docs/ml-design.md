# ML Design Decisions

> This document explains **which parts of Cortexion should be learned models at all** — the most important ML decision in the project.

## Decision Matrix

| Problem | Right Tool | Why NOT ML (where applicable) |
|---------|-----------|------|
| Instant harsh-brake alert (on-screen) | **Deterministic threshold** (edge, firmware) | Must work with zero network dependency and zero latency. A 2s OBD poll cycle already limits resolution — adding model inference overhead to a safety alert is wrong. |
| Refined event severity for dashboard | **Learned GBM model** (server-side) | Enough signal in OBD time-series to generalize past noisy fixed thresholds. Wrong answers here aren't safety-critical — they affect trend charts, not immediate alerts. |
| Per-road-segment congestion | **Online EWMA estimator** (deliberately not ML) | With 2 demo vehicles, there are nowhere near enough independent samples per road segment to fit anything statistically meaningful. A model here is theater, not engineering. |
| Cabin distress/wellness | **Transfer learning** on pretrained RuView embedding | Training WiFi CSI sensing from scratch is a multi-year research problem. Fine-tuning a small classification head on frozen 128-dim embeddings is the correct-scoped version. |
| Overall hazard level | **Transparent rule engine** (deliberately not ML) | No ethical way to collect real near-collision ground truth for a student project. An unauditable black-box model making safety-adjacent calls with no ground truth is worse engineering, not more impressive. |

## Model 1: Driving Event Severity

### Architecture
- **Type**: Gradient Boosting Classifier (scikit-learn)
- **Features**: `accel_kmh_s`, `jerk`, `rpm_delta`, `throttle_delta`, `accel_roll_std`, `speed_roll_mean`
- **Labels**: Weak labels bootstrapped from physics threshold (~0.35g braking)
- **Evaluation**: Session-level GroupShuffleSplit (not row-level — adjacent frames from the same braking event are near-duplicates)
- **Deployment**: Exported to zero-dependency JavaScript via `m2cgen`, called inline from Node.js backend

### Why GBM over Neural Network
- 6 features, ~1000s of samples per session — this is a tabular classification problem. GBM is the right tool for tabular data at this scale.
- Explainable via feature importances — when a judge asks "what drives the severity score," you can answer from the model, not guess.
- Deployable as a pure JavaScript function (m2cgen) — no Python microservice, no ONNX runtime.

## Model 2: Congestion Estimator (NOT ML)

### Architecture
- **Type**: Exponentially-weighted moving average (EWMA) per road segment
- **Half-life**: 120 seconds
- **Output**: `clear` / `moderate` / `congested` based on ratio to free-flow speed

### Why This Is Better Than ML Here
With 2 vehicles reporting speed data, you get ~2 independent observations per road segment per pass. That's not a dataset — it's a pair of data points. An EWMA that decays old observations naturally handles the temporal aspect (traffic changes over minutes, not hours) and is the standard tool for streaming, low-volume estimation.

## Model 3: Cabin Wellness

### Architecture
- **Type**: Transfer learning — frozen RuView self-supervised embedding (128-dim) → small 3-class MLP head
- **Classes**: `presence_normal`, `no_movement_extended`, `high_agitation`
- **Training Data**: Team members performing: (a) normal sitting, (b) staying still 90+ seconds, (c) fidgeting. Labeled by what was actually done, not by pretending to simulate medical emergencies.
- **Critical framing**: These are **behavioral proxies**, not medical diagnoses. Never surface as "distress detected" — surface as "unusual stillness for 45s+".

## Model 4: Hazard Fusion (NOT ML)

### Architecture
- **Type**: Weighted rule engine with transparent `reasons` array
- **Inputs**: own driving score, peer closing speed, peer distance, cabin status
- **Output**: `{level: "high"|"medium"|"low", reasons: [...]}`

### Why Rules Beat ML Here
- No ground truth for real near-collisions exists in this project's dataset
- Every rule is auditable — when a judge asks "why did it say high hazard," you read the `reasons` array
- The `reasons` field isn't decoration — it's the difference between "the AI said so" and "the sensor data said so"

## Model Versioning

```json
// ml/models/manifest.json
{
  "models": [
    {
      "name": "event_severity",
      "version": 1,
      "trained_on_sessions": ["synthetic_v1"],
      "metrics": {"roc_auc": 0.87, "f1": 0.82},
      "exported_to": "backend/src/severity-model.js"
    }
  ]
}
```

- Never overwrite a version — always increment
- Keep the manifest as the single source of truth for what's deployed
- No MLflow/DVC — this is solving a team-scale problem the project doesn't have
