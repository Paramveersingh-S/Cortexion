'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import GateEnergyChart from '@/components/GateEnergyChart';
import EnergyHeatmap from '@/components/EnergyHeatmap';
import PresenceIndicator from '@/components/PresenceIndicator';
import Link from 'next/link';
import { Radio, Shield, Activity } from 'lucide-react';

// Dynamically import SensingMap3D to avoid SSR issues with canvas
const SensingMap3D = dynamic(() => import('@/components/SensingMap3D'), { ssr: false });

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
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="url(#grad2)" strokeWidth="2"/>
              <path d="M8 12h8M12 8v8" stroke="url(#grad2)" strokeWidth="2" strokeLinecap="round"/>
              <defs><linearGradient id="grad2" x1="0" y1="0" x2="24" y2="24">
                <stop stopColor="#0070ff"/><stop offset="1" stopColor="#00c8ff"/>
              </linearGradient></defs>
            </svg>
            <span style={{ color: '#fff', letterSpacing: '1.5px', fontSize: '1.05rem' }}>CORTEXION</span>
          </Link>
          <span style={{
            color: 'var(--accent-teal)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px',
            padding: '3px 10px', background: 'rgba(0, 212, 170, 0.08)', borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(0, 212, 170, 0.15)', fontFamily: 'var(--font-mono)'
          }}>
            CABIN MONITOR
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <Link href="/" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Dashboard</Link>
          <Link href="/analytics" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Analytics</Link>
          <Link href="/sensing" style={{ padding: '8px 18px', background: 'rgba(0, 200, 255, 0.08)', border: '1px solid rgba(0, 200, 255, 0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px' }}>Cabin Monitor</Link>
        </div>

        <div className="nav-status">
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
            mmWave 24GHz
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
            {frameCount} frames
          </span>
          <div className={`status-dot ${wsStatus === 'connected' ? '' : wsStatus === 'connecting' ? 'warning' : 'offline'}`} />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
            {wsStatus.toUpperCase()}
          </span>
        </div>
      </nav>

      {/* Main content */}
      <div className="sensing-content">
        {/* Radar Visualization */}
        <div className="sensing-radar">
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SensingMap3D
              present={data.present}
              targetDistM={data.targetDistM}
              motionState={data.motionState}
              gateEnergy={data.gateEnergy}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div className="sensing-panel">
          {/* Occupant Status */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div className="section-header">
              <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={12} color="var(--accent-teal)" />
                Occupant Status
              </span>
              <span style={{ fontSize: '0.55rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
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
              <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={12} color="var(--accent-cyan)" />
                Detection Zone
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>
              {zoneLabel}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['Near', 'Mid', 'Far'].map((zone, zi) => {
                const gateStart = zi * 5;
                const gateEnd = Math.min(gateStart + 5, 16);
                const zoneMax = Math.max(...data.gateEnergy.slice(gateStart, gateEnd));
                const active = zoneMax > 100;
                return (
                  <div key={zone} style={{
                    flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', textAlign: 'center',
                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '1px',
                    fontFamily: 'var(--font-mono)',
                    background: active ? 'rgba(0, 200, 255, 0.08)' : 'rgba(255,255,255,0.015)',
                    color: active ? 'var(--accent-cyan)' : 'var(--text-dimmed)',
                    border: active ? '1px solid rgba(0,200,255,0.15)' : '1px solid rgba(255,255,255,0.03)',
                    transition: 'all 0.3s ease',
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
              <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={12} color="var(--accent-orange)" />
                Gate Energy
              </span>
              <span style={{ fontSize: '0.55rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                16 gates × 0.7m
              </span>
            </div>
            <GateEnergyChart gateEnergy={data.gateEnergy} gateWidthM={data.gateWidthM || 0.70} />
          </div>

          {/* Sensor Info */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div className="section-header">
              <span className="section-title">Sensor Hardware</span>
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
