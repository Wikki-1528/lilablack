# Architecture — LILA BLACK Player Journey Visualizer

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Data pipeline | Python 3, pandas, PyArrow | One-time parquet→JSON conversion. PyArrow reads extensionless parquet files natively |
| Frontend | React 19 + TypeScript + Vite | Fast build, type safety, modern DX |
| State | Zustand 5 | Single flat store, no boilerplate, reactive canvas redraws |
| Rendering | HTML5 Canvas (1024×1024) | 50+ animated player paths would thrash SVG/DOM. Canvas handles thousands of draw calls per frame within 16ms budget |
| Styling | TailwindCSS | Dark gaming theme with amber accent matching LILA BLACK's HUD |
| Hosting | Static files on EC2 + Nginx | No runtime server needed — all data is pre-baked JSON |

---

## Data Flow

```
1,246 parquet files (Feb 10-14, 5 folders)
        │
        ▼  [build time — process_data.py]
    Read with PyArrow
    Decode event bytes (b'Position' → "Position")
    Detect human/bot (UUID = human, numeric = bot)
    Group files by match_id → 796 matches
    Aggregate 48×48 heatmap grids per map
        │
        ▼
    public/data/
      index.json (152 KB) — 796 match summaries
      matches/{id}.json (avg 10 KB, max 86 KB) — per-match player events
      analytics/{map}.json (~174 KB each) — pre-aggregated heatmap grids
        │
        ▼  [runtime — browser]
    Fetch index.json on startup → populate filters
    Fetch match JSON on selection → render paths + events on canvas
    All 3 analytics JSONs pre-loaded in parallel → instant map switching
```

**Why no backend/database:** The dataset is static (89K events, read-only) and small enough (~8 MB total JSON) to serve as static files. A database would add hosting cost and a failure point for zero benefit. Adding new data requires re-running the pipeline — acceptable for batch analytics where data arrives in daily drops.

---

## Coordinate Mapping

The minimap images are 1024×1024 pixels. The README provides per-map calibration:

| Map | scale | originX | originZ |
|-----|-------|---------|---------|
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

Conversion:
```
u = (worldX - originX) / scale        → 0 to 1
v = (worldZ - originZ) / scale        → 0 to 1
pixelX = u × 1024
pixelY = (1 - v) × 1024               ← Z-axis flipped (image origin is top-left)
```

**Validation:** 0% of events fall outside the 0–1 UV range across all three maps. Every event in the dataset maps correctly within the minimap boundaries.

---

## Assumptions

- **Extraction inference:** No explicit "Extracted" event exists. Players whose last event is Position or Loot are inferred as extracted. Players ending with Killed/BotKilled/KilledByStorm are marked accordingly. This could mis-label a player who died after their last tracked event.
- **Bot presence via botKills:** Bot parquet files are frequently absent even when bots were in the match. The `botKills` count (from human BotKill events) is the reliable signal for bot presence — not the bot file count.
- **Timestamps:** Stored as Unix seconds in JSON. The frontend multiplies by 1000 for JavaScript ms. Match duration is computed as max(ts) − min(ts) across all players in a match. Average match: 6.8 minutes, longest: 14.8 minutes.
- **Duplicate timestamps:** 729/796 matches have events sharing the same second (e.g., BotKill + Loot + Position all fire simultaneously). All events are kept — no deduplication.
- **PvP rarity:** Only 3 human-vs-human kills exist in 796 matches. This appears to be a property of the dataset (most matches track only 1 human), not necessarily the game design.

---

## Tradeoffs

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Pre-processed static JSON | ✓ | DuckDB-WASM / runtime queries | 89K rows is small; JSON loads instantly, no WASM boot overhead |
| HTML5 Canvas | ✓ | SVG / DOM elements | 50+ animated paths with glow effects need GPU-backed rendering |
| 48×48 heatmap grid | ✓ | Per-pixel gaussian blur | Pre-aggregated grid is fast to render and produces clear signal even with partial data coverage |
| All analytics pre-loaded | ✓ | Lazy-load per map | 3 × 174 KB = 522 KB upfront; switching maps is instant with zero loading state |
| Match scoring for auto-select | ✓ | Show first match / random | `playerCount × 20 + botKills × 5` surfaces the richest replay on first load |
| Three app modes (Replay/Analytics/AI) | ✓ | Single cluttered view | Level Designers ask two distinct questions — "what happened?" (Replay) vs "what patterns exist?" (Analytics). Separating modes prevents UI overload |

---

## Component Breakdown

```
src/pages/Dashboard.tsx              — root page, data fetching, layout
│
├── src/components/TopBar.tsx        — top navigation bar (48px)
│   ├── Logo + mode tabs             Replay / Analytics / AI Insights
│   ├── Map selector                 3 maps, single-select
│   ├── Date picker                  February 2026 calendar (Feb 10–14 only)
│   └── Match dropdown               replay mode only, human-first sort
│
├── src/components/MapViewer.tsx     — center canvas (flex-1)
│   ├── <img>                        minimap PNG (desaturated)
│   ├── <canvas 1024×1024>           all event overlays drawn here
│   └── Mode-aware rendering:
│       ├── Replay: paths · kills · deaths · loot · storm · bots
│       ├── Analytics: 7 overlay types from spatial grid data
│       └── AI: analytics at 40% + pulsing zone highlights
│
├── src/components/Timeline.tsx      — bottom bar (replay mode)
│   ├── Scrubber track               with event dots at exact timestamps
│   ├── RAF playback engine          TIME_COMPRESSION=10 (1 real ms = 10 match ms)
│   ├── Play/Pause/Skip controls
│   └── Alive counter                humans alive at currentTime
│
├── src/components/RosterPanel.tsx   — right panel (replay mode)
│   ├── Match stats grid             kills · deaths · loot · storm
│   ├── Tracking banner              when player is isolated
│   └── Roster + Events tabs
│
├── src/components/AnalyticsPanel.tsx — right panel (analytics mode)
│   ├── Summary stats                dead zone % · avg K/D · overlap
│   └── 7 overlay selector buttons
│
├── src/components/AIPanel.tsx       — right panel (AI mode, display-only)
│   ├── Chat history renderer        renders messages, charts, zone badges
│   ├── AiInputBar                   input + suggested questions
│   └── useAiChat (hook)             all chat state lives in src/hooks/useAiChat.ts
│
└── src/components/KillFeed.tsx      — floating overlay (replay mode)
    └── Recent kill events           fades after 3.5s, max 8 items
```

### State management

A single flat Zustand store (`src/lib/store.ts`) holds all application state. No prop drilling, no context providers.

### Playback engine

The timeline uses `requestAnimationFrame` with a fixed time-compression constant. `TIME_COMPRESSION = 10` means every 1 real millisecond advances match time by 10 ms at 1× speed (a 12-minute match plays in ~75 seconds).

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
│   └── useAiChat.ts            AI chat state hook (extracted for reuse)
└── lib/
    ├── store.ts                Zustand store
    ├── types.ts                TypeScript interfaces + MAP_CONFIGS
    ├── colors.ts               brand colour palette (single source of truth)
    ├── constants.ts            named constants (TIME_COMPRESSION, CANVAS_SIZE, …)
    ├── aiGraph.ts              zone graph builder + RAG context string
    └── aiApi.ts                Groq / Gemini callers + response parser + demo responses
```

---

## What I'd Do With More Time

1. **Telemetry enrichment:** Add `victimX`/`victimZ` to Kill events (enables kill distance + sightline analysis), `weaponId` (identifies shotgun corridors vs sniper alleys), `itemCategory` on Loot, and `StormCircleUpdate` events (enables animated storm boundary)
2. **Multi-player match reconstruction:** With a richer dataset (more human files per match), the Replay mode would show 8+ players simultaneously — the current dataset averages 1.6 files per match
3. **WebSocket live ingestion:** Connect directly to the Nakama game server for real-time match visualization instead of batch processing
4. **Exportable reports:** Let Level Designers screenshot or export a heatmap with annotations as a PNG/PDF for design review meetings

---

## Deployment (AWS EC2)

```
Internet
    │
    ▼
EC2 Instance  [t3.micro — Amazon Linux 2023]
    │
    ├── Security Group
    │   ├── Inbound: 22 (SSH, your IP only)
    │   ├── Inbound: 80 (HTTP, 0.0.0.0/0)
    │   └── Inbound: 443 (HTTPS, optional)
    │
    └── nginx
        └── serves /var/www/lilablack/dist/ (static files)
```

No load balancer, no RDS, no Lambda — the tool is entirely static files. A t3.micro (~$8/month) is sufficient.

### Step-by-step setup

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

sudo dnf update -y && sudo dnf install nginx git -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install nodejs -y

git clone https://github.com/Wikki-1528/lilablack.git
cd lilablack
npm install
VITE_GEMINI_API_KEY=your_key_here npm run build

sudo mkdir -p /var/www/lilablack
sudo cp -r dist/* /var/www/lilablack/
sudo chown -R nginx:nginx /var/www/lilablack
```

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/lilablack;
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
| EC2 t3.micro | ~$8/month |
| 8GB gp3 EBS | ~$0.60/month |
| Data transfer (first 100GB free) | $0 |
