'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, AlertTriangle, Users, BarChart3 } from 'lucide-react';

interface AlertStats {
  alert_type: string;
  severity: string;
  count: number;
  last_occurred: string;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<AlertStats[]>([]);
  const [activeVehiclesCount, setActiveVehiclesCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        const [statsRes, vehiclesRes] = await Promise.all([
          fetch(`${apiUrl}/api/alerts/stats`),
          fetch(`${apiUrl}/api/vehicles`)
        ]);

        if (statsRes.ok) setStats(await statsRes.json());

        if (vehiclesRes.ok) {
          const vehicles = await vehiclesRes.json();
          setActiveVehiclesCount(vehicles.length);

          if (vehicles.length > 0) {
            const totalScore = vehicles.reduce((sum: number, v: any) => sum + (v.driving_score || 0), 0);
            setAvgScore(totalScore / vehicles.length);
          }
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const chartData = stats.reduce((acc, curr) => {
    const existing = acc.find(item => item.type === curr.alert_type);
    if (existing) {
      existing[curr.severity] = curr.count;
    } else {
      acc.push({
        type: curr.alert_type,
        high: curr.severity === 'high' ? curr.count : 0,
        medium: curr.severity === 'medium' ? curr.count : 0,
        low: curr.severity === 'low' ? curr.count : 0,
      });
    }
    return acc;
  }, [] as any[]);

  return (
    <div className="dashboard-layout" style={{ display: 'block', padding: 'var(--space-xl)', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/" style={{ color: 'var(--text-dimmed)', display: 'flex', alignItems: 'center', textDecoration: 'none', fontSize: '0.8rem', gap: '6px', transition: 'color 0.2s' }}>
            <ArrowLeft size={16} />
            <span>Fleet</span>
          </Link>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Fleet Analytics
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '4px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <Link href="/" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Dashboard</Link>
          <Link href="/analytics" style={{ padding: '8px 18px', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px' }}>Analytics</Link>
          <Link href="/sensing" style={{ padding: '8px 18px', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.5px', transition: 'all 0.2s' }}>Cabin Monitor</Link>
        </div>
      </header>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', borderTop: '2px solid var(--accent-blue)' }}>
          <div style={{ background: 'rgba(0, 112, 255, 0.08)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0, 112, 255, 0.1)' }}>
            <TrendingUp size={24} color="var(--accent-blue)" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '4px' }}>Avg Fleet Score</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {activeVehiclesCount > 0 ? avgScore.toFixed(1) : '--'}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', borderTop: '2px solid var(--accent-red)' }}>
          <div style={{ background: 'rgba(255, 56, 80, 0.08)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 56, 80, 0.1)' }}>
            <AlertTriangle size={24} color="var(--accent-red)" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '4px' }}>Total Alerts (24h)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {stats.reduce((acc, curr) => acc + curr.count, 0)}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', borderTop: '2px solid var(--accent-green)' }}>
          <div style={{ background: 'rgba(0, 232, 123, 0.08)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0, 232, 123, 0.1)' }}>
            <Users size={24} color="var(--accent-green)" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '4px' }}>Active Vehicles</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {activeVehiclesCount}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)' }}>
        {/* Alert Distribution Chart */}
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <BarChart3 size={16} color="var(--accent-cyan)" />
            <h2 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '-0.3px' }}>Alert Distribution</h2>
          </div>
          {loading ? (
            <div style={{ color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>Loading analytics...</div>
          ) : chartData.length > 0 ? (
            <div style={{ height: '320px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="type" stroke="var(--text-dimmed)" fontSize={11} tick={{ fill: 'var(--text-dimmed)' }} />
                  <YAxis stroke="var(--text-dimmed)" fontSize={11} tick={{ fill: 'var(--text-dimmed)' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ backgroundColor: 'rgba(12, 13, 20, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', backdropFilter: 'blur(8px)' }}
                    itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '0.75rem' }} />
                  <Bar dataKey="high" stackId="a" fill="var(--accent-red)" name="High" radius={[0, 0, 3, 3]} />
                  <Bar dataKey="medium" stackId="a" fill="var(--accent-orange)" name="Medium" />
                  <Bar dataKey="low" stackId="a" fill="var(--accent-cyan)" name="Low" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}>
                <rect x="4" y="18" width="6" height="18" rx="2" fill="var(--text-dimmed)"/>
                <rect x="14" y="10" width="6" height="26" rx="2" fill="var(--text-dimmed)"/>
                <rect x="24" y="14" width="6" height="22" rx="2" fill="var(--text-dimmed)"/>
                <rect x="34" y="6" width="6" height="30" rx="2" fill="var(--text-dimmed)"/>
              </svg>
              <div style={{ color: 'var(--text-dimmed)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>No alert data available</div>
              <div style={{ color: 'var(--text-dimmed)', fontSize: '0.7rem', marginTop: '6px', opacity: 0.6 }}>Data will populate once vehicles start transmitting</div>
            </div>
          )}
        </div>

        {/* Top Risk Factors */}
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <AlertTriangle size={16} color="var(--accent-orange)" />
            <h2 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '-0.3px' }}>Top Risk Factors</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.length === 0 ? (
              <div style={{ color: 'var(--text-dimmed)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '32px 0' }}>
                No risk data yet
              </div>
            ) : (
              stats.sort((a, b) => b.count - a.count).slice(0, 5).map((stat, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{stat.alert_type}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                      {stat.severity}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                    color: stat.severity === 'high' ? 'var(--accent-red)' : stat.severity === 'medium' ? 'var(--accent-orange)' : 'var(--text-primary)'
                  }}>
                    {stat.count}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
