# Gameplay Insights — LILA BLACK Telemetry Analysis

Analysis of 796 matches, 89,016 events, 245 unique human players across Ambrose Valley, Grand Rift, and Lockdown (February 10–14, 2026).

---

## Insight 1 — Over 70% of Lockdown is a Dead Zone: Players Only Use the Center

**What caught my eye:** When I switched to Analytics mode and enabled the Dead Zone overlay on Lockdown, nearly the entire map border lit up red. The numbers confirmed it: 71% of Lockdown's 48×48 grid cells have zero traffic from both humans and bots. Players cluster tightly in the central corridor and ignore everything else.

**The evidence:**

| Map | Dead Zone % | Human-only traffic cells | Bot-human overlap |
|-----|------------|------------------------|-------------------|
| AmbroseValley | 59.2% | 134 cells | 34.2% |
| GrandRift | 68.1% | 235 cells | 18.5% |
| **Lockdown** | **71.0%** | 96 cells | 22.6% |

Lockdown's dead zone problem is the worst across all three maps. The playable area feels much smaller than the designed area — the south edge, east periphery, and west periphery are effectively invisible to players. Top hot-drop cells confirm the North-in, Central-through pattern: players enter from the north (X=−94, Z=219 with 27 landings; X=135, Z=323 with 19 landings) and push toward the center, never ranging to the edges.

**Actionable recommendation:** Place high-value loot caches or contract objectives in the dead zones (south edge, east/west periphery) to pull players outward. Alternatively, if these zones are intentionally empty, consider shrinking Lockdown's playable boundary to match actual player behavior — a tighter map that's fully used is better than a large map that's 71% wasted.

**Metrics affected:** Map coverage %, average distance traveled per match, loot distribution evenness, match duration variance.

**Why a Level Designer should care:** If you're spending art and design hours on areas no player ever visits, that's wasted effort. This data pinpoints exactly where to focus — or where to add magnets that pull players into underused zones.

---

## Insight 2 — AmbroseValley's Loot is Severely Concentrated: 56% of Pickups Happen in 10% of Active Cells

**What caught my eye:** On the Loot heatmap for AmbroseValley, a few cells glowed intensely bright while most of the map was dark. I checked the distribution: the top 10% of loot-active grid cells account for 56% of all loot pickups on AmbroseValley. Players have either learned or been funneled into specific high-density loot rooms, creating predictable routes and ignoring alternative loot locations.

**The evidence:**

| Map | Total loot events | Top 10% of active cells hold | Interpretation |
|-----|-------------------|------------------------------|----------------|
| **AmbroseValley** | 9,936 | **56% of all loot** | Severe concentration |
| Lockdown | 2,050 | 37% | Moderate |
| GrandRift | 880 | 30% | Most evenly spread |

Cross-referencing with the kill heatmap: the top loot zones on AmbroseValley also overlap with the top kill zones. Players converge on the same spots and fight over them. The Central zone hotspot (X=14, Z=−14) alone accounts for 41 kills and sits inside the highest loot-density area. This creates a self-reinforcing loop — players go where loot is, fights happen there, and the rest of the map empties out.

**Actionable recommendation:** Redistribute loot spawns on AmbroseValley more evenly. Add secondary loot rooms in the cold zones (NE, S, SE quadrants). This would spread player traffic, reduce early-game clustering at known loot spots, and create more diverse route choices. GrandRift's more even distribution (30% in top cells) should be the target benchmark.

**Metrics affected:** Loot distribution Gini coefficient, early-game death rate at hot spots, route diversity per match, map coverage %, match outcome predictability.

**Why a Level Designer should care:** Concentrated loot creates predictable gameplay — experienced players rush the same 3 rooms every match, while new players wander empty areas and find nothing. Spreading loot creates more discovery moments and makes each match feel different.

---

## Insight 3 — Bots Patrol Where Humans Don't: GrandRift Has 72 Bot-Only Zones

**What caught my eye:** Switching to the Bot vs Human overlay in Analytics mode, I noticed large orange-only patches on GrandRift — areas where bots patrol but no human player has ever visited. On AmbroseValley the overlap was much better, with bots and humans largely sharing the same space.

**The evidence:**

| Map | Bot-only cells | Human-only cells | Overlap cells | Overlap % | Avg K/D |
|-----|---------------|-----------------|---------------|-----------|---------|
| AmbroseValley | 16 | 134 | 789 | 34.2% | 3.07 |
| GrandRift | **72** | 235 | 427 | 18.5% | 1.10 |
| Lockdown | 53 | 96 | 520 | 22.6% | 1.29 |

GrandRift has 72 grid cells where bots walk but zero humans ever go. That's 72 patrol zones where encounters are impossible in practice — the AI is active in areas players will never see. AmbroseValley has only 16 such cells, meaning bot patrol routes are well-aligned with human traffic.

The K/D ratio reinforces this: AmbroseValley's average K/D is 3.07 (humans dominate bots easily — they meet them on familiar ground). On GrandRift it's 1.10 — when humans do encounter bots they're on unfamiliar terrain and the fights are nearly even. The misalignment makes GrandRift feel harder without being better designed.

**Actionable recommendation:** On GrandRift, reroute bot patrol waypoints to overlap with the top human traffic corridors (the West zone around X=−163, Z=7 and the Central zone around X=−18, Z=−30 to −66 are the top kill zones). The goal is organic-feeling encounters — players should run into bots naturally along their paths. AmbroseValley's 34.2% overlap should be the minimum target for all maps.

**Metrics affected:** Bot encounter rate per match, perceived map liveliness, average bot kills per human player, player engagement time, PvE combat density.

**Why a Level Designer should care:** Bots exist to make the map feel alive and create combat encounters. If bots patrol areas humans never visit, they're invisible — the map feels empty despite having 30+ AI entities active. Aligning bot patrol routes with human traffic directly improves the moment-to-moment gameplay experience without touching any art assets.

---

## Methodology Note

**Dataset:** 796 matches, 89,016 events, 245 unique human players, 94 unique bot IDs. Feb 10–14, 2026.

**Event types used:**
- `Loot` — player picked up an item
- `Position` / `BotPosition` — position sample (movement tracking, ~82% of all events)
- `KilledByStorm` — eliminated by storm circle (39 total events across all matches)
- `Kill` / `BotKill` / `Killed` / `BotKilled` — combat events

**Key dataset characteristic:** Only 3 human-vs-human Kill events exist across 796 matches (99.6% of matches have zero PvP). The dataset predominantly captures human-vs-bot combat — LILA BLACK functions as a PvE extraction game in this sample. All kill density analysis refers to BotKill events (humans eliminating bots), not PvP.

**Timestamps:** Stored as Unix seconds in the processed JSON. Match duration = max(ts) − min(ts). Average match: 6.8 min, longest: 14.8 min, shortest: 13 sec.

**Analytics grid:** 48×48 cells per map, pre-aggregated across all matches. Each cell stores: human traffic (ht), bot traffic (bt), kills (k), deaths (d), loot (lo), storm deaths (sd), hot-drop landings (hd), K/D ratio (kd).

**Out-of-bounds events:** 0% across all three maps — coordinate calibration is clean.
