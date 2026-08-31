'use client';

import { useEffect, useState, use } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Link from 'next/link';
import { ArrowLeft, Activity, ShieldAlert, Thermometer, Battery, Gauge } from 'lucide-react';

interface VehicleHistory {
  id: number;
  speed_kmh: number;
  driving_score: number;
  engine_temp?: number;
  battery_voltage?: number;
  received_at: string;
}

interface EventLog {
  id: number;
  alert_type: string;
  severity: string;
  created_at: string;
}

export default function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const vehicleId = resolvedParams.id;
  const [history, setHistory] = useState<VehicleHistory[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const [historyRes, eventsRes] = await Promise.all([
          fetch(`${apiUrl}/api/vehicles/${vehicleId}/history?limit=100`),
          fetch(`${apiUrl}/api/alerts?vehicle_id=${vehicleId}&limit=20`)
        ]);

        if (historyRes.ok) setHistory(await historyRes.json());
        if (eventsRes.ok) setEvents(await eventsRes.json());
      } catch (err) {
        console.error('Failed to fetch vehicle data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [vehicleId]);

  const chartData = history.slice().reverse().map(h => ({
    time: new Date(h.received_at).toLocaleTimeString([], { hour12: false }),
    speed: h.speed_kmh,
    score: h.driving_score
  }));

  return (
    <div className="dashboard-layout" style={{ display: 'block', padding: 'var(--space-xl)', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/" style={{ color: 'var(--text-dimmed)', display: 'flex', alignItems: 'center', textDecoration: 'none', fontSize: '0.8rem', gap: '6px', transition: 'color 0.2s' }}>
            <ArrowLeft size={16} />
            <span>Fleet</span>
          </Link>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Vehicle #{vehicleId}
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1.5px',
              background: 'rgba(0, 232, 123, 0.08)', color: 'var(--accent-green)',
              padding: '4px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(0, 232, 123, 0.15)',
              fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 6px rgba(0,232,123,0.5)' }} />
              ACTIVE
            </span>
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '4px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <Link href="/" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Dashboard</Link>
          <Link href="/analytics" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Analytics</Link>
          <Link href="/sensing" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Cabin Monitor</Link>
        </div>
      </header>

      {loading ? (
        <div style={{ color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', letterSpacing: '1px' }}>Loading telemetry...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-md)' }}>
          {/* Main Charts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

            {/* Speed & Score Charts */}
            <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Gauge size={16} color="var(--accent-cyan)" />
                <h2 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '-0.3px' }}>Telemetry History</h2>
              </div>
              <div style={{ height: '280px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="time" stroke="var(--text-dimmed)" fontSize={10} tick={{ fill: 'var(--text-dimmed)' }} />
                    <YAxis yAxisId="left" stroke="var(--text-dimmed)" fontSize={10} tick={{ fill: 'var(--text-dimmed)' }} label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft', fill: 'var(--text-dimmed)', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-dimmed)" fontSize={10} domain={[0, 100]} tick={{ fill: 'var(--text-dimmed)' }} label={{ value: 'Score', angle: 90, position: 'insideRight', fill: 'var(--text-dimmed)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(12, 13, 20, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', backdropFilter: 'blur(8px)' }}
                      itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="speed" stroke="var(--accent-cyan)" strokeWidth={2} dot={false} name="Speed" />
                    <Line yAxisId="right" type="monotone" dataKey="score" stroke="var(--accent-orange)" strokeWidth={2} dot={false} name="Driving Score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Diagnostics Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-sm)' }}>
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', borderTop: '2px solid var(--accent-green)' }}>
                <Activity size={22} color="var(--accent-green)" />
                <div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '4px' }}>Avg Speed</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {Math.round(chartData.reduce((acc, curr) => acc + curr.speed, 0) / (chartData.length || 1))}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', marginLeft: '4px' }}>km/h</span>
                  </div>
                </div>
              </div>
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', borderTop: '2px solid var(--accent-orange)' }}>
                <Thermometer size={22} color="var(--accent-orange)" />
                <div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '4px' }}>Engine Temp</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {history.length > 0 && history[0].engine_temp ? `${history[0].engine_temp}°C` : 'N/A'}
                  </div>
                </div>
              </div>
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', borderTop: '2px solid var(--accent-purple)' }}>
                <Battery size={22} color="var(--accent-purple)" />
                <div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '4px' }}>Battery Volt</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {history.length > 0 && history[0].battery_voltage ? `${history[0].battery_voltage.toFixed(1)}V` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Event Log */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <ShieldAlert size={16} color="var(--accent-red)" />
              <h2 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Event Log</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.length === 0 ? (
                <div style={{ color: 'var(--text-dimmed)', fontSize: '0.8rem', textAlign: 'center', marginTop: '24px', fontFamily: 'var(--font-mono)' }}>No events recorded</div>
              ) : (
                events.map(event => (
                  <div key={event.id} style={{
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.015)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: `2px solid ${event.severity === 'high' ? 'var(--accent-red)' : event.severity === 'medium' ? 'var(--accent-orange)' : 'var(--accent-cyan)'}`,
                    border: '1px solid rgba(255,255,255,0.03)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{event.alert_type}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(event.created_at).toLocaleTimeString([], { hour12: false })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                      {event.severity}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
