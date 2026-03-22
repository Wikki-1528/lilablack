import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { worldToPixel, HUMAN_COLORS, MAP_CONFIGS, getPlayerStatus } from '@/lib/types';
import type { GridCell, AiHighlightZone, MatchData, AnalyticsData } from '@/lib/types';
import { CANVAS_SIZE, BOT_DASH_PATTERN } from '@/lib/constants';

// Compute per-match analytics grid from raw match event data
function computeMatchAnalytics(matchData: MatchData, mapId: string, gridSize = 48): AnalyticsData {
  const cfg = MAP_CONFIGS[mapId];
  const cellMap = new Map<number, GridCell>();

  const getCell = (x: number, z: number) => {
    if (!cfg) return null;
    const u = (x - cfg.originX) / cfg.scale;
    const v = (z - cfg.originZ) / cfg.scale;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    const col = Math.floor(u * gridSize);
    const row = Math.floor((1 - v) * gridSize);
    const key = row * gridSize + col;
    if (!cellMap.has(key)) cellMap.set(key, { row, col, ht: 0, bt: 0, k: 0, d: 0, kd: null, lo: 0, sd: 0, hd: 0 });
    return cellMap.get(key)!;
  };

  for (const player of matchData.players) {
    let firstTs = Infinity, firstX = 0, firstZ = 0, hasFirst = false;
    for (const e of player.events) {
      const cell = getCell(e.x, e.z);
      if (!cell) continue;
      if (player.isBot) {
        if (e.event === 'BotPosition') cell.bt++;
      } else {
        if (e.event === 'Position') {
          cell.ht++;
          if (e.ts < firstTs) { firstTs = e.ts; firstX = e.x; firstZ = e.z; hasFirst = true; }
        }
        if (e.event === 'Kill' || e.event === 'BotKill') cell.k++;
        if (e.event === 'Killed' || e.event === 'BotKilled') cell.d++;
        if (e.event === 'KilledByStorm') { cell.d++; cell.sd++; }
        if (e.event === 'Loot') cell.lo++;
      }
    }
    if (hasFirst) { const c = getCell(firstX, firstZ); if (c) c.hd++; }
  }

  const cells = Array.from(cellMap.values());
  cells.forEach((c) => { c.kd = c.d > 0 ? c.k / c.d : (c.k > 0 ? 2.0 : null); });

  return {
    matchCount: 1,
    gridSize,
    cells,
    summary: {
      deadZonePercent: 0, avgKdRatio: 1, botHumanOverlap: 0,
      hottestDropCell: null, topKillCell: null, stormClusters: [],
      totalHumanTraffic: cells.reduce((s, c) => s + c.ht, 0),
      totalBotTraffic:   cells.reduce((s, c) => s + c.bt, 0),
      totalKills:        cells.reduce((s, c) => s + c.k, 0),
      totalDeaths:       cells.reduce((s, c) => s + c.d, 0),
      totalLoot:         cells.reduce((s, c) => s + c.lo, 0),
    },
  };
}

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
  if (kd >= 1.5) return [34, 197, 94];
  if (kd <= 0.5) return [239, 68, 68];
  if (kd > 1.0) {
    const t = (kd - 1.0) / 0.5;
    return [lerp(251, 34, t), lerp(191, 197, t), lerp(36, 94, t)];
  }
  const t = (kd - 0.5) / 0.5;
  return [lerp(239, 251, t), lerp(68, 191, t), lerp(68, 36, t)];
}

function trafficColor(v: number): [number, number, number] {
  return [lerp(0, 0, v), lerp(0, 229, v), lerp(0, 255, v)];
}

function drawAnalyticsOverlay(
  ctx: CanvasRenderingContext2D,
  cells: GridCell[],
  gridSize: number,
  overlay: string,
  opacity: number,
) {
  const cellPx = CANVAS_SIZE / gridSize;

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
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, CANVAS_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(CANVAS_SIZE, p); ctx.stroke();
  }
}

function drawAiHighlights(ctx: CanvasRenderingContext2D, zones: AiHighlightZone[], mapId: string, pulse: number) {
  zones.forEach((zone) => {
    const { px, py } = worldToPixel(zone.x, zone.z, mapId);
    const color = zone.color ?? '#ff8a00';
    const r = zone.radius;
    const pulseFactor = 1 + 0.08 * Math.sin(pulse);

    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(pulse);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(px, py, r * pulseFactor, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(pulse);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

// ── Macro zone name from normalised cursor position (0-1) ─────────────────────

const MACRO_ZONE_NAMES: Record<string, string> = {
  '0,0': 'NW Corner', '0,1': 'North',   '0,2': 'NE Corner',
  '1,0': 'West',      '1,1': 'Central', '1,2': 'East',
  '2,0': 'SW Corner', '2,1': 'South',   '2,2': 'SE Corner',
};

function getMacroZone(rx: number, ry: number): string {
  const col = Math.min(2, Math.floor(rx * 3));
  const row = Math.min(2, Math.floor(ry * 3));
  return MACRO_ZONE_NAMES[`${row},${col}`] ?? '';
}

function fmtRelTime(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSecs / 60);
  return `+${m}:${String(totalSecs % 60).padStart(2, '0')}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export function MapViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef(0);
  const rafRef = useRef<number>(0);
  const radarRafRef = useRef<number>(0);
  const radarAngleRef = useRef(0);
  const acquiredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [radarAcquired, setRadarAcquired] = useState(false);
  type RevealPhase = 'hidden' | 'revealing' | 'visible';
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('visible');
  const revealPhaseRef = useRef<RevealPhase>('visible');
  revealPhaseRef.current = revealPhase;
  const [crosshair, setCrosshair] = useState({ x: 0.5, y: 0.5 });
  const [worldPos, setWorldPos] = useState({ x: 0, z: 0 });
  const [onMap, setOnMap] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<{
    type: string; icon: string; userId: string; ts: number; color: string; kills: number; deaths: number;
  } | null>(null);

  // Zoom + pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // normalized offset from center (0–1)
  const [isDragging, setIsDragging] = useState(false);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  zoomRef.current = zoom;
  panRef.current = pan;
  isDraggingRef.current = isDragging;

  const {
    appMode, selectedMap, matchData, currentTime,
    layers, pathStyle, highlightedPlayerId,
    analyticsData, analyticsOverlay, heatmapOpacity,
    aiHighlightZones, matchLoading,
  } = useVisualizerStore();

  const mapCfg = MAP_CONFIGS[selectedMap] ?? MAP_CONFIGS.AmbroseValley;

  // Per-match analytics — computed from raw match events; used in analytics mode
  const matchAnalytics = useMemo<AnalyticsData | null>(() => {
    if (!matchData || matchData.mapId !== selectedMap) return null;
    return computeMatchAnalytics(matchData, selectedMap);
  }, [matchData, selectedMap]);

  // Refs so handleMouseMove stays stable across currentTime/appMode changes
  const appModeRef = useRef(appMode);
  appModeRef.current = appMode;

  const visibleEvents = useMemo(() => {
    if (!matchData) return [] as { type: string; icon: string; userId: string; ts: number; rx: number; ry: number; color: string }[];
    const result: { type: string; icon: string; userId: string; ts: number; rx: number; ry: number; color: string }[] = [];
    matchData.players.forEach((p) => {
      p.events.forEach((e) => {
        if (e.ts > currentTime) return;
        let type = ''; let icon = ''; let color = '';
        if      (e.event === 'Kill'                                    && layers.kills)  { type = 'Kill';        icon = '✕'; color = '#ef4444'; }
        else if (e.event === 'BotKill'                                 && layers.kills)  { type = 'Bot Kill';    icon = '✕'; color = '#ec4899'; }
        else if ((e.event === 'Killed' || e.event === 'BotKilled')     && layers.deaths) { type = 'Eliminated';  icon = '☠'; color = '#f97316'; }
        else if (e.event === 'KilledByStorm'                           && layers.storm)  { type = 'Storm Death'; icon = '⚡'; color = '#a855f7'; }
        else if (e.event === 'Loot'                                    && layers.loot)   { type = 'Loot';        icon = '◆'; color = '#22c55e'; }
        if (!type) return;
        result.push({
          type, icon, userId: p.userId, ts: e.ts, color,
          rx: (e.x - mapCfg.originX) / mapCfg.scale,
          ry: 1 - (e.z - mapCfg.originZ) / mapCfg.scale,
        });
      });
    });
    return result;
  }, [matchData, currentTime, layers, mapCfg]);

  const visibleEventsRef = useRef(visibleEvents);
  visibleEventsRef.current = visibleEvents;

  // Per-player total K/D for the match (all events, not time-filtered)
  const playerStats = useMemo(() => {
    if (!matchData) return new Map<string, { kills: number; deaths: number }>();
    const m = new Map<string, { kills: number; deaths: number }>();
    matchData.players.forEach((p) => {
      let kills = 0, deaths = 0;
      p.events.forEach((e) => {
        if (e.event === 'Kill' || e.event === 'BotKill') kills++;
        if (e.event === 'Killed' || e.event === 'BotKilled' || e.event === 'KilledByStorm') deaths++;
      });
      m.set(p.userId, { kills, deaths });
    });
    return m;
  }, [matchData]);

  const playerStatsRef = useRef(playerStats);
  playerStatsRef.current = playerStats;

  const matchMinTs = useMemo(() => {
    if (!matchData) return 0;
    let min = Infinity;
    for (const p of matchData.players) for (const e of p.events) if (e.ts < min) min = e.ts;
    return min === Infinity ? 0 : min;
  }, [matchData]);

  // Reset zoom/pan when map changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
  }, [selectedMap]);

  // Non-passive wheel handler (needs preventDefault to stop page scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width;
      const cy = (e.clientY - rect.top) / rect.height;
      const oldZoom = zoomRef.current;
      // Delta-proportional: fast scroll = bigger zoom step; trackpad stays smooth
      const factor = Math.pow(0.998, e.deltaY);
      const newZoom = Math.max(1, Math.min(5, oldZoom * factor));
      if (newZoom === oldZoom) return;
      // Keep the point under cursor fixed while zooming
      const oldPan = panRef.current;
      const ratio = newZoom / oldZoom;
      const newPan = {
        x: (cx - 0.5) * (1 - ratio) + oldPan.x * ratio,
        y: (cy - 0.5) * (1 - ratio) + oldPan.y * ratio,
      };
      // Clamp so map edges don't go past container edges
      const maxPan = (newZoom - 1) / (2 * newZoom);
      newPan.x = Math.max(-maxPan, Math.min(maxPan, newPan.x));
      newPan.y = Math.max(-maxPan, Math.min(maxPan, newPan.y));
      setZoom(newZoom);
      setPan(newPan);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomRef.current <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;

    // Drag-to-pan
    if (isDraggingRef.current) {
      const dx = (e.clientX - dragStartRef.current.mouseX) / rect.width;
      const dy = (e.clientY - dragStartRef.current.mouseY) / rect.height;
      const z = zoomRef.current;
      const newPan = {
        x: dragStartRef.current.panX + dx / z,
        y: dragStartRef.current.panY + dy / z,
      };
      const maxPan = (z - 1) / (2 * z);
      newPan.x = Math.max(-maxPan, Math.min(maxPan, newPan.x));
      newPan.y = Math.max(-maxPan, Math.min(maxPan, newPan.y));
      setPan(newPan);
      setCrosshair({ x: cx, y: cy });
      return;
    }

    setCrosshair({ x: cx, y: cy });
    setOnMap(true);

    // Convert cursor position to map-space (accounts for zoom + pan)
    const z = zoomRef.current;
    const p = panRef.current;
    const rx = (cx - 0.5 - p.x) / z + 0.5;
    const ry = (cy - 0.5 - p.y) / z + 0.5;

    setWorldPos({
      x: mapCfg.originX + rx * mapCfg.scale,
      z: mapCfg.originZ + (1 - ry) * mapCfg.scale,
    });

    // Event hover detection (replay mode only) — hit radius shrinks with zoom
    if (appModeRef.current === 'replay') {
      const HIT = 0.022 / z;
      let best: typeof visibleEventsRef.current[0] | null = null;
      let bestDist = HIT;
      for (const evt of visibleEventsRef.current) {
        const dx = evt.rx - rx, dy = evt.ry - ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; best = evt; }
      }
      if (best) {
        const ps = playerStatsRef.current.get(best.userId) ?? { kills: 0, deaths: 0 };
        setHoveredEvent({ type: best.type, icon: best.icon, userId: best.userId, ts: best.ts, color: best.color, kills: ps.kills, deaths: ps.deaths });
      } else {
        setHoveredEvent(null);
      }
    } else {
      setHoveredEvent(null);
    }
  }, [mapCfg]);

  const handleMouseLeave = useCallback(() => {
    setOnMap(false);
    setIsDragging(false);
    setHoveredEvent(null);
  }, []);

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

  // Radar sweep animation
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!matchLoading && !radarAcquired) {
      cancelAnimationFrame(radarRafRef.current);
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      return;
    }

    const drawRadar = () => {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const cx = CANVAS_SIZE / 2;
      const cy = CANVAS_SIZE / 2;
      const maxR = CANVAS_SIZE * 0.72;

      // Dark tint
      ctx.fillStyle = 'rgba(7,6,11,0.55)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Concentric rings
      for (let i = 1; i <= 4; i++) {
        const r = (maxR / 4) * i;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,138,0,${0.06 + i * 0.02})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Cross hairs
      ctx.strokeStyle = 'rgba(255,138,0,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, CANVAS_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(CANVAS_SIZE, cy); ctx.stroke();

      if (!radarAcquired) {
        // Rotating sweep line
        const angle = radarAngleRef.current;
        const sweepX = cx + Math.cos(angle) * maxR;
        const sweepY = cy + Math.sin(angle) * maxR;

        // Trailing glow arc (120° behind the sweep line)
        const trailGrad = ctx.createConicalGradient
          ? null // fallback below
          : null;

        // Draw trail as multiple arc segments
        const TRAIL = Math.PI * 0.65;
        for (let i = 0; i < 32; i++) {
          const t = i / 32;
          const a0 = angle - TRAIL * (1 - t);
          const a1 = angle - TRAIL * (1 - (i + 1) / 32);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, maxR, a0, a1);
          ctx.closePath();
          ctx.fillStyle = `rgba(255,138,0,${t * 0.18})`;
          ctx.fill();
        }

        // Sweep line
        const lineGrad = ctx.createLinearGradient(cx, cy, sweepX, sweepY);
        lineGrad.addColorStop(0, 'rgba(255,138,0,0)');
        lineGrad.addColorStop(0.5, 'rgba(255,138,0,0.4)');
        lineGrad.addColorStop(1, 'rgba(255,138,0,0.9)');
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sweepX, sweepY);
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff8a00';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff8a00';
        ctx.fill();
        ctx.shadowBlur = 0;

        radarAngleRef.current += 0.045;
        radarRafRef.current = requestAnimationFrame(drawRadar);
      } else {
        // Acquired: full green ring flash
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(52,211,153,0.7)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#34d399';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    radarRafRef.current = requestAnimationFrame(drawRadar);
    return () => cancelAnimationFrame(radarRafRef.current);
  }, [matchLoading, radarAcquired]);

  // When loading finishes, flash "ACQUIRED" then clear
  useEffect(() => {
    if (!matchLoading) return;
    return () => {
      // matchLoading just went false
      setRadarAcquired(true);
      if (acquiredTimerRef.current) clearTimeout(acquiredTimerRef.current);
      acquiredTimerRef.current = setTimeout(() => setRadarAcquired(false), 700);
    };
  }, [matchLoading]);

  // Reveal phase: hide map when loading starts
  useEffect(() => {
    if (matchLoading) setRevealPhase('hidden');
  }, [matchLoading]);

  // Reveal phase: when both flags clear, run the smooth reveal
  useEffect(() => {
    if (matchLoading || radarAcquired) return;
    if (revealPhaseRef.current !== 'hidden') return;
    setRevealPhase('revealing');
    const timer = setTimeout(() => setRevealPhase('visible'), 700);
    return () => clearTimeout(timer);
  }, [matchLoading, radarAcquired]);

  // Main canvas draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // ── ANALYTICS MODE ──
    if (appMode === 'analytics') {
      // Use per-match computed cells when a match is loaded; fall back to aggregate
      const data = matchAnalytics ?? analyticsData[selectedMap];
      if (data) {
        drawAnalyticsOverlay(ctx, data.cells, data.gridSize, analyticsOverlay, heatmapOpacity);
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

      if ((p.isBot || layers.paths) && posEvents.length > 0) {
        // Landing marker — diamond at first position
        const first = posEvents[0];
        const { px: fpx, py: fpy } = worldToPixel(first.x, first.z, selectedMap);
        ctx.save();
        ctx.globalAlpha = isLit ? 0.6 : 0.06;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        const ds = 7;
        ctx.beginPath();
        ctx.moveTo(fpx, fpy - ds); ctx.lineTo(fpx + ds, fpy);
        ctx.lineTo(fpx, fpy + ds); ctx.lineTo(fpx - ds, fpy);
        ctx.closePath(); ctx.stroke();
        ctx.restore();

        // Path trail
        if (posEvents.length > 1) {
          ctx.save();
          ctx.globalAlpha = isLit ? (p.isBot ? 0.45 : 1) : (p.isBot ? 0.05 : 0.12);
          ctx.strokeStyle = color;
          ctx.lineWidth = p.isBot ? 1.5 : 3.5;
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          // Bots always dashed; humans follow pathStyle setting
          if (p.isBot || pathStyle === 'dotted') ctx.setLineDash(BOT_DASH_PATTERN);
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

        // Current position dot
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

        // End outcome marker — show once the terminal event has passed
        const status = getPlayerStatus(p);
        const lastEvt = p.events[p.events.length - 1];
        if (lastEvt && lastEvt.ts <= currentTime && status !== 'Active' && status !== 'Unknown') {
          const { px: epx, py: epy } = worldToPixel(last.x, last.z, selectedMap);
          ctx.save();
          ctx.globalAlpha = isLit ? 0.9 : 0.08;
          ctx.font = 'bold 13px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const outcomeGlyph = status === 'Extracted' ? '✓' : status === 'Killed' ? '☠' : '⚡';
          const outcomeColor = status === 'Extracted' ? '#34d399' : status === 'Killed' ? '#f87171' : '#a78bfa';
          ctx.fillStyle = outcomeColor;
          ctx.shadowBlur = 8; ctx.shadowColor = outcomeColor;
          ctx.fillText(outcomeGlyph, epx + 12, epy - 12);
          ctx.shadowBlur = 0;
          ctx.restore();
        }
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

    // Draw AI highlights on top in replay mode too
    if (aiHighlightZones.length > 0) {
      drawAiHighlights(ctx, aiHighlightZones, selectedMap, pulseRef.current);
    }
  }, [appMode, matchData, matchAnalytics, currentTime, selectedMap, layers, pathStyle, highlightedPlayerId, analyticsData, analyticsOverlay, heatmapOpacity, aiHighlightZones]);

  // Re-draw when AI pulse changes
  useEffect(() => {
    if (aiHighlightZones.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = analyticsData[selectedMap];
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (data && appMode === 'analytics') {
      drawAnalyticsOverlay(ctx, data.cells, data.gridSize, analyticsOverlay, heatmapOpacity);
    }
    drawAiHighlights(ctx, aiHighlightZones, selectedMap, pulseRef.current);
  });

  const imgUrl = (BASE.endsWith('/') ? BASE.slice(0, -1) : BASE) + mapCfg.imageUrl;

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-[#09090b] overflow-hidden"
      ref={containerRef}
      onMouseEnter={() => setOnMap(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : undefined }}
    >
      {/* Map + canvas — zoom/pan applied here only */}
      <div
        className="relative w-full h-full"
        style={{
          transform: zoom > 1 ? `translate(${pan.x * 100}%, ${pan.y * 100}%) scale(${zoom})` : undefined,
          transformOrigin: 'center center',
          willChange: zoom > 1 ? 'transform' : undefined,
        }}
      >
        <img
          src={imgUrl}
          alt={mapCfg.name}
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            opacity: revealPhase === 'hidden' ? 0 : (appMode === 'replay' ? 0.88 : 0.6),
            filter: revealPhase === 'hidden'
              ? 'brightness(0.2) saturate(0)'
              : 'brightness(1.05) contrast(1.04) saturate(0.85)',
            transition: revealPhase === 'revealing'
              ? 'opacity 700ms ease, filter 700ms ease'
              : 'none',
          }}
        />
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            zIndex: 10,
            opacity: revealPhase === 'hidden' ? 0 : 1,
            transition: revealPhase === 'revealing' ? 'opacity 700ms ease 250ms' : 'none',
          }}
        />
        {/* Black mask — always in DOM, fades out via CSS transition */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 14,
            background: '#07060b',
            opacity: revealPhase === 'hidden' ? 1 : 0,
            transition: revealPhase === 'revealing' ? 'opacity 700ms ease' : 'none',
          }}
        />
        {/* Radar sweep canvas — sits above mask */}
        <canvas
          ref={radarCanvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ zIndex: 15 }}
        />
        <div
          className="scanlines absolute inset-0"
          style={{
            zIndex: 16,
            opacity: revealPhase === 'hidden' ? 0 : 1,
            transition: revealPhase === 'revealing' ? 'opacity 700ms ease 300ms' : 'none',
          }}
        />
        <div className="map-vignette absolute inset-0" style={{ zIndex: 17 }} />
      </div>

      {/* Edge vignette — blends map background into app background, stays outside zoom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 13,
          background: 'radial-gradient(ellipse at center, transparent 52%, #09090b 88%)',
        }}
      />

      {/* Corner brackets */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        <CornerBrackets color="#ff8a00" size={22} thickness={1.5} />
      </div>

      {/* Top-left HUD */}
      <div className="absolute top-6 left-6 pointer-events-none" style={{ zIndex: 21 }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#ff8a00', textShadow: '0 0 16px rgba(255,138,0,0.6)' }}>
          {mapCfg.name}
        </div>
        {matchLoading ? (
          <div className="font-mono flex items-center gap-1.5" style={{ fontSize: 9, color: 'rgba(255,138,0,0.8)', letterSpacing: '0.1em', marginTop: 2 }}>
            <span style={{ animation: 'blink 0.7s step-end infinite' }}>▶</span>
            ACQUIRING MATCH DATA
          </div>
        ) : radarAcquired ? (
          <div className="font-mono" style={{ fontSize: 9, color: '#34d399', letterSpacing: '0.1em', marginTop: 2 }}>
            ✓ MATCH ACQUIRED
          </div>
        ) : (
          <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            {worldPos.x.toFixed(0)} · {worldPos.z.toFixed(0)}
          </div>
        )}
        {appMode === 'analytics' && (
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,138,0,0.7)', marginTop: 2, textTransform: 'uppercase' }}>
            Analytics Mode
          </div>
        )}
      </div>

      {/* Top-right HUD — replay only */}
      {appMode === 'replay' && matchData && (
        <div className="absolute top-6 right-14 pointer-events-none text-right" style={{ zIndex: 21 }}>
          <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ color: 'rgba(96,165,250,0.8)', fontWeight: 700 }}>{matchData.players.filter(p => !p.isBot).length}H</span>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}> · </span>
            <span style={{ color: 'rgba(255,138,0,0.8)', fontWeight: 700 }}>{matchData.players.filter(p => p.isBot).length}B</span>
          </div>
        </div>
      )}

      {/* Zoom controls — always visible, bottom-right (offset 64px to clear the 48px RightToolbar) */}
      <div
        className="absolute bottom-5 flex flex-col items-center"
        style={{ zIndex: 22, right: 64, gap: 1 }}
      >
        <button
          onClick={() => {
            const newZoom = Math.min(5, zoomRef.current * 1.3);
            const maxPan = (newZoom - 1) / (2 * newZoom);
            const p = panRef.current;
            setPan({ x: Math.max(-maxPan, Math.min(maxPan, p.x)), y: Math.max(-maxPan, Math.min(maxPan, p.y)) });
            setZoom(newZoom);
          }}
          title="Zoom in"
          style={{
            width: 24, height: 24,
            background: 'rgba(8,7,12,0.85)',
            border: '1px solid rgba(255,138,0,0.25)',
            color: 'rgba(255,138,0,0.8)',
            fontSize: 14, lineHeight: 1,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
        <div
          className="font-mono"
          style={{
            width: 24, height: 20,
            background: 'rgba(8,7,12,0.85)',
            border: '1px solid rgba(255,138,0,0.15)',
            borderTop: 'none', borderBottom: 'none',
            color: zoom > 1 ? '#ff8a00' : 'rgba(255,255,255,0.25)',
            fontSize: 8, letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{zoom.toFixed(1)}×</div>
        <button
          onClick={() => {
            if (zoomRef.current <= 1) return;
            const newZoom = Math.max(1, zoomRef.current / 1.3);
            if (newZoom <= 1) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
            const maxPan = (newZoom - 1) / (2 * newZoom);
            const p = panRef.current;
            setPan({ x: Math.max(-maxPan, Math.min(maxPan, p.x)), y: Math.max(-maxPan, Math.min(maxPan, p.y)) });
            setZoom(newZoom);
          }}
          title="Zoom out"
          style={{
            width: 24, height: 24,
            background: 'rgba(8,7,12,0.85)',
            border: '1px solid rgba(255,138,0,0.25)',
            color: zoom > 1 ? 'rgba(255,138,0,0.8)' : 'rgba(255,255,255,0.2)',
            fontSize: 14, lineHeight: 1,
            cursor: zoom > 1 ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >−</button>
        {zoom > 1 && (
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title="Reset zoom"
            className="font-mono"
            style={{
              width: 24, height: 16,
              background: 'rgba(255,138,0,0.1)',
              border: '1px solid rgba(255,138,0,0.3)',
              borderTop: 'none',
              color: '#ff8a00',
              fontSize: 7, letterSpacing: '0.06em',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >FIT</button>
        )}
      </div>

      {/* AI zones label */}
      {aiHighlightZones.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 22 }}>
          <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,138,0,0.3)', backdropFilter: 'blur(4px)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#ff8a00', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10, color: '#ff8a00', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {aiHighlightZones.length} zone{aiHighlightZones.length !== 1 ? 's' : ''} highlighted
            </span>
          </div>
        </div>
      )}

      {/* Crosshair lines — subtle guide only */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        <div className="absolute w-full" style={{ top: `${crosshair.y * 100}%`, height: 1, background: 'rgba(245,158,11,0.1)' }} />
        <div className="absolute h-full" style={{ left: `${crosshair.x * 100}%`, width: 1, background: 'rgba(245,158,11,0.1)' }} />
      </div>

      {/* Unified map tooltip — event card takes priority over coord card */}
      {(hoveredEvent || onMap) && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${crosshair.x * 100}%`,
            top: `${crosshair.y * 100}%`,
            transform: crosshair.x > 0.72
              ? 'translate(calc(-100% - 14px), 10px)'
              : 'translate(14px, 10px)',
            zIndex: 26,
          }}
        >
          {hoveredEvent ? (
            /* ── Merged event card ── */
            <div
              style={{
                background: 'rgba(8,7,12,0.95)',
                border: `1px solid ${hoveredEvent.color}55`,
                backdropFilter: 'blur(10px)',
                padding: '8px 12px',
                minWidth: 160,
              }}
            >
              {/* Row 1: icon + event type */}
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, color: hoveredEvent.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {hoveredEvent.icon} {hoveredEvent.type}
              </div>
              {/* Row 2: player ID · zone */}
              <div className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                {hoveredEvent.userId.slice(0, 12)} · {getMacroZone(crosshair.x, crosshair.y)}
              </div>
              {/* Row 3: coords · relative time */}
              <div className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                ({worldPos.x.toFixed(0)}, {worldPos.z.toFixed(0)}) · {fmtRelTime(hoveredEvent.ts - matchMinTs)}
              </div>
              {/* Row 4: K/D divider */}
              <div
                className="font-mono flex gap-3 mt-2 pt-2"
                style={{ fontSize: 8, borderTop: `1px solid ${hoveredEvent.color}22` }}
              >
                <span style={{ color: '#ef4444' }}>K: {hoveredEvent.kills}</span>
                <span style={{ color: '#f97316' }}>D: {hoveredEvent.deaths}</span>
              </div>
            </div>
          ) : (
            /* ── Coord-only card (no event nearby) ── */
            <div
              style={{
                background: 'rgba(8,7,12,0.92)',
                border: '1px solid rgba(255,138,0,0.3)',
                backdropFilter: 'blur(10px)',
                padding: '7px 11px',
                minWidth: 130,
              }}
            >
              <div className="font-mono" style={{ fontSize: 8, color: 'rgba(255,138,0,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                {getMacroZone(crosshair.x, crosshair.y)}
              </div>
              <div className="font-mono tabular-nums" style={{ fontSize: 11, fontWeight: 700, color: '#ff8a00' }}>
                {worldPos.x.toFixed(0)}, {worldPos.z.toFixed(0)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map legend — replay mode only */}
      {appMode === 'replay' && (
        <div
          className="absolute bottom-5 left-4 pointer-events-none"
          style={{ zIndex: 21 }}
        >
          <div
            style={{
              background: 'rgba(8,7,12,0.78)',
              border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: 'blur(6px)',
              padding: '6px 9px',
            }}
          >
            {[
              { icon: '✕', label: 'Kill',         color: '#ef4444' },
              { icon: '✕', label: 'Bot Kill',     color: '#ec4899' },
              { icon: '☠', label: 'Eliminated',   color: '#f97316' },
              { icon: '⚡', label: 'Storm Death',  color: '#a855f7' },
              { icon: '◆', label: 'Loot',          color: '#22c55e' },
            ].map(({ icon, label, color }) => (
              <div key={label} className="flex items-center gap-1.5" style={{ marginBottom: 3 }}>
                <span style={{ fontSize: 9, color, width: 10, textAlign: 'center', lineHeight: 1 }}>{icon}</span>
                <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.04em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
