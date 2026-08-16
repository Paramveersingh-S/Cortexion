'use client';

interface Props {
  present: boolean;
  motionState: string;
  targetDistM: number;
  stillnessSeconds?: number;
}

const MOTION_LABELS: Record<string, { label: string; icon: string; class: string }> = {
  'moving':       { label: 'Moving',       icon: '🏃', class: 'motion-moving' },
  'micro_motion': { label: 'Micro-motion', icon: '🧘', class: 'motion-micro' },
  'stationary':   { label: 'Stationary',   icon: '⚠️', class: 'motion-still' },
  'none':         { label: 'No Target',    icon: '—',  class: 'motion-none' },
};

export default function PresenceIndicator({ present, motionState, targetDistM, stillnessSeconds = 0 }: Props) {
  const motion = MOTION_LABELS[motionState] || MOTION_LABELS['none'];

  return (
    <div className="presence-indicator-panel">
      {/* Presence Status */}
      <div className={`presence-badge ${present ? 'present' : 'absent'}`}>
        <div className={`presence-dot ${present ? 'pulse' : ''}`} />
        <span className="presence-text">{present ? 'HUMAN DETECTED' : 'NO PRESENCE'}</span>
      </div>

      {/* Distance */}
      {present && (
        <div className="presence-stat">
          <span className="presence-stat-label">Distance</span>
          <span className="presence-stat-value">
            {targetDistM.toFixed(1)}<span className="presence-stat-unit">m</span>
          </span>
        </div>
      )}

      {/* Motion State */}
      <div className={`motion-badge ${motion.class}`}>
        <span>{motion.icon}</span>
        <span>{motion.label}</span>
      </div>

      {/* Stillness Timer */}
      {present && motionState === 'stationary' && (
        <div className="stillness-timer">
          <span className="stillness-label">Still for</span>
          <span className="stillness-value">{stillnessSeconds}s</span>
          {stillnessSeconds > 45 && (
            <span className="stillness-alert">⚠ Extended inactivity</span>
          )}
        </div>
      )}
    </div>
  );
}
