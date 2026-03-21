import React from 'react';
import { useVisualizerStore, type AppMode } from '@/lib/store';
import { MAP_CONFIGS } from '@/lib/types';
import { Play, BarChart2, Sparkles, ChevronDown } from 'lucide-react';

const MODES: { id: AppMode; label: string; icon: React.ReactNode }[] = [
  { id: 'replay',    label: 'Replay',    icon: <Play className="w-3.5 h-3.5" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { id: 'ai',        label: 'AI Insights', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

const MAP_LABELS: Record<string, string> = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
};

export function TopBar() {
  const {
    appMode, setAppMode,
    indexData, selectedMap, selectedDate, selectedMatchId,
    setSelectedMap, setSelectedDate, setSelectedMatchId,
  } = useVisualizerStore();

  const filteredMatches = (indexData?.matches.filter(
    (m) => m.map === selectedMap && m.date === selectedDate
  ) ?? []).slice().sort((a, b) =>
    (b.kills * 10 + b.bots * 4 + b.stormDeaths * 2 + b.totalEvents * 0.01) -
    (a.kills * 10 + a.bots * 4 + a.stormDeaths * 2 + a.totalEvents * 0.01)
  );

  const dateNumbers = indexData?.stats.dates ?? [];

  return (
    <div
      className="h-12 flex items-center px-4 gap-6 shrink-0 z-50"
      style={{ background: '#08070c', borderBottom: '1px solid rgba(255,138,0,0.12)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-[#ff8a00] to-[#ff5500]"
          style={{ clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))' }}
        >
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M3 3L9 15L15 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 9H12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span
          className="uppercase tracking-[0.14em] leading-none"
          style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff' }}
        >
          LILA <span style={{ color: '#ff8a00' }}>BLACK</span>
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

      {/* Mode tabs */}
      <div className="flex items-center gap-1">
        {MODES.map((m) => {
          const active = appMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setAppMode(m.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: active ? 'rgba(255,138,0,0.12)' : 'transparent',
                border: `1px solid ${active ? 'rgba(255,138,0,0.4)' : 'transparent'}`,
                color: active ? '#ff8a00' : 'rgba(255,255,255,0.45)',
              }}
            >
              <span style={{ color: active ? '#ff8a00' : 'rgba(255,255,255,0.3)' }}>{m.icon}</span>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Map selector */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono uppercase tracking-widest" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Map</span>
        <div className="relative">
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            className="appearance-none font-mono cursor-pointer pr-5 pl-2 py-1 focus:outline-none"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {Object.keys(MAP_LABELS).map((m) => (
              <option key={m} value={m}>{MAP_LABELS[m]}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono uppercase tracking-widest" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Date</span>
        <div className="relative">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="appearance-none cursor-pointer pr-5 pl-2 py-1 focus:outline-none"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {dateNumbers.map((d) => (
              <option key={d} value={d}>{d.replace('February_', 'Feb ')}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
      </div>

      {/* Match selector — only shown in replay mode */}
      {appMode === 'replay' && (
        <div className="flex items-center gap-1.5">
          <span className="font-mono uppercase tracking-widest" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Match</span>
          <div className="relative">
            <select
              value={selectedMatchId ?? ''}
              onChange={(e) => setSelectedMatchId(e.target.value || null)}
              className="appearance-none cursor-pointer pr-5 pl-2 py-1 focus:outline-none"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 600,
                fontSize: 11,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: selectedMatchId ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)',
                maxWidth: 200,
              }}
            >
              <option value="">— select match —</option>
              {filteredMatches.map((m) => {
                const tags = [
                  `${m.totalEvents}ev`,
                  `${m.humans}H`,
                  m.bots > 0 ? `${m.bots}B` : null,
                  m.kills > 0 ? `${m.kills}K` : null,
                  m.stormDeaths > 0 ? `${m.stormDeaths}⚡` : null,
                ].filter(Boolean).join(' · ');
                return (
                  <option key={m.id} value={m.id}>
                    {m.id.slice(0, 8)}… {tags}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
          </div>
        </div>
      )}
    </div>
  );
}
