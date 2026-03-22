import React, { useState, useEffect } from 'react';
import { ChevronDown, Sparkles, Trash2 } from 'lucide-react';
import { useVisualizerStore } from '@/lib/store';
import { MapViewer } from '@/components/MapViewer';
import { AIPanel, AiInputBar, useAiChat } from '@/components/AIPanel';

const MAP_OPTIONS = [
  { id: 'AmbroseValley', label: 'Ambrose Valley' },
  { id: 'GrandRift',     label: 'Grand Rift' },
  { id: 'Lockdown',      label: 'Lockdown' },
];

export function AiModePage() {
  const {
    selectedMap, setSelectedMap,
    analyticsData,
    aiMessages, clearAiMessages, setAiHighlightZones,
    geminiApiKey,
  } = useVisualizerStore();

  const [aiMap, setAiMap] = useState(selectedMap);
  const [mapOpen, setMapOpen] = useState(false);

  // Single hook instance — owns all chat state
  const chat = useAiChat(aiMap);

  const handleMapChange = (mapId: string) => {
    if (mapId === aiMap) return;
    setAiMap(mapId);
    setSelectedMap(mapId);
    clearAiMessages();
    setAiHighlightZones([]);
    setMapOpen(false);
  };

  useEffect(() => { setAiMap(selectedMap); }, [selectedMap]);

  const mapLabel = MAP_OPTIONS.find((m) => m.id === aiMap)?.label ?? aiMap;
  const hasKey = !!(import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || geminiApiKey);

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: '#07060b' }}>

      {/* ── Top: 50/50 split ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: Map pane — exactly half */}
        <div className="relative w-1/2 min-h-0" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <MapViewer />
        </div>

        {/* Right: Chat pane — exactly half */}
        <div className="w-1/2 flex flex-col min-h-0" style={{ background: '#08070c' }}>

          {/* Chat header: title + map selector + clear */}
          <div
            className="px-4 py-3 flex items-center gap-3 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: '#ff8a00' }} />
            <div className="flex-1 min-w-0">
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', letterSpacing: '0.06em' }}>
                AI Insights
              </div>
              <div className="font-mono flex items-center gap-1.5" style={{ fontSize: 8, lineHeight: 1 }}>
                <span
                  style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    background: hasKey ? '#34d399' : 'rgba(255,255,255,0.2)',
                    boxShadow: hasKey ? '0 0 6px #34d399' : 'none',
                  }}
                />
                <span style={{ color: hasKey ? '#34d399' : 'rgba(255,255,255,0.28)' }}>
                  {hasKey
                    ? (import.meta.env.VITE_GROQ_API_KEY ? 'Live · Llama 3.3 70B via Groq' : 'Live · Gemini 2.0 Flash')
                    : 'Demo mode · pre-computed responses'}
                </span>
              </div>
            </div>

            {/* Map selector dropdown */}
            <div className="relative">
              <button
                onClick={() => setMapOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 transition-all"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  background: mapOpen ? 'rgba(255,138,0,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${mapOpen ? 'rgba(255,138,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: mapOpen ? '#ff8a00' : 'rgba(255,255,255,0.75)',
                }}
              >
                {mapLabel}
                <ChevronDown
                  className="w-3 h-3"
                  style={{
                    color: 'rgba(255,138,0,0.6)',
                    transform: mapOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s',
                  }}
                />
              </button>

              {mapOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50"
                  style={{
                    background: '#0d0c14',
                    border: '1px solid rgba(255,138,0,0.25)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    minWidth: 160,
                  }}
                >
                  {MAP_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleMapChange(opt.id)}
                      className={`w-full text-left px-3 py-2 transition-all${opt.id !== aiMap ? ' dropdown-option' : ''}`}
                      style={{
                        fontFamily: 'Rajdhani, sans-serif',
                        fontWeight: opt.id === aiMap ? 700 : 600,
                        fontSize: 12,
                        color: opt.id === aiMap ? '#ff8a00' : 'rgba(255,255,255,0.65)',
                        background: opt.id === aiMap ? 'rgba(255,138,0,0.08)' : undefined,
                        borderLeft: `2px solid ${opt.id === aiMap ? '#ff8a00' : 'transparent'}`,
                      }}
                    >
                      {opt.label}
                      {analyticsData[opt.id] && (
                        <span className="font-mono ml-2" style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                          {analyticsData[opt.id].matchCount}m
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear chat */}
            {aiMessages.length > 0 && (
              <button
                onClick={() => { clearAiMessages(); setAiHighlightZones([]); }}
                title="Clear chat"
                className="opacity-40 hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: '#fff' }} />
              </button>
            )}
          </div>


          {/* Chat history — flex-1 scrollable */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AIPanel map={aiMap} chat={chat} />
          </div>
        </div>
      </div>

      {/* ── Bottom: full-width input bar ── */}
      <AiInputBar chat={chat} />
    </div>
  );
}
