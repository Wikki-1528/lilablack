import React, { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { MapViewer } from '@/components/MapViewer';
import { Timeline } from '@/components/Timeline';
import { RightToolbar } from '@/components/RightToolbar';
import { ContextPanel } from '@/components/ContextPanel';
import { KillFeed } from '@/components/KillFeed';
import { AiModePage } from '@/pages/AiModePage';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useVisualizerStore } from '@/lib/store';
import type { IndexData, MatchData, AnalyticsData, MatchIndex } from '@/lib/types';

const BASE = import.meta.env.BASE_URL;

/**
 * Score a match for auto-selection quality.
 *
 * Priority order (from the dataset README):
 *  1. Has at least one human player file — hard requirement
 *  2. botKills > 0 — confirms bots were actively in the match (bot files are
 *     often absent from the dataset even when bots were present, so botKills
 *     is the true presence indicator per the README)
 *  3. Weighted sum:
 *     humans   × 10  — more human files = richer replay
 *     botKills × 5   — confirmed bot engagements
 *     kills    × 4   — PvP combat density
 *     loots    × 0.5 — general activity
 *     events   × 0.02 — raw data density tie-breaker
 */
function matchScore(m: MatchIndex): number {
  const playerCount = m.humans + m.bots;
  if (playerCount <= 1) return -100;   // disqualify single-player matches
  if (m.humans === 0) return -1;
  return (
    playerCount * 20 +                 // heavily weight total files = richer replay
    m.botKills  *  5 +
    m.kills     *  4 +
    m.loots     *  0.5 +
    m.totalEvents * 0.02
  );
}

export default function Dashboard() {
  const [showLoader, setShowLoader] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  const {
    appMode,
    selectedMatchId, selectedMap, selectedDate,
    setIndexData, setMatchData, setTimeBounds, setSelectedMatchId,
    setAnalyticsData, analyticsData,
    setSelectedDate, setMatchLoading,
    indexData,
  } = useVisualizerStore();

  // Load index on mount — find the globally richest AmbroseValley match
  // across all dates, then set the date pill to match it
  useEffect(() => {
    fetch(BASE + 'data/index.json')
      .then((r) => r.json())
      .then((data: IndexData) => {
        setIndexData(data);
        setDataReady(true);
        const richest = data.matches
          .filter((m) => m.map === 'AmbroseValley')
          .sort((a, b) => matchScore(b) - matchScore(a))[0];
        if (richest) {
          setSelectedDate(richest.date);
          setSelectedMatchId(richest.id);
        }
      })
      .catch(console.error);
  }, []);

  // Auto-select richest match on map/date change
  useEffect(() => {
    if (!indexData) return;
    const richest = indexData.matches
      .filter((m) => m.map === selectedMap && m.date === selectedDate)
      .sort((a, b) => matchScore(b) - matchScore(a))[0];
    if (richest) setSelectedMatchId(richest.id);
    else setSelectedMatchId(null);
  }, [selectedMap, selectedDate, indexData]);

  // Load match data
  useEffect(() => {
    if (!selectedMatchId) { setMatchData(null); return; }
    setMatchLoading(true);
    fetch(BASE + 'data/matches/' + selectedMatchId + '.json')
      .then((r) => r.json())
      .then((data: MatchData) => {
        data.players.forEach((p) => p.events.forEach((e) => { e.ts = e.ts * 1000; }));
        setMatchData(data);
        const allTs = data.players.flatMap((p) => p.events.map((e) => e.ts));
        if (allTs.length > 0) setTimeBounds(Math.min(...allTs), Math.max(...allTs));
        setMatchLoading(false);
      })
      .catch(() => setMatchLoading(false));
  }, [selectedMatchId]);

  // Pre-load all 3 analytics files on startup so map switching is instant
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

  return (
    <div className="w-screen h-screen flex flex-col lila-grid-bg overflow-hidden" style={{ backgroundColor: '#07060b' }}>
      {showLoader && (
        <LoadingScreen
          dataReady={dataReady}
          onDone={() => setShowLoader(false)}
        />
      )}
      <TopBar />

      {appMode === 'ai' ? (
        <AiModePage />
      ) : (
        <>
          {/* Main area — map fills everything, toolbar + panel overlay on right */}
          <div className="flex-1 relative min-h-0">
            {/* Map — hero element */}
            <div className="absolute inset-0">
              <MapViewer />
              {appMode === 'replay' && <KillFeed />}
            </div>

            {/* Context panel — slides in from right, overlays map */}
            <ContextPanel />

            {/* Right icon toolbar — always visible at right edge */}
            <RightToolbar />
          </div>

          {/* Timeline — replay mode only */}
          {appMode === 'replay' && <Timeline />}
        </>
      )}
    </div>
  );
}
