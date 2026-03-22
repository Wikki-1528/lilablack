import React from 'react';
import { Eye, Flame, Users, List, BarChart2 } from 'lucide-react';
import { useVisualizerStore, type ActivePanel, type AppMode } from '@/lib/store';

interface ToolbarButton {
  id: Exclude<ActivePanel, null>;
  icon: React.ReactNode;
  label: string;
  modes: AppMode[];
}

const BUTTONS: ToolbarButton[] = [
  { id: 'layers',  icon: <Eye className="w-5 h-5" />,       label: 'Layers',  modes: ['replay'] },
  { id: 'heatmap', icon: <Flame className="w-5 h-5" />,     label: 'Heatmap', modes: ['analytics'] },
  { id: 'players', icon: <Users className="w-5 h-5" />,     label: 'Players', modes: ['replay'] },
  { id: 'events',  icon: <List className="w-5 h-5" />,      label: 'Events',  modes: ['replay'] },
  { id: 'stats',   icon: <BarChart2 className="w-5 h-5" />, label: 'Stats',   modes: ['replay', 'analytics'] },
];

export function RightToolbar() {
  const { appMode, activePanel, setActivePanel } = useVisualizerStore();

  const visible = BUTTONS.filter((b) => b.modes.includes(appMode));

  return (
    <div
      className="absolute right-0 top-0 bottom-0 flex flex-col items-center py-3 gap-1"
      style={{
        width: 48,
        background: 'rgba(8,7,12,0.92)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
        zIndex: 30,
      }}
    >
      {visible.map((btn) => {
        const isActive = activePanel === btn.id;
        return (
          <button
            key={btn.id}
            onClick={() => setActivePanel(btn.id)}
            title={btn.label}
            className="w-10 h-10 flex items-center justify-center transition-all relative group toolbar-btn"
            data-active={isActive}
            style={{
              background: isActive ? 'rgba(255,138,0,0.12)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(255,138,0,0.35)' : 'transparent'}`,
            }}
          >
            {btn.icon}
            {/* Tooltip */}
            <div
              className="absolute right-full mr-2 px-2 py-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{
                background: 'rgba(13,12,20,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.7)',
                zIndex: 40,
              }}
            >
              {btn.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
