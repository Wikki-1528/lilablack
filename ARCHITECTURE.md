# Architecture — LILA BLACK Player Journey Visualizer

## Overview

The tool is a **static-first** React single-page application. There is no backend server required to run it. Raw parquet telemetry is pre-processed once by a Python pipeline into static JSON files, which the frontend loads directly. This keeps the architecture simple, fast, and trivially deployable.

```
Raw Data (Parquet)
      │
      ▼
 Python Pipeline          Backend/process_data.py
      │
      ▼
 Static JSON              public/data/index.json
                          public/data/matches/{id}.json
      │
      ▼
 React App (Vite)         frontend/artifacts/lila-viz/
      │
      ▼
 Vite Build / Vercel      dist/ → static hosting
```

---

## Data Pipeline

**Input:** 1,243 `.parquet` files across 5 date directories (`February_10` – `February_14`), each file representing one match.

**Processing steps:**

1. Read each parquet file with `pyarrow` + `pandas`
2. Decode `event` column from bytes → string
3. Convert `ts` from `datetime64[ms]` → integer milliseconds (for JSON and arithmetic)
4. Cast `x`, `y`, `z` coordinates from `float32` → `float64` before rounding to avoid float32 precision artifacts (e.g. `-233.58` → `-233.5800018310547`)
5. Group events by `userId` within each match, classify players as human vs bot
6. Write one `{matchId}.json` per match, plus a global `index.json` with match metadata and aggregate stats

**Output size:** 796 match files · 8MB total · ~10KB average per match

**Runtime:** ~8.6 seconds on a standard laptop for the full dataset

### Key data types

```python
# Coordinate fix — must cast float32→float64 before rounding
df["x"] = df["x"].astype(float).round(2)

# Timestamp fix — astype int64 gives milliseconds from datetime64[ms]
df["ts"] = df["ts"].astype("int64")
```

---

## Frontend Architecture

**Stack:** React 19 · Vite 7 · TypeScript · Zustand · Tailwind CSS v4 · Lucide icons

### Component tree

```
Dashboard (pages/Dashboard.tsx)
├── Sidebar
│   ├── Map selector (3 maps)
│   ├── Date filter (Feb 10–14)
│   ├── Match dropdown (sorted by activity score)
│   ├── Layer toggles (paths, kills, deaths, loot, storm, bots)
│   └── Heatmap mode + opacity
├── MapViewer
│   ├── <img> — minimap background
│   ├── <canvas> 1024×1024 — all overlays rendered here
│   ├── Scanlines + vignette overlays
│   └── HUD (map name, coords, player count, corner brackets)
├── Timeline
│   ├── RAF-based playback engine
│   ├── Scrubber with event dots
│   └── Playback controls (play/pause, skip, speed)
└── RightPanel
    ├── Match stats grid
    ├── Player roster (scoreboard style, click to isolate)
    └── Live event feed
```

### State management

All UI state lives in a single Zustand store (`src/lib/store.ts`):

```typescript
{
  selectedMap, selectedDate, selectedMatchId,  // selection
  indexData, matchData,                         // loaded data
  currentTime, minTime, maxTime,               // timeline
  isPlaying, playbackSpeed,                    // playback
  layers,                                       // { paths, kills, deaths, loot, storm, bots }
  heatmapMode, heatmapOpacity,                 // heatmap
  highlightedPlayerId,                         // player isolation
  playerFilter,                                // roster filter
}
```

### Map rendering

The canvas uses a fixed **1024×1024 coordinate space** regardless of screen size. CSS `object-contain` scales both the minimap `<img>` and the `<canvas>` identically, so they stay pixel-aligned.

World coordinates → canvas pixels:

```typescript
function worldToPixel(x, z, mapId) {
  const { originX, originZ, scale } = MAP_CONFIGS[mapId];
  const u = (x - originX) / scale;   // [0, 1] horizontal
  const v = (z - originZ) / scale;   // [0, 1] vertical
  return {
    px: u * 1024,
    py: (1 - v) * 1024,              // Y axis flipped (Z+ = up in world)
  };
}
```

### Playback engine

RAF loop with a `msPerRealMs` multiplier:

```typescript
// 30 seconds of wall time = full match duration at 1× speed
const msPerRealMs = duration / (30_000 / playbackSpeed);
// each animation frame: currentTime += delta * msPerRealMs
```

### Match selection — richness scoring

Matches are sorted so the most interesting match is auto-selected:

```
score = kills × 10 + bots × 4 + stormDeaths × 2 + totalEvents × 0.01
```

### Player isolation

`highlightedPlayerId` in the store drives opacity on both the canvas layer and the right panel roster. When set, non-highlighted players render at 8–12% alpha.

---

## Deployment

The app is a static Vite build. Deploy `dist/` to any static host:

```bash
cd frontend/artifacts/lila-viz
pnpm build
# → dist/ is self-contained
```

For Vercel: connect the repo, set root to `frontend/artifacts/lila-viz`, build command `pnpm build`, output `dist`.
