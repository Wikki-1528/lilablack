import React, { useEffect, useRef, useMemo } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { formatRelativeTime } from '@/lib/types';
import { TIME_COMPRESSION, PLAYBACK_SPEEDS } from '@/lib/constants';
import { Play, Pause, SkipBack, Users } from 'lucide-react';

const EVENT_DOT: Record<string, { color: string; r: number }> = {
  Kill:          { color: '#ef4444', r: 4 },
  BotKill:       { color: '#ec4899', r: 3 },
  Killed:        { color: '#f97316', r: 4 },
  BotKilled:     { color: '#f97316', r: 3 },
  KilledByStorm: { color: '#a855f7', r: 4 },
  Loot:          { color: '#22c55e', r: 3 },
};

export function Timeline() {
  const {
    matchData, currentTime, minTime, maxTime,
    isPlaying, playbackSpeed,
    setCurrentTime, setIsPlaying, setPlaybackSpeed,
  } = useVisualizerStore();

  const rafRef = useRef<number>(0);
  const lastRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = undefined;
      return;
    }
    const duration = maxTime - minTime;
    if (duration <= 0) return;

    const msPerRealMs = playbackSpeed * TIME_COMPRESSION;

    const tick = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const delta = ts - lastRef.current;
      lastRef.current = ts;
      setCurrentTime((prev) => {
        const next = prev + delta * msPerRealMs;
        if (next >= maxTime) { setIsPlaying(false); return maxTime; }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, playbackSpeed, maxTime, minTime, setCurrentTime, setIsPlaying]);

  const eventDots = useMemo(() => {
    if (!matchData) return [];
    return matchData.players.flatMap((p) =>
      p.events
        .filter((e) => EVENT_DOT[e.event])
        .map((e) => ({ ...e, userId: p.userId }))
    );
  }, [matchData]);

  const duration = Math.max(0, maxTime - minTime);
  const relTime = Math.max(0, currentTime - minTime);
  const progress = duration > 0 ? relTime / duration : 0;

  const aliveCount = useMemo(() => {
    if (!matchData) return { alive: 0, total: 0 };
    const humans = matchData.players.filter((p) => !p.isBot);
    const alive = humans.filter((p) =>
      !p.events.some((e) => ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.event) && e.ts <= currentTime)
    );
    return { alive: alive.length, total: humans.length };
  }, [matchData, currentTime]);

  if (!matchData) {
    return (
      <div
        className="h-[72px] flex items-center justify-center border-t"
        style={{ background: '#08070c', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <span
          className="font-mono uppercase tracking-[0.2em]"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}
        >
          Select a match to enable timeline
        </span>
      </div>
    );
  }

  return (
    <div
      className="h-[72px] px-5 flex flex-col justify-center gap-2.5 border-t"
      style={{ background: '#08070c', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      {/* Scrubber row */}
      <div className="flex items-center gap-4">
        {/* Current time */}
        <span
          className="font-mono w-12 text-right tabular-nums shrink-0"
          style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, color: '#ff8a00' }}
        >
          {formatRelativeTime(relTime)}
        </span>

        {/* Track */}
        <div className="relative flex-1 h-6 flex items-center">
          {/* Track bg */}
          <div className="absolute w-full h-[2px]" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Filled */}
          <div
            className="absolute h-[2px] transition-none"
            style={{ width: `${progress * 100}%`, background: '#ff8a00', boxShadow: '0 0 6px rgba(255,138,0,0.5)' }}
          />

          {/* Event dots */}
          {eventDots.map((e, i) => {
            const cfg = EVENT_DOT[e.event];
            if (!cfg) return null;
            const pct = duration > 0 ? ((e.ts - minTime) / duration) * 100 : 0;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 cursor-pointer hover:scale-[2] transition-transform"
                style={{
                  left: `${pct}%`,
                  width: cfg.r * 2,
                  height: cfg.r * 2,
                  backgroundColor: cfg.color,
                  opacity: e.ts <= currentTime ? 1 : 0.22,
                  boxShadow: e.ts <= currentTime ? `0 0 4px ${cfg.color}` : 'none',
                }}
                onClick={() => setCurrentTime(e.ts)}
                title={e.event}
              />
            );
          })}

          {/* Thumb */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 pointer-events-none"
            style={{
              left: `${progress * 100}%`,
              width: 10,
              height: 10,
              backgroundColor: '#ff8a00',
              boxShadow: '0 0 8px rgba(255,138,0,0.8), 0 0 0 2px rgba(255,138,0,0.2)',
            }}
          />

          {/* Invisible range input */}
          <input
            type="range" min={minTime} max={maxTime} value={currentTime}
            onChange={(e) => { setIsPlaying(false); setCurrentTime(Number(e.target.value)); }}
            className="absolute w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Total time */}
        <span
          className="font-mono w-12 tabular-nums shrink-0"
          style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}
        >
          {formatRelativeTime(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">

        {/* Left: playback */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCurrentTime(minTime); setIsPlaying(false); }}
            className="w-8 h-8 flex items-center justify-center transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 px-5 py-2 transition-all"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: '#ff8a00',
              color: '#fff',
              boxShadow: isPlaying
                ? '0 0 24px rgba(255,138,0,0.6), 0 0 48px rgba(255,138,0,0.2)'
                : '0 0 18px rgba(255,138,0,0.45)',
            }}
          >
            {isPlaying
              ? <><Pause className="w-3.5 h-3.5 fill-current" /> Pause</>
              : <><Play className="w-3.5 h-3.5 fill-current" /> Play</>}
          </button>
        </div>

        {/* Center: alive counter */}
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.28)' }} />
          <span
            style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}
          >
            {aliveCount.alive}
          </span>
          <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
            / {aliveCount.total} alive
          </span>
        </div>

        {/* Right: speed */}
        <div
          className="flex items-center gap-0.5 p-0.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className="w-8 h-6 transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: 10,
                background: playbackSpeed === s ? '#ff8a00' : 'transparent',
                color: playbackSpeed === s ? '#fff' : 'rgba(255,255,255,0.38)',
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
