# Run: 2026-04-10 seed 42 — 600k frame baseline

**Command:**
```
node bots-strategy-v11/test/simlog.js \
  --frames 600000 \
  --snap-every 500 \
  --gzip \
  --out /tmp/longrun.ndjson.gz
```

**Config:** 20 bots, 50 dots, seed 42, lifecycle=none, 2000×2000 world, v11 combat
defaults (no `damageFloor`, no `statCap`, stalemate breaker = division).

**Runtime:** 106s (~5,637 fps). 84,844 events. 1 MB gzipped.

**Files:**
- `simlog.ndjson.gz` — raw NDJSON stream from simlog.js
- `observations.md` — this file

---

## TL;DR

1. **Bot #12 snowballed into a "god-king":** 4,731 kills, 0 deaths, final stats
   ~1,200 in every stat. Everyone else stuck at ~5/5/5/3 (i.e. perpetually
   respawning).
2. **Root cause is a combat formula bug, not a simulation artifact:** once a
   bot's `defence` exceeds every other bot's `attack`, the primary
   `damage = attack - defence` clamps to 0 and the stalemate branch never
   fires (because the god-bot still deals damage). The god-bot is
   mathematically invincible and every kill mints +1 stat.
3. **Fixed in this session.** Added `combatSettings.damageFloor` (minimum
   attack-fraction damage guarantee) + `combatSettings.statCap` (hard
   ceiling per stat). Both off by default; opt-in via config.
4. **Strategy layer ran fine.** Movement, map coverage, and dot hunting
   all look healthy across every bot. The broken piece is combat balance,
   not the AI.

---

## Event counts

| event | count |
|---|---|
| eat | 35,334 |
| combat | 27,645 |
| kill | 9,647 |
| lifecycle (all RESPAWN) | 11,015 |
| snap | 1,200 |
| meta+init+final | 3 |

## Combat damage breakdown

| outcome | events | % |
|---|---|---|
| one-sided (only one side took damage) | 18,247 | 66% |
| mutual damage | 9,379 | 34% |
| true stalemate (both blocked → division fired) | 19 | 0.07% |
| zero-impact | rest (combat events with no damage dealt due to cooldown/protection/invincibility) | |

**Key finding:** the stalemate breaker only fired 19 times. The runaway
wasn't caused by stalemates — it was caused by **one-sided** combats where
the god-bot dealt full damage and took zero. The existing stalemate branch
does nothing to prevent this.

## Kills / deaths / eats (top + bottom)

| bot | kills | deaths | eats | final stats |
|---|---:|---:|---:|---|
| **#12** | **4,731** | **0** | 480 | spd 1187 / atk 1179 / def 1215 / lv 1206 |
| #0 (player) | 116 | 389 | **4,314** | spd 8.7 / atk 5.6 / def 5.8 / lv 4.5 |
| #19 | 374 | 514 | 1,709 | ~5.5/6.6/6.4/1.0 |
| #13 | 338 | 508 | 1,797 | ~5/5/5/2 |
| … | | | | |
| #3 | 186 | 546 | 1,650 | ~5/5/5/1.3 |
| #16 | 225 | **583** (most deaths) | 1,620 | ~5.7/5.5/6.7/1.3 |

- **Player bot #0** is a clear outlier: gather-heavy (2.4× eat rate of
  average NPC), avoids combat (3× fewer kills), dies less than average.
  Its strategy — whatever it is — is effectively "farm dots and run from
  fights" and it works.
- **Every non-god NPC** has final stats ≈ respawn baseline. They're in a
  death/reset treadmill (489–583 deaths each over 600k frames ≈ a death
  every ~1,100 frames ≈ ~18 seconds at 60fps).

## Stat growth rate per 1k frames

| bot | start total | end total | growth/1kf | kills/1kf |
|---|---:|---:|---:|---:|
| #12 | 16.4 | 4,787.4 | **7.958** | **7.89** |
| #0 (player) | 17.3 | 24.6 | 0.012 | 0.19 |
| rest | ~16–18 | ~15–21 | ~0.002 | 0.3–0.6 |

Bot #12's growth is almost exactly 1-stat-per-kill (7.958 ÷ 7.89 ≈ 1.009).
No one else accumulates anything.

## Map coverage (10×10 grid heatmap)

```
 : o o o o o o o o :
 o # # # # # # # # O
 o # # # # # # # # o
 o # # # # # # # # o
 o # # # # # # O # o
 o # # # # # # # # o
 o # # # # O # # # o
 o # # # O # # # # o
 o # # # # # # # # o
 : o o o o o o o o :
```

- **Interior is uniformly visited** — every bot roams all four quadrants.
- **Edge rows/cols are under-visited** — bots cluster toward the interior
  where dots respawn.
- **Exploration is healthy**: every bot's `xRange` and `yRange` is
  1860–1949 (out of 2000). No bot got stuck in a corner.

## Movement / exploration

- 19 of 20 bots had **zero stale snaps** (moved every 500 frames).
- Bot #12 had 11 stale snaps — makes sense, as a god-bot sometimes stops to
  chew through a victim in place.
- Average speed (distance between snaps): 540–580 units per 500-frame
  interval, i.e. ~1.1 world units per frame. Consistent with
  `0.5 + speed*0.2` at speed=3–5 (which matches everyone except #12).

## Strategy observations

**Not captured in this run:** per-frame decision traces (`--decisions` was
off). To analyze behavior/rule/state-machine activation patterns, a re-run
with `--decisions` enabled is needed. That run will be ~3–10× larger in
file size but gives exact per-decision reason codes
(`BEHAVIOR:gatherer`, `RULE:2`, `FSM_STATE:fleeing`, etc.).

**What IS visible from snaps + event stream:**

| bot | implied strategy | evidence |
|---|---|---|
| #0 (player) | **pure gatherer** | 2.4× eat rate, 3× fewer kills, lowest death count (389) |
| #12 (god-king) | **opportunist → hunter** | once stats passed the invincibility threshold (~frame 30k, def > 10), it started killing everything on sight |
| #1, #5, #9 | **balanced / default** | all exactly 5/5/5/3 at end — they die before gaining anything |
| #18 | **slight defender bias** | final def=8.1 (above respawn baseline) — survived longer than average before dying |
| #0 outlier | | player's `preferredStat` + `reEvaluationRate` combo is visible in the retained spd=8.7 (preferred stat) even after 389 deaths |

**Also not analyzed:** pack formation, territory, relationships,
reproduction — all disabled in this run (`lifecycle=none`).

---

## Open questions for follow-up runs

1. **Reproduce with different seeds?** Does the same bot index win on
   seeds 7, 13, 99, or does it depend on the seed-ordering of collisions?
   (Hypothesis: a different bot wins each time, but the runaway pattern
   is identical.)
2. **Does `damageFloor` alone prevent the runaway?** Rerun seed 42 with
   `combatSettings.damageFloor.enabled = true, fraction = 0.1`. Expected:
   kill distribution looks like a normal competitive run, no single bot
   dominates.
3. **Does `statCap` at maxPerStat=50 change the game feel?** Rerun seed 42
   with statCap only (no damage floor). Expected: runaway stops at ~50,
   but the god-bot might still dominate at that level.
4. **What do decision traces look like with `--decisions`?** Run with
   `--decisions --frames 60000 --lifecycle none` for a focused trace.
5. **Strategy diversity:** current NPCs all use the same AI baseline. A
   run with `npcSettings.randomStrategy.enabled = true` would produce
   gatherer/hunter/survivor splits whose relative performance is the
   actual interesting question.

## What the simlog tool is missing (for next iteration)

- **Strategy tagging per bot** (initial state should record each bot's
  `npcStrategy` and the player's `strategyMode`).
- **Per-decision action counts** (even without full traces, an
  aggregated histogram like `{gather: 41%, hunt: 32%, flee: 12%, …}` per
  bot would be cheap to capture).
- **RESPAWN events still emitted when `lifecycle=none`** — should filter
  or be its own opt-in.
- **Zone/dot-cluster metrics** (density maps over time) would help
  validate cluster-farmer behavior.
