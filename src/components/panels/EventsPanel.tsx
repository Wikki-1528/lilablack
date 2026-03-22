import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Target, Skull, ShoppingBag, Zap, Activity, ChevronRight } from 'lucide-react';
import { useVisualizerStore } from '@/lib/store';
import { formatRelativeTime } from '@/lib/types';

type EventFilter = 'all' | 'kills' | 'deaths' | 'loot' | 'storm';

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string; filterKey: EventFilter }> = {
  Kill:          { icon: <Target className="w-3 h-3" />,      color: '#ef4444', label: 'killed a player', filterKey: 'kills' },
  BotKill:       { icon: <Target className="w-3 h-3" />,      color: '#ec4899', label: 'killed a bot',    filterKey: 'kills' },
  Killed:        { icon: <Skull className="w-3 h-3" />,       color: '#f97316', label: 'was killed',      filterKey: 'deaths' },
  BotKilled:     { icon: <Skull className="w-3 h-3" />,       color: '#fb923c', label: 'killed by bot',   filterKey: 'deaths' },
  KilledByStorm: { icon: <Zap className="w-3 h-3" />,         color: '#a855f7', label: 'died to storm',   filterKey: 'storm' },
  Loot:          { icon: <ShoppingBag className="w-3 h-3" />, color: '#22c55e', label: 'looted',          filterKey: 'loot' },
};

export function EventsPanel() {
  const { matchData, currentTime, setCurrentTime } = useVisualizerStore();
  const [filter, setFilter] = useState<EventFilter>('all');
  const listRef = useRef<HTMLDivElement>(null);
  const prevPastCountRef = useRef(0);

  const allTs = useMemo(() => {
    if (!matchData) return [];
    return matchData.players.flatMap((p) => p.events.map((e) => e.ts));
  }, [matchData]);

  const matchStart = allTs.length > 0 ? Math.min(...allTs) : 0;

  const events = useMemo(() => {
    if (!matchData) return [];
    const all = matchData.players
      .flatMap((p) =>
        p.events
          .filter((e) => EVENT_CONFIG[e.event])
          .map((e) => ({ ...e, userId: p.userId, relTs: e.ts - matchStart }))
      )
      .sort((a, b) => a.ts - b.ts);
    if (filter === 'all') return all;
    return all.filter((e) => EVENT_CONFIG[e.event]?.filterKey === filter);
  }, [matchData, filter, matchStart]);

  const pastCount = events.filter((e) => e.ts <= currentTime).length;

  // Auto-scroll to latest past event
  useEffect(() => {
    if (!listRef.current || pastCount === 0 || pastCount === prevPastCountRef.current) return;
    prevPastCountRef.current = pastCount;
    const items = listRef.current.querySelectorAll('[data-event]');
    const target = items[pastCount - 1];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [pastCount]);

  if (!matchData) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Select a match</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex gap-1 px-2 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['all', 'kills', 'deaths', 'loot', 'storm'] as EventFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-1 py-1 uppercase transition-all"
            style={{
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 8, letterSpacing: '0.08em',
              background: filter === f ? 'rgba(255,138,0,0.1)' : 'transparent',
              border: `1px solid ${filter === f ? 'rgba(255,138,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: filter === f ? '#ff8a00' : 'rgba(255,255,255,0.3)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Event count */}
      <div className="px-4 py-1.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
          {pastCount} / {events.length} events
        </span>
      </div>

      {/* Events list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-1">
        {events.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <span className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
              No {filter === 'all' ? '' : filter + ' '}events in this match
            </span>
          </div>
        )}
        {events.map((e, i) => {
          const cfg = EVENT_CONFIG[e.event] ?? {
            icon: <Activity className="w-3 h-3" />, color: '#888', label: e.event, filterKey: 'all' as EventFilter,
          };
          const isPast = e.ts <= currentTime;
          return (
            <button
              key={i}
              data-event="true"
              onClick={() => setCurrentTime(e.ts)}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 transition-all"
              style={{ opacity: isPast ? 1 : 0.3, background: 'transparent' }}
              onMouseEnter={(el) => (el.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={(el) => (el.currentTarget.style.background = 'transparent')}
            >
              <span className="shrink-0" style={{ color: cfg.color }}>{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-mono truncate" style={{ fontSize: 9, color: isPast ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)' }}>
                  <span style={{ color: isPast ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)' }}>
                    {e.userId.slice(0, 8)}
                  </span>{' '}
                  {cfg.label}
                </div>
              </div>
              <span className="font-mono shrink-0" style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                +{formatRelativeTime(e.relTs)}
              </span>
              <ChevronRight className="w-3 h-3 shrink-0 opacity-20" style={{ color: '#ff8a00' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
