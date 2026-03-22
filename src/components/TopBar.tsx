import React, { useState, useRef, useEffect } from 'react';
import { useVisualizerStore, type AppMode } from '@/lib/store';
import { Play, BarChart2, ChevronDown, Sparkles } from 'lucide-react';

const MODES: { id: AppMode; label: string; icon: React.ReactNode }[] = [
  { id: 'replay',    label: 'Replay',    icon: <Play className="w-3.5 h-3.5" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { id: 'ai',        label: 'AI',        icon: <Sparkles className="w-3.5 h-3.5" /> },
];

const MAP_LABELS: Record<string, string> = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
};

// Feb 2026 calendar — only dates 10-14 have data
const AVAILABLE_DAYS = new Set([10, 11, 12, 13, 14]);
const DAY_TO_DATE: Record<number, string> = {
  10: 'February_10', 11: 'February_11', 12: 'February_12',
  13: 'February_13', 14: 'February_14',
};
const DATE_TO_DAY: Record<string, number> = {
  February_10: 10, February_11: 11, February_12: 12,
  February_13: 13, February_14: 14,
};
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
// Feb 1 2026 = Sunday (index 0)
const FEB_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

function CalendarPicker({ selectedDate, onSelect, onClose }: {
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const selectedDay = DATE_TO_DAY[selectedDate];

  return (
    <div
      className="absolute z-50 top-full mt-1 right-0"
      style={{
        background: '#0d0c14',
        border: '1px solid rgba(255,138,0,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        minWidth: 220,
        padding: '12px',
      }}
    >
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, color: '#ff8a00', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          February 2026
        </span>
        <button onClick={onClose} className="opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#fff', fontSize: 16, lineHeight: 1 }}>✕</button>
      </div>

      {/* Day names header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — Feb 1 = Sunday so no offset needed */}
      <div className="grid grid-cols-7 gap-0.5">
        {FEB_DAYS.map((day) => {
          const isAvailable = AVAILABLE_DAYS.has(day);
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              disabled={!isAvailable}
              onClick={() => { onSelect(DAY_TO_DATE[day]); onClose(); }}
              className="aspect-square flex items-center justify-center transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: isSelected ? 700 : isAvailable ? 600 : 400,
                fontSize: 11,
                background: isSelected
                  ? '#ff8a00'
                  : isAvailable
                    ? 'rgba(255,138,0,0.1)'
                    : 'transparent',
                border: isSelected
                  ? '1px solid #ff8a00'
                  : isAvailable
                    ? '1px solid rgba(255,138,0,0.3)'
                    : '1px solid transparent',
                color: isSelected
                  ? '#000'
                  : isAvailable
                    ? '#ff8a00'
                    : 'rgba(255,255,255,0.15)',
                cursor: isAvailable ? 'pointer' : 'default',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-3 pt-2 font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        Data available: Feb 10 – 14 only
      </div>
    </div>
  );
}

function StyledSelect({ value, onChange, children, style }: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer pr-6 pl-2.5 py-1.5 focus:outline-none"
        style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: '0.04em',
          background: '#0d0c14',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.85)',
          colorScheme: 'dark',
          ...style,
        }}
      >
        {children}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,138,0,0.5)' }} />
    </div>
  );
}

export function TopBar() {
  const {
    appMode, setAppMode,
    indexData, selectedMap, selectedDate, selectedMatchId,
    setSelectedMap, setSelectedDate, setSelectedMatchId,
  } = useVisualizerStore();

  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  // Close calendar on outside click
  useEffect(() => {
    if (!calOpen) return;
    const handler = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calOpen]);

  const filteredMatches = (indexData?.matches.filter(
    (m) => m.map === selectedMap && m.date === selectedDate
  ) ?? []).slice().sort((a, b) => {
    // Human matches always rank above bot-only matches in the dropdown
    const hA = a.humans > 0 ? 1 : 0, hB = b.humans > 0 ? 1 : 0;
    if (hB !== hA) return hB - hA;
    return (b.kills * 10 + b.stormDeaths * 2 + b.totalEvents * 0.01) -
           (a.kills * 10 + a.stormDeaths * 2 + a.totalEvents * 0.01);
  });

  const selectedDay = DATE_TO_DAY[selectedDate];
  const stats = indexData?.stats;

  return (
    <div
      className="h-12 flex items-center px-5 gap-5 shrink-0"
      style={{ background: '#08070c', borderBottom: '1px solid rgba(255,138,0,0.1)', zIndex: 50 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="w-7 h-7 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #ff8a00, #ff5500)',
            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M3 3L9 15L15 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 9H12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.15em', color: '#fff' }}>
          LILA <span style={{ color: '#ff8a00' }}>BLACK</span>
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

      {/* Mode tabs */}
      <div className="flex items-center gap-0.5">
        {MODES.map((m) => {
          const active = appMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setAppMode(m.id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 transition-all mode-tab${active ? ' active' : ''}`}
              style={{
                width: 100,
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: active ? 'rgba(255,138,0,0.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(255,138,0,0.35)' : 'rgba(255,255,255,0.07)'}`,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ opacity: active ? 1 : 0.5 }}>{m.icon}</span>
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Dataset stats chips */}
      {stats && (
        <div className="hidden lg:flex items-center gap-3 mr-2">
          {[
            { value: stats.totalMatches, label: 'matches' },
            { value: stats.totalPlayers, label: 'players' },
            { value: `${Math.round(stats.totalEvents / 1000)}K`, label: 'events' },
          ].map((chip) => (
            <div key={chip.label} className="flex items-center gap-1">
              <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>
                {chip.value}
              </span>
              <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.08em' }}>
                {chip.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Separator before controls */}
      {stats && <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />}

      {/* Map/Date/Match controls — hidden in AI mode (AI page has its own map selector) */}
      {appMode !== 'ai' && (
      <div className="flex items-center gap-4">

      {/* Map selector */}
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Map</span>
        <StyledSelect value={selectedMap} onChange={setSelectedMap}>
          {Object.entries(MAP_LABELS).map(([k, v]) => (
            <option key={k} value={k} style={{ background: '#0d0c14', color: 'rgba(255,255,255,0.85)' }}>{v}</option>
          ))}
        </StyledSelect>
      </div>

      {/* Date — calendar picker */}
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Date</span>
        <div className="relative" ref={calRef}>
          <button
            onClick={() => setCalOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 transition-all"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              background: calOpen ? 'rgba(255,138,0,0.1)' : '#0d0c14',
              border: `1px solid ${calOpen ? 'rgba(255,138,0,0.35)' : 'rgba(255,255,255,0.12)'}`,
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.04em',
            }}
          >
            Feb {selectedDay}
            <ChevronDown className="w-3 h-3" style={{ color: 'rgba(255,138,0,0.5)', transform: calOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {calOpen && (
            <CalendarPicker
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              onClose={() => setCalOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Match selector — replay mode only */}
      {appMode === 'replay' && (
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Match</span>
          <StyledSelect
            value={selectedMatchId ?? ''}
            onChange={(v) => setSelectedMatchId(v || null)}
            style={{ maxWidth: 190 }}
          >
            <option value="" style={{ background: '#0d0c14', color: 'rgba(255,255,255,0.4)' }}>— select —</option>
            {filteredMatches.map((m) => {
              const tags = [
                `${m.totalEvents}ev`,
                `${m.humans}H`,
                m.bots > 0 ? `${m.bots}B` : null,
                m.kills > 0 ? `${m.kills}K` : null,
                m.stormDeaths > 0 ? `${m.stormDeaths}⚡` : null,
              ].filter(Boolean).join(' · ');
              return (
                <option key={m.id} value={m.id} style={{ background: '#0d0c14', color: 'rgba(255,255,255,0.85)' }}>
                  {m.id.slice(0, 8)}… {tags}
                </option>
              );
            })}
          </StyledSelect>
        </div>
      )}

      </div>
      )}
    </div>
  );
}
