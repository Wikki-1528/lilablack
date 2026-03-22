import React from 'react';
import { useVisualizerStore, type AnalyticsOverlay } from '@/lib/store';
import { Activity, Info } from 'lucide-react';

const OVERLAYS: { id: AnalyticsOverlay; label: string; desc: string; color: string }[] = [
  { id: 'traffic',   label: 'Human Traffic',    desc: 'Where players spend the most time', color: '#60a5fa' },
  { id: 'kd',        label: 'K/D Ratio Zones',  desc: 'Kill-dominant vs death-trap zones', color: '#fbbf24' },
  { id: 'deadzone',  label: 'Dead Zones',        desc: 'Map areas with zero player traffic', color: '#ef4444' },
  { id: 'loot',      label: 'Loot Density',      desc: 'Where loot pickups are concentrated', color: '#22c55e' },
  { id: 'hotdrop',   label: 'Hot Drops',         desc: 'Where players land at match start', color: '#ff8a00' },
  { id: 'botvhuman', label: 'Bot vs Human',      desc: 'Traffic overlap and divergence', color: '#a855f7' },
  { id: 'storm',     label: 'Storm Deaths',      desc: 'Where storm eliminations happen', color: '#7c3aed' },
];

export function AnalyticsPanel() {
  const { analyticsData, selectedMap, analyticsOverlay, setAnalyticsOverlay } = useVisualizerStore();
  const data = analyticsData[selectedMap];
  const summary = data?.summary;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#08070c' }}>

      {/* Header */}
      <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', letterSpacing: '0.08em' }}>
          Map Analytics
        </div>
        {data && (
          <div className="font-mono mt-0.5" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
            {data.matchCount} matches · Feb 10–14 · all dates
          </div>
        )}
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="font-mono uppercase tracking-widest mb-2" style={{ fontSize: 8, color: 'rgba(255,138,0,0.6)' }}>Overview</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Dead Zone', value: `${summary.deadZonePercent}%`, color: '#ef4444', desc: 'of map unused' },
              { label: 'Bot/Human Overlap', value: `${Math.round(summary.botHumanOverlap * 100)}%`, color: '#a855f7', desc: 'of active cells' },
              { label: 'Avg K/D', value: summary.avgKdRatio.toFixed(2), color: '#fbbf24', desc: 'across zones' },
              { label: 'Total Kills', value: summary.totalKills, color: '#ef4444', desc: 'all matches' },
              { label: 'Total Loot', value: summary.totalLoot.toLocaleString(), color: '#22c55e', desc: 'pickups' },
              { label: 'Storm Deaths', value: summary.stormClusters.reduce((s, c) => s + c.count, 0), color: '#7c3aed', desc: 'total' },
            ].map((s) => (
              <div key={s.label} className="px-2 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div className="font-mono uppercase tracking-wide mt-1" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overlay selector */}
      <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="font-mono uppercase tracking-widest mb-2" style={{ fontSize: 8, color: 'rgba(255,138,0,0.6)' }}>Overlay</div>
        <div className="space-y-1">
          {OVERLAYS.map((o) => {
            const active = analyticsOverlay === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setAnalyticsOverlay(o.id)}
                className="w-full text-left px-2.5 py-2 transition-all"
                style={{
                  background: active ? `${o.color}12` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${active ? `${o.color}40` : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 shrink-0" style={{ backgroundColor: o.color, opacity: active ? 1 : 0.4 }} />
                  <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: active ? 700 : 600, fontSize: 12, color: active ? '#fff' : 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>
                    {o.label}
                  </span>
                </div>
                <div className="font-mono mt-0.5" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', paddingLeft: 16 }}>
                  {o.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* K/D legend — shown when KD overlay active */}
      {analyticsOverlay === 'kd' && (
        <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="font-mono uppercase tracking-widest mb-2" style={{ fontSize: 8, color: 'rgba(255,138,0,0.6)' }}>K/D Scale</div>
          <div className="flex items-center gap-2">
            <span className="font-mono" style={{ fontSize: 8, color: '#22c55e' }}>High K/D</span>
            <div className="flex-1 h-2" style={{ background: 'linear-gradient(to right, #22c55e, #fbbf24, #ef4444)' }} />
            <span className="font-mono" style={{ fontSize: 8, color: '#ef4444' }}>Death trap</span>
          </div>
          <div className="flex justify-between mt-1 font-mono" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
            <span>K/D &gt; 1.5</span>
            <span>0.5 – 1.5</span>
            <span>K/D &lt; 0.5</span>
          </div>
        </div>
      )}

      {/* Data scope note */}
      <div className="px-3 py-3">
        <div className="flex items-start gap-2 px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'rgba(255,138,0,0.5)' }} />
          <div className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
            Analytics aggregate all 5 days (Feb 10–14). Use the date picker in the top bar to filter Replay mode by day.
          </div>
        </div>
      </div>

      {!data && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Activity className="w-6 h-6 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.1)' }} />
            <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Loading analytics…</div>
          </div>
        </div>
      )}
    </div>
  );
}
