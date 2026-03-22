import React, { useMemo, useState } from 'react';
import { Radio, Bot } from 'lucide-react';
import { useVisualizerStore } from '@/lib/store';
import { HUMAN_COLORS, getPlayerStatus } from '@/lib/types';
import type { Player } from '@/lib/types';

type SortKey = 'kills' | 'deaths' | 'loot' | 'distance' | 'survival';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  Extracted: { label: 'Exfil',  color: '#34d399', icon: '✓' },
  Killed:    { label: 'Killed', color: '#f87171', icon: '☠' },
  Storm:     { label: 'Storm',  color: '#a78bfa', icon: '⚡' },
  Active:    { label: 'Active', color: '#ff8a00', icon: '·' },
  Unknown:   { label: '—',      color: 'rgba(255,255,255,0.25)', icon: '?' },
};

const SORT_LABELS: Record<SortKey, string> = {
  kills: 'K', deaths: 'D', loot: 'L', distance: 'Dist', survival: 'Surv',
};

type EnrichedPlayer = Player & {
  kills: number;
  deaths: number;
  loot: number;
  distance: number;
  status: string;
  survival: number;
};

function calcDistance(player: Player): number {
  const pos = player.events.filter((e) => e.event === 'Position' || e.event === 'BotPosition');
  let dist = 0;
  for (let i = 1; i < pos.length; i++) {
    const dx = pos[i].x - pos[i - 1].x;
    const dz = pos[i].z - pos[i - 1].z;
    dist += Math.sqrt(dx * dx + dz * dz);
  }
  return Math.round(dist);
}

function enrichPlayer(p: Player, minTime: number, duration: number): EnrichedPlayer {
  const kills = p.events.filter((e) => e.event === 'Kill' || e.event === 'BotKill').length;
  const deaths = p.events.filter((e) => ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.event)).length;
  const loot = p.events.filter((e) => e.event === 'Loot').length;
  const distance = calcDistance(p);
  const status = getPlayerStatus(p);
  const lastTs = p.events[p.events.length - 1]?.ts ?? minTime;
  const survival = duration > 0 ? Math.min(100, Math.round(((lastTs - minTime) / duration) * 100)) : 0;
  return { ...p, kills, deaths, loot, distance, status, survival };
}

export function PlayersPanel() {
  const { matchData, minTime, maxTime, highlightedPlayerId, setHighlightedPlayer } = useVisualizerStore();
  const [sortKey, setSortKey] = useState<SortKey>('kills');
  const [filter, setFilter] = useState<'all' | 'humans' | 'bots'>('all');

  const humanPlayers = matchData?.players.filter((p) => !p.isBot) ?? [];
  const colorMap = useMemo(
    () => new Map(humanPlayers.map((p, i) => [p.userId, HUMAN_COLORS[i % HUMAN_COLORS.length]])),
    [humanPlayers]
  );

  const duration = maxTime - minTime;

  const { sortedHumans, botSummary, interestingBots } = useMemo(() => {
    if (!matchData) return { sortedHumans: [], botSummary: null, interestingBots: [] };

    const allBots = matchData.players.filter((p) => p.isBot).map((p) => enrichPlayer(p, minTime, duration));
    const allHumans = matchData.players.filter((p) => !p.isBot).map((p) => enrichPlayer(p, minTime, duration));

    // Bot summary
    const killedBots = allBots.filter((b) => ['Killed', 'Storm', 'BotKilled'].includes(b.status)).length;
    const totalDist = allBots.reduce((sum, b) => sum + b.distance, 0);
    const avgDistance = allBots.length > 0 ? Math.round(totalDist / allBots.length) : 0;

    // Interesting bots: participated in combat (had kills or deaths)
    const interesting = allBots
      .filter((b) => b.kills > 0 || b.deaths > 0)
      .sort((a, b) => b.kills - a.kills);

    // Sorted humans
    const sorted = [...allHumans].sort((a, b) => {
      if (sortKey === 'kills')    return b.kills - a.kills;
      if (sortKey === 'deaths')   return b.deaths - a.deaths;
      if (sortKey === 'loot')     return b.loot - a.loot;
      if (sortKey === 'distance') return b.distance - a.distance;
      if (sortKey === 'survival') return b.survival - a.survival;
      return 0;
    });

    return {
      sortedHumans: sorted,
      botSummary: allBots.length > 0 ? {
        total: allBots.length,
        killed: killedBots,
        active: allBots.length - killedBots,
        avgDistance,
        boringCount: allBots.length - interesting.length,
      } : null,
      interestingBots: interesting,
    };
  }, [matchData, minTime, duration, sortKey]);

  if (!matchData) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Select a match</span>
      </div>
    );
  }

  const showBots = filter !== 'humans';
  const showHumans = filter !== 'bots';

  return (
    <div className="flex flex-col h-full">
      {/* Filter */}
      <div className="flex gap-1 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['all', 'humans', 'bots'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-1 py-1 uppercase transition-all"
            style={{
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.1em',
              background: filter === f ? 'rgba(255,138,0,0.1)' : 'transparent',
              border: `1px solid ${filter === f ? 'rgba(255,138,0,0.3)' : 'rgba(255,255,255,0.07)'}`,
              color: filter === f ? '#ff8a00' : 'rgba(255,255,255,0.35)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Sort (humans only) */}
      {showHumans && (
        <div className="px-3 py-1.5 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="font-mono uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>Sort</span>
          <div className="flex gap-1 flex-1">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((sk) => (
              <button
                key={sk}
                onClick={() => setSortKey(sk)}
                className="flex-1 py-0.5 transition-all"
                style={{
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: sortKey === sk ? 'rgba(255,138,0,0.1)' : 'transparent',
                  border: `1px solid ${sortKey === sk ? 'rgba(255,138,0,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  color: sortKey === sk ? '#ff8a00' : 'rgba(255,255,255,0.3)',
                }}
              >
                {SORT_LABELS[sk]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">

        {/* ── Bot section ── */}
        {showBots && botSummary && (
          <>
            {/* Bot summary card */}
            <div
              style={{
                background: 'rgba(255,138,0,0.06)',
                border: '1px solid rgba(255,138,0,0.2)',
                padding: '8px 10px',
                marginBottom: 4,
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Bot className="w-3 h-3 shrink-0" style={{ color: '#ff8a00' }} />
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, color: '#ff8a00' }}>
                  {botSummary.total} Bots
                </span>
              </div>
              <div className="flex gap-3">
                <BotStat value={botSummary.killed} label="killed" color="#f87171" />
                <BotStat value={botSummary.active} label="active" color="#34d399" />
                <BotStat value={`${botSummary.avgDistance}m`} label="avg dist" color="#60a5fa" />
              </div>
              {botSummary.boringCount > 0 && (
                <div className="font-mono mt-2" style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>
                  {botSummary.boringCount} bots had no combat activity
                </div>
              )}
            </div>

            {/* Interesting bots individually */}
            {interestingBots.length > 0 && (
              <div className="font-mono uppercase mb-0.5" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,138,0,0.4)', paddingLeft: 2 }}>
                Notable Bots
              </div>
            )}
            {interestingBots.map((bot) => {
              const statusCfg = STATUS_CONFIG[bot.status];
              const isSelected = highlightedPlayerId === bot.userId;
              const isDimmed = highlightedPlayerId !== null && !isSelected;
              return (
                <PlayerCard
                  key={bot.userId}
                  player={bot}
                  color="#ff8a00"
                  statusCfg={statusCfg}
                  isSelected={isSelected}
                  isDimmed={isDimmed}
                  onClick={() => setHighlightedPlayer(isSelected ? null : bot.userId)}
                />
              );
            })}

            {/* Divider before humans */}
            {showHumans && sortedHumans.length > 0 && (
              <div className="font-mono uppercase mt-2 mb-0.5" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'rgba(96,165,250,0.4)', paddingLeft: 2 }}>
                Human Players
              </div>
            )}
          </>
        )}

        {/* ── Human section ── */}
        {showHumans && sortedHumans.map((player) => {
          const color = colorMap.get(player.userId) ?? '#60a5fa';
          const statusCfg = STATUS_CONFIG[player.status];
          const isSelected = highlightedPlayerId === player.userId;
          const isDimmed = highlightedPlayerId !== null && !isSelected;
          return (
            <PlayerCard
              key={player.userId}
              player={player}
              color={color}
              statusCfg={statusCfg}
              isSelected={isSelected}
              isDimmed={isDimmed}
              onClick={() => setHighlightedPlayer(isSelected ? null : player.userId)}
            />
          );
        })}

        {sortedHumans.length === 0 && !botSummary && (
          <div className="flex flex-col items-center justify-center py-10 gap-1">
            <span className="font-mono text-center" style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
              No players in this match
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({
  player, color, statusCfg, isSelected, isDimmed, onClick,
}: {
  player: EnrichedPlayer;
  color: string;
  statusCfg: { label: string; color: string; icon: string };
  isSelected: boolean;
  isDimmed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-all"
      style={{
        background: isSelected ? `${color}12` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isSelected ? `${color}35` : 'rgba(255,255,255,0.05)'}`,
        opacity: isDimmed ? 0.3 : 1,
        padding: '7px 10px',
      }}
    >
      {/* Row 1: dot + name + status */}
      <div className="flex items-center gap-2">
        {isSelected
          ? <Radio className="w-3 h-3 shrink-0" style={{ color: '#ff8a00' }} />
          : <span className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}66` }} />
        }
        <span className="flex-1 truncate font-mono" style={{ fontSize: 10, color: isSelected ? '#fff' : 'rgba(255,255,255,0.65)' }}>
          {player.isBot ? `Bot_${player.userId.slice(0, 6)}` : player.userId.slice(0, 8)}
        </span>
        <span className="font-mono uppercase shrink-0" style={{ fontSize: 7, fontWeight: 700, color: statusCfg.color }}>
          {statusCfg.icon} {statusCfg.label}
        </span>
      </div>

      {/* Row 2: K/D/L + distance */}
      <div className="flex items-center gap-4 mt-2" style={{ paddingLeft: 16 }}>
        <MiniStat label="K" value={player.kills}    color="#f87171" />
        <MiniStat label="D" value={player.deaths}   color="#fb923c" />
        <MiniStat label="L" value={player.loot}     color="#34d399" />
        <MiniStat label="m" value={player.distance} color="#60a5fa" />
      </div>

      {/* Row 3: survival bar */}
      <div className="mt-2" style={{ paddingLeft: 16 }}>
        <div className="relative h-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="absolute left-0 top-0 h-full"
            style={{ width: `${player.survival}%`, background: statusCfg.color, opacity: 0.7 }}
          />
        </div>
        <div className="font-mono mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)' }}>
          {player.survival}% match survived
        </div>
      </div>
    </button>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <span className="flex items-center gap-0.5">
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color, lineHeight: 1 }}>{value}</span>
      <span className="font-mono" style={{ fontSize: 7, color: 'rgba(255,255,255,0.28)' }}>{label}</span>
    </span>
  );
}

function BotStat({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <span className="flex items-center gap-1">
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, color, lineHeight: 1 }}>{value}</span>
      <span className="font-mono" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{label}</span>
    </span>
  );
}
