'use client';

interface Props {
  gateEnergy: number[];
  gateWidthM?: number;
}

const NUM_GATES = 16;

export default function GateEnergyChart({ gateEnergy, gateWidthM = 0.70 }: Props) {
  const maxEnergy = Math.max(...gateEnergy, 1);

  return (
    <div className="gate-energy-chart">
      <div className="gate-bars">
        {gateEnergy.map((energy, i) => {
          const widthPct = (energy / maxEnergy) * 100;
          const ratio = energy / maxEnergy;
          const color = ratio > 0.7 ? 'var(--accent-red)' :
                        ratio > 0.4 ? 'var(--accent-orange)' :
                        ratio > 0.15 ? 'var(--accent-cyan)' : 'rgba(0, 200, 255, 0.15)';

          return (
            <div key={i} className="gate-bar-wrapper" title={`Gate ${i}: ${(i * gateWidthM).toFixed(1)}–${((i + 1) * gateWidthM).toFixed(1)}m  Energy: ${energy}`}>
              <span className="gate-label">{i}</span>
              <div className="gate-bar-track">
                <div
                  className="gate-bar-fill"
                  style={{
                    width: `${widthPct}%`,
                    background: color,
                    boxShadow: ratio > 0.4 ? `0 0 6px ${color}` : 'none',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="gate-axis-label">
        <span>0m</span>
        <span>Gate Index → Distance</span>
        <span>{(NUM_GATES * gateWidthM).toFixed(1)}m</span>
      </div>
    </div>
  );
}
