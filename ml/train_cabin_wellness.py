"""
Cortexion ML — Cabin Wellness Model (Transfer Learning)

Fine-tunes a small classification head on frozen RuView CSI embeddings.
Classes are behavioral PROXIES, not medical diagnoses:
  0 = presence_normal
  1 = no_movement_extended (45+ seconds still)
  2 = high_agitation (unusual movement patterns)

Never surface these as "distress detected" — surface them as what
they actually measure.
"""

import torch
import torch.nn as nn
import numpy as np
from pathlib import Path

MODEL_DIR = Path(__file__).parent / 'models'
MODEL_DIR.mkdir(exist_ok=True)

# ── Class Labels ─────────────────────────────────────────────────
CLASS_NAMES = ['presence_normal', 'no_movement_extended', 'high_agitation']
N_CLASSES = len(CLASS_NAMES)
EMBEDDING_DIM = 128  # RuView's self-supervised embedding dimension


class WellnessHead(nn.Module):
    """
    Small MLP classification head on top of frozen RuView embeddings.

    Architecture deliberately minimal:
    - 128 → 32 → 3 with ReLU + Dropout
    - No need for more capacity on this dataset size
    - Trainable in seconds on CPU
    """

    def __init__(self, in_dim=EMBEDDING_DIM, hidden=32, n_classes=N_CLASSES):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden, n_classes),
        )

    def forward(self, x):
        return self.net(x)


def generate_synthetic_embeddings(n_samples: int = 300) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic 128-dim embeddings for development/testing.

    In production, these would come from:
    1. Team members sitting in the driver's seat performing labeled actions
    2. RuView's ESP32-S3 CSI pipeline extracting embeddings
    3. Embeddings collected via UDP and labeled by action type
    """
    np.random.seed(42)
    embeddings = []
    labels = []

    for cls_idx, (cls_name, center, spread) in enumerate([
        ('normal',    np.random.randn(EMBEDDING_DIM) * 0.5, 0.8),
        ('still',     np.random.randn(EMBEDDING_DIM) * 0.5 + 1.0, 0.6),
        ('agitated',  np.random.randn(EMBEDDING_DIM) * 0.5 - 1.0, 1.0),
    ]):
        samples = center + np.random.randn(n_samples // 3, EMBEDDING_DIM) * spread
        embeddings.append(samples)
        labels.extend([cls_idx] * (n_samples // 3))

    return np.vstack(embeddings).astype(np.float32), np.array(labels)


def train(embeddings: np.ndarray = None, labels: np.ndarray = None,
          epochs: int = 40, lr: float = 1e-3) -> dict:
    """Train the wellness classification head."""
    if embeddings is None or labels is None:
        print("Using synthetic embeddings for development...")
        embeddings, labels = generate_synthetic_embeddings(300)

    X = torch.tensor(embeddings, dtype=torch.float32)
    y = torch.tensor(labels, dtype=torch.long)

    # Train/val split
    n = len(X)
    split = int(n * 0.8)
    perm = torch.randperm(n)
    train_idx, val_idx = perm[:split], perm[split:]

    head = WellnessHead()
    opt = torch.optim.AdamW(head.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss()

    best_val_acc = 0.0
    metrics_log = []

    for epoch in range(epochs):
        # Train
        head.train()
        opt.zero_grad()
        logits = head(X[train_idx])
        loss = loss_fn(logits, y[train_idx])
        loss.backward()
        opt.step()

        # Validate
        head.eval()
        with torch.no_grad():
            val_logits = head(X[val_idx])
            val_preds = val_logits.argmax(1)
            val_acc = (val_preds == y[val_idx]).float().mean().item()

        if epoch % 10 == 0:
            print(f"Epoch {epoch:3d}: loss={loss.item():.4f}  val_acc={val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(head.state_dict(), MODEL_DIR / 'cabin_wellness_head.pt')

        metrics_log.append({
            'epoch': epoch,
            'loss': loss.item(),
            'val_acc': val_acc,
        })

    print(f"\nBest validation accuracy: {best_val_acc:.4f}")
    print(f"Model saved to {MODEL_DIR / 'cabin_wellness_head.pt'}")

    return {
        'best_val_acc': round(best_val_acc, 4),
        'final_loss': round(metrics_log[-1]['loss'], 4),
        'n_train': len(train_idx),
        'n_val': len(val_idx),
    }


if __name__ == '__main__':
    train()
