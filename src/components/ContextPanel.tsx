import React from 'react';
import { X } from 'lucide-react';
import { useVisualizerStore } from '@/lib/store';
import { LayersPanel } from './panels/LayersPanel';
import { HeatmapPanel } from './panels/HeatmapPanel';
import { PlayersPanel } from './panels/PlayersPanel';
import { EventsPanel } from './panels/EventsPanel';
import { StatsPanel } from './panels/StatsPanel';
const PANEL_LABELS: Record<string, string> = {
  layers:  'Layer Controls',
  heatmap: 'Heatmap',
  players: 'Players',
  events:  'Event Feed',
  stats:   'Match Stats',
};

export function ContextPanel() {
  const { activePanel, setActivePanel } = useVisualizerStore();
  const isOpen = activePanel !== null;

  return (
    <div
      className="absolute top-0 bottom-0 flex flex-col"
      style={{
        right: 48,
        width: 360,
        transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 48px))',
        transition: 'transform 0.22s ease',
        background: 'rgba(8,7,12,0.96)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        zIndex: 29,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#ff8a00',
          }}
        >
          {activePanel ? PANEL_LABELS[activePanel] : ''}
        </span>
        <button
          onClick={() => setActivePanel(null)}
          className="opacity-40 hover:opacity-100 transition-opacity"
          style={{ color: '#fff' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activePanel === 'layers'  && <LayersPanel />}
        {activePanel === 'heatmap' && <HeatmapPanel />}
        {activePanel === 'players' && <PlayersPanel />}
        {activePanel === 'events'  && <EventsPanel />}
        {activePanel === 'stats'   && <StatsPanel />}
      </div>
    </div>
  );
}
