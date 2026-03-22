# LILA BLACK — Player Journey Visualizer

A map analytics tool for Level Designers to explore player behavior, combat patterns, and loot distribution across LILA BLACK's three maps using real match telemetry.

---

## Live Demo

**[http://\<EC2-IP-HERE\>](http://localhost)** ← will be updated after deployment

---

## What It Does

| Mode | Description |
|------|-------------|
| **Replay** | Watch any match unfold — player paths, kills, deaths, loot and storm events rendered on the minimap with a playback timeline (1×/2×/4×/8×) |
| **Analytics** | 7 heatmap overlays aggregated across all 796 matches — traffic, K/D ratio, dead zones, loot density, hot drops, bot vs human, storm clusters |
| **AI Insights** | Ask natural-language questions about the map; the AI highlights relevant zones directly on the minimap |

**Dataset:** 796 matches · 89,016 events · 245 human players · 3 maps (Feb 10–14, 2026)

---

## Run Locally

**Prerequisites:** Node.js 18+, npm (or pnpm: `npm i -g pnpm`)

```bash
git clone https://github.com/Wikki-1528/lilablack.git
cd lilablack
npm install
npm run dev
```

Open **http://localhost:5173**

> The app works immediately — processed JSON data is already committed to the repo. No backend, no database, no env vars required to explore Replay and Analytics modes.

> **AI Insights mode** uses Groq (Llama 3.3 70B) or Gemini 2.0 Flash. Without an API key it runs in demo mode — pre-computed responses from real match data. To enable live AI, copy `.env.example` to `.env` and add your key:
> ```
> VITE_GROQ_API_KEY=your_key_here
> # or
> VITE_GEMINI_API_KEY=your_key_here
> ```

---

## Re-run the Data Pipeline (optional)

Only needed if you have new parquet telemetry files. Python 3.9+ required.

```bash
cd pipeline
pip install -r requirements.txt
python process_data.py
```

Reads from `../Resourses/February_XX/` → writes to `../public/data/`

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Data pipeline | Python 3, pandas, PyArrow |
| Frontend | React 19, TypeScript, Vite |
| State | Zustand 5 |
| Map rendering | HTML5 Canvas (1024×1024) |
| Styling | Tailwind CSS v4 |
| AI | Groq (Llama 3.3 70B) / Gemini 2.0 Flash fallback |
| Hosting | AWS EC2 (t3.micro) + Nginx, static files |

---

## Project Structure

```
lilablack/
├── README.md
├── ARCHITECTURE.md                  ← tech decisions, data flow, coordinate mapping
├── INSIGHTS.md                      ← 3 data-backed gameplay insights
├── package.json                     ← frontend deps (React 19, Vite 7, Tailwind 4)
├── vite.config.ts
├── tsconfig.json
├── index.html
├── .env.example                     ← copy to .env and add AI key (optional)
│
├── src/
│   ├── pages/                       Dashboard · AiModePage
│   ├── components/                  TopBar · MapViewer · Timeline · RosterPanel
│   │                                AnalyticsPanel · AIPanel · KillFeed
│   ├── hooks/                       useAiChat
│   └── lib/                         store · types · colors · constants · aiGraph · aiApi
│
├── public/data/
│   ├── index.json                   796 match summaries (152 KB)
│   ├── matches/                     per-match events, 796 files (~8 MB total)
│   └── analytics/                   48×48 spatial grids, 3 maps (~174 KB each)
│
└── pipeline/
    ├── process_data.py              ← parquet → JSON pipeline (run once)
    └── requirements.txt
```

---

## Docs

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — stack choices, data pipeline, coordinate mapping, tradeoffs, EC2 deployment steps
- **[INSIGHTS.md](INSIGHTS.md)** — 3 gameplay insights derived from the telemetry data with design recommendations
