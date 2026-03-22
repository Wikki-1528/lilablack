# Architecture — LILA BLACK Player Journey Visualizer

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Data pipeline | Python 3, pandas, PyArrow | One-time parquet→JSON conversion. PyArrow reads extensionless parquet files natively |
| Frontend | React 19 + TypeScript + Vite 7 | Fast build, type safety, modern DX |
| State | Zustand 5 | Single flat store, no boilerplate, reactive canvas redraws |
| Rendering | HTML5 Canvas (1024×1024) | 50+ animated player paths would thrash SVG/DOM. Canvas handles thousands of draw calls per frame within 16ms budget |
| Styling | Tailwind CSS v4 | Dark gaming theme with amber accent matching LILA BLACK's HUD |
| AI | Groq API (Llama 3.3 70B) | Fast inference, free tier; falls back to Gemini 2.0 Flash |
| Hosting | Static files on EC2 + Nginx + SSL | No runtime server needed — all data is pre-baked JSON |

---

## Data Flow

```
1,246 parquet files (Feb 10-14, 5 folders)
        │
        ▼  [build time — pipeline/process_data.py]
    Read with PyArrow
    Decode event bytes (b'Position' → "Position")
    Detect human/bot (UUID = human, numeric = bot)
    Group files by match_id → 796 matches
    Aggregate 48×48 heatmap grids per map (3 files)
        │
        ▼
    public/data/
      index.json (152 KB) — 796 match summaries with kill/loot/event counts
      matches/{id}.json (avg 10 KB, max 86 KB) — per-match player events
      analytics/{map}.json (~174 KB each) — pre-aggregated heatmap grids
        │
        ▼  [runtime — browser]
    Fetch index.json on startup → auto-select richest AmbroseValley match
    Fetch match JSON on selection → render paths + events on canvas
    All 3 analytics JSONs pre-loaded in parallel → instant map switching
    Per-match analytics computed on-the-fly in browser from event data
```

**Why no backend/database:** The dataset is static (89K events, read-only) and small enough (~8 MB total JSON) to serve as static files. A database would add hosting cost and a failure point for zero benefit.

---

## Coordinate Mapping

The minimap images are 1024×1024 pixels.

| Map | scale | originX | originZ |
|-----|-------|---------|---------|
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

```
u = (worldX - originX) / scale        → 0 to 1
v = (worldZ - originZ) / scale        → 0 to 1
pixelX = u × 1024
pixelY = (1 - v) × 1024               ← Z-axis flipped (image origin is top-left)
```

**Validation:** 0% of events fall outside the 0–1 UV range across all three maps.

---

## Assumptions

- **Extraction inference:** No explicit "Extracted" event exists. Players whose last event is Position or Loot are inferred as extracted. Players ending with Killed/BotKilled/KilledByStorm are marked accordingly.
- **Bot presence via botKills:** Bot parquet files are frequently absent even when bots were in the match. The `botKills` count (from human BotKill events) is the reliable signal for bot presence — not the bot file count. The UI shows `~N` inferred bot count when `botKills > bots`.
- **Timestamps:** Stored as Unix seconds in JSON. The frontend multiplies by 1000 for JavaScript ms. Match duration is computed as max(ts) − min(ts) across all players.
- **Duplicate timestamps:** 729/796 matches have events sharing the same second. All events are kept — no deduplication.
- **PvP rarity:** Only 3 human-vs-human kills exist in 796 matches. Most matches track only 1 human player.

---

## Analytics: Dual Data Sources

Analytics mode uses two data sources depending on context:

### 1. Aggregate analytics (`public/data/analytics/{map}.json`)
Pre-baked 48×48 grid across **all matches** for a map. Loaded at startup, used as the default when no match is selected. Produced by `pipeline/process_data.py`.

### 2. Per-match analytics (computed on-the-fly)
`computeMatchAnalytics()` in `MapViewer.tsx` derives a fresh `GridCell[]` grid from the already-loaded match event data:

| Event type | Grid signal |
|---|---|
| `Position` | human traffic (`ht`) |
| `BotPosition` | bot traffic (`bt`) |
| `Kill` / `BotKill` | kills per cell (`k`) |
| `Killed` / `BotKilled` / `KilledByStorm` | deaths per cell (`d`) |
| `Loot` | loot density (`lo`) |
| `KilledByStorm` | storm deaths (`sd`) |
| First `Position` per player | hot-drop landing (`hd`) |

When a match is selected in Analytics mode, the per-match grid takes precedence over the aggregate. All 6 overlay types (traffic, K/D, dead zones, loot, hotdrop, bot-vs-human) reflect the selected match's data. Switching the match dropdown updates the heatmap immediately.

---

## AI: Graph-Structured RAG

The AI mode uses a custom zone-graph RAG pipeline — not a vector database. The knowledge base is the pre-aggregated `analyticsData[map]`.

### Pipeline

```
User question
      │
      ▼  [src/lib/aiGraph.ts — buildGraphContext()]
  1. Build zone graph
     48×48 grid cells aggregated into a 3×3 macro-zone graph
     (NW Corner · North · NE Corner · West · Central · East · SW Corner · South · SE Corner)
     Each zone: kills, deaths, human traffic, bot traffic, loot, storm deaths, hotdrops, K/D
     Edges computed between adjacent zones: kill_corridor · traffic_flow · bot_overlap

  2. Query-aware retrieval
     Keywords → intent classification → ranked zone subset:
       "kill/kd/danger"  → zones ranked by kills
       "drop/land/spawn" → zones ranked by hotdrops
       "storm/shrink"    → zones ranked by storm deaths
       "dead/empty"      → zero-traffic zones only
       "loot/item"       → zones ranked by loot density
       "bot/overlap"     → zones with both human + bot traffic
     Top 6 zones + up to 8 relevant edges selected

  3. Prompt construction
     [SYSTEM_PROMPT: role + strict JSON schema]
     ZONE GRAPH — {map} · {matchCount} matches
     GLOBAL: dead% · botOverlap% · avgKD · totalKills · totalLoot
     LANDMARKS: topKillZone · hotDrop · stormZone · deadZones[]
     NODES: name(worldX,worldZ): kills deaths ht bt loot storm hotdrops kd
     ZONE RELATIONSHIPS: ZoneA ↔ ZoneB [type strength=0.72] — note
     QUESTION: {user question}
      │
      ▼  [src/lib/aiApi.ts — callGroq() or callGemini()]
  Groq Llama 3.3 70B (primary) / Gemini 2.0 Flash (fallback)
  max_tokens=700, temperature=0.3
      │
      ▼  parseAIResponse()
  Strict JSON → { text, insight, charts[], zones[] }
  zones[] carry world coordinates → plotted on map as pulsing overlays
  charts[] rendered as inline bar charts in the chat panel
```

**Why graph RAG over vector RAG:** The telemetry is structured spatial data, not unstructured text. Zone relationships (adjacency, traffic flow, kill corridors) are the meaningful signal. A graph structure captures these relationships directly; vector similarity would flatten them.

**Config:** Set `VITE_GROQ_API_KEY` in `.env` for Groq (Llama 3.3 70B). Falls back to `VITE_GEMINI_API_KEY`, then to pre-computed demo responses.

---

## Tradeoffs

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Pre-processed static JSON | ✓ | DuckDB-WASM / runtime queries | 89K rows is small; JSON loads instantly, no WASM boot overhead |
| HTML5 Canvas | ✓ | SVG / DOM elements | 50+ animated paths with glow effects need GPU-backed rendering |
| 48×48 heatmap grid | ✓ | Per-pixel gaussian blur | Pre-aggregated grid is fast to render, clear signal even with sparse data |
| All analytics pre-loaded | ✓ | Lazy-load per map | 3 × 174 KB = 522 KB upfront; switching maps is instant |
| Per-match analytics on-the-fly | ✓ | Pre-baking per-match files | 796 extra JSON files vs one `useMemo` — trivial computation from already-loaded event data |
| Match scoring for auto-select | ✓ | Show first match / random | `playerCount × 20 + botKills × 5` surfaces the richest replay on first load |
| Graph-structured RAG | ✓ | Vector DB RAG | Spatial telemetry has explicit relationships; graph preserves adjacency and flow |
| Three app modes (Replay / Analytics / AI) | ✓ | Single cluttered view | Level Designers ask two distinct questions — "what happened?" (Replay) vs "what patterns exist?" (Analytics) |

---

## Component Breakdown

```
src/pages/Dashboard.tsx              — root page, data fetching, layout
│
├── src/components/TopBar.tsx        — top navigation bar (48px)
│   ├── Logo + mode tabs             Replay / Analytics / AI Insights
│   ├── Map selector                 3 maps, single-select
│   ├── Date picker                  February 2026 calendar (Feb 10–14 only)
│   └── Match dropdown               replay + analytics modes; human-first sort
│
├── src/components/LoadingScreen.tsx — full-screen boot animation (first load only)
│   ├── Staggered boot lines         5 system messages over 1.75s
│   ├── Progress bar                 RAF-animated over MIN_DISPLAY_MS (3s)
│   └── Fade-out                     triggers when data ready + min time elapsed
│
├── src/components/MapViewer.tsx     — center canvas (flex-1)
│   ├── <img>                        minimap PNG with filter adjustments
│   ├── <canvas 1024×1024>           all event overlays drawn here
│   ├── Radar sweep canvas           tactical sweep animation on match load (3s min)
│   ├── Cinematic reveal             revealPhase state machine: hidden→revealing→visible
│   │                                CSS transitions on map/canvas/scanlines after radar
│   ├── Zoom + pan                   scroll-wheel zoom 1×–5×, drag-to-pan when zoomed
│   │                                non-passive wheel listener, cursor-centered zoom
│   ├── Coordinate tooltip           instant on mouse-enter, world X/Z coords
│   ├── Event hit detection          radius scales with zoom (HIT = 0.022 / zoom)
│   └── Mode-aware rendering:
│       ├── Replay: paths · kills · deaths · loot · storm · bots
│       ├── Analytics: per-match grid (if match loaded) or aggregate; 6 overlay types
│       └── AI: analytics at 40% opacity + pulsing zone highlight circles
│
├── src/components/Timeline.tsx      — bottom bar (replay mode)
│   ├── Scrubber track               with event dots at exact timestamps
│   ├── RAF playback engine          TIME_COMPRESSION=10 (1 real ms = 10 match ms)
│   ├── Play/Pause/Skip controls
│   └── Alive counter                humans alive at currentTime
│
├── src/components/RightToolbar.tsx  — icon strip at right edge (48px)
│   ├── Layers icon                  → LayersPanel (replay)
│   ├── Heatmap icon                 → HeatmapPanel (analytics)
│   ├── Players icon                 → PlayersPanel (replay)
│   ├── Events icon                  → EventsPanel (replay)
│   └── Stats icon                  → StatsPanel (replay + analytics)
│   [opens automatically: Layers in replay, Heatmap in analytics]
│
├── src/components/ContextPanel.tsx  — slide-in panel (right side, overlays map)
│   └── Renders active panel:
│       ├── src/components/panels/LayersPanel.tsx   — toggle paths/kills/deaths/loot/storm/bots
│       ├── src/components/panels/HeatmapPanel.tsx  — 6 overlay buttons + opacity slider
│       ├── src/components/panels/PlayersPanel.tsx  — humans first, bots below; click to track
│       ├── src/components/panels/EventsPanel.tsx   — chronological event log
│       └── src/components/panels/StatsPanel.tsx    — per-match + map-wide aggregate stats
│
├── src/pages/AiModePage.tsx         — AI Insights layout (full-page)
│   ├── Left: MapViewer (50%)        analytics heatmap + zone highlight overlays
│   └── Right: Chat pane (50%)
│       ├── src/components/AIPanel.tsx   — message renderer (text · insight · charts · zones)
│       └── AiInputBar                   — input + suggested questions per map
│
└── src/components/KillFeed.tsx      — floating overlay (replay mode)
    └── Recent kill events           fades after 3.5s, max 8 items
```

### State management

A single flat Zustand store (`src/lib/store.ts`) holds all application state. No prop drilling, no context providers. Key defaults: `activePanel` opens to `'layers'` in replay and `'heatmap'` in analytics on mode switch.

### Playback engine

```typescript
// src/lib/constants.ts
const TIME_COMPRESSION = 10;   // 1 real ms → 10 match ms at 1×

// Timeline RAF loop
const msPerRealMs = playbackSpeed * TIME_COMPRESSION;
currentTime += deltaRealMs * msPerRealMs;
```

### Key source files

```
src/
├── hooks/
│   └── useAiChat.ts            AI chat state + Groq/Gemini calls + retry logic
└── lib/
    ├── store.ts                Zustand store (all app state)
    ├── types.ts                TypeScript interfaces + MAP_CONFIGS + coordinate helpers
    ├── constants.ts            TIME_COMPRESSION · CANVAS_SIZE · BOT_DASH_PATTERN
    ├── aiGraph.ts              zone graph builder + query-aware retrieval + RAG context
    └── aiApi.ts                Groq/Gemini callers · response parser · demo responses
```

---

## Match Counts by Map

| Map | Total | Feb 10 | Feb 11 | Feb 12 | Feb 13 | Feb 14 |
|-----|-------|--------|--------|--------|--------|--------|
| Ambrose Valley | 566 | 200 | 137 | 127 | 78 | 24 |
| Lockdown | 171 | 61 | 50 | 26 | 29 | 5 |
| Grand Rift | 59 | 24 | 13 | 9 | 5 | 8 |
| **Total** | **796** | 285 | 200 | 162 | 112 | 37 |

---

## What I'd Do With More Time

1. **Per-match AI context:** Feed `computeMatchAnalytics()` output into the RAG pipeline so AI answers reflect the selected match, not the all-time aggregate
2. **Telemetry enrichment:** Add `victimX`/`victimZ` to Kill events (kill distance + sightline analysis), `weaponId` (shotgun corridors vs sniper alleys), `StormCircleUpdate` events (animated storm boundary)
3. **Multi-player match reconstruction:** With more human files per match the Replay mode would show 8+ simultaneous players — the current dataset averages 1.6 files per match
4. **WebSocket live ingestion:** Connect to the Nakama game server for real-time match visualization instead of batch processing
5. **Exportable reports:** Let Level Designers export a heatmap with AI annotations as PNG/PDF for design review meetings

---

## Deployment (AWS EC2)

```
Internet → DNS (lilablack.heywikki.com)
    │
    ▼
EC2 Instance  [Ubuntu, t-series]
    │
    ├── Security Group
    │   ├── Inbound: 22  (SSH)
    │   ├── Inbound: 80  (HTTP → redirects to HTTPS)
    │   └── Inbound: 443 (HTTPS)
    │
    ├── Certbot / Let's Encrypt  (auto-renewing SSL)
    │
    └── nginx
        └── serves /home/ubuntu/lilablack/dist/ (static files)
            SPA fallback: try_files $uri $uri/ /index.html
```

### Build and deploy

```bash
# Local: build with API key baked in
echo "VITE_GROQ_API_KEY=your_key" > .env
npm run build

# Deploy to EC2
scp -i your-key.pem dist/index.html ubuntu@<IP>:/home/ubuntu/lilablack/dist/
scp -i your-key.pem dist/assets/* ubuntu@<IP>:/home/ubuntu/lilablack/dist/assets/
```

```nginx
server {
    listen 443 ssl;
    server_name lilablack.heywikki.com;
    root /home/ubuntu/lilablack/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ { expires 1y; add_header Cache-Control "public, immutable"; }
    location /data/ { expires 5m; add_header Cache-Control "public"; }
    gzip on;
    gzip_types text/plain application/javascript application/json text/css image/svg+xml;
}
```

| Resource | Cost |
|---|---|
| EC2 instance | ~$8–10/month |
| Data transfer (first 100 GB free) | $0 |
| Certbot SSL | Free |
| Groq API (free tier) | $0 |
