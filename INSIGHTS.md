# Gameplay Insights — LILA BLACK Telemetry Analysis

Analysis of 796 matches, 89,016 events, 245 unique human players across Ambrose Valley, Grand Rift, and Lockdown (February 10–14, 2026).

---

## Insight 1: Ambrose Valley is the loot-richest map — by a large margin

Players loot **46% more per match** on Ambrose Valley than on Lockdown.

| Map | Avg Loot Events / Match |
|---|---|
| Ambrose Valley | **17.6** |
| Grand Rift | 14.9 |
| Lockdown | 12.0 |

**What this tells us:** Loot density on Ambrose Valley is high enough that players find meaningful pickups roughly once every 6 position steps (`loot-to-movement ratio = 0.18`). Lockdown's ratio is meaningfully lower, suggesting either fewer loot spawns, more contested spawns, or player paths that avoid loot zones.

**Design implication:** If Lockdown's lower loot rate is intentional (tighter map, faster TTK), it's working as designed. If unintentional, loot spawn placement should be reviewed — players may be routing through corridors that bypass spawn points. The visualizer's Loot heatmap layer can identify exactly which zones are being skipped.

---

## Insight 2: Storm deaths are a late-game phenomenon — 100% occur after the 40% match mark

Zero storm deaths occurred in the first 40% of any match's duration. All 39 storm deaths across the dataset happened in the **final 60% of match time**.

| Storm death timing | Count |
|---|---|
| Before 40% of match duration | 0 |
| After 40% of match duration | 39 (100%) |

**What this tells us:** Players are successfully outrunning the storm in the early phase. The storm becomes lethal only as the circle tightens — which is the intended progression. However, this also means the storm is not creating meaningful early-game pressure or routing decisions.

**Design implication:** If storm deaths are purely a late-game execution failure (rather than a routing/decision-making mechanic), the early storm speed or radius schedule could be tightened slightly. A small number of early storm deaths (5–10%) would indicate the storm is influencing player routing, not just punishing stragglers. Use the Storm Deaths heatmap to check if late-storm deaths cluster at predictable map edges (suggesting players know which sides are "safe" to slow-rotate from).

---

## Insight 3: Loot engagement is declining week-over-week — 8% drop from Feb 10 to Feb 13

Across the 5-day window, average loot pickups per match trended downward:

| Date | Avg Loots / Match | Matches |
|---|---|---|
| Feb 10 | **17.2** | 285 |
| Feb 11 | 16.3 | 200 |
| Feb 12 | 15.0 | 162 |
| Feb 13 | 14.2 | 112 |
| Feb 14 | 18.6* | 37 |

*Feb 14 has the smallest sample (37 matches) and the spike may not be statistically significant.

**What this tells us:** The consistent week-over-week decline (Feb 10 → Feb 13, −17%) suggests players were becoming more selective in their looting — either routing more directly, getting eliminated before reaching loot zones, or adapting their play style after familiarizing themselves with spawn layouts.

**Design implication:** This is worth monitoring over longer windows. If loot engagement continues declining, it may signal that experienced players have learned the optimal high-density loot zones and ignore the rest — reducing map exploration. Redistributing a portion of high-value loot to underutilized zones (identifiable via the Traffic heatmap) could restore more varied movement patterns and extend meaningful engagement across the full map area.

---

## Methodology Note

Event types used in this analysis:
- `Loot` — player picked up an item
- `Position` / `BotPosition` — player position sample (emitted at regular intervals during movement)
- `KilledByStorm` — player eliminated by storm circle
- `Kill` / `BotKill` / `Killed` / `BotKilled` — PvP / PvE combat events

All timestamps are in UTC milliseconds. Match duration calculated as `max(ts) − min(ts)` per match. Matches with fewer than 10 position events were included in aggregate counts but excluded from per-movement ratio calculations.
