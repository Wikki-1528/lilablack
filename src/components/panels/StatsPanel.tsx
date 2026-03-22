import React, { useMemo } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { MAP_CONFIGS } from '@/lib/types';
import type { MatchData } from '@/lib/types';

const GRID_SIZE = 15;

function calcMapCoverage(matchData: MatchData, mapId: string): number {
  const cfg = MAP_CONFIGS[mapId];
  if (!cfg) return 0;
  const visited = new Set<number>();
  for (const p of matchData.players) {
    if (p.isBot) continue;
    for (const e of p.events) {
      if (e.event !== 'Position') continue;
      const u = (e.x - cfg.originX) / cfg.scale;
      const v = (e.z - cfg.originZ) / cfg.scale;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const col = Math.floor(u * GRID_SIZE);
      const row = Math.floor((1 - v) * GRID_SIZE);
      visited.add(row * GRID_SIZE + col);
    }
  }
  return Math.round((visited.size / (GRID_SIZE * GRID_SIZE)) * 100);
}

export function StatsPanel() {
  const { matchData, indexData, selectedMatchId, selectedMap, minTime, maxTime } = useVisualizerStore();
  const matchIndex = indexData?.matches.find((m) => m.id === selectedMatchId);
  const duration = maxTime - minTime;
  const durationFmt = duration <= 0 ? '—'
    : duration < 60000 ? `${(duration / 1000).toFixed(1)}s`
    : `${Math.floor(duration / 60000)}:${String(Math.floor((duration % 60000) / 1000)).padStart(2, '0')}`;

  const coverage = useMemo(() => {
    if (!matchData) return 0;
    return calcMapCoverage(matchData, selectedMap);
  }, [matchData, selectedMap]);

  const mapStats = useMemo(() => {
    if (!indexData) return null;
    const mapMatches = indexData.matches.filter((m) => m.map === selectedMap);
    const total = mapMatches.length;
    if (total === 0) return null;
    const avgKills = (mapMatches.reduce((s, m) => s + m.kills + (m.botKills ?? 0), 0) / total).toFixed(1);
    const avgLoot = (mapMatches.reduce((s, m) => s + m.loots, 0) / total).toFixed(0);
    const withBots = mapMatches.filter((m) => (m.botKills ?? 0) > 0).length;
    return { total, avgKills, avgLoot, withBots };
  }, [indexData, selectedMap]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Match summary */}
      {matchIndex ? (
        <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="font-mono uppercase tracking-widest mb-3" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>
            This Match
          </div>
          {(() => {
            const inferredBots = Math.max(matchIndex.bots, matchIndex.botKills ?? 0);
            const botsInferred = inferredBots > matchIndex.bots;
            return (
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'Humans',    value: matchIndex.humans,   color: '#60a5fa', sub: null },
              { label: 'Bots',      value: botsInferred ? `~${inferredBots}` : inferredBots, color: '#ff8a00', sub: botsInferred ? `${matchIndex.bots} tracked` : null },
              { label: 'Bot Kills', value: matchIndex.botKills ?? 0, color: '#f97316', sub: null },
              { label: 'Kills',     value: matchIndex.kills,    color: '#ef4444', sub: null },
              { label: 'Loot',      value: matchIndex.loots,    color: '#22c55e', sub: null },
              { label: 'Storm',     value: matchIndex.stormDeaths, color: '#a855f7', sub: null },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center py-2 px-1"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 18, color: s.color, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div className="font-mono uppercase tracking-wider mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
                  {s.label}
                </div>
                {s.sub && (
                  <div className="font-mono mt-0.5" style={{ fontSize: 6, color: 'rgba(255,255,255,0.2)' }}>
                    {s.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
            );
          })()}
          </div>

          {/* Duration + coverage row */}
          <div className="flex gap-1 mt-1">
            <div className="flex-1 text-center py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 18, color: '#fbbf24', lineHeight: 1 }}>
                {durationFmt}
              </div>
              <div className="font-mono uppercase tracking-wider mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Duration</div>
            </div>
            <div className="flex-1 text-center py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 18, color: '#818cf8', lineHeight: 1 }}>
                {coverage}%
              </div>
              <div className="font-mono uppercase tracking-wider mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Map Coverage</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <span className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Select a match</span>
        </div>
      )}

      {/* Map averages */}
      {mapStats && (
        <div className="px-3 py-3">
          <div className="font-mono uppercase tracking-widest mb-3" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>
            Map · {selectedMap.replace(/([A-Z])/g, ' $1').trim()}
          </div>
          <div className="space-y-1.5">
            <StatRow label="Total matches"       value={mapStats.total}    color="#60a5fa" />
            <StatRow label="Avg kills / match"   value={mapStats.avgKills} color="#ef4444" />
            <StatRow label="Avg loot / match"    value={mapStats.avgLoot}  color="#22c55e" />
            <StatRow
              label="Matches with bots"
              value={`${mapStats.withBots} (${Math.round(mapStats.withBots / mapStats.total * 100)}%)`}
              color="#ff8a00"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color }}>{value}</span>
    </div>
  );
}
