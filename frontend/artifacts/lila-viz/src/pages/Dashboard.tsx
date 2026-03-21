import React, { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MapViewer } from '@/components/MapViewer';
import { Timeline } from '@/components/Timeline';
import { RightPanel } from '@/components/RightPanel';
import { useVisualizerStore } from '@/lib/store';
import type { IndexData, MatchData } from '@/lib/types';

const BASE = import.meta.env.BASE_URL;

export default function Dashboard() {
  const {
    selectedMatchId, selectedMap, selectedDate,
    setIndexData, setMatchData, setTimeBounds, setSelectedMatchId,
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
          .sort((a, b) => (b.kills * 10 + b.bots * 4 + b.totalEvents * 0.01) - (a.kills * 10 + a.bots * 4 + a.totalEvents * 0.01))[0];
        if (richest) setSelectedMatchId(richest.id);
      })
      .catch(console.error);
  }, []);

  // Auto-select first match on map/date change
  useEffect(() => {
    if (!indexData) return;
    const richest = indexData.matches
      .filter((m) => m.map === selectedMap && m.date === selectedDate)
      .sort((a, b) => (b.kills * 10 + b.bots * 4 + b.totalEvents * 0.01) - (a.kills * 10 + a.bots * 4 + a.totalEvents * 0.01))[0];
    if (richest) setSelectedMatchId(richest.id);
    else setSelectedMatchId(null);
  }, [selectedMap, selectedDate, indexData]);

  // Load match data
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

  return (
    <div className="w-screen h-screen flex lila-grid-bg overflow-hidden" style={{ backgroundColor: '#07060b' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 min-h-0">
          <MapViewer />
        </div>
        <Timeline />
      </main>
      <RightPanel />
    </div>
  );
}
