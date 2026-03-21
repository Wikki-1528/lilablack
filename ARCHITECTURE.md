# Architecture — LILA BLACK Player Journey Visualizer

## System Overview

The tool is a **fully static single-page application**. There is no application server, no database, and no API at runtime. Raw parquet telemetry is pre-processed once offline by a Python pipeline into static JSON files, which the browser loads directly from disk or a static file server.

This design choice keeps the stack minimal, eliminates backend operational overhead, and makes the tool trivially hostable anywhere — including EC2 with nginx serving flat files.

```
┌─────────────────────────────────────────────────────────────────────┐
│  OFFLINE (run once when new data arrives)                           │
│                                                                     │
│  Resourses/                                                         │
│  ├── February_10/ (1,246 parquet files across all 5 dates)         │
│  ├── February_11/        │                                          │
│  ├── February_12/        │  Backend/process_data.py                 │
│  ├── February_13/        │  (pyarrow + pandas)                      │
│  └── February_14/        │                                          │
│                           ▼                                         │
│    public/data/index.json             ← match catalogue (796 matches)│
│    public/data/matches/*.json         ← per-match events (796 files)│
│    public/data/analytics/{map}.json   ← 48×48 spatial grids (3 maps)│
└─────────────────────────────────────────────────────────────────────┘
                           │
                           │  (committed to git, served as static files)
                           │
┌─────────────────────────────────────────────────────────────────────┐
│  RUNTIME (served to browser)                                        │
│                                                                     │
│  EC2 (nginx)  ──serves──▶  React SPA (Vite build)                  │
│                                │                                    │
│                    ┌───────────┴───────────┐                        │
│                    │   Zustand store        │                        │
│                    └──┬────────────────┬───┘                        │
│                       │                │                            │
│               fetch index.json    fetch match.json                  │
│               (on load)           (on match select)                 │
│                                                                     │
│               fetch analytics/{map}.json  ← all 3 loaded on startup│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Pipeline

### Input

**1,246 `.parquet` files** located in `Resourses/February_XX/` directories.
Each file represents **one player's session in one match** — not one match per file.
Multiple files with the same `match_id` are merged to reconstruct the full match.

Each file contains a table with columns: `match_id`, `map_id`, `user_id`, `event`, `x`, `y`, `z`, `ts`.

| Column | Raw type | Issue |
|---|---|---|
| `event` | `bytes` | Must decode to `str` |
| `ts` | `datetime64[ms]` | Must convert to `int64` (ms) for JSON |
| `x`, `y`, `z` | `float32` | Must cast to `float64` before rounding or precision artifacts appear |
| `user_id` | `str` | UUID format = human player; numeric string (e.g. `"1412"`) = bot |

### Processing steps (Backend/process_data.py)

```
For each date directory:
  For each .parquet file (= one player session):
    1. Read file with pyarrow engine
    2. Decode event bytes → str
    3. ts: datetime64[ms] → int64  (gives Unix ms)
    4. x/y/z: float32 → float64 → round(2)
    5. Detect human vs bot by UUID regex on user_id
    6. Group events by user_id; merge into match by match_id

After all files are parsed (796 unique matches):
  7. Write public/data/matches/{matchId}.json   (one per match)
  8. Write public/data/index.json               (catalogue + stats)
  9. Build 48×48 spatial grid per map → write public/data/analytics/{mapId}.json
```

### Critical type fixes

```python
# Without this cast, float32 precision leaks into JSON:
# -233.58 becomes -233.5800018310547
df["x"] = df["x"].astype(float).round(2)   # float32 → float64 → round
df["y"] = df["y"].astype(float).round(2)
df["z"] = df["z"].astype(float).round(2)

# datetime64[ms] to integer ms — .astype("int64") is reliable on pandas 2+
df["ts"] = df["ts"].astype("int64")

# bytes → str
df["event"] = df["event"].apply(lambda b: b.decode("utf-8") if isinstance(b, bytes) else b)

# Bot detection — bots use numeric IDs, humans use UUIDs
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$", re.I)
is_human = lambda uid: bool(UUID_RE.match(uid))
```

### Output

| File | Description | Size |
|---|---|---|
| `public/data/index.json` | Match catalogue + aggregate stats | ~200KB |
| `public/data/matches/*.json` | One file per match (796 files) | ~8MB total, ~10KB avg |
| `public/data/analytics/AmbroseValley.json` | 48×48 spatial grid (all matches) | ~176KB |
| `public/data/analytics/GrandRift.json` | 48×48 spatial grid (all matches) | ~176KB |
| `public/data/analytics/Lockdown.json` | 48×48 spatial grid (all matches) | ~176KB |

**Runtime:** ~30 seconds for the full 1,246-file dataset on a standard laptop.

---

## Frontend Architecture

### Tech stack

| Concern | Library / Tool |
|---|---|
| UI framework | React 19 |
| Build tool | Vite 7 |
| Language | TypeScript 5 |
| State management | Zustand 5 |
| Styling | Tailwind CSS v4 |
| Map rendering | HTML5 Canvas (1024×1024) |
| Icons | Lucide React |
| Package manager | pnpm 9 (workspace) |

### Three-mode application

The tool has three distinct modes selectable from the top bar:

| Mode | Purpose |
|---|---|
| **Replay** | Watch a single match unfold — player paths, kills, deaths, loot, storm events on the minimap with timeline scrubber |
| **Analytics** | Map-wide heatmap overlays computed across all 796 matches — traffic, K/D ratio, dead zones, loot density, hot drops, bot vs human, storm clusters |
| **AI Insights** | Natural language Q&A powered by Gemini API — ask questions about player behavior; coordinates in the response are highlighted on the map |

### Component breakdown

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
│   ├── RAF playback engine          1×/2×/4×/8× speed
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
├── src/components/AIPanel.tsx       — right panel (AI mode)
│   ├── Gemini API chat              uses VITE_GEMINI_API_KEY env var
│   ├── Suggested questions          per-map presets
│   └── Zone parsing                 x=N, z=N regex → map highlights
│
└── src/components/KillFeed.tsx      — floating overlay (replay mode)
    └── Recent kill events           fades after 3.5s, max 8 items
```

### State management

A single flat Zustand store (`src/lib/store.ts`) holds all application state.

```typescript
interface VisualizerStore {
  // Mode
  appMode: 'replay' | 'analytics' | 'ai';

  // Selection
  selectedMap: string;
  selectedDate: string;
  selectedMatchId: string | null;

  // Loaded data
  indexData: IndexData | null;
  matchData: MatchData | null;
  analyticsData: Record<string, AnalyticsData>;  // pre-loaded for all 3 maps

  // Timeline
  currentTime: number;      // Unix ms — current playback position
  minTime: number;          // earliest event ts in match
  maxTime: number;          // latest event ts in match
  isPlaying: boolean;
  playbackSpeed: number;    // 1 | 2 | 4 | 8

  // Layers (replay mode)
  layers: { paths; kills; deaths; loot; storm; bots: boolean };

  // Analytics
  analyticsOverlay: 'traffic' | 'kd' | 'deadzone' | 'loot' | 'hotdrop' | 'botvhuman' | 'storm';

  // AI
  aiMessages: ChatMessage[];
  aiHighlightZones: AiHighlightZone[];
  geminiApiKey: string;     // from VITE_GEMINI_API_KEY env var, localStorage fallback

  // Player focus
  highlightedPlayerId: string | null;
  playerFilter: 'all' | 'humans' | 'bots';
}
```

### Map coordinate system

The canvas is fixed at 1024×1024 internal pixels, scaled to fill its container by CSS. The minimap `<img>` uses the same CSS class, so they stay perfectly aligned at any container size.

World game coordinates → canvas pixels:

```
World space (x, z):               Canvas space (px, py):
  x axis: left → right              px = (x - originX) / scale × 1024
  z axis: down → up (world)         py = (1 - (z - originZ) / scale) × 1024
                                     ↑ Z is flipped: world Z+ = canvas top
```

Map calibration values (`src/lib/types.ts`), derived by aligning known landmark coordinates with their visual positions on the minimap:

| Map | originX | originZ | scale |
|---|---|---|---|
| Ambrose Valley | -370 | -473 | 900 |
| Grand Rift | -290 | -290 | 581 |
| Lockdown | -500 | -500 | 1000 |

### Analytics spatial grid

The Python pipeline pre-computes a **48×48 cell grid** per map aggregated over all matches. Each cell stores:

```
ht  — human traffic (Position event count)
bt  — bot traffic (BotPosition event count)
k   — kills, d — deaths, kd — kill/death ratio
lo  — loot pickups, sd — storm deaths, hd — hot drop landings
```

Grid resolution: `scale / 48` world units per cell (~19–21 units depending on map). All 3 analytics files are loaded simultaneously on app startup so map switching is instant.

### Playback engine

The timeline uses `requestAnimationFrame` with a real-time multiplier. The entire match is compressed to 30 seconds of wall time at 1× speed.

```typescript
const msPerRealMs = matchDuration / (30_000 / playbackSpeed);
// Each frame: currentTime += delta * msPerRealMs
```

### Match auto-selection — human-first ranking

When a map/date is selected, the richest human match is auto-selected:

```
1. Matches with at least 1 human player rank above all bot-only matches
2. Among human matches: sort by kills × 10 + totalEvents × 0.01
```

This ensures the replay always shows a real player's journey. 16 of 796 matches are bot-only (no human joined); these appear at the bottom of the dropdown and are never auto-selected.

### Player isolation

Clicking a player in the roster sets `highlightedPlayerId`. Non-highlighted players render at 8–12% global alpha on canvas; their roster row renders at 35% opacity.

---

## Assumptions & Edge Cases

| Situation | How handled |
|---|---|
| Bot user ID format | Bots use numeric strings (`"1412"`), humans use UUIDs. UUID regex is the detection method. |
| Multiple players per parquet file key | Each `.parquet` file = one player's session. Files sharing a `match_id` are merged. |
| Bot position events | Bots emit `BotPosition` events (not `Position`). Analytics grid correctly routes these to `botTraffic`. |
| Out-of-bounds coordinates | ~0% of human position events fall outside map bounds. Out-of-bounds events are silently skipped in the grid builder. |
| Bot-only matches | 16 matches have 0 human players (bots joined but no human did). Included in analytics aggregates; excluded from auto-selection in replay. |
| GrandRift low match count | Only 59 matches (vs 566 for Ambrose Valley). Analytics grid is accurate but has lower statistical confidence. |

---

## Trade-offs

| Decision | Chosen | Alternative considered | Why |
|---|---|---|---|
| Static JSON vs live backend | Static JSON, pre-built | Express + SQLite query on demand | No infra to operate; 8MB total JSON fits comfortably; data is batch (not real-time) |
| 48×48 analytics grid | Fixed grid | Variable density / KDE | Simple, fast to compute, maps cleanly to canvas cells |
| Canvas vs SVG | Canvas | SVG | 50K+ events per match — SVG DOM would be too slow |
| Single Zustand store | Flat store | Context API / Redux | Less boilerplate; no prop drilling; store is the single source of truth |
| Gemini API (client-side) | Client-side with env key | Backend proxy | Keeps stack fully static; key is server-side env var baked at build time |

## What I'd Do Differently With More Time

- **Multi-player overlay** — most matches have 1 human + bots. With 2-human matches possible, add split-view or colour-coded multi-track support
- **Cross-match comparison** — overlay two matches on the same map to compare routing decisions
- **Bot behaviour analysis** — bots follow deterministic patrol paths; clustering those paths could reveal balance issues
- **Time-of-day filtering** — timestamps are in UTC ms; adding a session-time filter could reveal if human play patterns differ by time of day
- **Vercel/Netlify deployment** — EC2 works but Vercel would give instant HTTPS, CDN, and preview deployments for free

---

## Deployment on AWS EC2

### Infrastructure

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

No load balancer, no RDS, no Lambda — the tool is entirely static files. A t3.micro (~$8/month) is more than sufficient.

---

### Step-by-step EC2 Setup

#### 1. Launch EC2 instance

- AMI: **Amazon Linux 2023** (free tier eligible)
- Instance type: `t3.micro`
- Security group inbound: SSH port 22 (your IP), HTTP port 80 (0.0.0.0/0)

#### 2. SSH and install dependencies

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

sudo dnf update -y
sudo dnf install nginx git -y

curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install nodejs -y
sudo npm install -g pnpm
```

#### 3. Clone, build, deploy

```bash
git clone https://github.com/Wikki-1528/lilablack.git
cd lilablack/frontend/artifacts/lila-viz

pnpm install
VITE_GEMINI_API_KEY=your_key_here pnpm build

sudo mkdir -p /var/www/lilablack
sudo cp -r dist/* /var/www/lilablack/
sudo chown -R nginx:nginx /var/www/lilablack
```

#### 4. Configure nginx

```bash
sudo nano /etc/nginx/conf.d/lilablack.conf
```

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/lilablack;
    index index.html;

    location / { try_files $uri $uri/ /index.html; }

    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /data/ {
        expires 5m;
        add_header Cache-Control "public";
    }

    gzip on;
    gzip_types text/plain application/javascript application/json text/css image/svg+xml;
}
```

```bash
sudo nginx -t
sudo systemctl start nginx && sudo systemctl enable nginx
```

Open `http://<EC2_PUBLIC_IP>`

---

### Cost estimate

| Resource | Type | Cost |
|---|---|---|
| EC2 | t3.micro (on-demand) | ~$8/month |
| Storage | 8GB gp3 EBS | ~$0.60/month |
| Data transfer | First 100GB/month free | $0 |
| **Total** | | **~$9/month** |

---

## File Reference

```
lilablack/
├── .gitignore                              excludes: node_modules, parquet data, PDF
├── README.md                               setup + run instructions
├── ARCHITECTURE.md                         this document
├── INSIGHTS.md                             3 data-backed gameplay insights
│
├── Backend/
│   ├── process_data.py                     parquet → JSON pipeline (run offline)
│   └── requirements.txt                    pyarrow>=14.0.0, pandas>=2.0.0
│
└── frontend/
    ├── package.json                        pnpm workspace root
    ├── pnpm-workspace.yaml
    │
    └── artifacts/lila-viz/
        ├── .env.example                    VITE_GEMINI_API_KEY placeholder
        ├── index.html
        ├── vite.config.ts
        │
        ├── public/
        │   ├── AmbroseValley_Minimap.png
        │   ├── GrandRift_Minimap.png
        │   ├── Lockdown_Minimap.jpg
        │   └── data/
        │       ├── index.json              match catalogue (796 matches, ~200KB)
        │       ├── matches/                796 match JSON files (~8MB total)
        │       └── analytics/              3 spatial grid files (~176KB each)
        │           ├── AmbroseValley.json
        │           ├── GrandRift.json
        │           └── Lockdown.json
        │
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── index.css
            │
            ├── pages/
            │   └── Dashboard.tsx           data loading, layout, mode routing
            │
            ├── components/
            │   ├── TopBar.tsx              mode tabs · map · date · match selectors
            │   ├── MapViewer.tsx           canvas engine (replay + analytics + AI)
            │   ├── Timeline.tsx            scrubber + RAF playback
            │   ├── RosterPanel.tsx         player roster + event feed (replay)
            │   ├── AnalyticsPanel.tsx      overlay selector + summary (analytics)
            │   ├── AIPanel.tsx             Gemini chat + zone highlights (AI)
            │   └── KillFeed.tsx            floating kill feed overlay (replay)
            │
            └── lib/
                ├── store.ts                Zustand store
                ├── types.ts                TypeScript interfaces + MAP_CONFIGS
                └── utils.ts                shared utilities
```
