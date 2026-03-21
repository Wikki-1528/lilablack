# Architecture — LILA BLACK Player Journey Visualizer

## System Overview

The tool is a **fully static single-page application**. There is no application server, no database, and no API at runtime. Raw parquet telemetry is pre-processed once offline by a Python pipeline into static JSON files, which the browser loads directly from disk or a static file server.

This design choice keeps the stack minimal, eliminates backend operational overhead, and makes the tool trivially hostable anywhere — including EC2 with nginx serving flat files.

```
┌─────────────────────────────────────────────────────────────────────┐
│  OFFLINE (run once when new data arrives)                           │
│                                                                     │
│  Resourses/                                                         │
│  ├── February_10/ (parquet files)                                   │
│  ├── February_11/        │                                          │
│  ├── February_12/        │  Backend/process_data.py                 │
│  ├── February_13/        │  (pyarrow + pandas)                      │
│  └── February_14/        │                                          │
│                           ▼                                         │
│              public/data/index.json          ← match catalogue      │
│              public/data/matches/*.json      ← per-match events     │
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
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Pipeline

### Input

**1,243 `.parquet` files** located in `Resourses/February_XX/` directories (one file = one match).
Each file contains a table with columns: `match_id`, `user_id`, `event`, `x`, `y`, `z`, `ts`.

| Column | Raw type | Issue |
|---|---|---|
| `event` | `bytes` | Must decode to `str` |
| `ts` | `datetime64[ms]` | Must convert to `int64` (ms) for JSON |
| `x`, `y`, `z` | `float32` | Must cast to `float64` before rounding or precision artifacts appear |

### Processing steps (Backend/process_data.py)

```
For each date directory:
  For each .parquet file (= one match):
    1. Read file with pyarrow engine
    2. Decode event bytes → str
    3. ts: datetime64[ms] → int64  (gives Unix ms)
    4. x/y/z: float32 → float64 → round(2)
    5. Separate humans vs bots by userId prefix
    6. Group events by userId
    7. Write public/data/matches/{matchId}.json

  After all matches:
    8. Write public/data/index.json  (catalogue + aggregate stats)
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
```

### Output

| File | Description | Size |
|---|---|---|
| `public/data/index.json` | Match catalogue + aggregate stats | ~200KB |
| `public/data/matches/*.json` | One file per match (796 files) | ~8MB total, ~10KB avg |

**Runtime:** ~8.6 seconds for the full 1,243-file dataset on a standard laptop.

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
| Routing | Wouter |
| Package manager | pnpm 9 (workspace) |

### Component breakdown

```
src/pages/Dashboard.tsx          — root page, data fetching
│
├── src/components/Sidebar.tsx   — left panel (260px)
│   ├── Map selector             3 maps, single-select
│   ├── Date filter              Feb 10–14, single-select
│   ├── Match dropdown           sorted by activity richness score
│   ├── Layer toggles            paths · kills · deaths · loot · storm · bots
│   └── Heatmap controls         mode selector + opacity slider
│
├── src/components/MapViewer.tsx — center canvas (flex-1)
│   ├── <img>                    minimap PNG (desaturated, 88% opacity)
│   ├── <canvas 1024×1024>       all event overlays drawn here
│   ├── Scanlines overlay        decorative 3px repeating gradient
│   ├── Vignette overlay         radial gradient darkening edges
│   └── HUD elements             map name · world coords · corner brackets
│
├── src/components/Timeline.tsx  — bottom bar (72px fixed height)
│   ├── Scrubber track           with event dots at exact timestamps
│   ├── RAF playback engine      1×/2×/4×/8× speed
│   ├── Play/Pause/Skip controls
│   └── Alive counter            humans still alive at currentTime
│
└── src/components/RightPanel.tsx — right panel (252px)
    ├── Match stats grid         kills · deaths · loot · storm · humans · bots
    ├── Tracking banner          shown when a player is isolated
    ├── Roster tab               scoreboard-style, click to track player
    └── Events tab               live feed of combat/loot events up to currentTime
```

### State management

A single flat Zustand store (`src/lib/store.ts`) holds all application state. No prop drilling, no Context API.

```typescript
interface VisualizerStore {
  // Selection
  selectedMap: string;
  selectedDate: string;
  selectedMatchId: string | null;

  // Loaded data
  indexData: IndexData | null;
  matchData: MatchData | null;

  // Timeline
  currentTime: number;      // Unix ms — current playback position
  minTime: number;          // earliest event ts in match
  maxTime: number;          // latest event ts in match
  isPlaying: boolean;
  playbackSpeed: number;    // 1 | 2 | 4 | 8

  // Layers
  layers: {
    paths: boolean;
    kills: boolean;
    deaths: boolean;
    loot: boolean;
    storm: boolean;
    bots: boolean;
  };

  // Heatmap
  heatmapMode: 'none' | 'kills' | 'deaths' | 'loot' | 'traffic';
  heatmapOpacity: number;   // 0.1 – 1.0

  // Player focus
  highlightedPlayerId: string | null;   // null = show all
  playerFilter: 'all' | 'humans' | 'bots';
}
```

### Map coordinate system

The canvas is fixed at 1024×1024 internal pixels, scaled to fill its container by CSS `object-contain`. The minimap `<img>` uses the same CSS class, so they stay perfectly aligned at any container size.

World game coordinates → canvas pixels:

```
World space (x, z):               Canvas space (px, py):
  x axis: left → right              px = (x - originX) / scale × 1024
  z axis: down → up (world)         py = (1 - (z - originZ) / scale) × 1024
                                     ↑ Y is flipped: world Z+ = canvas top
```

Map calibration values (`src/lib/types.ts`):

| Map | originX | originZ | scale |
|---|---|---|---|
| Ambrose Valley | -370 | -370 | 900 |
| Grand Rift | — | — | — |
| Lockdown | — | — | — |

### Playback engine

The timeline uses `requestAnimationFrame` with a real-time multiplier. The entire match is compressed to 30 seconds of wall time at 1× speed.

```typescript
// Calculated once when play starts:
const msPerRealMs = matchDuration / (30_000 / playbackSpeed);

// Each animation frame:
const delta = timestamp - lastTimestamp;   // real elapsed ms
currentTime += delta * msPerRealMs;        // advance match time
```

Speed table (30-second match example):

| Speed | Wall time to play full match |
|---|---|
| 1× | 30 seconds |
| 2× | 15 seconds |
| 4× | 7.5 seconds |
| 8× | ~4 seconds |

### Match ranking — richness score

Matches are sorted so the most action-dense match is auto-selected when a map/date is chosen:

```
score = (kills × 10) + (bots × 4) + (stormDeaths × 2) + (totalEvents × 0.01)
```

### Player isolation

Clicking a player in the roster sets `highlightedPlayerId`. The canvas `useEffect` and the roster both read this value:

- **Canvas:** non-highlighted players render at 8–12% global alpha (path, dots, markers all dimmed)
- **Roster:** non-highlighted rows render at 35% opacity
- **Tracking banner:** appears at top of right panel with a "Clear" button

---

## Deployment on AWS EC2

### Infrastructure

```
Internet
    │
    ▼
Route 53 (optional, DNS)
    │
    ▼
EC2 Instance  [t3.micro — Amazon Linux 2023]
    │
    ├── Security Group
    │   ├── Inbound: 22 (SSH, your IP only)
    │   ├── Inbound: 80 (HTTP, 0.0.0.0/0)
    │   └── Inbound: 443 (HTTPS, 0.0.0.0/0) ← if adding SSL
    │
    └── nginx
        └── serves /var/www/lilablack/dist/ (static files)
```

No load balancer, no RDS, no Lambda — the tool is entirely static files. A t3.micro ($0.01/hr) is more than sufficient.

---

### Step-by-step EC2 Setup

#### 1. Launch EC2 instance

In AWS Console:
- AMI: **Amazon Linux 2023** (free tier eligible)
- Instance type: `t3.micro`
- Key pair: create or use existing `.pem` file
- Security group — add inbound rules:
  - SSH: port 22, source = your IP
  - HTTP: port 80, source = 0.0.0.0/0

#### 2. SSH into the instance

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

#### 3. Install dependencies

```bash
# Update system
sudo dnf update -y

# Install nginx
sudo dnf install nginx -y

# Install Node.js 20 + pnpm
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install nodejs -y
sudo npm install -g pnpm

# Install git
sudo dnf install git -y
```

#### 4. Clone the repo and build

```bash
# Clone
cd /home/ec2-user
git clone https://github.com/Wikki-1528/lilablack.git
cd lilablack

# Install frontend dependencies
cd frontend/artifacts/lila-viz
pnpm install

# Build production bundle
pnpm build
# Output: frontend/artifacts/lila-viz/dist/
```

#### 5. Deploy static files

```bash
# Create web root directory
sudo mkdir -p /var/www/lilablack

# Copy the built files
sudo cp -r dist/* /var/www/lilablack/

# Set correct ownership
sudo chown -R nginx:nginx /var/www/lilablack
```

#### 6. Configure nginx

```bash
sudo nano /etc/nginx/conf.d/lilablack.conf
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name _;                          # catches all requests on port 80
                                            # replace _ with your domain if you have one

    root /var/www/lilablack;
    index index.html;

    # Serve the React SPA — all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively (JS/CSS/images have content hashes)
    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache JSON data files for 5 minutes
    location /data/ {
        expires 5m;
        add_header Cache-Control "public";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain application/javascript application/json text/css image/svg+xml;
    gzip_min_length 1024;
}
```

#### 7. Start nginx

```bash
# Test config is valid
sudo nginx -t

# Start nginx and enable on boot
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

#### 8. Open in browser

```
http://<EC2_PUBLIC_IP>
```

---

### Updating the deployment

When new match data or code changes are pushed to GitHub:

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

cd /home/ec2-user/lilablack

# Pull latest changes
git pull origin master

# Rebuild
cd frontend/artifacts/lila-viz
pnpm install          # only needed if package.json changed
pnpm build

# Re-deploy
sudo cp -r dist/* /var/www/lilablack/
sudo systemctl reload nginx
```

---

### Optional: Add HTTPS with Let's Encrypt

If you point a domain at the EC2 IP:

```bash
# Install certbot
sudo dnf install certbot python3-certbot-nginx -y

# Get certificate (replace with your actual domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
sudo systemctl status certbot-renew.timer
```

---

### Cost estimate

| Resource | Type | Cost |
|---|---|---|
| EC2 | t3.micro (on-demand) | ~$8/month |
| Storage | 8GB gp3 EBS (default) | ~$0.60/month |
| Data transfer | First 100GB/month free | $0 |
| **Total** | | **~$9/month** |

For an internal tool with low traffic, a t3.micro is entirely sufficient. It can serve thousands of concurrent users for a static site since nginx handles file serving with no compute per request.

---

## File Reference

```
lilablack/
├── .gitignore                              excludes: node_modules, parquet data, PDF
├── README.md                               setup + run instructions
├── ARCHITECTURE.md                         this document
├── INSIGHTS.md                             data-backed gameplay insights
│
├── Backend/
│   ├── process_data.py                     parquet → JSON pipeline (run offline)
│   └── requirements.txt                    pyarrow>=14.0.0, pandas>=2.0.0
│
└── frontend/
    ├── package.json                        pnpm workspace root
    ├── pnpm-workspace.yaml                 declares artifact packages
    ├── pnpm-lock.yaml                      lockfile for reproducible installs
    ├── tsconfig.base.json                  shared TS config
    │
    └── artifacts/lila-viz/                 THE DELIVERABLE APP
        ├── index.html                      SPA entry point
        ├── vite.config.ts                  build config (base URL, aliases)
        ├── tsconfig.json                   app-level TS config
        ├── package.json                    app dependencies
        │
        ├── public/
        │   ├── AmbroseValley_Minimap.png   map background images
        │   ├── GrandRift_Minimap.png
        │   ├── Lockdown_Minimap.jpg
        │   └── data/
        │       ├── index.json              match catalogue (committed)
        │       └── matches/                796 match JSON files (committed)
        │
        └── src/
            ├── main.tsx                    React entry point
            ├── App.tsx                     router (Wouter)
            ├── index.css                   global styles, Tailwind, brand vars
            │
            ├── pages/
            │   └── Dashboard.tsx           data loading, layout composition
            │
            ├── components/
            │   ├── MapViewer.tsx           canvas rendering engine + HUD
            │   ├── Sidebar.tsx             left control panel
            │   ├── Timeline.tsx            scrubber + playback engine
            │   └── RightPanel.tsx          roster + event feed
            │
            └── lib/
                ├── store.ts                Zustand store (all UI state)
                ├── types.ts                TypeScript interfaces + MAP_CONFIGS
                └── utils.ts                shared utilities
```
