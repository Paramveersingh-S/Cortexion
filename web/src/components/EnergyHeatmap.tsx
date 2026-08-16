'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Props {
  gateEnergy: number[];
  maxHistory?: number;
}

const NUM_GATES = 16;
const CELL_HEIGHT = 6;

function intensityToRgb(ratio: number): [number, number, number] {
  if (ratio < 0.15) return [10, 10, 30];
  if (ratio < 0.3)  return [0, 40, 100];
  if (ratio < 0.5)  return [0, 120, 200];
  if (ratio < 0.7)  return [0, 220, 180];
  if (ratio < 0.85) return [200, 255, 50];
  return [255, 80, 40];
}

export default function EnergyHeatmap({ gateEnergy, maxHistory = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[][]>([]);
  const maxEnergyRef = useRef(100);

  const appendFrame = useCallback((ge: number[]) => {
    historyRef.current.push([...ge]);
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    }
    const frameMax = Math.max(...ge);
    maxEnergyRef.current = Math.max(maxEnergyRef.current * 0.99, frameMax, 50);
  }, [maxHistory]);

  useEffect(() => {
    appendFrame(gateEnergy);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const history = historyRef.current;
    const maxE = maxEnergyRef.current;

    const W = canvas.width;
    const H = NUM_GATES * CELL_HEIGHT;
    canvas.height = H;

    const cellW = Math.max(1, Math.floor(W / maxHistory));

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    for (let t = 0; t < history.length; t++) {
      const x = (maxHistory - history.length + t) * cellW;
      for (let g = 0; g < NUM_GATES; g++) {
        const ratio = Math.min((history[t][g] || 0) / maxE, 1);
        const [r, gv, b] = intensityToRgb(ratio);
        ctx.fillStyle = `rgb(${r},${gv},${b})`;
        ctx.fillRect(x, g * CELL_HEIGHT, cellW, CELL_HEIGHT);
      }
    }
  }, [gateEnergy, appendFrame, maxHistory]);

  return (
    <div className="energy-heatmap-container">
      <div className="heatmap-y-labels">
        <span>0</span>
        <span>8</span>
        <span>15</span>
      </div>
      <canvas ref={canvasRef} width={600} height={NUM_GATES * CELL_HEIGHT} className="energy-heatmap-canvas" />
      <div className="heatmap-legend">
        <span style={{ color: 'var(--text-dimmed)', fontSize: '0.6rem' }}>← time</span>
        <span style={{ color: 'var(--text-dimmed)', fontSize: '0.6rem' }}>Gate Energy Timeline</span>
        <span style={{ color: 'var(--text-dimmed)', fontSize: '0.6rem' }}>now →</span>
      </div>
    </div>
  );
}
