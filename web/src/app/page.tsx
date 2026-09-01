'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
// @ts-ignore
import dynamic from 'next/dynamic';
import Link from 'next/link';

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

function ScoreGauge({ score, size = 130 }: { score: number; size?: number }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#00e87b' : score >= 50 ? '#ff9500' : '#ff3850';

  return (
    <div className="score-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
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
  console.log("Dashboard rendering - HMR Triggered");
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="url(#grad)" strokeWidth="2"/>
            <path d="M8 12h8M12 8v8" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round"/>
            <defs><linearGradient id="grad" x1="0" y1="0" x2="24" y2="24">
              <stop stopColor="#0070ff"/><stop offset="1" stopColor="#00c8ff"/>
            </linearGradient></defs>
          </svg>
          <span style={{ letterSpacing: '1.5px', fontSize: '1.05rem' }}>CORTEXION</span>
        </div>

        <div style={{ display: 'flex', gap: '4px', position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'auto' }}>
          <Link href="/" style={{ padding: '8px 18px', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px' }}>Dashboard</Link>
          <Link href="/analytics" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Analytics</Link>
          <Link href="/sensing" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Cabin Monitor</Link>
        </div>


        <div className="nav-status">
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
            {vehicleArray.length} vehicle{vehicleArray.length !== 1 ? 's' : ''}
          </span>
          <div className={`status-dot ${wsStatus === 'connected' ? '' : wsStatus === 'connecting' ? 'warning' : 'offline'}`} />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
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
          const hazardColor = v.hazard?.level === 'high' ? 'var(--accent-red)' :
                              v.hazard?.level === 'medium' ? 'var(--accent-orange)' : 'rgba(0, 200, 255, 0.15)';
          return (
            <Link key={v.vehicleId} href={`/vehicle/${v.vehicleId}`} style={{ textDecoration: 'none' }}>
              <div className="glass-card vehicle-card"
                   style={{ borderLeft: `2px solid ${hazardColor}`, transition: 'all 0.25s ease', cursor: 'pointer' }}
                   onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--border-active)'; }}
                   onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = hazardColor; }}>
                <div className="vehicle-card-header">
                  <span className="vehicle-id">V{v.vehicleId}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
                    {v.peerDistance != null ? `${v.peerDistance}m` : '—'}
                  </span>
                </div>

                <ScoreGauge score={v.drivingScore} />

                <div className="vehicle-stats" style={{ marginTop: 'var(--space-md)' }}>
                  <div className="stat-item">
                    <div className="stat-label">Speed</div>
                    <div className="stat-value">{v.speedKmh}<span style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)' }}> km/h</span></div>
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
                      fontSize: '0.85rem', letterSpacing: '0.5px'
                    }}>
                      {(v.hazard?.level || 'low').toUpperCase()}
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Position</div>
                    <div className="stat-value" style={{ fontSize: '0.65rem' }}>
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
            </Link>
          );
        })}

        {vehicleArray.length === 0 && (
          <div className="glass-card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
            {/* Animated radar scan SVG */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
              <circle cx="24" cy="24" r="20" stroke="rgba(0,200,255,0.1)" strokeWidth="1.5"/>
              <circle cx="24" cy="24" r="14" stroke="rgba(0,200,255,0.08)" strokeWidth="1"/>
              <circle cx="24" cy="24" r="8" stroke="rgba(0,200,255,0.06)" strokeWidth="1"/>
              <line x1="24" y1="24" x2="24" y2="4" stroke="rgba(0,200,255,0.3)" strokeWidth="1.5" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="3s" repeatCount="indefinite"/>
              </line>
              <circle cx="24" cy="24" r="2" fill="var(--accent-cyan)" opacity="0.6"/>
            </svg>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>
              AWAITING TELEMETRY
            </div>
            <div style={{ color: 'var(--text-dimmed)', fontSize: '0.7rem', marginTop: '8px' }}>
              Start the simulator or connect hardware
            </div>
          </div>
        )}

        {/* Alert Feed */}
        <div className="glass-card alert-feed">
          <div className="section-header">
            <span className="section-title">Live Alerts</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
              {alerts.length}
            </span>
          </div>
          {alerts.length === 0 && (
            <div style={{ color: 'var(--text-dimmed)', fontSize: '0.75rem', padding: '8px 0', fontFamily: 'var(--font-mono)' }}>
              No alerts
            </div>
          )}
          {alerts.slice(0, 15).map(alert => (
            <div key={alert.id} className="alert-item">
              <span className={`alert-severity ${alert.severity}`}>{alert.severity}</span>
              <div>
                <div className="alert-text">V{alert.vehicleId}: {alert.reason}</div>
                <div className="alert-time">
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour12: false })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
