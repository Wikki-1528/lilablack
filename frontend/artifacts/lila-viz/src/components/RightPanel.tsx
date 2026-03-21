import React, { useMemo, useState } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { HUMAN_COLORS, formatRelativeTime, getPlayerStatus } from '@/lib/types';
import { Target, Skull, ShoppingBag, Zap, Activity, ChevronRight, Radio } from 'lucide-react';
import clsx from 'clsx';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Extracted: { label: 'Exfil',   color: '#34d399' },
  Killed:    { label: 'Killed',  color: '#f87171' },
  Storm:     { label: 'Storm',   color: '#a78bfa' },
  Active:    { label: 'Active',  color: '#ff8a00' },
  Unknown:   { label: '—',       color: 'rgba(255,255,255,0.25)' },
};

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Kill:          { icon: <Target className="w-3 h-3" />,      color: '#ef4444', label: 'killed a player' },
  Killed:        { icon: <Skull className="w-3 h-3" />,       color: '#f97316', label: 'was killed' },
  BotKill:       { icon: <Target className="w-3 h-3" />,      color: '#ec4899', label: 'killed a bot' },
  BotKilled:     { icon: <Skull className="w-3 h-3" />,       color: '#fb923c', label: 'killed by bot' },
  KilledByStorm: { icon: <Zap className="w-3 h-3" />,        color: '#a855f7', label: 'died to storm' },
  Loot:          { icon: <ShoppingBag className="w-3 h-3" />, color: '#22c55e', label: 'picked up loot' },
};

export function RightPanel() {
  const {
    indexData, matchData, selectedMatchId, currentTime,
    highlightedPlayerId, setHighlightedPlayer,
    playerFilter, setPlayerFilter, setCurrentTime,
  } = useVisualizerStore();

  const [activeTab, setActiveTab] = useState<'players' | 'events'>('players');

  const matchIndex = indexData?.matches.find((m) => m.id === selectedMatchId);

  const humanPlayers = matchData?.players.filter((p) => !p.isBot) ?? [];
  const colorMap = useMemo(
    () => new Map(humanPlayers.map((p, i) => [p.userId, HUMAN_COLORS[i % HUMAN_COLORS.length]])),
    [humanPlayers]
  );

  const visiblePlayers = useMemo(() => {
    if (!matchData) return [];
    return matchData.players.filter((p) => {
      if (playerFilter === 'humans') return !p.isBot;
      if (playerFilter === 'bots') return p.isBot;
      return true;
    });
  }, [matchData, playerFilter]);

  const combatEvents = useMemo(() => {
    if (!matchData) return [];
    const allTs = matchData.players.flatMap((p) => p.events.map((e) => e.ts));
    const matchStart = Math.min(...allTs);
    return matchData.players
      .flatMap((p) =>
        p.events
          .filter((e) => !['Position', 'BotPosition'].includes(e.event) && e.ts <= currentTime)
          .map((e) => ({ ...e, userId: p.userId, isBot: p.isBot, relTs: e.ts - matchStart }))
      )
      .sort((a, b) => b.relTs - a.relTs)
      .slice(0, 60);
  }, [matchData, currentTime]);

  const isTracking = highlightedPlayerId !== null;

  return (
    <aside className="w-[252px] shrink-0 h-full flex flex-col bg-[#08070c] border-l border-[#ffffff0d] overflow-hidden">

      {/* Tracking banner */}
      {isTracking && (
        <div
          className="px-4 py-2 flex items-center gap-2"
          style={{ background: 'rgba(255,138,0,0.08)', borderBottom: '1px solid rgba(255,138,0,0.2)' }}
        >
          <Radio className="w-3 h-3 shrink-0" style={{ color: '#ff8a00' }} />
          <span
            className="uppercase tracking-widest flex-1"
            style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, color: '#ff8a00' }}
          >
            Tracking player
          </span>
          <button
            onClick={() => setHighlightedPlayer(null)}
            className="font-mono uppercase tracking-wider transition-opacity hover:opacity-100 opacity-60"
            style={{ fontSize: 8, color: '#ff8a00' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Match info */}
      <div className="px-4 py-4 border-b border-[#ffffff08]">
        {matchIndex ? (
          <>
            <div className="mb-3">
              <div
                className="leading-none mb-1"
                style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff' }}
              >
                {matchIndex.map.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>
                {matchIndex.date.replace('_', ' ')} · <span style={{ color: 'rgba(255,255,255,0.22)' }}>{matchIndex.id.slice(0, 8)}…</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Humans', value: matchIndex.humans,     color: '#60a5fa' },
                { label: 'Bots',   value: matchIndex.bots,       color: '#ff8a00' },
                { label: 'Kills',  value: matchIndex.kills,      color: '#ef4444' },
                { label: 'Deaths', value: matchIndex.deaths,     color: '#f97316' },
                { label: 'Loot',   value: matchIndex.loots,      color: '#22c55e' },
                { label: 'Storm',  value: matchIndex.stormDeaths, color: '#a855f7' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="px-2 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, lineHeight: 1, color: s.color }}>
                    {s.value}
                  </div>
                  <div className="font-mono uppercase tracking-wider mt-1" style={{ fontSize: 8, color: 'rgba(255,255,255,0.32)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>No match selected</div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#ffffff08]">
        {(['players', 'events'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2.5 uppercase transition-all"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.12em',
              color: activeTab === tab ? '#ff8a00' : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === tab ? '2px solid #ff8a00' : '2px solid transparent',
            }}
          >
            {tab === 'players' ? 'Roster' : 'Events'}
          </button>
        ))}
      </div>

      {activeTab === 'players' ? (
        <>
          {/* Filter row */}
          <div className="flex gap-1 px-3 py-2 border-b border-[#ffffff06]">
            {(['all', 'humans', 'bots'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPlayerFilter(f)}
                className="flex-1 py-1.5 uppercase transition-all"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  background: playerFilter === f ? 'rgba(255,138,0,0.1)' : 'transparent',
                  border: `1px solid ${playerFilter === f ? 'rgba(255,138,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: playerFilter === f ? '#ff8a00' : 'rgba(255,255,255,0.35)',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Player roster — scoreboard style */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {!matchData ? (
              <EmptyState label="Select a match to view roster" />
            ) : (
              visiblePlayers.map((player, idx) => {
                const status = getPlayerStatus(player);
                const statusCfg = STATUS_CONFIG[status];
                const kills = player.events.filter((e) => e.event === 'Kill' || e.event === 'BotKill').length;
                const deaths = player.events.filter((e) =>
                  ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.event)
                ).length;
                const loot = player.events.filter((e) => e.event === 'Loot').length;
                const color = player.isBot ? '#ff8a00' : (colorMap.get(player.userId) ?? '#60a5fa');
                const isSelected = highlightedPlayerId === player.userId;
                const isDimmed = highlightedPlayerId !== null && !isSelected;

                return (
                  <button
                    key={player.userId}
                    onClick={() =>
                      setHighlightedPlayer(highlightedPlayerId === player.userId ? null : player.userId)
                    }
                    className="w-full text-left transition-all"
                    style={{
                      background: isSelected
                        ? `${color}12`
                        : isDimmed ? 'transparent' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? `${color}35` : 'rgba(255,255,255,0.06)'}`,
                      opacity: isDimmed ? 0.35 : 1,
                      padding: '6px 10px',
                    }}
                  >
                    {/* Row 1: color dot + name + status */}
                    <div className="flex items-center gap-2">
                      {/* Rank number or tracking indicator */}
                      {isSelected ? (
                        <span className="w-4 text-center shrink-0" style={{ color: '#ff8a00' }}>
                          <Radio className="w-3 h-3 inline" />
                        </span>
                      ) : (
                        <span
                          className="w-4 text-center shrink-0 font-mono"
                          style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}
                        >
                          {idx + 1}
                        </span>
                      )}

                      <span
                        className="w-2 h-2 shrink-0"
                        style={{ backgroundColor: color, boxShadow: isSelected ? `0 0 8px ${color}` : `0 0 4px ${color}55` }}
                      />

                      <span
                        className="flex-1 truncate font-mono"
                        style={{ fontSize: 10, color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)' }}
                      >
                        {player.isBot ? `Bot_${player.userId.slice(0, 6)}` : player.userId.slice(0, 8)}
                      </span>

                      <span
                        className="uppercase font-mono shrink-0"
                        style={{ fontSize: 8, fontWeight: 700, color: statusCfg.color, letterSpacing: '0.05em' }}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Row 2: K/D/L stats */}
                    <div className="flex gap-3 mt-1.5" style={{ paddingLeft: 24 }}>
                      <StatPill label="K" value={kills} color="#f87171" />
                      <StatPill label="D" value={deaths} color="#fb923c" />
                      <StatPill label="L" value={loot} color="#34d399" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* Event feed */
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {combatEvents.length === 0 ? (
            <EmptyState label={matchData ? 'No events yet — use timeline' : 'Select a match'} />
          ) : (
            combatEvents.map((e, i) => {
              const cfg = EVENT_CONFIG[e.event] ?? { icon: <Activity className="w-3 h-3" />, color: '#888', label: e.event };
              return (
                <button
                  key={i}
                  className="w-full text-left flex items-start gap-2 px-2 py-2 transition-all group"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(el) => (el.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(el) => (el.currentTarget.style.background = 'transparent')}
                  onClick={() => setCurrentTime(e.ts)}
                >
                  <span className="shrink-0 mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono truncate" style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>{e.userId.slice(0, 8)}</span>
                      {' '}{cfg.label}
                    </div>
                    <div className="font-mono mt-0.5" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>
                      +{formatRelativeTime(e.relTs)} · {e.x.toFixed(0)}, {e.z.toFixed(0)}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 opacity-20 group-hover:opacity-60 transition-opacity" style={{ color: '#ff8a00' }} />
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-3 border-t border-[#ffffff06]" style={{ background: '#0d0c12' }}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.32)' }}>
          <LegendItem color="#60a5fa" dash={false} label="Human path" />
          <LegendItem color="#ff8a00" dash={true} label="Bot path" />
          <LegendItem symbol="✕" color="#ef4444" label="Kill" />
          <LegendItem symbol="☠" color="#f97316" label="Killed" />
          <LegendItem symbol="◆" color="#22c55e" label="Loot" />
          <LegendItem symbol="⚡" color="#a855f7" label="Storm" />
        </div>
      </div>
    </aside>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-1">
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color, lineHeight: 1 }}>
        {value}
      </span>
      <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>{label}</span>
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <Activity className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.1)' }} />
      <span className="text-center font-medium" style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{label}</span>
    </div>
  );
}

function LegendItem({ color, dash, symbol, label }: { color: string; dash?: boolean; symbol?: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {symbol ? (
        <span style={{ color }}>{symbol}</span>
      ) : (
        <span
          className="w-4 h-px inline-block"
          style={{
            backgroundImage: dash ? `repeating-linear-gradient(90deg, ${color} 0, ${color} 3px, transparent 3px, transparent 5px)` : undefined,
            backgroundColor: dash ? 'transparent' : color,
          }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
