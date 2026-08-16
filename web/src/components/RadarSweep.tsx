'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Props {
  gateEnergy: number[];
  targetDistM: number;
  present: boolean;
  maxEnergyGate: number;
}

const NUM_GATES = 16;
const GATE_WIDTH_M = 0.70;

function energyToColor(energy: number, maxEnergy: number): string {
  const ratio = Math.min(energy / Math.max(maxEnergy, 1), 1);
  if (ratio < 0.2) return `rgba(0, 40, 80, ${0.1 + ratio * 2})`;
  if (ratio < 0.4) return `rgba(0, 100, 200, ${0.3 + ratio})`;
  if (ratio < 0.6) return `rgba(0, 212, 255, ${0.4 + ratio * 0.6})`;
  if (ratio < 0.8) return `rgba(100, 255, 100, ${0.5 + ratio * 0.4})`;
  return `rgba(255, ${Math.floor(255 - ratio * 200)}, 50, ${0.7 + ratio * 0.3})`;
}

export default function RadarSweep({ gateEnergy, targetDistM, present, maxEnergyGate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sweepAngleRef = useRef(0);
  const animRef = useRef<number>(0);
  const dataRef = useRef({ gateEnergy, targetDistM, present, maxEnergyGate });

  // Keep data ref updated without re-triggering animation
  useEffect(() => {
    dataRef.current = { gateEnergy, targetDistM, present, maxEnergyGate };
  }, [gateEnergy, targetDistM, present, maxEnergyGate]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const maxRadius = Math.min(cx, cy) - 20;
    const { gateEnergy: ge, targetDistM: dist, present: pres, maxEnergyGate: maxGate } = dataRef.current;

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    const maxE = Math.max(...ge, 1);

    // Draw concentric range rings with energy coloring
    for (let i = NUM_GATES - 1; i >= 0; i--) {
      const outerR = ((i + 1) / NUM_GATES) * maxRadius;
      const innerR = (i / NUM_GATES) * maxRadius;

      // Energy fill for this gate
      const energy = ge[i] || 0;
      const color = energyToColor(energy, maxE);

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
      ctx.fillStyle = color;
      ctx.fill();

      // Ring border
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Distance labels every 2 gates
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(136, 136, 170, 0.6)';
    ctx.textAlign = 'center';
    for (let i = 2; i <= NUM_GATES; i += 2) {
      const r = (i / NUM_GATES) * maxRadius;
      const distLabel = (i * GATE_WIDTH_M).toFixed(1);
      ctx.fillText(`${distLabel}m`, cx + r - 12, cy - 4);
    }

    // Cross-hair lines
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.06)';
    ctx.lineWidth = 0.5;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxRadius, cy + Math.sin(angle) * maxRadius);
      ctx.stroke();
    }

    // Sweep line with phosphor trail
    const sweepAngle = sweepAngleRef.current;
    const trailSteps = 30;
    for (let i = trailSteps; i >= 0; i--) {
      const a = sweepAngle - (i * 0.03);
      const opacity = ((trailSteps - i) / trailSteps) * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * maxRadius, cy + Math.sin(a) * maxRadius);
      ctx.strokeStyle = `rgba(0, 255, 136, ${opacity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Main sweep line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius, cy + Math.sin(sweepAngle) * maxRadius);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Target dot (if present)
    if (pres && dist > 0) {
      const targetR = Math.min(dist / (NUM_GATES * GATE_WIDTH_M), 1) * maxRadius;
      const pulseScale = 1 + 0.15 * Math.sin(Date.now() * 0.005);
      const dotR = 6 * pulseScale;

      // Glow
      const glow = ctx.createRadialGradient(cx, cy - targetR, 0, cx, cy - targetR, dotR * 4);
      glow.addColorStop(0, 'rgba(255, 60, 60, 0.6)');
      glow.addColorStop(1, 'rgba(255, 60, 60, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy - targetR, dotR * 4, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(cx, cy - targetR, dotR, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3344';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Distance label
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ff3344';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist.toFixed(1)}m`, cx, cy - targetR - 14);
    }

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00d4ff';
    ctx.fill();

    // "RADAR" label
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 212, 255, 0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('MMWAVE RADAR', 10, 16);
    ctx.fillText(pres ? '● TRACKING' : '○ SCANNING', 10, 30);

    // Update sweep angle
    sweepAngleRef.current += 0.03;
    if (sweepAngleRef.current > Math.PI * 2) sweepAngleRef.current -= Math.PI * 2;

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        const size = Math.min(rect.width, rect.height);
        canvas.width = size * window.devicePixelRatio;
        canvas.height = size * window.devicePixelRatio;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="radar-canvas" />;
}
