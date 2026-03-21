import React, { useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { MapViewer } from '@/components/MapViewer';
import { Timeline } from '@/components/Timeline';
import { RosterPanel } from '@/components/RosterPanel';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { AIPanel } from '@/components/AIPanel';
import { KillFeed } from '@/components/KillFeed';
import { useVisualizerStore } from '@/lib/store';
import type { IndexData, MatchData, AnalyticsData } from '@/lib/types';

const BASE = import.meta.env.BASE_URL;

export default function Dashboard() {
  const {
    appMode,
    selectedMatchId, selectedMap, selectedDate,
    setIndexData, setMatchData, setTimeBounds, setSelectedMatchId,
    setAnalyticsData, analyticsData,
    indexData,
  } = useVisualizerStore();

  // Load index on mount
  useEffect(() => {
    fetch(BASE + 'data/index.json')
      .then((r) => r.json())
      .then((data: IndexData) => {
        setIndexData(data);
        const richest = data.matches
          .filter((m) => m.map === 'AmbroseValley' && m.date === 'February_10')
          .sort((a, b) => {
            // Human matches always rank above bot-only matches
            const hA = a.humans > 0 ? 1 : 0, hB = b.humans > 0 ? 1 : 0;
            if (hB !== hA) return hB - hA;
            return (b.kills * 10 + b.totalEvents * 0.01) - (a.kills * 10 + a.totalEvents * 0.01);
          })[0];
        if (richest) setSelectedMatchId(richest.id);
      })
      .catch(console.error);
  }, []);

  // Auto-select richest match on map/date change
  useEffect(() => {
    if (!indexData) return;
    const richest = indexData.matches
      .filter((m) => m.map === selectedMap && m.date === selectedDate)
      .sort((a, b) => {
        const hA = a.humans > 0 ? 1 : 0, hB = b.humans > 0 ? 1 : 0;
        if (hB !== hA) return hB - hA;
        return (b.kills * 10 + b.totalEvents * 0.01) - (a.kills * 10 + a.totalEvents * 0.01);
      })[0];
    if (richest) setSelectedMatchId(richest.id);
    else setSelectedMatchId(null);
  }, [selectedMap, selectedDate, indexData]);

  // Load match data (replay mode)
  useEffect(() => {
    if (!selectedMatchId) { setMatchData(null); return; }
    fetch(BASE + 'data/matches/' + selectedMatchId + '.json')
      .then((r) => r.json())
      .then((data: MatchData) => {
        setMatchData(data);
        const allTs = data.players.flatMap((p) => p.events.map((e) => e.ts));
        if (allTs.length > 0) setTimeBounds(Math.min(...allTs), Math.max(...allTs));
      })
      .catch(console.error);
  }, [selectedMatchId]);

  // Pre-load ALL 3 analytics files on startup so map switching is instant
  useEffect(() => {
    const maps = ['AmbroseValley', 'GrandRift', 'Lockdown'];
    maps.forEach((mapId) => {
      if (analyticsData[mapId]) return;
      fetch(BASE + 'data/analytics/' + mapId + '.json')
        .then((r) => r.json())
        .then((data: AnalyticsData) => setAnalyticsData(mapId, data))
        .catch(() => {});
    });
  }, []);

  const ContextPanel = () => {
    if (appMode === 'replay')    return <RosterPanel />;
    if (appMode === 'analytics') return <AnalyticsPanel />;
    if (appMode === 'ai')        return <AIPanel />;
    return null;
  };

  return (
    <div className="w-screen h-screen flex flex-col lila-grid-bg overflow-hidden" style={{ backgroundColor: '#07060b' }}>
      {/* Top navigation bar */}
      <TopBar />

      {/* Main area: map + context panel */}
      <div className="flex flex-1 min-h-0">
        {/* Map — hero element */}
        <div className="flex-1 relative min-w-0">
          <MapViewer />
          {/* Kill feed floats over map in replay mode */}
          {appMode === 'replay' && <KillFeed />}
        </div>

        {/* Context panel — slides in from right */}
        <div
          className="shrink-0 flex flex-col overflow-hidden"
          style={{
            width: 268,
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            transition: 'width 0.2s ease',
          }}
        >
          <ContextPanel />
        </div>
      </div>

      {/* Bottom bar — changes per mode */}
      {appMode === 'replay' && <Timeline />}
      {appMode === 'analytics' && <AnalyticsBottomBar />}
      {appMode === 'ai' && <AIBottomBar />}
    </div>
  );
}

function AnalyticsBottomBar() {
  const { analyticsData, selectedMap, indexData, selectedDate } = useVisualizerStore();
  const data = analyticsData[selectedMap];
  const summary = data?.summary;
  const dateMatches = indexData?.matches.filter((m) => m.map === selectedMap && m.date === selectedDate).length ?? 0;

  return (
    <div
      className="h-14 px-6 flex items-center gap-8 shrink-0"
      style={{ background: '#08070c', borderTop: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,138,0,0.8)' }}>
        Analytics · {selectedMap.replace(/([A-Z])/g, ' $1').trim()}
      </div>
      {summary && (
        <>
          <StatChip label="Matches analyzed" value={data.matchCount} color="#60a5fa" />
          <StatChip label="Dead zone" value={`${summary.deadZonePercent}%`} color="#ef4444" />
          <StatChip label="Avg K/D" value={summary.avgKdRatio.toFixed(2)} color="#fbbf24" />
          <StatChip label="Bot/human overlap" value={`${Math.round(summary.botHumanOverlap * 100)}%`} color="#a855f7" />
          <StatChip label="Total loot" value={summary.totalLoot.toLocaleString()} color="#22c55e" />
        </>
      )}
    </div>
  );
}

function AIBottomBar() {
  const { aiHighlightZones, setAiHighlightZones } = useVisualizerStore();
  return (
    <div
      className="h-14 px-6 flex items-center gap-4 shrink-0"
      style={{ background: '#08070c', borderTop: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,138,0,0.8)' }}>
        AI Insights Mode
      </div>
      <div className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
        Ask questions about player behavior · Highlighted zones appear on map
      </div>
      {aiHighlightZones.length > 0 && (
        <button
          onClick={() => setAiHighlightZones([])}
          className="ml-auto px-3 py-1 uppercase"
          style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, background: 'rgba(255,138,0,0.08)', border: '1px solid rgba(255,138,0,0.25)', color: '#ff8a00', letterSpacing: '0.1em' }}
        >
          Clear highlights
        </button>
      )}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color, lineHeight: 1 }}>{value}</span>
      <span className="font-mono uppercase tracking-wider" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{label}</span>
    </div>
  );
}
