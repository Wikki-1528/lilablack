import React from 'react';
import { useVisualizerStore } from '@/lib/store';
import { MAP_CONFIGS } from '@/lib/types';
import {
  Eye, EyeOff, Target, Skull, Zap, ShoppingBag,
  Bot, Activity, Layers, MapPin, Calendar, SlidersHorizontal,
} from 'lucide-react';
import clsx from 'clsx';

const MAPS = ['AmbroseValley', 'GrandRift', 'Lockdown'];
const MAP_LABELS: Record<string, string> = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
};

export function Sidebar() {
  const {
    indexData, selectedMap, selectedDate, selectedMatchId,
    layers, heatmapMode, heatmapOpacity,
    setSelectedMap, setSelectedDate, setSelectedMatchId,
    toggleLayer, setHeatmapMode, setHeatmapOpacity,
  } = useVisualizerStore();

  const filteredMatches = (indexData?.matches.filter(
    (m) => m.map === selectedMap && m.date === selectedDate
  ) ?? []).slice().sort((a, b) =>
    (b.kills * 10 + b.bots * 4 + b.stormDeaths * 2 + b.totalEvents * 0.01) -
    (a.kills * 10 + a.bots * 4 + a.stormDeaths * 2 + a.totalEvents * 0.01)
  );

  const dateNumbers = indexData?.stats.dates ?? [];

  return (
    <aside className="w-[260px] shrink-0 h-full flex flex-col bg-[#08070c] border-r border-[#ffffff0d] overflow-hidden">

      {/* LILA BLACK Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-[#ffffff0a]">
        <div className="flex items-center gap-3 mb-4">
          {/* Logo mark */}
          <div className="relative w-9 h-9 shrink-0">
            <div
              className="absolute inset-0 bg-gradient-to-br from-[#ff8a00] to-[#ff5500]"
              style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 3L9 15L15 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 9H12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div>
            <div
              className="leading-none tracking-[0.15em] uppercase"
              style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}
            >
              LILA <span style={{ color: '#ff8a00' }}>BLACK</span>
            </div>
            <div
              className="mt-1 font-mono uppercase tracking-[0.22em]"
              style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}
            >
              Journey Analytics
            </div>
          </div>
        </div>

        {/* Global stats */}
        {indexData && (
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Matches', value: indexData.stats.totalMatches.toLocaleString() },
              { label: 'Players', value: indexData.stats.totalPlayers.toLocaleString() },
              { label: 'Events', value: (indexData.stats.totalEvents / 1000).toFixed(0) + 'K' },
            ].map((s) => (
              <div
                key={s.label}
                className="px-2 py-2 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div
                  style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#ff8a00', lineHeight: 1 }}
                >
                  {s.value}
                </div>
                <div className="font-mono uppercase tracking-wider mt-1" style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-5 px-4">

        {/* Map selector */}
        <section>
          <SectionLabel icon={<MapPin className="w-3 h-3" />} label="Map" />
          <div className="space-y-1 mt-2">
            {MAPS.map((map) => {
              const active = selectedMap === map;
              return (
                <button
                  key={map}
                  onClick={() => setSelectedMap(map)}
                  className="w-full text-left px-3 py-2.5 text-[12px] font-medium tracking-wide transition-all flex items-center justify-between"
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: active ? 700 : 500,
                    background: active ? 'rgba(255,138,0,0.1)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(255,138,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                    letterSpacing: '0.06em',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 shrink-0 transition-all"
                      style={{
                        backgroundColor: active ? '#ff8a00' : 'rgba(255,255,255,0.2)',
                        boxShadow: active ? '0 0 6px #ff8a00' : 'none',
                      }}
                    />
                    {MAP_LABELS[map]}
                  </div>
                  {active && (
                    <span className="font-mono uppercase tracking-widest" style={{ fontSize: 8, color: 'rgba(255,138,0,0.8)' }}>
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Date filter */}
        <section>
          <SectionLabel icon={<Calendar className="w-3 h-3" />} label="Date · Feb 2026" />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {dateNumbers.map((date) => {
              const day = date.replace('February_', '');
              const active = selectedDate === date;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className="w-10 h-10 text-[12px] font-semibold transition-all"
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 700,
                    background: active ? 'rgba(255,138,0,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(255,138,0,0.5)' : 'rgba(255,255,255,0.09)'}`,
                    color: active ? '#ff8a00' : 'rgba(255,255,255,0.45)',
                    boxShadow: active ? '0 0 12px rgba(255,138,0,0.12)' : 'none',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </section>

        {/* Match select */}
        <section>
          <SectionLabel icon={<Activity className="w-3 h-3" />} label={`Match  ·  ${filteredMatches.length} found`} />
          <div className="mt-2">
            <select
              value={selectedMatchId ?? ''}
              onChange={(e) => setSelectedMatchId(e.target.value || null)}
              className="w-full text-[11px] px-3 py-2.5 focus:outline-none appearance-none cursor-pointer font-mono"
              style={{
                background: '#0d0c12',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.75)',
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
                    {m.id.slice(0, 8)}… — {tags}
                  </option>
                );
              })}
            </select>
          </div>
        </section>

        <Divider />

        {/* Layer toggles */}
        <section>
          <SectionLabel icon={<Layers className="w-3 h-3" />} label="Layers" />
          <div className="space-y-1 mt-2">
            {[
              { key: 'paths' as const, label: 'Player Paths', icon: <Activity className="w-3 h-3" />, color: '#60a5fa' },
              { key: 'kills' as const, label: 'Kill Events', icon: <Target className="w-3 h-3" />, color: '#ef4444' },
              { key: 'deaths' as const, label: 'Death Events', icon: <Skull className="w-3 h-3" />, color: '#f97316' },
              { key: 'loot' as const, label: 'Loot Events', icon: <ShoppingBag className="w-3 h-3" />, color: '#22c55e' },
              { key: 'storm' as const, label: 'Storm Deaths', icon: <Zap className="w-3 h-3" />, color: '#a855f7' },
              { key: 'bots' as const, label: 'Show Bots', icon: <Bot className="w-3 h-3" />, color: '#ff8a00' },
            ].map(({ key, label, icon, color }) => {
              const on = layers[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleLayer(key)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium transition-all"
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: on ? 600 : 500,
                    background: on ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: `1px solid ${on ? 'rgba(255,255,255,0.09)' : 'transparent'}`,
                    color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span className="flex items-center gap-2" style={{ color: on ? color : 'rgba(255,255,255,0.2)' }}>
                    {icon}
                    <span style={{ textDecoration: on ? 'none' : 'line-through', color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)' }}>
                      {label}
                    </span>
                  </span>
                  {on
                    ? <Eye className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    : <EyeOff className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.18)' }} />}
                </button>
              );
            })}
          </div>
        </section>

        <Divider />

        {/* Heatmap */}
        <section>
          <SectionLabel icon={<SlidersHorizontal className="w-3 h-3" />} label="Heatmap" />
          <div className="grid grid-cols-2 gap-1 mt-2">
            {[
              { id: 'none', label: 'Off', full: true },
              { id: 'kills', label: 'Kills', color: '#ef4444' },
              { id: 'deaths', label: 'Deaths', color: '#f97316' },
              { id: 'loot', label: 'Loot', color: '#22c55e' },
              { id: 'traffic', label: 'Traffic', color: '#60a5fa' },
            ].map((opt) => {
              const active = heatmapMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setHeatmapMode(opt.id as any)}
                  className={clsx('py-2 px-2 text-[10px] font-medium uppercase transition-all', (opt as any).full && 'col-span-2')}
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    background: active ? 'rgba(255,138,0,0.1)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(255,138,0,0.38)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? (opt as any).color ?? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {heatmapMode !== 'none' && (
            <div className="mt-3">
              <div className="flex justify-between font-mono mb-1.5" style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)' }}>
                <span>Opacity</span>
                <span style={{ color: 'rgba(255,138,0,0.7)' }}>{Math.round(heatmapOpacity * 100)}%</span>
              </div>
              <input
                type="range" min="10" max="100"
                value={Math.round(heatmapOpacity * 100)}
                onChange={(e) => setHeatmapOpacity(Number(e.target.value) / 100)}
                className="w-full h-[3px] appearance-none cursor-pointer"
                style={{
                  accentColor: '#ff8a00',
                  background: `linear-gradient(to right, #ff8a00 ${heatmapOpacity * 100}%, rgba(255,255,255,0.08) ${heatmapOpacity * 100}%)`
                }}
              />
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#ffffff07]">
        <div className="font-mono uppercase tracking-[0.18em]" style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>
          LILA GAMES · Internal Tooling
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono uppercase tracking-[0.18em]" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
      <span style={{ color: 'rgba(255,138,0,0.6)' }}>{icon}</span>
      {label}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />;
}
