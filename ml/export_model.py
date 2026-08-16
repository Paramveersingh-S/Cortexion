"""
Cortexion ML — Model Export Pipeline

Exports trained scikit-learn models to zero-dependency JavaScript
using m2cgen, for inline execution in the Node.js backend.

This removes an entire service, a language boundary, and a deployment
step for models this small — match deployment complexity to model
complexity, not to how impressive the model sounds.
"""

import joblib
import json
from pathlib import Path

MODEL_DIR = Path(__file__).parent / 'models'
BACKEND_DIR = Path(__file__).parent.parent / 'backend' / 'src'


def export_to_javascript(model_name: str = 'event_severity_v1'):
    """Export a trained joblib model to JavaScript via m2cgen."""
    model_path = MODEL_DIR / f'{model_name}.joblib'

    if not model_path.exists():
        print(f"Model not found at {model_path}")
        print("Run train_event_severity.py first.")
        return

    try:
        import m2cgen as m2c
    except ImportError:
        print("m2cgen not installed. Run: pip install m2cgen")
        return

    model = joblib.load(model_path)
    js_code = m2c.export_to_javascript(model)

    # Wrap in a module export
    output = f"""/**
 * Cortexion — Event Severity Model (auto-generated)
 *
 * Gradient Boosting Classifier exported from scikit-learn via m2cgen.
 * Zero dependencies — pure JavaScript.
 *
 * Input:  [accel_kmh_s, jerk, rpm_delta, throttle_delta, accel_roll_std, speed_roll_mean]
 * Output: [probability_class_0, probability_class_1]
 *
 * Generated from: ml/models/{model_name}.joblib
 * DO NOT EDIT — regenerate with: python ml/export_model.py
 */

{js_code}

export {{ score }};
"""

    output_path = BACKEND_DIR / 'severity-model.js'
    output_path.write_text(output)
    print(f"Exported {model_name} → {output_path}")

    # Update manifest
    update_manifest(model_name, str(output_path))


def update_manifest(model_name: str, exported_to: str):
    """Update the model registry manifest."""
    manifest_path = MODEL_DIR / 'manifest.json'

    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
    else:
        manifest = {'models': []}

    # Update or add entry
    found = False
    for entry in manifest['models']:
        if entry['name'] == model_name:
            entry['exported_to'] = exported_to
            found = True
            break

    if not found:
        manifest['models'].append({
            'name': model_name,
            'version': 1,
            'exported_to': exported_to,
        })

    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"Updated manifest at {manifest_path}")


if __name__ == '__main__':
    export_to_javascript()
