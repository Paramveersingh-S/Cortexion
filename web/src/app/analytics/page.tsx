'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, AlertTriangle, Users } from 'lucide-react';

interface AlertStats {
  alert_type: string;
  severity: string;
  count: number;
  last_occurred: string;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<AlertStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/alerts/stats`);
        if (res.ok) setStats(await res.json());
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
    <div className="dashboard-layout" style={{ display: 'block', padding: 'var(--space-xl)', overflowY: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', marginRight: 'var(--space-md)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} style={{ marginRight: '8px' }} />
          Back to Fleet
        </Link>
        <h1 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
          Fleet Analytics
        </h1>
      </header>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: 'var(--space-lg)' }}>
          <div style={{ background: 'rgba(0, 102, 255, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <TrendingUp size={28} color="var(--accent-blue)" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-dimmed)' }}>Avg Fleet Score</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>84.2</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: 'var(--space-lg)' }}>
          <div style={{ background: 'rgba(255, 51, 68, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <AlertTriangle size={28} color="var(--accent-red)" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-dimmed)' }}>Total Alerts (24h)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats.reduce((acc, curr) => acc + curr.count, 0)}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: 'var(--space-lg)' }}>
          <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <Users size={28} color="var(--accent-green)" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-dimmed)' }}>Active Vehicles</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>12</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-lg)' }}>
        {/* Alert Distribution Chart */}
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '24px', color: 'var(--text-primary)' }}>Alert Distribution by Severity</h2>
          {loading ? (
            <div style={{ color: 'var(--text-dimmed)' }}>Loading analytics...</div>
          ) : chartData.length > 0 ? (
            <div style={{ height: '350px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="type" stroke="var(--text-dimmed)" fontSize={12} tick={{ fill: 'var(--text-secondary)' }} />
                  <YAxis stroke="var(--text-dimmed)" fontSize={12} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="high" stackId="a" fill="var(--accent-red)" name="High Severity" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="medium" stackId="a" fill="var(--accent-orange)" name="Medium Severity" />
                  <Bar dataKey="low" stackId="a" fill="var(--accent-cyan)" name="Low Severity" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div style={{ color: 'var(--text-dimmed)', textAlign: 'center', marginTop: '40px' }}>No alert data available yet.</div>
          )}
        </div>

        {/* Top Risk Factors */}
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '24px', color: 'var(--text-primary)' }}>Top Risk Factors</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stats.sort((a, b) => b.count - a.count).slice(0, 5).map((stat, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stat.alert_type}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dimmed)', textTransform: 'capitalize' }}>Severity: {stat.severity}</div>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: stat.severity === 'high' ? 'var(--accent-red)' : stat.severity === 'medium' ? 'var(--accent-orange)' : 'var(--text-primary)' }}>
                  {stat.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
