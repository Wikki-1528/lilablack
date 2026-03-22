import React from 'react';
import { useVisualizerStore, type AnalyticsOverlay } from '@/lib/store';

const OVERLAY_CONFIG: { id: AnalyticsOverlay; label: string; color: string; insight: string }[] = [
  {
    id: 'traffic',
    label: 'Human Traffic',
    color: '#00e5ff',
    insight: 'Shows where players spend the most time. Bright zones are high-traffic corridors and loot rooms.',
  },
  {
    id: 'kd',
    label: 'K/D Ratio',
    color: '#fbbf24',
    insight: 'Green = high K/D (>1.5), red = low K/D (<0.5). Identifies chokepoints where attackers dominate vs. defenders.',
  },
  {
    id: 'deadzone',
    label: 'Dead Zones',
    color: '#ef4444',
    insight: 'Areas with zero player traffic across all matches. These zones may be under-designed or inaccessible.',
  },
  {
    id: 'loot',
    label: 'Loot Density',
    color: '#22c55e',
    insight: 'Loot pickup density. Compare against traffic to find whether players are reaching all loot rooms.',
  },
  {
    id: 'hotdrop',
    label: 'Hot Drops',
    color: '#ff8a00',
    insight: 'First landing positions per player. Orange clusters reveal popular initial drop zones and spawn pressure.',
  },
  {
    id: 'botvhuman',
    label: 'Bot vs Human',
    color: '#a855f7',
    insight: 'Blue = human-only zones, orange = bot-only, purple = overlap. Reveals how AI routing differs from human preference.',
  },
  {
    id: 'storm',
    label: 'Storm Deaths',
    color: '#7c3aed',
    insight: 'Location of storm-related deaths. Clusters near map edges indicate late-game storm compression zones.',
  },
];

export function HeatmapPanel() {
  const { analyticsOverlay, setAnalyticsOverlay, heatmapOpacity, setHeatmapOpacity } = useVisualizerStore();
  const currentInsight = OVERLAY_CONFIG.find((o) => o.id === analyticsOverlay)?.insight ?? '';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Overlay selector */}
      <div className="px-3 py-3 space-y-1">
        <div className="font-mono uppercase tracking-widest mb-2" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>
          Overlay Mode
        </div>
        {OVERLAY_CONFIG.map((ov) => {
          const isActive = analyticsOverlay === ov.id;
          return (
            <button
              key={ov.id}
              onClick={() => setAnalyticsOverlay(ov.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-all text-left"
              style={{
                background: isActive ? `${ov.color}12` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? `${ov.color}40` : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              <span className="w-2 h-2 shrink-0" style={{ backgroundColor: ov.color }} />
              <span
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              >
                {ov.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Opacity slider */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono uppercase tracking-widest" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>Opacity</span>
          <span className="font-mono" style={{ fontSize: 9, color: '#ff8a00' }}>{Math.round(heatmapOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={heatmapOpacity}
          onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: '#ff8a00' }}
        />
      </div>

      {/* Insight text */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="font-mono uppercase tracking-widest mb-2" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>Insight</div>
        <p className="font-mono leading-relaxed" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
          {currentInsight}
        </p>
      </div>
    </div>
  );
}
