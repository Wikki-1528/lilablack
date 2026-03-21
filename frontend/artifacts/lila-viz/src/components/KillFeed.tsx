import React, { useEffect, useRef, useState } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { Target, Skull, Zap } from 'lucide-react';

interface FeedItem {
  id: number;
  event: string;
  userId: string;
  ts: number;
  born: number; // real timestamp when added
}

const EVENT_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Kill:          { icon: <Target className="w-3 h-3" />,  color: '#ef4444', label: 'eliminated' },
  BotKill:       { icon: <Target className="w-3 h-3" />,  color: '#ec4899', label: 'bot eliminated' },
  Killed:        { icon: <Skull className="w-3 h-3" />,   color: '#f97316', label: 'killed' },
  BotKilled:     { icon: <Skull className="w-3 h-3" />,   color: '#fb923c', label: 'killed by bot' },
  KilledByStorm: { icon: <Zap className="w-3 h-3" />,    color: '#a855f7', label: 'storm' },
};

let ID = 0;
const FADE_MS = 3500;

export function KillFeed() {
  const { matchData, currentTime } = useVisualizerStore();
  const [items, setItems] = useState<FeedItem[]>([]);
  const prevTime = useRef<number>(0);

  useEffect(() => {
    if (!matchData) { setItems([]); return; }

    // Going forward: find events that crossed into visibility
    if (currentTime > prevTime.current) {
      const newEvents: FeedItem[] = [];
      matchData.players.forEach((p) => {
        p.events.forEach((e) => {
          if (EVENT_META[e.event] && e.ts > prevTime.current && e.ts <= currentTime) {
            newEvents.push({ id: ++ID, event: e.event, userId: p.userId, ts: e.ts, born: Date.now() });
          }
        });
      });
      if (newEvents.length > 0) {
        setItems((prev) => [...prev, ...newEvents].slice(-8));
      }
    } else {
      // Scrubbed back — clear feed
      setItems([]);
    }
    prevTime.current = currentTime;
  }, [currentTime, matchData]);

  // Prune old items
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setItems((prev) => prev.filter((item) => now - item.born < FADE_MS));
    }, 500);
    return () => clearInterval(id);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="absolute flex flex-col gap-1 pointer-events-none"
      style={{ top: 56, right: 8, zIndex: 25, minWidth: 200 }}
    >
      {items.map((item) => {
        const meta = EVENT_META[item.event];
        if (!meta) return null;
        const age = Date.now() - item.born;
        const opacity = age > FADE_MS - 600 ? Math.max(0, (FADE_MS - age) / 600) : 1;
        return (
          <div
            key={item.id}
            className="flex items-center gap-2 px-2.5 py-1.5"
            style={{
              background: 'rgba(0,0,0,0.72)',
              border: `1px solid ${meta.color}30`,
              opacity,
              transition: 'opacity 0.3s',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span style={{ color: meta.color }}>{meta.icon}</span>
            <span className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
              {item.userId.slice(0, 8)}
            </span>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10, color: meta.color, letterSpacing: '0.06em' }}>
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
