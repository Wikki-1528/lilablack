#!/usr/bin/env python3
"""
LILA BLACK — Data Pipeline
Reads all parquet player files from Resourses/ and generates static JSON
files consumed by the lila-viz frontend.

Output:
  ../frontend/artifacts/lila-viz/public/data/index.json
  ../frontend/artifacts/lila-viz/public/data/matches/{matchId}.json

Usage:
  pip install pyarrow pandas
  python process_data.py
"""

import json
import os
import re
import shutil
import time
from collections import defaultdict
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

# ── Paths ──────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
ROOT_DIR     = SCRIPT_DIR.parent
RESOURSES    = ROOT_DIR / "Resourses"
OUTPUT_DIR   = ROOT_DIR / "frontend" / "artifacts" / "lila-viz" / "public" / "data"
MATCHES_DIR  = OUTPUT_DIR / "matches"

DATES = [
    "February_10",
    "February_11",
    "February_12",
    "February_13",
    "February_14",
]

# Human user_id is a UUID, bot is a short numeric string
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def is_human(user_id: str) -> bool:
    return bool(UUID_RE.match(user_id))


def decode_event(val) -> str:
    if isinstance(val, bytes):
        return val.decode("utf-8")
    return str(val)


def main():
    t_start = time.time()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # Clear old match files before regenerating
    if MATCHES_DIR.exists():
        shutil.rmtree(MATCHES_DIR)
    MATCHES_DIR.mkdir(parents=True)

    # ── Collect data grouped by match_id ──────────────────────────────────────
    # match_id → { date, mapId, players: { user_id → [events] } }
    matches: dict[str, dict] = {}

    total_files = 0
    failed_files = 0

    for date in DATES:
        date_dir = RESOURSES / date
        if not date_dir.exists():
            print(f"  [skip] {date} not found")
            continue

        files = list(date_dir.iterdir())
        print(f"\n{date}: {len(files)} files", flush=True)

        for filepath in files:
            total_files += 1
            try:
                table = pq.read_table(str(filepath))
                df = table.to_pandas()

                if df.empty:
                    continue

                # ── Decode event bytes ─────────────────────────────────────
                df["event"] = df["event"].apply(decode_event)

                # ── Convert datetime64[ms] → integer ms ───────────────────
                # datetime64[ms].astype(int64) gives milliseconds directly
                df["ts"] = df["ts"].astype("int64")

                # ── Round coordinates to 2 dp ──────────────────────────────
                # Cast float32 → float64 first, otherwise round() produces
                # values like -233.5800018310547 due to float32 precision loss
                df["x"] = df["x"].astype(float).round(2)
                df["y"] = df["y"].astype(float).round(2)
                df["z"] = df["z"].astype(float).round(2)

                # ── Extract metadata from first row ────────────────────────
                first = df.iloc[0]
                match_id = str(first["match_id"])   # keeps .nakama-0 suffix
                map_id   = str(first["map_id"])
                user_id  = str(first["user_id"])

                # ── Build events list ──────────────────────────────────────
                events = df[["x", "z", "y", "ts", "event"]].to_dict("records")
                # ensure ts is plain int (not np.int64) for JSON serialisation
                for ev in events:
                    ev["ts"] = int(ev["ts"])

                # ── Insert into match dict ─────────────────────────────────
                if match_id not in matches:
                    matches[match_id] = {
                        "date":    date,
                        "mapId":   map_id,
                        "players": {},
                    }

                matches[match_id]["players"][user_id] = {
                    "userId": user_id,
                    "isBot":  not is_human(user_id),
                    "events": events,
                }

            except Exception as exc:
                failed_files += 1
                print(f"  [warn] {filepath.name}: {exc}")

    print(
        f"\nLoaded {total_files - failed_files}/{total_files} files "
        f"-> {len(matches)} unique matches",
        flush=True,
    )

    # ── Write per-match JSON and build index ──────────────────────────────────
    match_index = []
    unique_players: set[str] = set()
    total_events = 0

    for match_id, match in matches.items():
        players_list = list(match["players"].values())

        humans = [p for p in players_list if not p["isBot"]]
        bots   = [p for p in players_list if p["isBot"]]

        kills        = sum(1 for p in players_list for e in p["events"] if e["event"] == "Kill")
        deaths       = sum(1 for p in players_list for e in p["events"] if e["event"] in ("Killed", "BotKilled"))
        loots        = sum(1 for p in players_list for e in p["events"] if e["event"] == "Loot")
        storm_deaths = sum(1 for p in players_list for e in p["events"] if e["event"] == "KilledByStorm")
        match_events = sum(len(p["events"]) for p in players_list)

        total_events += match_events
        for p in humans:
            unique_players.add(p["userId"])

        # Write match file
        match_data = {
            "matchId": match_id,
            "mapId":   match["mapId"],
            "date":    match["date"],
            "players": players_list,
        }
        out_path = MATCHES_DIR / f"{match_id}.json"
        with open(out_path, "w") as fh:
            json.dump(match_data, fh, separators=(",", ":"))

        match_index.append({
            "id":          match_id,
            "map":         match["mapId"],
            "date":        match["date"],
            "humans":      len(humans),
            "bots":        len(bots),
            "totalEvents": match_events,
            "kills":       kills,
            "deaths":      deaths,
            "loots":       loots,
            "stormDeaths": storm_deaths,
        })

    # Sort by date then match_id for deterministic order
    match_index.sort(key=lambda m: (m["date"], m["id"]))

    # ── Write index.json ──────────────────────────────────────────────────────
    index_data = {
        "stats": {
            "totalMatches":  len(match_index),
            "totalPlayers":  len(unique_players),
            "totalEvents":   total_events,
            "maps":  ["AmbroseValley", "GrandRift", "Lockdown"],
            "dates": DATES,
        },
        "matches": match_index,
    }
    with open(OUTPUT_DIR / "index.json", "w") as fh:
        json.dump(index_data, fh, separators=(",", ":"))

    elapsed = time.time() - t_start
    print(f"\n{'-'*55}")
    print(f"  Matches  : {len(match_index)}")
    print(f"  Players  : {len(unique_players)} unique humans")
    print(f"  Events   : {total_events:,}")
    print(f"  Time     : {elapsed:.1f}s")
    print(f"  Output   : {OUTPUT_DIR}")
    print(f"{'-'*55}")
    print("Done.")


if __name__ == "__main__":
    main()
