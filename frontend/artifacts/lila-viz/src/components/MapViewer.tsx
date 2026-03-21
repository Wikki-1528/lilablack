import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { worldToPixel, HUMAN_COLORS, MAP_CONFIGS } from '@/lib/types';
import type { GridCell, AiHighlightZone } from '@/lib/types';

const BASE = import.meta.env.BASE_URL;

function CornerBrackets({ color = '#ff8a00', size = 18, thickness = 1.5 }: {
  color?: string; size?: number; thickness?: number;
}) {
  const base: React.CSSProperties = { position: 'absolute', width: size, height: size, borderStyle: 'solid', borderColor: color };
  return (
    <>
      <div style={{ ...base, top: 8, left: 8,  borderWidth: `${thickness}px 0 0 ${thickness}px` }} />
      <div style={{ ...base, top: 8, right: 8, borderWidth: `${thickness}px ${thickness}px 0 0` }} />
      <div style={{ ...base, bottom: 8, left: 8,  borderWidth: `0 0 ${thickness}px ${thickness}px` }} />
      <div style={{ ...base, bottom: 8, right: 8, borderWidth: `0 ${thickness}px ${thickness}px 0` }} />
    </>
  );
}

// ── Analytics overlay draw functions ─────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function kdColor(kd: number): [number, number, number] {
  // green (high K/D > 1.5) → yellow → red (low K/D < 0.5)
  if (kd >= 1.5) return [34, 197, 94];   // #22c55e
  if (kd <= 0.5) return [239, 68, 68];   // #ef4444
  if (kd > 1.0) {
    const t = (kd - 1.0) / 0.5;
    return [lerp(251, 34, t), lerp(191, 197, t), lerp(36, 94, t)];
  }
  const t = (kd - 0.5) / 0.5;
  return [lerp(239, 251, t), lerp(68, 191, t), lerp(68, 36, t)];
}

function trafficColor(v: number): [number, number, number] {
  // transparent → blue → bright cyan
  return [lerp(0, 0, v), lerp(0, 229, v), lerp(0, 255, v)];
}

function drawAnalyticsOverlay(
  ctx: CanvasRenderingContext2D,
  cells: GridCell[],
  gridSize: number,
  overlay: string,
  opacity: number,
) {
  const cellPx = 1024 / gridSize;

  // Normalise values for relative scaling
  const maxHT = Math.max(1, ...cells.map((c) => c.ht));
  const maxBT = Math.max(1, ...cells.map((c) => c.bt));
  const maxLo = Math.max(1, ...cells.map((c) => c.lo));
  const maxHD = Math.max(1, ...cells.map((c) => c.hd));
  const maxSD = Math.max(1, ...cells.map((c) => c.sd));

  for (const cell of cells) {
    const px = cell.col * cellPx;
    const py = cell.row * cellPx;

    if (overlay === 'traffic') {
      if (cell.ht === 0) continue;
      const t = Math.pow(cell.ht / maxHT, 0.5);
      const [r, g, b] = trafficColor(t);
      ctx.fillStyle = `rgba(${r},${g},${b},${t * opacity * 0.75})`;
      ctx.fillRect(px, py, cellPx, cellPx);

    } else if (overlay === 'kd') {
      if (cell.kd === null || cell.d < 2) continue;
      const [r, g, b] = kdColor(cell.kd);
      const a = Math.min(0.85, opacity * 0.7 + (cell.k + cell.d) / 20 * 0.3);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(px, py, cellPx, cellPx);

    } else if (overlay === 'deadzone') {
      if (cell.ht > 0 || cell.bt > 0) continue;
      ctx.fillStyle = `rgba(239,68,68,${opacity * 0.55})`;
      ctx.fillRect(px, py, cellPx, cellPx);

    } else if (overlay === 'loot') {
      if (cell.lo === 0) continue;
      const t = Math.pow(cell.lo / maxLo, 0.6);
      ctx.fillStyle = `rgba(34,197,94,${t * opacity * 0.75})`;
      ctx.fillRect(px, py, cellPx, cellPx);

    } else if (overlay === 'hotdrop') {
      if (cell.hd === 0) continue;
      const t = Math.pow(cell.hd / maxHD, 0.5);
      ctx.fillStyle = `rgba(255,138,0,${t * opacity * 0.8})`;
      ctx.fillRect(px, py, cellPx, cellPx);

    } else if (overlay === 'botvhuman') {
      const hasH = cell.ht > 0;
      const hasB = cell.bt > 0;
      if (!hasH && !hasB) continue;
      if (hasH && hasB) {
        // overlap — purple
        const t = Math.min(1, (cell.ht + cell.bt) / (maxHT * 0.5));
        ctx.fillStyle = `rgba(168,85,247,${t * opacity * 0.7})`;
      } else if (hasH) {
        const t = cell.ht / maxHT;
        ctx.fillStyle = `rgba(96,165,250,${t * opacity * 0.7})`;
      } else {
        const t = cell.bt / maxBT;
        ctx.fillStyle = `rgba(255,138,0,${t * opacity * 0.7})`;
      }
      ctx.fillRect(px, py, cellPx, cellPx);

    } else if (overlay === 'storm') {
      if (cell.sd === 0) continue;
      const t = Math.pow(cell.sd / maxSD, 0.5);
      ctx.fillStyle = `rgba(124,58,237,${t * opacity * 0.85})`;
      ctx.fillRect(px, py, cellPx, cellPx);
    }
  }

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= gridSize; i++) {
    const p = i * cellPx;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 1024); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(1024, p); ctx.stroke();
  }
}

function drawAiHighlights(ctx: CanvasRenderingContext2D, zones: AiHighlightZone[], mapId: string, pulse: number) {
  zones.forEach((zone) => {
    const { px, py } = worldToPixel(zone.x, zone.z, mapId);
    const color = zone.color ?? '#ff8a00';
    const r = zone.radius;
    const pulseFactor = 1 + 0.08 * Math.sin(pulse);

    // Outer pulse ring
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(pulse);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(px, py, r * pulseFactor, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner fill
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(pulse);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export function MapViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [crosshair, setCrosshair] = useState({ x: 0.5, y: 0.5 });
  const [worldPos, setWorldPos] = useState({ x: 0, z: 0 });

  const {
    appMode, selectedMap, matchData, currentTime,
    layers, highlightedPlayerId,
    analyticsData, analyticsOverlay,
    aiHighlightZones,
  } = useVisualizerStore();

  const mapCfg = MAP_CONFIGS[selectedMap] ?? MAP_CONFIGS.AmbroseValley;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    setCrosshair({ x: rx, y: ry });
    setWorldPos({
      x: mapCfg.originX + rx * mapCfg.scale,
      z: mapCfg.originZ + (1 - ry) * mapCfg.scale,
    });
  }, [mapCfg]);

  // AI highlight pulse animation
  useEffect(() => {
    if (aiHighlightZones.length === 0) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      pulseRef.current += 0.06;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [aiHighlightZones.length]);

  // Main canvas draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 1024, 1024);

    // ── ANALYTICS MODE ──
    if (appMode === 'analytics') {
      const data = analyticsData[selectedMap];
      if (data) {
        drawAnalyticsOverlay(ctx, data.cells, data.gridSize, analyticsOverlay, 0.85);
      }
      if (aiHighlightZones.length > 0) {
        drawAiHighlights(ctx, aiHighlightZones, selectedMap, pulseRef.current);
      }
      return;
    }

    // ── AI MODE ── (static map + highlights only)
    if (appMode === 'ai') {
      const data = analyticsData[selectedMap];
      if (data) {
        drawAnalyticsOverlay(ctx, data.cells, data.gridSize, analyticsOverlay, 0.4);
      }
      if (aiHighlightZones.length > 0) {
        drawAiHighlights(ctx, aiHighlightZones, selectedMap, pulseRef.current);
      }
      return;
    }

    // ── REPLAY MODE ──
    if (!matchData || matchData.mapId !== selectedMap) return;

    const humans = matchData.players.filter((p) => !p.isBot);
    const colorMap = new Map(humans.map((p, i) => [p.userId, HUMAN_COLORS[i % HUMAN_COLORS.length]]));

    matchData.players.forEach((p) => {
      if (p.isBot && !layers.bots) return;
      const isLit = highlightedPlayerId === null || highlightedPlayerId === p.userId;
      const color = p.isBot ? '#ff8a00' : (colorMap.get(p.userId) ?? '#60a5fa');

      const posEvents = p.events.filter(
        (e) => (e.event === 'Position' || e.event === 'BotPosition') && e.ts <= currentTime
      );

      if (layers.paths && posEvents.length > 0) {
        if (posEvents.length > 1) {
          ctx.save();
          ctx.globalAlpha = isLit ? (p.isBot ? 0.45 : 1) : (p.isBot ? 0.05 : 0.12);
          ctx.strokeStyle = color;
          ctx.lineWidth = p.isBot ? 1.5 : 3.5;
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          if (p.isBot) ctx.setLineDash([4, 6]);
          if (!p.isBot) { ctx.shadowBlur = 6; ctx.shadowColor = color; }
          ctx.beginPath();
          posEvents.forEach((e, i) => {
            const { px, py } = worldToPixel(e.x, e.z, selectedMap);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          });
          ctx.stroke();
          ctx.setLineDash([]); ctx.shadowBlur = 0;
          ctx.restore();
        }

        const last = posEvents[posEvents.length - 1];
        const { px, py } = worldToPixel(last.x, last.z, selectedMap);
        const dotR = p.isBot ? 4 : 6;

        ctx.save();
        ctx.globalAlpha = isLit ? 1 : 0.1;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 14; ctx.shadowColor = color;
        ctx.beginPath(); ctx.arc(px, py, dotR + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = color; ctx.shadowBlur = 12; ctx.shadowColor = color;
        ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI * 2); ctx.fill();
        if (!p.isBot) {
          ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Event markers
      p.events.forEach((e) => {
        if (e.ts > currentTime) return;
        const { px, py } = worldToPixel(e.x, e.z, selectedMap);
        ctx.save();
        ctx.globalAlpha = isLit ? 1 : 0.08;

        if (e.event === 'Kill' && layers.kills) {
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5; ctx.shadowBlur = 8; ctx.shadowColor = '#ef4444';
          drawX(ctx, px, py, 7);
        } else if (e.event === 'BotKill' && layers.kills) {
          ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 1.5; drawX(ctx, px, py, 4);
        } else if ((e.event === 'Killed' || e.event === 'BotKilled') && layers.deaths) {
          ctx.fillStyle = '#f97316'; ctx.shadowBlur = 5; ctx.shadowColor = '#f97316';
          drawSkull(ctx, px, py, 6);
        } else if (e.event === 'KilledByStorm' && layers.storm) {
          ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.shadowBlur = 8; ctx.shadowColor = '#a855f7';
          drawLightning(ctx, px, py, 8);
        } else if (e.event === 'Loot' && layers.loot) {
          ctx.fillStyle = '#22c55e'; ctx.shadowBlur = 4; ctx.shadowColor = '#22c55e';
          drawDiamond(ctx, px, py, 4);
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      });
    });
  }, [appMode, matchData, currentTime, selectedMap, layers, highlightedPlayerId, analyticsData, analyticsOverlay, aiHighlightZones]);

  // Re-draw when AI pulse changes
  useEffect(() => {
    if (aiHighlightZones.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = analyticsData[selectedMap];
    const baseOpacity = appMode === 'ai' ? 0.4 : appMode === 'analytics' ? 0.85 : 0;
    ctx.clearRect(0, 0, 1024, 1024);
    if (data && (appMode === 'analytics' || appMode === 'ai')) {
      drawAnalyticsOverlay(ctx, data.cells, data.gridSize, analyticsOverlay, baseOpacity);
    }
    drawAiHighlights(ctx, aiHighlightZones, selectedMap, pulseRef.current);
  });

  const imgUrl = (BASE.endsWith('/') ? BASE.slice(0, -1) : BASE) + mapCfg.imageUrl;

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-[#06050a] overflow-hidden"
      ref={containerRef}
      onMouseMove={handleMouseMove}
    >
      {/* Map + canvas */}
      <div className="relative w-full h-full">
        <img
          src={imgUrl}
          alt={mapCfg.name}
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            opacity: appMode === 'replay' ? 0.88 : 0.6,
            filter: 'brightness(1.05) contrast(1.04) saturate(0.85)',
          }}
        />
        <canvas
          ref={canvasRef}
          width={1024}
          height={1024}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: 10 }}
        />
        <div className="scanlines absolute inset-0" style={{ zIndex: 11 }} />
        <div className="map-vignette absolute inset-0" style={{ zIndex: 12 }} />
      </div>

      {/* Corner brackets */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        <CornerBrackets color="#ff8a00" size={22} thickness={1.5} />
      </div>

      {/* Top-left HUD */}
      <div className="absolute top-6 left-6 pointer-events-none" style={{ zIndex: 21 }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#ff8a00', textShadow: '0 0 16px rgba(255,138,0,0.6)' }}>
          {mapCfg.name}
        </div>
        <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          {worldPos.x.toFixed(0)} · {worldPos.z.toFixed(0)}
        </div>
        {appMode === 'analytics' && (
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,138,0,0.7)', marginTop: 2, textTransform: 'uppercase' }}>
            Analytics Mode
          </div>
        )}
        {appMode === 'ai' && (
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,138,0,0.7)', marginTop: 2, textTransform: 'uppercase' }}>
            AI Insights Mode
          </div>
        )}
      </div>

      {/* Top-right HUD — replay only */}
      {appMode === 'replay' && matchData && (
        <div className="absolute top-6 right-6 pointer-events-none text-right" style={{ zIndex: 21 }}>
          <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ color: 'rgba(96,165,250,0.8)', fontWeight: 700 }}>{matchData.players.filter(p => !p.isBot).length}H</span>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}> · </span>
            <span style={{ color: 'rgba(255,138,0,0.8)', fontWeight: 700 }}>{matchData.players.filter(p => p.isBot).length}B</span>
          </div>
        </div>
      )}

      {/* Analytics overlay label */}
      {(appMode === 'analytics' || appMode === 'ai') && aiHighlightZones.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 22 }}>
          <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,138,0,0.3)', backdropFilter: 'blur(4px)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#ff8a00', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10, color: '#ff8a00', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {aiHighlightZones.length} zone{aiHighlightZones.length !== 1 ? 's' : ''} highlighted
            </span>
          </div>
        </div>
      )}

      {/* Crosshair */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        <div className="absolute h-px w-full" style={{ top: `${crosshair.y * 100}%`, background: 'rgba(255,138,0,0.04)' }} />
        <div className="absolute w-px h-full" style={{ left: `${crosshair.x * 100}%`, background: 'rgba(255,138,0,0.04)' }} />
      </div>

      {/* Empty state */}
      {appMode === 'replay' && !matchData && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 30 }}>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Select a match to begin
          </div>
        </div>
      )}
    </div>
  );
}

function drawX(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
  ctx.stroke();
}
function drawSkull(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - r * 0.6, y + r * 0.3, r * 1.2, r * 0.4);
}
function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
  ctx.closePath(); ctx.fill();
}
function drawLightning(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x + s * 0.3, y - s); ctx.lineTo(x - s * 0.1, y - s * 0.1);
  ctx.lineTo(x + s * 0.3, y - s * 0.1); ctx.lineTo(x - s * 0.3, y + s);
  ctx.stroke();
}
