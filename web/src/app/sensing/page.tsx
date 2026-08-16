'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import GateEnergyChart from '@/components/GateEnergyChart';
import EnergyHeatmap from '@/components/EnergyHeatmap';
import PresenceIndicator from '@/components/PresenceIndicator';
import Link from 'next/link';

// Dynamically import RadarSweep to avoid SSR issues with canvas
const RadarSweep = dynamic(() => import('@/components/RadarSweep'), { ssr: false });

interface MmWaveData {
  vehicleId: number;
  present: boolean;
  targetDistMm: number;
  targetDistM: number;
  gateEnergy: number[];
  maxEnergyGate: number;
  maxEnergyGateDistM: number;
  motionState: string;
  numGates: number;
  gateWidthM: number;
  timestampMs: number;
}

const DEFAULT_DATA: MmWaveData = {
  vehicleId: 0,
  present: false,
  targetDistMm: 0,
  targetDistM: 0,
  gateEnergy: new Array(16).fill(0),
  maxEnergyGate: 0,
  maxEnergyGateDistM: 0,
  motionState: 'none',
  numGates: 16,
  gateWidthM: 0.70,
  timestampMs: 0,
};

export default function SensingPage() {
  const [data, setData] = useState<MmWaveData>(DEFAULT_DATA);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [frameCount, setFrameCount] = useState(0);
  const [stillnessSeconds, setStillnessSeconds] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const lastMotionTimeRef = useRef(Date.now());

  const connectWebSocket = useCallback(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8081';
    setWsStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsStatus('connected');

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'mmwave' && msg.data) {
            setData(msg.data);
            setFrameCount(c => c + 1);

            if (msg.data.motionState !== 'stationary') {
              lastMotionTimeRef.current = Date.now();
            }
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => ws.close();
    } catch {
      setWsStatus('disconnected');
      setTimeout(connectWebSocket, 3000);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => wsRef.current?.close();
  }, [connectWebSocket]);

  // Stillness timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (data.present && data.motionState === 'stationary') {
        setStillnessSeconds(Math.floor((Date.now() - lastMotionTimeRef.current) / 1000));
      } else {
        setStillnessSeconds(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [data.present, data.motionState]);

  // Zone classification
  const activeGates = data.gateEnergy.map((e, i) => ({ energy: e, gate: i }))
    .filter(g => g.energy > 50)
    .sort((a, b) => b.energy - a.energy);
  const zoneLabel = activeGates.length === 0 ? 'No target' :
    activeGates[0].gate < 5 ? 'Near zone (0–3.5m)' :
    activeGates[0].gate < 10 ? 'Mid zone (3.5–7m)' : 'Far zone (7–11.2m)';

  return (
    <div className="sensing-layout">
      {/* Navigation */}
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="url(#grad2)" strokeWidth="2"/>
              <path d="M8 12h8M12 8v8" stroke="url(#grad2)" strokeWidth="2" strokeLinecap="round"/>
              <defs><linearGradient id="grad2" x1="0" y1="0" x2="24" y2="24">
                <stop stopColor="#0066ff"/><stop offset="1" stopColor="#00d4ff"/>
              </linearGradient></defs>
            </svg>
            <span>CORTEXION</span>
          </Link>
          <span style={{ color: 'var(--accent-orange)', fontSize: '0.75rem', fontWeight: 600, marginLeft: '8px',
            padding: '2px 8px', background: 'rgba(255,136,0,0.1)', borderRadius: '12px', border: '1px solid rgba(255,136,0,0.2)' }}>
            SENSING
          </span>
        </div>
        <div className="nav-status">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            mmWave 24GHz • {frameCount} frames
          </span>
          <div className={`status-dot ${wsStatus === 'connected' ? '' : wsStatus === 'connecting' ? 'warning' : 'offline'}`} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
            {wsStatus.toUpperCase()}
          </span>
        </div>
      </nav>

      {/* Main content */}
      <div className="sensing-content">
        {/* Radar Visualization */}
        <div className="sensing-radar">
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RadarSweep
              gateEnergy={data.gateEnergy}
              targetDistM={data.targetDistM}
              present={data.present}
              maxEnergyGate={data.maxEnergyGate}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div className="sensing-panel">
          {/* Presence */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div className="section-header">
              <span className="section-title">Presence</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
                V{data.vehicleId || '—'}
              </span>
            </div>
            <PresenceIndicator
              present={data.present}
              motionState={data.motionState}
              targetDistM={data.targetDistM}
              stillnessSeconds={stillnessSeconds}
            />
          </div>

          {/* Zone Occupancy */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div className="section-header">
              <span className="section-title">Zone</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              {zoneLabel}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {['Near', 'Mid', 'Far'].map((zone, zi) => {
                const gateStart = zi * 5;
                const gateEnd = Math.min(gateStart + 5, 16);
                const zoneMax = Math.max(...data.gateEnergy.slice(gateStart, gateEnd));
                const active = zoneMax > 100;
                return (
                  <div key={zone} style={{
                    flex: 1, padding: '6px 8px', borderRadius: '8px', textAlign: 'center',
                    fontSize: '0.7rem', fontWeight: 600,
                    background: active ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255,255,255,0.02)',
                    color: active ? 'var(--accent-cyan)' : 'var(--text-dimmed)',
                    border: active ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
                  }}>
                    {zone}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gate Energy */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div className="section-header">
              <span className="section-title">Gate Energy</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
                16 gates × 0.7m
              </span>
            </div>
            <GateEnergyChart gateEnergy={data.gateEnergy} gateWidthM={data.gateWidthM || 0.70} />
          </div>

          {/* Sensor Info */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div className="section-header">
              <span className="section-title">Sensor</span>
            </div>
            <div className="sensor-info-grid">
              <div className="sensor-info-item">
                <span className="sensor-info-label">Module</span>
                <span className="sensor-info-value">HMMD 24GHz</span>
              </div>
              <div className="sensor-info-item">
                <span className="sensor-info-label">Range</span>
                <span className="sensor-info-value">0–11.2m</span>
              </div>
              <div className="sensor-info-item">
                <span className="sensor-info-label">Refresh</span>
                <span className="sensor-info-value">100ms</span>
              </div>
              <div className="sensor-info-item">
                <span className="sensor-info-label">Accuracy</span>
                <span className="sensor-info-value">±0.15m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Heatmap */}
      <div className="sensing-heatmap">
        <div className="glass-card" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
          <EnergyHeatmap gateEnergy={data.gateEnergy} />
        </div>
      </div>
    </div>
  );
}
