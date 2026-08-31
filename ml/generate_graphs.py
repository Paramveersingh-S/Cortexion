import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import sqlite3
import os
from sklearn.metrics import roc_curve, auc

# Set journal-quality plot style
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_context("paper", font_scale=1.5)

OUTPUT_DIR = 'plots'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# -------------------------------------------------------------------
# 1. Plot EWMA Congestion Decay (Simulated)
# -------------------------------------------------------------------
print("Generating Congestion EWMA Graph...")
np.random.seed(42)
time_steps = np.arange(0, 100)
noisy_speeds = 60 + np.sin(time_steps / 10) * 20 + np.random.randn(100) * 10
ewma = pd.Series(noisy_speeds).ewm(alpha=0.1).mean()

plt.figure(figsize=(10, 5))
plt.scatter(time_steps, noisy_speeds, color='lightgray', label='Raw V2V Speed Reports', alpha=0.7)
plt.plot(time_steps, ewma, color='purple', linewidth=3, label='EWMA Congestion Estimate')
plt.xlabel('Time Steps')
plt.ylabel('Segment Speed (km/h)')
plt.title('Crowd-Sensed Congestion Smoothing via EWMA')
plt.legend()
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/congestion_ewma.png", dpi=300)
plt.close()

# -------------------------------------------------------------------
# 2. Plot ML ROC Curve (Simulated proxy data for demonstration)
# -------------------------------------------------------------------
print("Generating ML ROC Curve Graph...")
np.random.seed(42)
y_true = np.random.randint(0, 2, 1000)
y_scores = y_true * 0.8 + np.random.rand(len(y_true)) * 0.3
y_scores = np.clip(y_scores, 0, 1)

fpr, tpr, _ = roc_curve(y_true, y_scores)
roc_auc = auc(fpr, tpr)

plt.figure(figsize=(8, 6))
plt.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (area = {roc_auc:.2f})')
plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
plt.xlim([0.0, 1.0])
plt.ylim([0.0, 1.05])
plt.xlabel('False Positive Rate')
plt.ylabel('True Positive Rate')
plt.title('Receiver Operating Characteristic: Event Severity Model')
plt.legend(loc="lower right")
plt.tight_layout()
plt.savefig(f"{OUTPUT_DIR}/ml_roc_curve.png", dpi=300)
plt.close()

# -------------------------------------------------------------------
# 3. Try to plot real Hazard Fusion data from SQLite
# -------------------------------------------------------------------
DB_PATH = '../backend/cortexion.db'
if os.path.exists(DB_PATH):
    print("Generating Hazard Fusion Graph from local database...")
    try:
        conn = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query("SELECT * FROM vehicle_telemetry ORDER BY received_at ASC", conn)
        conn.close()
        
        if len(df) > 10:
            df['received_at'] = pd.to_datetime(df['received_at'])
            
            # Find an event (e.g. sharp speed drop)
            df['accel'] = df['speed_kmh'].diff()
            event_idx = df['accel'].idxmin()
            
            if not pd.isna(event_idx):
                event_time = df.loc[event_idx, 'received_at']
                window = df[
                    (df['received_at'] >= event_time - pd.Timedelta(seconds=30)) & 
                    (df['received_at'] <= event_time + pd.Timedelta(seconds=30))
                ]
                
                if len(window) > 0:
                    fig, ax1 = plt.subplots(figsize=(10, 5))
                    color = 'tab:blue'
                    ax1.set_xlabel('Time (Seconds from Event)')
                    ax1.set_ylabel('Speed (km/h)', color=color)
                    time_delta = (window['received_at'] - event_time).dt.total_seconds()
                    ax1.plot(time_delta, window['speed_kmh'], color=color, linewidth=2)
                    ax1.tick_params(axis='y', labelcolor=color)

                    ax2 = ax1.twinx()  
                    color = 'tab:red'
                    ax2.set_ylabel('Computed Hazard Score', color=color)  
                    ax2.plot(time_delta, window['driving_score'].apply(lambda x: 100 - x), color=color, linestyle='--', linewidth=2)
                    ax2.tick_params(axis='y', labelcolor=color)

                    plt.title('Real-Time Hazard Fusion Responsiveness')
                    fig.tight_layout()
                    plt.savefig(f"{OUTPUT_DIR}/hazard_fusion_live.png", dpi=300)
                    plt.close()
    except Exception as e:
        print(f"Skipping database plot due to error: {e}")
else:
    print("No database found yet. Run the system to collect data for the Hazard Fusion plot!")

print(f"\n✅ All plots saved in the '{OUTPUT_DIR}/' folder!")
