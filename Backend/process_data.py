#!/usr/bin/env python3
"""
LILA BLACK - Data Pipeline
Reads all parquet player files from Resourses/ and generates static JSON
files consumed by the lila-viz frontend.

Output:
  ../frontend/artifacts/lila-viz/public/data/index.json
  ../frontend/artifacts/lila-viz/public/data/matches/{matchId}.json
  ../frontend/artifacts/lila-viz/public/data/analytics/{mapId}.json

Usage:
  pip install pyarrow pandas
  python process_data.py
"""

import json
import math
import os
import re
import shutil
import time
from collections import defaultdict
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

# -- Paths -------------------------------------------------------------------

SCRIPT_DIR    = Path(__file__).parent
ROOT_DIR      = SCRIPT_DIR.parent
RESOURSES     = ROOT_DIR / "Resourses"
OUTPUT_DIR    = ROOT_DIR / "frontend" / "artifacts" / "lila-viz" / "public" / "data"
MATCHES_DIR   = OUTPUT_DIR / "matches"
ANALYTICS_DIR = OUTPUT_DIR / "analytics"

DATES = [
    "February_10",
    "February_11",
    "February_12",
    "February_13",
    "February_14",
]

MAP_CONFIGS = {
    "AmbroseValley": {"originX": -370, "originZ": -473, "scale": 900},
    "GrandRift":     {"originX": -290, "originZ": -290, "scale": 581},
    "Lockdown":      {"originX": -500, "originZ": -500, "scale": 1000},
}

GRID_SIZE = 48  # 48x48 cells per map

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


def world_to_cell(x: float, z: float, map_id: str) -> tuple[int, int] | None:
    """Convert world (x, z) to grid (row, col). Returns None if out of bounds."""
    cfg = MAP_CONFIGS.get(map_id)
    if not cfg:
        return None
    u = (x - cfg["originX"]) / cfg["scale"]
    v = (z - cfg["originZ"]) / cfg["scale"]
    if not (0 <= u < 1 and 0 <= v < 1):
        return None
    col = int(u * GRID_SIZE)
    row = int((1 - v) * GRID_SIZE)  # flip Z so row 0 = top of map
    row = max(0, min(GRID_SIZE - 1, row))
    col = max(0, min(GRID_SIZE - 1, col))
    return row, col


def cell_to_world_center(row: int, col: int, map_id: str) -> tuple[float, float]:
    """Convert grid cell center back to approximate world (x, z)."""
    cfg = MAP_CONFIGS[map_id]
    u = (col + 0.5) / GRID_SIZE
    v = 1 - (row + 0.5) / GRID_SIZE
    x = cfg["originX"] + u * cfg["scale"]
    z = cfg["originZ"] + v * cfg["scale"]
    return round(x, 1), round(z, 1)


def build_analytics(all_matches: dict) -> dict:
    """
    Aggregate all match data into per-map grid analytics.
    Returns: { mapId: { matchCount, grid, summary } }
    """
    # Initialise per-map accumulators
    map_grids: dict[str, dict] = {}
    map_match_counts: dict[str, int] = defaultdict(int)

    for map_id in MAP_CONFIGS:
        n = GRID_SIZE * GRID_SIZE
        map_grids[map_id] = {
            "humanTraffic": [0] * n,
            "botTraffic":   [0] * n,
            "kills":        [0] * n,
            "deaths":       [0] * n,
            "loot":         [0] * n,
            "stormDeaths":  [0] * n,
            "hotDrops":     [0] * n,  # first position event per player
        }

    HUMAN_POS = {"Position"}
    BOT_POS   = {"BotPosition"}
    KILL_EVT  = {"Kill", "BotKill"}
    DEATH_EVT = {"Killed", "BotKilled"}
    STORM_EVT = {"KilledByStorm"}

    for match_id, match in all_matches.items():
        map_id = match["mapId"]
        if map_id not in map_grids:
            continue
        g = map_grids[map_id]
        map_match_counts[map_id] += 1

        for player in match["players"].values():
            is_bot = not is_human(player["userId"])
            first_pos_recorded = False

            for ev in player["events"]:
                cell = world_to_cell(ev["x"], ev["z"], map_id)
                if cell is None:
                    continue
                row, col = cell
                idx = row * GRID_SIZE + col
                evt = ev["event"]

                if evt in HUMAN_POS:
                    g["humanTraffic"][idx] += 1
                    if not is_bot and not first_pos_recorded:
                        g["hotDrops"][idx] += 1
                        first_pos_recorded = True
                elif evt in BOT_POS:
                    g["botTraffic"][idx] += 1
                    if is_bot and not first_pos_recorded:
                        first_pos_recorded = True

                if evt in KILL_EVT:
                    g["kills"][idx] += 1
                if evt in DEATH_EVT:
                    g["deaths"][idx] += 1
                if evt in STORM_EVT:
                    g["stormDeaths"][idx] += 1
                if evt == "Loot":
                    g["loot"][idx] += 1

    # Build final analytics per map
    result = {}
    for map_id, g in map_grids.items():
        n = GRID_SIZE * GRID_SIZE
        cells = []
        total_cells = 0
        dead_cells = 0
        total_kd = 0.0
        kd_count = 0
        top_kill_cells = []
        top_hot_drops = []
        storm_clusters = []

        for idx in range(n):
            row = idx // GRID_SIZE
            col = idx % GRID_SIZE
            ht = g["humanTraffic"][idx]
            bt = g["botTraffic"][idx]
            k  = g["kills"][idx]
            d  = g["deaths"][idx]
            lo = g["loot"][idx]
            sd = g["stormDeaths"][idx]
            hd = g["hotDrops"][idx]

            kd_ratio = None
            if d > 0:
                kd_ratio = round(k / d, 3)
                total_kd += kd_ratio
                kd_count += 1

            total_cells += 1
            if ht == 0 and bt == 0:
                dead_cells += 1

            cell = {
                "row": row, "col": col,
                "ht": ht, "bt": bt,
                "k": k, "d": d, "kd": kd_ratio,
                "lo": lo, "sd": sd, "hd": hd,
            }
            cells.append(cell)

            if k > 0:
                top_kill_cells.append((k, row, col))
            if hd > 0:
                top_hot_drops.append((hd, row, col))
            if sd > 0:
                wx, wz = cell_to_world_center(row, col, map_id)
                storm_clusters.append({"x": wx, "z": wz, "count": sd})

        top_kill_cells.sort(reverse=True)
        top_hot_drops.sort(reverse=True)

        # Bot vs human overlap: cells where both ht > 0 and bt > 0
        both = sum(1 for idx in range(n)
                   if g["humanTraffic"][idx] > 0 and g["botTraffic"][idx] > 0)
        human_active = sum(1 for idx in range(n) if g["humanTraffic"][idx] > 0)
        bot_human_overlap = round(both / human_active, 3) if human_active > 0 else 0

        dead_zone_pct = round(dead_cells / total_cells * 100, 1) if total_cells > 0 else 0
        avg_kd = round(total_kd / kd_count, 3) if kd_count > 0 else 0

        hottest_drop = {"row": top_hot_drops[0][1], "col": top_hot_drops[0][2]} if top_hot_drops else None
        top_kill = {"row": top_kill_cells[0][1], "col": top_kill_cells[0][2], "kills": top_kill_cells[0][0]} if top_kill_cells else None

        result[map_id] = {
            "matchCount": map_match_counts[map_id],
            "gridSize": GRID_SIZE,
            "cells": cells,
            "summary": {
                "deadZonePercent": dead_zone_pct,
                "avgKdRatio": avg_kd,
                "botHumanOverlap": bot_human_overlap,
                "hottestDropCell": hottest_drop,
                "topKillCell": top_kill,
                "stormClusters": sorted(storm_clusters, key=lambda s: -s["count"])[:10],
                "totalHumanTraffic": sum(g["humanTraffic"]),
                "totalBotTraffic": sum(g["botTraffic"]),
                "totalKills": sum(g["kills"]),
                "totalDeaths": sum(g["deaths"]),
                "totalLoot": sum(g["loot"]),
            }
        }

    return result


def main():
    t_start = time.time()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if MATCHES_DIR.exists():
        shutil.rmtree(MATCHES_DIR)
    MATCHES_DIR.mkdir(parents=True)
    ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)

    # -- Collect all matches --------------------------------------------------
    all_matches: dict[str, dict] = {}
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

                df["event"] = df["event"].apply(decode_event)
                df["ts"]    = df["ts"].astype("int64")
                df["x"]     = df["x"].astype(float).round(2)
                df["y"]     = df["y"].astype(float).round(2)
                df["z"]     = df["z"].astype(float).round(2)

                first    = df.iloc[0]
                match_id = str(first["match_id"])
                map_id   = str(first["map_id"])
                user_id  = str(first["user_id"])

                events = df[["x", "z", "y", "ts", "event"]].to_dict("records")
                for ev in events:
                    ev["ts"] = int(ev["ts"])

                if match_id not in all_matches:
                    all_matches[match_id] = {
                        "date":    date,
                        "mapId":   map_id,
                        "players": {},
                    }

                all_matches[match_id]["players"][user_id] = {
                    "userId": user_id,
                    "isBot":  not is_human(user_id),
                    "events": events,
                }

            except Exception as exc:
                failed_files += 1
                print(f"  [warn] {filepath.name}: {exc}")

    print(f"\nLoaded {total_files - failed_files}/{total_files} files -> {len(all_matches)} unique matches", flush=True)

    # -- Write per-match JSON + build index -----------------------------------
    match_index = []
    unique_players: set[str] = set()
    total_events = 0

    for match_id, match in all_matches.items():
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

        match_data = {
            "matchId": match_id,
            "mapId":   match["mapId"],
            "date":    match["date"],
            "players": players_list,
        }
        with open(MATCHES_DIR / f"{match_id}.json", "w") as fh:
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

    match_index.sort(key=lambda m: (m["date"], m["id"]))

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

    # -- Build and write analytics --------------------------------------------
    print("\nBuilding analytics grids...", flush=True)
    analytics = build_analytics(all_matches)

    for map_id, data in analytics.items():
        out_path = ANALYTICS_DIR / f"{map_id}.json"
        with open(out_path, "w") as fh:
            json.dump(data, fh, separators=(",", ":"))
        print(f"  {map_id}: {data['matchCount']} matches | deadZone={data['summary']['deadZonePercent']}% | overlap={data['summary']['botHumanOverlap']}")

    elapsed = time.time() - t_start
    print(f"\n{'-'*55}")
    print(f"  Matches   : {len(match_index)}")
    print(f"  Players   : {len(unique_players)} unique humans")
    print(f"  Events    : {total_events:,}")
    print(f"  Analytics : {len(analytics)} map grids ({GRID_SIZE}x{GRID_SIZE})")
    print(f"  Time      : {elapsed:.1f}s")
    print(f"  Output    : {OUTPUT_DIR}")
    print(f"{'-'*55}")
    print("Done.")


if __name__ == "__main__":
    main()
