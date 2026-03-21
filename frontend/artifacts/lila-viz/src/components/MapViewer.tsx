import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { worldToPixel, HUMAN_COLORS, MAP_CONFIGS } from '@/lib/types';

const BASE = import.meta.env.BASE_URL;

/** Four corner-bracket decorations — pure CSS, no SVG */
function CornerBrackets({ color = '#ff8a00', size = 18, thickness = 1.5 }: {
  color?: string; size?: number; thickness?: number;
}) {
  const base: React.CSSProperties = {
    position: 'absolute', width: size, height: size, borderStyle: 'solid', borderColor: color,
  };
  return (
    <>
      <div style={{ ...base, top: 8, left: 8,  borderWidth: `${thickness}px 0 0 ${thickness}px` }} />
      <div style={{ ...base, top: 8, right: 8, borderWidth: `${thickness}px ${thickness}px 0 0` }} />
      <div style={{ ...base, bottom: 8, left: 8,  borderWidth: `0 0 ${thickness}px ${thickness}px` }} />
      <div style={{ ...base, bottom: 8, right: 8, borderWidth: `0 ${thickness}px ${thickness}px 0` }} />
    </>
  );
}

export function MapViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [crosshair, setCrosshair] = useState({ x: 0.5, y: 0.5 });
  const [worldPos, setWorldPos] = useState({ x: 0, z: 0 });

  const {
    selectedMap, matchData, currentTime,
    layers, heatmapMode, heatmapOpacity, highlightedPlayerId,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 1024, 1024);
    if (!matchData || matchData.mapId !== selectedMap) return;

    const humans = matchData.players.filter((p) => !p.isBot);
    const colorMap = new Map(humans.map((p, i) => [p.userId, HUMAN_COLORS[i % HUMAN_COLORS.length]]));

    // Heatmap
    if (heatmapMode !== 'none') {
      const HMAP: Record<string, string[]> = {
        kills: ['Kill', 'BotKill'],
        deaths: ['Killed', 'BotKilled', 'KilledByStorm'],
        loot: ['Loot'],
        traffic: ['Position', 'BotPosition'],
      };
      const COLORS: Record<string, string> = {
        kills: 'rgba(239,68,68,',
        deaths: 'rgba(249,115,22,',
        loot: 'rgba(34,197,94,',
        traffic: 'rgba(96,165,250,',
      };
      const targets = HMAP[heatmapMode] ?? [];
      const col = COLORS[heatmapMode] ?? 'rgba(255,255,255,';
      const r = heatmapMode === 'traffic' ? 16 : 28;

      matchData.players.forEach((p) => {
        if (p.isBot && !layers.bots) return;
        p.events.forEach((e) => {
          if (!targets.includes(e.event) || e.ts > currentTime) return;
          const { px, py } = worldToPixel(e.x, e.z, selectedMap);
          const g = ctx.createRadialGradient(px, py, 0, px, py, r);
          g.addColorStop(0, col + (heatmapOpacity * 0.7) + ')');
          g.addColorStop(1, col + '0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    // Players
    matchData.players.forEach((p) => {
      if (p.isBot && !layers.bots) return;
      const isLit = highlightedPlayerId === null || highlightedPlayerId === p.userId;
      const baseAlpha = p.isBot ? 0.3 : 0.8;
      const alpha = isLit ? baseAlpha : baseAlpha * 0.12;
      const color = p.isBot ? '#ff8a00' : (colorMap.get(p.userId) ?? '#60a5fa');

      const posEvents = p.events.filter(
        (e) => (e.event === 'Position' || e.event === 'BotPosition') && e.ts <= currentTime
      );

      if (layers.paths && posEvents.length > 0) {
        // Path trail (needs ≥2 points)
        if (posEvents.length > 1) {
          ctx.save();
          ctx.globalAlpha = isLit ? (p.isBot ? 0.45 : 1) : (p.isBot ? 0.05 : 0.12);
          ctx.strokeStyle = color;
          ctx.lineWidth = p.isBot ? 1.5 : 3.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          if (p.isBot) ctx.setLineDash([4, 6]);
          if (!p.isBot) { ctx.shadowBlur = 6; ctx.shadowColor = color; }
          ctx.beginPath();
          posEvents.forEach((e, i) => {
            const { px, py } = worldToPixel(e.x, e.z, selectedMap);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          });
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // Current position dot — always shown once any position event is visible
        const last = posEvents[posEvents.length - 1];
        const { px, py } = worldToPixel(last.x, last.z, selectedMap);
        const dotR = p.isBot ? 4 : 6;

        ctx.save();
        ctx.globalAlpha = isLit ? 1 : 0.1;

        // Outer glow ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(px, py, dotR + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Filled dot
        ctx.fillStyle = color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fill();

        // White centre for humans
        if (!p.isBot) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Markers
      p.events.forEach((e) => {
        if (e.ts > currentTime) return;
        const { px, py } = worldToPixel(e.x, e.z, selectedMap);
        ctx.save();
        ctx.globalAlpha = isLit ? 1 : 0.08;

        if (e.event === 'Kill' && layers.kills) {
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
          ctx.shadowBlur = 8; ctx.shadowColor = '#ef4444';
          drawX(ctx, px, py, 7);
        } else if (e.event === 'BotKill' && layers.kills) {
          ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 1.5;
          drawX(ctx, px, py, 4);
        } else if ((e.event === 'Killed' || e.event === 'BotKilled') && layers.deaths) {
          ctx.fillStyle = '#f97316';
          ctx.shadowBlur = 5; ctx.shadowColor = '#f97316';
          drawSkull(ctx, px, py, 6);
        } else if (e.event === 'KilledByStorm' && layers.storm) {
          ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
          ctx.shadowBlur = 8; ctx.shadowColor = '#a855f7';
          drawLightning(ctx, px, py, 8);
        } else if (e.event === 'Loot' && layers.loot) {
          ctx.fillStyle = '#22c55e';
          ctx.shadowBlur = 4; ctx.shadowColor = '#22c55e';
          drawDiamond(ctx, px, py, 4);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
      });
    });
  }, [matchData, currentTime, selectedMap, layers, heatmapMode, heatmapOpacity, highlightedPlayerId]);

  const imgUrl = (BASE.endsWith('/') ? BASE.slice(0, -1) : BASE) + mapCfg.imageUrl;

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-[#06050a] overflow-hidden"
      ref={containerRef}
      onMouseMove={handleMouseMove}
    >
      {/* Map image + canvas */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="relative" style={{ width: '100%', height: '100%' }}>
          <img
            src={imgUrl}
            alt={mapCfg.name}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ opacity: 0.88, filter: 'brightness(1.08) contrast(1.04) saturate(0.9)' }}
          />
          <canvas
            ref={canvasRef}
            width={1024}
            height={1024}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ zIndex: 10 }}
          />

          {/* Scanlines */}
          <div className="scanlines absolute inset-0" style={{ zIndex: 11 }} />

          {/* Vignette */}
          <div className="map-vignette absolute inset-0" style={{ zIndex: 12 }} />
        </div>
      </div>

      {/* Corner brackets */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        <CornerBrackets color="#ff8a00" size={22} thickness={1.5} />
      </div>

      {/* Top-left HUD */}
      <div className="absolute top-6 left-6 pointer-events-none" style={{ zIndex: 21 }}>
        <div
          className="text-[11px] tracking-[0.22em] uppercase mb-0.5"
          style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, color: '#ff8a00', textShadow: '0 0 16px rgba(255,138,0,0.6)' }}
        >
          {mapCfg.name}
        </div>
        <div className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {worldPos.x.toFixed(0)} · {worldPos.z.toFixed(0)}
        </div>
      </div>

      {/* Top-right HUD */}
      {matchData && (
        <div className="absolute top-6 right-6 pointer-events-none text-right" style={{ zIndex: 21 }}>
          <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ color: 'rgba(96,165,250,0.8)', fontWeight: 700 }}>
              {matchData.players.filter(p => !p.isBot).length}H
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}> · </span>
            <span style={{ color: 'rgba(255,138,0,0.8)', fontWeight: 700 }}>
              {matchData.players.filter(p => p.isBot).length}B
            </span>
          </div>
        </div>
      )}

      {/* Crosshair */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        <div className="absolute h-px w-full" style={{ top: `${crosshair.y * 100}%`, background: 'rgba(255,138,0,0.05)' }} />
        <div className="absolute w-px h-full" style={{ left: `${crosshair.x * 100}%`, background: 'rgba(255,138,0,0.05)' }} />
      </div>

      {/* Empty state */}
      {!matchData && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 30 }}>
          <div className="text-center">
            <div
              className="uppercase tracking-widest"
              style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.2)' }}
            >
              Select a match to begin visualization
            </div>
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
  ctx.beginPath();
  ctx.arc(x, y - r * 0.1, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - r * 0.6, y + r * 0.3, r * 1.2, r * 0.4);
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
  ctx.closePath(); ctx.fill();
}

function drawLightning(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x + s * 0.3, y - s);
  ctx.lineTo(x - s * 0.1, y - s * 0.1);
  ctx.lineTo(x + s * 0.3, y - s * 0.1);
  ctx.lineTo(x - s * 0.3, y + s);
  ctx.stroke();
}
