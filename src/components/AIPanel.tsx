import React, { useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Sparkles, Send, MapPin, Lightbulb, AlertCircle, RefreshCw } from 'lucide-react';
import { useVisualizerStore } from '@/lib/store';
import type { AiChart } from '@/lib/types';
import type { AiChatHook } from '@/hooks/useAiChat';

// Re-export hook so `import { useAiChat } from '@/components/AIPanel'` still works
export { useAiChat } from '@/hooks/useAiChat';
export type { AiChatHook } from '@/hooks/useAiChat';

// ── Chart renderers ───────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0d0c14', border: '1px solid rgba(255,138,0,0.3)', fontSize: 9, fontFamily: 'monospace', color: '#fff' },
  labelStyle:   { color: 'rgba(255,255,255,0.5)', fontSize: 8 },
  cursor:       { fill: 'rgba(255,255,255,0.04)' },
};

function BarChartCard({ chart }: { chart: AiChart }) {
  const color = chart.color ?? '#ff8a00';
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 6px 4px' }}>
      <div className="font-mono uppercase tracking-widest mb-2 px-1" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{chart.title}</div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={chart.data} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 7, fill: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }} axisLine={false} tickLine={false} interval={0} angle={-35} textAnchor="end" height={36} />
          <YAxis tick={{ fontSize: 7, fill: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} style={{ filter: `drop-shadow(0 0 4px ${color}66)` }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RadarChartCard({ chart }: { chart: AiChart }) {
  const color = chart.color ?? '#ff8a00';
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 6px 4px' }}>
      <div className="font-mono uppercase tracking-widest mb-1 px-1" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{chart.title}</div>
      <ResponsiveContainer width="100%" height={150}>
        <RadarChart data={chart.data} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }} />
          <PolarRadiusAxis tick={false} axisLine={false} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.25} dot={{ r: 3, fill: color }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartDisplay({ chart }: { chart: AiChart }) {
  return chart.type === 'radar' ? <RadarChartCard chart={chart} /> : <BarChartCard chart={chart} />;
}

function ZoneBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <MapPin className="w-3 h-3 shrink-0" style={{ color: '#ff8a00' }} />
      <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,138,0,0.8)' }}>
        {count} zone{count !== 1 ? 's' : ''} highlighted on map
      </span>
    </div>
  );
}

function InsightBadge({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 mt-2 px-2.5 py-2" style={{ background: 'rgba(255,138,0,0.08)', border: '1px solid rgba(255,138,0,0.22)' }}>
      <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" style={{ color: '#ff8a00' }} />
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <Sparkles className="w-3 h-3 shrink-0" style={{ color: '#ff8a00' }} />
      <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Analyzing map data</span>
      <div className="flex gap-1 ml-1">
        {[0, 1, 2].map((n) => (
          <div key={n} className="w-1.5 h-1.5" style={{ background: '#ff8a00', animation: `pulse 1s ${n * 0.22}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ── AIPanel — pure display component ─────────────────────────────────────────

export function AIPanel({ map, chat }: { map: string; chat: AiChatHook }) {
  const { aiMessages } = useVisualizerStore();
  const { loading, retryIn, pendingQ, data, suggested, ask } = chat;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [aiMessages.length]);

  return (
    <div className="flex flex-col h-full">

      {/* No analytics data warning */}
      {!data && (
        <div className="px-3 py-3 m-3" style={{ background: 'rgba(255,138,0,0.06)', border: '1px solid rgba(255,138,0,0.2)' }}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#ff8a00' }} />
            <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
              Analytics data loading for {map}…
            </span>
          </div>
        </div>
      )}

      {/* Rate-limit countdown */}
      {retryIn > 0 && (
        <div className="mx-3 my-2 px-3 py-2.5 flex items-center gap-2.5 shrink-0" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <RefreshCw className="w-3.5 h-3.5 shrink-0" style={{ color: '#f87171', animation: 'spin 1.5s linear infinite' }} />
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, color: '#f87171' }}>Rate limit — retrying in {retryIn}s</div>
            <div className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Free tier quota reached. Auto-retrying…</div>
          </div>
          <div className="shrink-0 font-mono tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: '#f87171', minWidth: 36, textAlign: 'right' }}>{retryIn}</div>
        </div>
      )}

      {/* Suggested questions — shown when chat is empty */}
      {aiMessages.length === 0 && data && (
        <div className="px-4 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="font-mono uppercase tracking-widest mb-3" style={{ fontSize: 8, color: 'rgba(255,138,0,0.6)' }}>
            Suggested Questions
          </div>
          <div className="space-y-1.5">
            {suggested.map((q, i) => (
              <button
                key={i}
                onClick={() => ask(q)}
                className="w-full text-left px-3 py-2.5 transition-all suggest-btn"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: '0.02em',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {aiMessages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-1.5'}>
            {msg.role === 'user' ? (
              <div
                className="max-w-[88%] px-3 py-2.5"
                style={{ background: 'rgba(255,138,0,0.08)', border: '1px solid rgba(255,138,0,0.22)', fontFamily: 'Rajdhani, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}
              >
                {msg.content}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className="px-3 py-3"
                  style={{ background: msg.error ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${msg.error ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`, fontFamily: 'Rajdhani, sans-serif', fontSize: 13, color: msg.error ? '#f87171' : 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}
                >
                  {msg.content}
                  {msg.zones && msg.zones.length > 0 && <ZoneBadge count={msg.zones.length} />}
                </div>
                {msg.insight && <InsightBadge text={msg.insight} />}
                {msg.charts && msg.charts.map((chart, ci) => <ChartDisplay key={ci} chart={chart} />)}
              </div>
            )}
          </div>
        ))}
        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Pending message label */}
      {pendingQ && retryIn > 0 && (
        <div className="px-4 py-1 font-mono shrink-0" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          Pending: "{pendingQ.slice(0, 60)}{pendingQ.length > 60 ? '…' : ''}"
        </div>
      )}
    </div>
  );
}

// ── AiInputBar — full-width bottom bar ───────────────────────────────────────

export function AiInputBar({ chat }: { chat: AiChatHook }) {
  const { input, setInput, loading, retryIn, ask, data } = chat;

  if (!data) return null;

  return (
    <div
      className="shrink-0 flex items-center gap-3 px-6 py-4"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#08070c' }}
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
        placeholder={retryIn > 0 ? `Rate limited — retrying in ${retryIn}s…` : 'Ask about map design, chokepoints, hot drops, storm patterns…'}
        className="flex-1 focus:outline-none"
        style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 14,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${retryIn > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.12)'}`,
          color: '#fff',
          opacity: retryIn > 0 ? 0.5 : 1,
        }}
        disabled={loading || retryIn > 0}
        autoFocus
      />
      <button
        onClick={() => ask(input)}
        disabled={loading || retryIn > 0 || !input.trim()}
        className="flex items-center gap-2 px-5 transition-all shrink-0"
        style={{
          height: 46,
          fontFamily: 'Rajdhani, sans-serif',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          background: input.trim() && !loading && retryIn === 0 ? '#ff8a00' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: input.trim() && !loading && retryIn === 0 ? '#fff' : 'rgba(255,255,255,0.3)',
          boxShadow: input.trim() && !loading && retryIn === 0 ? '0 0 18px rgba(255,138,0,0.4)' : 'none',
        }}
      >
        <Send className="w-4 h-4" />
        Send
      </button>
    </div>
  );
}
