import React, { useMemo, useState } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { HUMAN_COLORS, formatRelativeTime, getPlayerStatus } from '@/lib/types';
import { Radio, Activity, ChevronRight, Target, Skull, ShoppingBag, Zap } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Extracted: { label: 'Exfil',  color: '#34d399' },
  Killed:    { label: 'Killed', color: '#f87171' },
  Storm:     { label: 'Storm',  color: '#a78bfa' },
  Active:    { label: 'Active', color: '#ff8a00' },
  Unknown:   { label: '—',      color: 'rgba(255,255,255,0.25)' },
};

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Kill:          { icon: <Target className="w-3 h-3" />,      color: '#ef4444', label: 'killed a player' },
  Killed:        { icon: <Skull className="w-3 h-3" />,       color: '#f97316', label: 'was killed' },
  BotKill:       { icon: <Target className="w-3 h-3" />,      color: '#ec4899', label: 'killed a bot' },
  BotKilled:     { icon: <Skull className="w-3 h-3" />,       color: '#fb923c', label: 'killed by bot' },
  KilledByStorm: { icon: <Zap className="w-3 h-3" />,        color: '#a855f7', label: 'died to storm' },
  Loot:          { icon: <ShoppingBag className="w-3 h-3" />, color: '#22c55e', label: 'picked up loot' },
};

export function RosterPanel() {
  const {
    matchData, currentTime, indexData, selectedMatchId,
    highlightedPlayerId, setHighlightedPlayer,
    playerFilter, setPlayerFilter, setCurrentTime,
  } = useVisualizerStore();

  const [tab, setTab] = useState<'roster' | 'events'>('roster');

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
          .map((e) => ({ ...e, userId: p.userId, relTs: e.ts - matchStart }))
      )
      .sort((a, b) => b.relTs - a.relTs)
      .slice(0, 50);
  }, [matchData, currentTime]);

  const isTracking = highlightedPlayerId !== null;

  return (
    <div className="flex flex-col h-full" style={{ background: '#08070c' }}>

      {/* Tracking banner */}
      {isTracking && (
        <div className="px-3 py-1.5 flex items-center gap-2 shrink-0" style={{ background: 'rgba(255,138,0,0.08)', borderBottom: '1px solid rgba(255,138,0,0.2)' }}>
          <Radio className="w-3 h-3 shrink-0" style={{ color: '#ff8a00' }} />
          <span className="flex-1 uppercase tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, color: '#ff8a00' }}>Tracking</span>
          <button onClick={() => setHighlightedPlayer(null)} className="uppercase font-mono opacity-70 hover:opacity-100" style={{ fontSize: 8, color: '#ff8a00' }}>Clear</button>
        </div>
      )}

      {/* Match summary */}
      {matchIndex && (
        <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'Humans',   value: matchIndex.humans,     color: '#60a5fa' },
              { label: 'Bot Kills', value: matchIndex.botKills ?? matchIndex.bots, color: '#ff8a00' },
              { label: 'Kills',    value: matchIndex.kills,      color: '#ef4444' },
              { label: 'Deaths',   value: matchIndex.deaths,     color: '#f97316' },
              { label: 'Loot',     value: matchIndex.loots,      color: '#22c55e' },
              { label: 'Storm',    value: matchIndex.stormDeaths, color: '#a855f7' },
            ].map((s) => (
              <div key={s.label} className="text-center px-1 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div className="font-mono uppercase tracking-wider mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {(['roster', 'events'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-2 uppercase transition-all"
            style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.12em', color: tab === t ? '#ff8a00' : 'rgba(255,255,255,0.35)', borderBottom: `2px solid ${tab === t ? '#ff8a00' : 'transparent'}` }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'roster' ? (
        <>
          {/* Filter */}
          <div className="flex gap-1 px-2 py-1.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {(['all', 'humans', 'bots'] as const).map((f) => (
              <button key={f} onClick={() => setPlayerFilter(f)} className="flex-1 py-1 uppercase transition-all"
                style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.1em', background: playerFilter === f ? 'rgba(255,138,0,0.1)' : 'transparent', border: `1px solid ${playerFilter === f ? 'rgba(255,138,0,0.3)' : 'rgba(255,255,255,0.07)'}`, color: playerFilter === f ? '#ff8a00' : 'rgba(255,255,255,0.35)' }}>
                {f}
              </button>
            ))}
          </div>

          {/* Player list */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {!matchData ? (
              <EmptyState label="Select a match" />
            ) : (
              visiblePlayers.map((player, idx) => {
                const status = getPlayerStatus(player);
                const statusCfg = STATUS_CONFIG[status];
                const kills = player.events.filter((e) => e.event === 'Kill' || e.event === 'BotKill').length;
                const deaths = player.events.filter((e) => ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.event)).length;
                const loot = player.events.filter((e) => e.event === 'Loot').length;
                const color = player.isBot ? '#ff8a00' : (colorMap.get(player.userId) ?? '#60a5fa');
                const isSelected = highlightedPlayerId === player.userId;
                const isDimmed = highlightedPlayerId !== null && !isSelected;

                return (
                  <button key={player.userId} onClick={() => setHighlightedPlayer(isSelected ? null : player.userId)}
                    className="w-full text-left transition-all"
                    style={{ background: isSelected ? `${color}12` : isDimmed ? 'transparent' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelected ? `${color}35` : 'rgba(255,255,255,0.05)'}`, opacity: isDimmed ? 0.3 : 1, padding: '5px 8px' }}>
                    <div className="flex items-center gap-1.5">
                      {isSelected
                        ? <Radio className="w-3 h-3 shrink-0" style={{ color: '#ff8a00' }} />
                        : <span className="font-mono w-4 text-center shrink-0" style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{idx + 1}</span>}
                      <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: color, boxShadow: isSelected ? `0 0 8px ${color}` : `0 0 4px ${color}55` }} />
                      <span className="flex-1 truncate font-mono" style={{ fontSize: 10, color: isSelected ? '#fff' : 'rgba(255,255,255,0.65)' }}>
                        {player.isBot ? `Bot_${player.userId.slice(0, 6)}` : player.userId.slice(0, 8)}
                      </span>
                      <span className="font-mono uppercase shrink-0" style={{ fontSize: 7, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
                    </div>
                    <div className="flex gap-2.5 mt-1" style={{ paddingLeft: 18 }}>
                      <Stat label="K" value={kills} color="#f87171" />
                      <Stat label="D" value={deaths} color="#fb923c" />
                      <Stat label="L" value={loot} color="#34d399" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {combatEvents.length === 0
            ? <EmptyState label={matchData ? 'No events yet' : 'Select a match'} />
            : combatEvents.map((e, i) => {
                const cfg = EVENT_CONFIG[e.event] ?? { icon: <Activity className="w-3 h-3" />, color: '#888', label: e.event };
                return (
                  <button key={i} onClick={() => setCurrentTime(e.ts)}
                    className="w-full text-left flex items-start gap-1.5 px-2 py-1.5 transition-all"
                    style={{ background: 'transparent' }}
                    onMouseEnter={(el) => (el.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(el) => (el.currentTarget.style.background = 'transparent')}>
                    <span className="shrink-0 mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono truncate" style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>{e.userId.slice(0, 8)}</span> {cfg.label}
                      </div>
                      <div className="font-mono mt-0.5" style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>+{formatRelativeTime(e.relTs)}</div>
                    </div>
                    <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 opacity-20" style={{ color: '#ff8a00' }} />
                  </button>
                );
              })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-0.5">
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color, lineHeight: 1 }}>{value}</span>
      <span className="font-mono" style={{ fontSize: 7, color: 'rgba(255,255,255,0.28)' }}>{label}</span>
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <Activity className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.1)' }} />
      <span className="font-medium text-center" style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{label}</span>
    </div>
  );
}
