# LILA BLACK — Player Journey Visualizer

An internal analytics tool for Level Designers at Lila Games to explore player behavior on LILA BLACK maps using real match telemetry data.

![LILA BLACK Visualizer](frontend/artifacts/lila-viz/public/opengraph.jpg)

---

## What It Does

| Feature | Description |
|---|---|
| Map overlay | Player paths, kills, deaths, loot, storm events drawn on minimap |
| Timeline | Scrub or play back at 1×/2×/4×/8× speed |
| Heatmaps | Spatial density for kills, deaths, loot, and traffic |
| Player tracking | Click any player in the roster to isolate their individual journey |
| Match browser | 796 matches across 3 maps and 5 dates, sorted by activity |

## Dataset

| Map | Matches |
|---|---|
| Ambrose Valley | 566 |
| Lockdown | 171 |
| Grand Rift | 59 |
| **Total** | **796 matches · 89,016 events · 245 players** |

---

## Quickstart (Local)

### Prerequisites

- Node.js 18+
- pnpm 9+ → `npm i -g pnpm`
- Python 3.9+ (only needed to re-run the data pipeline)

### Run the app

The processed JSON data is already committed to this repo. You only need to build and serve the frontend:

```bash
git clone https://github.com/Wikki-1528/lilablack.git
cd lilablack/frontend/artifacts/lila-viz

pnpm install
pnpm dev
```

Open **http://localhost:5173**

> **Windows + Git Bash:** use `MSYS_NO_PATHCONV=1 pnpm dev`

### Re-run the data pipeline (optional)

Only needed if you have new parquet telemetry files:

```bash
cd Backend
pip install -r requirements.txt
python process_data.py
```

Reads from `../Resourses/February_XX/*.parquet` → writes to `frontend/artifacts/lila-viz/public/data/`

---

## Deploy to AWS EC2

### 1. Launch EC2 instance

- AMI: **Amazon Linux 2023**
- Type: `t3.micro` (~$8/month)
- Security group inbound rules:
  - Port 22 (SSH) — your IP only
  - Port 80 (HTTP) — 0.0.0.0/0

### 2. Install dependencies on EC2

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

sudo dnf update -y
sudo dnf install nginx git -y

# Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install nodejs -y
sudo npm install -g pnpm
```

### 3. Build and deploy

```bash
git clone https://github.com/Wikki-1528/lilablack.git
cd lilablack/frontend/artifacts/lila-viz

pnpm install
pnpm build

sudo mkdir -p /var/www/lilablack
sudo cp -r dist/* /var/www/lilablack/
sudo chown -R nginx:nginx /var/www/lilablack
```

### 4. Configure nginx

```bash
sudo nano /etc/nginx/conf.d/lilablack.conf
```

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/lilablack;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /data/ {
        expires 5m;
        add_header Cache-Control "public";
    }

    gzip on;
    gzip_types application/javascript application/json text/css image/svg+xml;
}
```

```bash
sudo nginx -t
sudo systemctl start nginx && sudo systemctl enable nginx
```

Open **http://\<EC2_PUBLIC_IP\>**

> Full EC2 setup details, HTTPS/SSL instructions, and update workflow are in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Project Structure

```
lilablack/
├── README.md
├── ARCHITECTURE.md          system design + EC2 deployment guide
├── INSIGHTS.md              3 data-backed gameplay insights
│
├── Backend/
│   ├── process_data.py      parquet → JSON pipeline
│   └── requirements.txt
│
└── frontend/
    └── artifacts/lila-viz/
        ├── src/
        │   ├── components/  MapViewer · Sidebar · Timeline · RightPanel
        │   ├── lib/         Zustand store · types · coordinate utils
        │   └── pages/       Dashboard (data loading)
        └── public/data/     generated JSON files (committed, 8MB)
```

---

## Deliverables

- [x] Player Journey Visualization Tool
- [x] Data pipeline (`Backend/process_data.py`)
- [x] Architecture + EC2 deployment guide (`ARCHITECTURE.md`)
- [x] Gameplay insights (`INSIGHTS.md`)
