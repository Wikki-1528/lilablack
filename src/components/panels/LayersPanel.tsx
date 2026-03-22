import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useVisualizerStore } from '@/lib/store';

const LAYER_CONFIG = [
  { key: 'paths',  label: 'Player Paths',  color: '#60a5fa' },
  { key: 'kills',  label: 'Kill Events',   color: '#ef4444' },
  { key: 'deaths', label: 'Death Events',  color: '#f97316' },
  { key: 'loot',   label: 'Loot Events',   color: '#22c55e' },
  { key: 'storm',  label: 'Storm Deaths',  color: '#a855f7' },
  { key: 'bots',   label: 'Bot Paths',     color: '#ff8a00' },
] as const;

export function LayersPanel() {
  const { layers, toggleLayer, pathStyle, setPathStyle } = useVisualizerStore();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Path style */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="font-mono uppercase tracking-widest mb-2" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>
          Path Style
        </div>
        <div className="flex gap-1">
          {(['solid', 'dotted'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setPathStyle(s)}
              className="flex-1 py-1.5 uppercase transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '0.1em',
                background: pathStyle === s ? 'rgba(255,138,0,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${pathStyle === s ? 'rgba(255,138,0,0.3)' : 'rgba(255,255,255,0.07)'}`,
                color: pathStyle === s ? '#ff8a00' : 'rgba(255,255,255,0.4)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Layer toggles */}
      <div className="px-4 py-3">
        <div className="font-mono uppercase tracking-widest mb-3" style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)' }}>
          Visible Layers
        </div>
        <div className="space-y-1.5">
          {LAYER_CONFIG.map(({ key, label, color }) => {
            const isOn = layers[key];
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 transition-all"
                style={{
                  background: isOn ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: `1px solid ${isOn ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'}`,
                }}
              >
                <span
                  className="w-2.5 h-2.5 shrink-0"
                  style={{ backgroundColor: isOn ? color : 'rgba(255,255,255,0.15)' }}
                />
                <span
                  className="flex-1 text-left font-mono"
                  style={{ fontSize: 10, color: isOn ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)' }}
                >
                  {label}
                </span>
                {isOn
                  ? <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
                  : <EyeOff className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
                }
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
