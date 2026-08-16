"""
Cortexion ML — Driving Event Severity Model

Gradient Boosting Classifier that refines the edge-side hard-threshold
harsh-braking flag into a continuous severity score, robust to OBD
sensor noise.

Key design decisions:
1. Weak labels bootstrapped from physics threshold (~0.35g braking)
2. Session-level cross-validation (GroupShuffleSplit, NOT row-level)
3. 6 features with rolling context to generalize past noisy thresholds
4. Deployed via m2cgen as zero-dependency JavaScript (see export_model.py)
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import GroupShuffleSplit
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, roc_auc_score
import joblib

MODEL_DIR = Path(__file__).parent / 'models'
DATA_DIR = Path(__file__).parent / 'data'
MODEL_DIR.mkdir(exist_ok=True)


def load_session_logs(paths: list[str]) -> pd.DataFrame:
    """Load and concatenate session logs with session IDs."""
    frames = []
    for i, p in enumerate(paths):
        df = pd.read_csv(p)
        df['session_id'] = i
        frames.append(df)
    return pd.concat(frames, ignore_index=True)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineer time-series features from raw OBD data.

    Rolling context (window=5) is most of why a learned model beats
    the raw threshold — a single noisy OBD sample can't flip the label.
    """
    df = df.sort_values(['session_id', 'timestamp_ms']).copy()

    # First-order differences
    df['dt_s'] = df.groupby('session_id')['timestamp_ms'].diff().fillna(200) / 1000.0
    df['accel_kmh_s'] = df.groupby('session_id')['speed_kmh'].diff() / df['dt_s']

    # Second-order: jerk (rate of change of acceleration)
    df['jerk'] = df.groupby('session_id')['accel_kmh_s'].diff() / df['dt_s']

    # Correlated signal changes
    df['rpm_delta'] = df.groupby('session_id')['rpm'].diff()
    df['throttle_delta'] = df.groupby('session_id')['throttle_pct'].diff()

    # Rolling context — this is the key feature engineering step
    for session_id in df['session_id'].unique():
        mask = df['session_id'] == session_id
        session_data = df.loc[mask]

        df.loc[mask, 'accel_roll_std'] = (
            session_data['accel_kmh_s'].rolling(window=5, min_periods=2).std()
        )
        df.loc[mask, 'speed_roll_mean'] = (
            session_data['speed_kmh'].rolling(window=5, min_periods=2).mean()
        )

    return df.dropna(subset=['accel_kmh_s', 'jerk', 'accel_roll_std'])


def weak_label(df: pd.DataFrame) -> pd.Series:
    """
    Bootstrap labels from a physics threshold (~0.35g braking).

    There is no labeled 'harsh driving' dataset for this project.
    The model's job is generalizing past sensor noise around this
    threshold using context (jerk, rolling variance) that a fixed
    cutoff ignores — not inventing a new definition of 'harsh'.
    """
    accel_ms2 = df['accel_kmh_s'] / 3.6
    return (accel_ms2 < -3.4).astype(int)


FEATURE_COLS = [
    'accel_kmh_s', 'jerk', 'rpm_delta', 'throttle_delta',
    'accel_roll_std', 'speed_roll_mean'
]


def train(data_paths: list[str] = None) -> dict:
    """Train the event severity model and return metrics."""
    if data_paths is None:
        data_paths = sorted(str(p) for p in DATA_DIR.glob('*.csv'))

    if not data_paths:
        raise FileNotFoundError(
            f"No training data found in {DATA_DIR}. "
            "Run generate_synthetic_data.py first."
        )

    print(f"Loading {len(data_paths)} session logs...")
    df = engineer_features(load_session_logs(data_paths))
    y = weak_label(df)
    X = df[FEATURE_COLS]

    print(f"Dataset: {len(X)} samples, {y.sum()} positive ({y.mean()*100:.1f}%)")

    # Split by session, NOT by row. Adjacent frames from the same
    # braking event are near-duplicates — a row-level split leaks
    # them across train/test and reports inflated accuracy.
    splitter = GroupShuffleSplit(test_size=0.25, n_splits=1, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=df['session_id']))

    print(f"Train: {len(train_idx)} samples, Test: {len(test_idx)} samples")

    model = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=3,
        learning_rate=0.05,
        min_samples_leaf=10,
        subsample=0.8,
        random_state=42,
    )
    model.fit(X.iloc[train_idx], y.iloc[train_idx])

    # Evaluate
    preds = model.predict(X.iloc[test_idx])
    probs = model.predict_proba(X.iloc[test_idx])[:, 1]

    print("\n" + "=" * 50)
    print("Classification Report:")
    print(classification_report(y.iloc[test_idx], preds))

    roc_auc = roc_auc_score(y.iloc[test_idx], probs)
    print(f"ROC-AUC: {roc_auc:.4f}")

    # Feature importances
    print("\nFeature Importances:")
    for name, imp in sorted(zip(FEATURE_COLS, model.feature_importances_),
                            key=lambda x: -x[1]):
        print(f"  {name}: {imp:.4f}")

    # Save model
    model_path = MODEL_DIR / 'event_severity_v1.joblib'
    joblib.dump(model, model_path)
    print(f"\nModel saved to {model_path}")

    metrics = {
        'roc_auc': round(roc_auc, 4),
        'n_train': len(train_idx),
        'n_test': len(test_idx),
        'positive_rate': round(float(y.mean()), 4),
    }
    return metrics


if __name__ == '__main__':
    train()
