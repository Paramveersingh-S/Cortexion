'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues with Leaflet
const VehicleMap = dynamic(() => import('@/components/VehicleMap'), { ssr: false });

interface VehicleBeacon {
  vehicleId: number;
  lat: number;
  lon: number;
  speedKmh: number;
  headingDeg: number;
  drivingScore: number;
  hazardFlags: number;
  cabinStatus: string;
  cabinStatusCode: number;
  hazards: { harshBrake: boolean; harshAccel: boolean; lowFuel: boolean; engineFault: boolean; };
  hazard: { level: string; score: number; reasons: string[]; };
  peerDistance: number | null;
  receivedAt: string;
}

interface Alert {
  id: number;
  reason: string;
  severity: string;
  vehicleId: number;
  timestamp: string;
}

const CABIN_STATUS_MAP: Record<string, { label: string; class: string; icon: string }> = {
  'presence_ok': { label: 'Driver Present', class: 'ok', icon: '✓' },
  'no_movement': { label: 'No Movement (45s+)', class: 'warning', icon: '⚠' },
  'possible_distress': { label: 'Possible Distress', class: 'danger', icon: '🚨' },
  'unknown': { label: 'Sensor Offline', class: 'unknown', icon: '?' },
  'none': { label: 'No Sensor', class: 'unknown', icon: '—' },
};

function ScoreGauge({ score, size = 140 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#00ff88' : score >= 50 ? '#ff8800' : '#ff3344';

  return (
    <div className="score-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease' }} />
      </svg>
      <div className="value">
        <span className="number" style={{ color }}>{score}</span>
        <span className="label">Score</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [vehicles, setVehicles] = useState<Map<number, VehicleBeacon>>(new Map());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const alertIdRef = useRef(0);

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
          if (msg.type === 'beacon' && msg.data) {
            const beacon = msg.data as VehicleBeacon;
            setVehicles(prev => new Map(prev).set(beacon.vehicleId, beacon));

            // Generate alerts from hazard fusion
            if (beacon.hazard && beacon.hazard.level !== 'low') {
              beacon.hazard.reasons.forEach(reason => {
                setAlerts(prev => [{
                  id: alertIdRef.current++,
                  reason,
                  severity: beacon.hazard.level,
                  vehicleId: beacon.vehicleId,
                  timestamp: new Date().toISOString(),
                }, ...prev].slice(0, 50));
              });
            }
          }
        } catch {}
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

  useEffect(() => { connectWebSocket(); return () => wsRef.current?.close(); }, [connectWebSocket]);

  const vehicleArray = Array.from(vehicles.values());

  return (
    <div className="dashboard-layout">
      {/* Navigation */}
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="url(#grad)" strokeWidth="2"/>
            <path d="M8 12h8M12 8v8" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round"/>
            <defs><linearGradient id="grad" x1="0" y1="0" x2="24" y2="24">
              <stop stopColor="#0066ff"/><stop offset="1" stopColor="#00d4ff"/>
            </linearGradient></defs>
          </svg>
          CORTEXION
        </div>
        <div className="nav-status">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {vehicleArray.length} vehicle{vehicleArray.length !== 1 ? 's' : ''} active
          </span>
          <div className={`status-dot ${wsStatus === 'connected' ? '' : wsStatus === 'connecting' ? 'warning' : 'offline'}`} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
            {wsStatus.toUpperCase()}
          </span>
        </div>
      </nav>

      {/* Map */}
      <div className="dashboard-map">
        <VehicleMap vehicles={vehicleArray} />
      </div>

      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        {/* Vehicle Cards */}
        {vehicleArray.map(v => {
          const cabin = CABIN_STATUS_MAP[v.cabinStatus] || CABIN_STATUS_MAP['none'];
          return (
            <div key={v.vehicleId} className="glass-card vehicle-card">
              <div className="vehicle-card-header">
                <span className="vehicle-id">V{v.vehicleId}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
                  {v.peerDistance != null ? `${v.peerDistance}m` : '—'}
                </span>
              </div>

              <ScoreGauge score={v.drivingScore} />

              <div className="vehicle-stats" style={{ marginTop: 'var(--space-md)' }}>
                <div className="stat-item">
                  <div className="stat-label">Speed</div>
                  <div className="stat-value">{v.speedKmh}<span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)' }}> km/h</span></div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Heading</div>
                  <div className="stat-value">{v.headingDeg}°</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Hazard</div>
                  <div className="stat-value" style={{
                    color: v.hazard?.level === 'high' ? 'var(--accent-red)' :
                           v.hazard?.level === 'medium' ? 'var(--accent-orange)' : 'var(--accent-green)',
                    fontSize: '0.9rem'
                  }}>
                    {(v.hazard?.level || 'low').toUpperCase()}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Position</div>
                  <div className="stat-value" style={{ fontSize: '0.7rem' }}>
                    {v.lat?.toFixed(4)}, {v.lon?.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Cabin Status */}
              <div className={`cabin-indicator ${cabin.class}`} style={{ marginTop: 'var(--space-md)' }}>
                <span>{cabin.icon}</span>
                <span>{cabin.label}</span>
              </div>
            </div>
          );
        })}

        {vehicleArray.length === 0 && (
          <div className="glass-card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📡</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Waiting for vehicle data...
            </div>
            <div style={{ color: 'var(--text-dimmed)', fontSize: '0.7rem', marginTop: 'var(--space-xs)' }}>
              Start the simulator or connect hardware
            </div>
          </div>
        )}

        {/* Alert Feed */}
        <div className="glass-card alert-feed">
          <div className="section-header">
            <span className="section-title">Live Alerts</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
              {alerts.length}
            </span>
          </div>
          {alerts.length === 0 && (
            <div style={{ color: 'var(--text-dimmed)', fontSize: '0.8rem', padding: 'var(--space-sm) 0' }}>
              No alerts yet
            </div>
          )}
          {alerts.slice(0, 15).map(alert => (
            <div key={alert.id} className="alert-item">
              <span className={`alert-severity ${alert.severity}`}>{alert.severity}</span>
              <div>
                <div className="alert-text">V{alert.vehicleId}: {alert.reason}</div>
                <div className="alert-time">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
