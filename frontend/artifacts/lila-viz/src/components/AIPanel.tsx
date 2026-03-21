import React, { useRef, useState } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { Sparkles, Send, Key, Trash2, MapPin } from 'lucide-react';
import type { AiHighlightZone, ChatMessage } from '@/lib/types';
import { MAP_CONFIGS } from '@/lib/types';

const SUGGESTED: Record<string, string[]> = {
  AmbroseValley: [
    'Where do most storm deaths happen?',
    'Which zone has the worst K/D ratio?',
    'Where do players land most often?',
    'Where are the dead zones?',
    'How do bot and human paths differ?',
  ],
  GrandRift: [
    'What is the deadliest area on Grand Rift?',
    'Where do players land at the start?',
    'Which zones have the highest loot density?',
    'Where are the dead zones?',
  ],
  Lockdown: [
    'Where do most deaths happen on Lockdown?',
    'Which areas have zero player traffic?',
    'Where do storm deaths cluster?',
    'What is the hottest drop location?',
  ],
};

function buildStatsContext(mapId: string, data: any, summary: any): string {
  const cfg = MAP_CONFIGS[mapId];
  const gridSize = data.gridSize;

  // Find top cells by different metrics
  const cells = data.cells;
  const topTraffic = [...cells].sort((a: any, b: any) => b.ht - a.ht).slice(0, 5);
  const topKills   = [...cells].sort((a: any, b: any) => b.k - a.k).slice(0, 5);
  const topDeaths  = [...cells].sort((a: any, b: any) => b.d - a.d).slice(0, 5);
  const topLoot    = [...cells].sort((a: any, b: any) => b.lo - a.lo).slice(0, 5);
  const topHotDrop = [...cells].sort((a: any, b: any) => b.hd - a.hd).slice(0, 5);
  const worstKD    = cells.filter((c: any) => c.kd !== null && c.d > 2).sort((a: any, b: any) => a.kd - b.kd).slice(0, 3);
  const bestKD     = cells.filter((c: any) => c.kd !== null && c.k > 1).sort((a: any, b: any) => b.kd - a.kd).slice(0, 3);

  function cellCoords(cell: any) {
    const u = (cell.col + 0.5) / gridSize;
    const v = 1 - (cell.row + 0.5) / gridSize;
    const x = Math.round(cfg.originX + u * cfg.scale);
    const z = Math.round(cfg.originZ + v * cfg.scale);
    return `(x=${x}, z=${z})`;
  }

  return `Map: ${mapId} | ${data.matchCount} matches analyzed
Grid: ${gridSize}x${gridSize} cells

SUMMARY:
- Dead zone: ${summary.deadZonePercent}% of map has zero player traffic
- Bot/human overlap: ${Math.round(summary.botHumanOverlap * 100)}% of active cells
- Average K/D ratio across zones: ${summary.avgKdRatio}
- Total kills: ${summary.totalKills}, total deaths: ${summary.totalDeaths}
- Total loot pickups: ${summary.totalLoot}
- Storm death clusters: ${summary.stormClusters.slice(0, 3).map((c: any) => `(x=${c.x}, z=${c.z}) count=${c.count}`).join('; ')}

TOP TRAFFIC ZONES (human): ${topTraffic.map((c: any) => `${cellCoords(c)} traffic=${c.ht}`).join(', ')}
TOP HOT DROP ZONES: ${topHotDrop.map((c: any) => `${cellCoords(c)} drops=${c.hd}`).join(', ')}
TOP KILL ZONES: ${topKills.map((c: any) => `${cellCoords(c)} kills=${c.k}`).join(', ')}
TOP DEATH ZONES: ${topDeaths.map((c: any) => `${cellCoords(c)} deaths=${c.d}`).join(', ')}
WORST K/D (death traps): ${worstKD.map((c: any) => `${cellCoords(c)} kd=${c.kd}`).join(', ')}
BEST K/D (kill zones): ${bestKD.map((c: any) => `${cellCoords(c)} kd=${c.kd}`).join(', ')}
TOP LOOT ZONES: ${topLoot.map((c: any) => `${cellCoords(c)} loot=${c.lo}`).join(', ')}`;
}

function parseZones(text: string): AiHighlightZone[] {
  const zones: AiHighlightZone[] = [];
  // Match patterns like x=-120, z=200 or (x=-120, z=200) or x: -120, z: 200
  const re = /x[=:]\s*(-?\d+(?:\.\d+)?)[,\s]+z[=:]\s*(-?\d+(?:\.\d+)?)/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    zones.push({
      x: parseFloat(match[1]),
      z: parseFloat(match[2]),
      radius: 60,
      label: '',
      color: '#ff8a00',
    });
  }
  return zones.slice(0, 6); // max 6 highlights
}

export function AIPanel() {
  const {
    selectedMap, analyticsData, geminiApiKey, setGeminiApiKey,
    aiMessages, addAiMessage, clearAiMessages, setAiHighlightZones,
  } = useVisualizerStore();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const data = analyticsData[selectedMap];
  const suggested = SUGGESTED[selectedMap] ?? SUGGESTED.AmbroseValley;

  const ask = async (question: string) => {
    if (!question.trim() || loading || !geminiApiKey) return;
    if (!data) return;

    const userMsg: ChatMessage = { role: 'user', content: question };
    addAiMessage(userMsg);
    setInput('');
    setLoading(true);

    const statsCtx = buildStatsContext(selectedMap, data, data.summary);
    const systemPrompt = `You are a game analytics assistant for LILA BLACK, an extraction shooter.
You analyze player telemetry data to give Level Designers actionable insights.
When mentioning specific locations, always include coordinates in the format: x=<number>, z=<number>
Be concise (3-5 sentences max). Focus on what the Level Designer can actually change in the map.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${systemPrompt}\n\nData:\n${statsCtx}\n\nQuestion: ${question}`,
              }],
            }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message ?? `HTTP ${res.status}`);
      }

      const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response.';
      const zones = parseZones(text);
      const assistantMsg: ChatMessage = { role: 'assistant', content: text, zones };
      addAiMessage(assistantMsg);
      if (zones.length > 0) setAiHighlightZones(zones);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      addAiMessage({ role: 'assistant', content: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#08070c' }}>

      {/* Header */}
      <div className="px-3 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Sparkles className="w-4 h-4" style={{ color: '#ff8a00' }} />
        <div className="flex-1">
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff' }}>AI Insights</div>
          <div className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>Powered by Gemini · {selectedMap}</div>
        </div>
        <button onClick={() => setShowKeyInput(!showKeyInput)} title="Set API Key">
          <Key className="w-3.5 h-3.5" style={{ color: geminiApiKey ? 'rgba(255,138,0,0.6)' : 'rgba(255,255,255,0.3)' }} />
        </button>
        {aiMessages.length > 0 && (
          <button onClick={() => { clearAiMessages(); setAiHighlightZones([]); }} title="Clear chat">
            <Trash2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
          </button>
        )}
      </div>

      {/* API key input */}
      {showKeyInput && (
        <div className="px-3 py-3 shrink-0" style={{ background: 'rgba(255,138,0,0.05)', borderBottom: '1px solid rgba(255,138,0,0.15)' }}>
          <div className="font-mono uppercase tracking-widest mb-1.5" style={{ fontSize: 8, color: 'rgba(255,138,0,0.7)' }}>Gemini API Key</div>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="AIza..."
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              className="flex-1 px-2 py-1.5 font-mono focus:outline-none"
              style={{ fontSize: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,138,0,0.3)', color: '#fff' }}
            />
            <button
              onClick={() => { setGeminiApiKey(keyDraft); setShowKeyInput(false); setKeyDraft(''); }}
              className="px-3 py-1.5"
              style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10, background: '#ff8a00', color: '#fff', letterSpacing: '0.08em' }}
            >
              Save
            </button>
          </div>
          <div className="font-mono mt-1.5" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
            Get a free key at aistudio.google.com · stored in localStorage
          </div>
        </div>
      )}

      {/* No key warning */}
      {!geminiApiKey && !showKeyInput && (
        <div className="px-3 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-center">
            <Key className="w-5 h-5 mx-auto mb-2" style={{ color: 'rgba(255,138,0,0.4)' }} />
            <div className="font-mono mb-2" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Add your Gemini API key to enable AI insights</div>
            <button onClick={() => setShowKeyInput(true)} className="px-3 py-1.5 uppercase"
              style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10, background: 'rgba(255,138,0,0.1)', border: '1px solid rgba(255,138,0,0.3)', color: '#ff8a00', letterSpacing: '0.1em' }}>
              Add Key
            </button>
          </div>
        </div>
      )}

      {/* Suggested questions */}
      {aiMessages.length === 0 && geminiApiKey && (
        <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="font-mono uppercase tracking-widest mb-2" style={{ fontSize: 8, color: 'rgba(255,138,0,0.6)' }}>Suggested Questions</div>
          <div className="space-y-1">
            {suggested.map((q, i) => (
              <button key={i} onClick={() => ask(q)}
                className="w-full text-left px-2.5 py-2 transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,138,0,0.3)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {aiMessages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className="max-w-[92%] px-3 py-2"
              style={{
                background: msg.role === 'user' ? 'rgba(255,138,0,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(255,138,0,0.25)' : 'rgba(255,255,255,0.08)'}`,
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: 12,
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.5,
              }}
            >
              {msg.content}
              {msg.zones && msg.zones.length > 0 && (
                <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <MapPin className="w-3 h-3 shrink-0" style={{ color: '#ff8a00' }} />
                  <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,138,0,0.8)' }}>
                    {msg.zones.length} zone{msg.zones.length !== 1 ? 's' : ''} highlighted on map
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex gap-1">
                {[0, 1, 2].map((n) => (
                  <div key={n} className="w-1.5 h-1.5" style={{ background: '#ff8a00', animation: `pulse 1s ${n * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {geminiApiKey && (
        <div className="px-3 py-2.5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              placeholder="Ask about this map..."
              className="flex-1 px-2.5 py-2 focus:outline-none"
              style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              disabled={loading}
            />
            <button
              onClick={() => ask(input)}
              disabled={loading || !input.trim()}
              className="w-9 h-9 flex items-center justify-center transition-all"
              style={{ background: input.trim() && !loading ? '#ff8a00' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Send className="w-3.5 h-3.5" style={{ color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.3)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
