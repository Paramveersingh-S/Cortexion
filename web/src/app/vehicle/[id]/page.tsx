'use client';

import { useEffect, useState, use } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Link from 'next/link';
import { ArrowLeft, Activity, ShieldAlert, Thermometer, Battery } from 'lucide-react';

interface VehicleHistory {
  id: number;
  speed_kmh: number;
  driving_score: number;
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
    <div className="dashboard-layout" style={{ display: 'block', padding: 'var(--space-xl)', overflowY: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', marginRight: 'var(--space-md)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} style={{ marginRight: '8px' }} />
          Back to Fleet
        </Link>
        <h1 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
          Vehicle #{vehicleId}
          <span style={{ marginLeft: '12px', fontSize: '0.9rem', background: 'rgba(0, 255, 136, 0.1)', color: 'var(--accent-green)', padding: '4px 10px', borderRadius: '20px' }}>Active</span>
        </h1>
      </header>

      {loading ? (
        <div style={{ color: 'var(--text-dimmed)' }}>Loading telemetry...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-lg)' }}>
          {/* Main Charts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            
            {/* Speed & Score Charts */}
            <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Telemetry History</h2>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" stroke="var(--text-dimmed)" fontSize={12} />
                    <YAxis yAxisId="left" stroke="var(--text-dimmed)" fontSize={12} label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft', fill: 'var(--text-dimmed)' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-dimmed)" fontSize={12} domain={[0, 100]} label={{ value: 'Score', angle: 90, position: 'insideRight', fill: 'var(--text-dimmed)' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="speed" stroke="var(--accent-cyan)" strokeWidth={2} dot={false} name="Speed" />
                    <Line yAxisId="right" type="monotone" dataKey="score" stroke="var(--accent-orange)" strokeWidth={2} dot={false} name="Driving Score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Diagnostics Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Activity size={24} color="var(--accent-green)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dimmed)' }}>Avg Speed</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>{Math.round(chartData.reduce((acc, curr) => acc + curr.speed, 0) / (chartData.length || 1))} km/h</div>
                </div>
              </div>
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Thermometer size={24} color="var(--accent-orange)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dimmed)' }}>Engine Temp</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>92°C</div>
                </div>
              </div>
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Battery size={24} color="var(--accent-purple)" />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dimmed)' }}>Battery Volt</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>13.8V</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Event Log */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <ShieldAlert size={18} color="var(--accent-red)" />
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Event Log</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {events.length === 0 ? (
                <div style={{ color: 'var(--text-dimmed)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>No events recorded.</div>
              ) : (
                events.map(event => (
                  <div key={event.id} style={{ 
                    padding: '12px', 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: '8px',
                    borderLeft: `3px solid ${event.severity === 'high' ? 'var(--accent-red)' : event.severity === 'medium' ? 'var(--accent-orange)' : 'var(--accent-cyan)'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{event.alert_type}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dimmed)' }}>{new Date(event.created_at).toLocaleTimeString([], { hour12: false })}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Severity: <span style={{ textTransform: 'capitalize' }}>{event.severity}</span>
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
