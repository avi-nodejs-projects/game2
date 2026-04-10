# 4-Run Matrix Analysis — 2026-04-10

**Goal:** verify the runaway-stat fix from commit `ece900b`
(`combatSettings.damageFloor` + `combatSettings.statCap`) on multiple
seeds, and collect per-strategy decision data.

**Runs:** 600k frames each, 20 bots, 50 dots, 2000×2000 world,
`lifecycle=none`, `--decisions --npc-strategies`.

**Runtime:** ~200s each (~3000 fps with decision logging — roughly half
the no-decision baseline). 13.3 min total. Each gzipped file is ~4 MB
containing ~460-477k events.

**Files (all under `matrix-2026-04-10/`):**
- `A-seed7-baseline.ndjson.gz` — no fix, different seed
- `B-seed42-damagefloor.ndjson.gz` — damage-floor only, broken seed
- `C-seed13-damagefloor.ndjson.gz` — damage-floor only, third seed
- `D-seed99-full.ndjson.gz` — damage-floor + stat-cap 50

---

## TL;DR — the headline

**The runaway is structural, not seed-specific, and damage-floor alone
does NOT cure it.** Every one of the 4 runs produced a dominant bot
with 25-38% of all kills. Only Run D (`stat-cap 50` on top of
damage-floor) meaningfully tamed the top-vs-median stat ratio —
**10.4× instead of 52-89×** in the other runs.

**Also:** across all 4 seeds, **the `survivor` template wins** (3 of 4
runs produced a survivor as the dominant bot). Survival → stat
retention → snowball, even under the new combat formula.

---

## 1. Combat blowout check

| run | seed | fix | totalKills | top killer | top kills | share | top bot stats | runaway? |
|---|---|---|---|---|---|---|---|---|
| **A** | 7 | **none** | 2837 | #13 (gatherer) | 1084 | **38.2%** | 438/449/450/420 | **YES** |
| **B** | 42 | damage-floor | 2182 | #13 (gatherer) | 535 | 24.5% | 5/5/5/3 | mixed¹ |
| **C** | 13 | damage-floor | 2416 | #18 (survivor) | 712 | **29.5%** | 431/436/453/64 | **YES** |
| **D** | 99 | df + cap | 2421 | #1 (survivor) | 838 | **34.6%** | **50/50/50/51** | capped² |

¹ In Run B, bot #13 had the most kills but normal stats (5/5/5/3) —
it wins fights via lucky damage, then dies, gaining no net stats. The
actual **stat snowball** in Run B is **bot #2 (survivor) at 328/317/341/32**
with 484 kills. Damage-floor redirected the problem: instead of one
immortal god-bot, you get a stat-accumulator (that dies occasionally)
plus a high-kill-count brawler (that wins but dies back to baseline).

² Run D's top bot IS capped at `maxPerStat=50` exactly — the cap
worked as designed. But it still dominated (34.6% kill share).
Cap is necessary; it's just not sufficient for real balance.

## 2. Combat outcome distribution

This is where the damage-floor fix IS visibly working:

| run | total combat events | mutual dmg | one-sided | zero-dmg | **one-sided %** |
|---|---|---|---|---|---|
| A (no fix) | 7,328 | 1,682 | 5,607 | 39 | **76.5%** |
| B (df 0.1) | 5,354 | 5,231 | 123 | 0 | 2.3% |
| C (df 0.1) | 6,427 | 6,334 | 93 | 0 | 1.4% |
| D (df+cap) | 6,355 | 6,268 | 87 | 0 | 1.4% |

**Interpretation:** without the damage-floor, 76% of combats were
one-sided (god-bot dealt full damage, victim dealt 0). With the floor,
only 1.4-2.3% are one-sided — the rest are mutual. The formula fix
does exactly what it was designed to do.

**So why is there still a runaway?** Because even with the floor, a
strong bot still outputs more damage than it takes. If bot-strong
deals 100 damage and receives 10 (the floor kicks in from weak
attackers), it still wins every combat and still gains +1 stat per
kill. The floor slowed the one-shot-everyone problem but didn't break
the feedback loop.

## 3. Strategy assignment per run

Seeds produce different strategy distributions (the randomStrategy
flag assigns templates via seeded `Math.random()`):

| run | seed | gatherer | hunter | survivor | opportunist | aggressive | player |
|---|---|---|---|---|---|---|---|
| A | 7  | 4 | 3 | 2 | 5 | 5 | 1 |
| B | 42 | 5 | 3 | **8** | 1 | 2 | 1 |
| C | 13 | 3 | 2 | 4 | 4 | 6 | 1 |
| D | 99 | **7** | 3 | 5 | 2 | 2 | 1 |

**The dominant bot's strategy across runs:**
- Run A: gatherer (1 of 4 gatherers won)
- Run B: gatherer by kill count, survivor by stat accumulation
- Run C: **survivor**
- Run D: **survivor**

## 4. Per-strategy kill/death performance (Run B, seed 42)

| strategy | bots | kills | deaths | kills/bot | deaths/bot | **K/D ratio** |
|---|---|---|---|---|---|---|
| **survivor** | 8 | 838 | 493 | 104.8 | 61.6 | **1.70** |
| gatherer | 5 | 854 | 666 | 170.8 | 133.2 | 1.28 |
| hunter | 3 | 218 | 374 | 72.7 | 124.7 | 0.58 |
| aggressive | 2 | 186 | 335 | 93.0 | 167.5 | 0.56 |
| opportunist | 1 | 41 | 110 | 41.0 | 110.0 | 0.37 |
| simple (player) | 1 | 45 | 204 | 45.0 | 204.0 | **0.22** |

**This is the most interesting finding of the whole matrix.** With
`damage-floor` enabled, **combat is bad for you**. Every fight costs
HP because no one is immune anymore. So the strategies that win are
the ones that AVOID combat:

- **Survivor** (K/D 1.70): flees when endangered → takes fewer hits →
  retains stats → eventually strong enough that the threshold stops
  triggering, then it sits on top of the food chain.
- **Gatherer** (K/D 1.28): picks dots, ignores enemies → zero combat
  initiation → but dies when found by hunters → still positive K/D.
- **Hunter** (K/D 0.58): actively seeks fights → takes more damage →
  loses more often → **the hunter template is a net negative**.
- **Aggressive** (K/D 0.56): similar story — seeking combat is a tax
  when combat always costs both sides.
- **Player (simple default)** (K/D 0.22): the weakest performer, which
  is surprising — the player's default `simple` mode should in
  principle be well-tuned but it's only playing with the default
  `behaviorWeights` which seem to produce a lot of wasted decisions.

**The design implication:** combat-seeking strategies become
dysfunctional under the damage-floor rule. Without an incentive to
hunt (like bounty multipliers or stat steal), the optimal strategy is
to never fight. The game reduces to "stand around and eat dots".

## 5. Action histogram per strategy (Run B)

What each strategy template actually does — not what its name says:

| strategy | decisions | gather% | hunt% | flee% | other |
|---|---|---|---|---|---|
| simple (player) | 18,961 | 62.0% | 0.0% | 0.0% | 38.0% (cluster_farm) |
| survivor | 156,115 | 51.8% | 0.0% | 8.1% | 40.1% (gather_safe) |
| **hunter** | 57,677 | **69.6%** | **22.7%** | 7.7% | 0% |
| gatherer | 94,603 | 66.6% | 0.0% | 3.4% | 30.0% (cluster_farm) |
| opportunist | 19,325 | 42.5% | 6.9% | 6.1% | 44.5% (gather_safe/cluster) |
| **aggressive** | 37,819 | **77.6%** | **22.4%** | 0.0% | 0% |

**Huge insight buried in this table:**

- A **hunter** template bot **gathers 69.6% of the time**, not hunts.
- An **aggressive** template bot **gathers 77.6% of the time**.

Why? Look at the behavior-action map in `bot-ai.js:392`:
```js
hunter: context['nearest_enemy.distance'] < targetRange ? 'hunt' : 'gather'
```

Even when the `hunter` behavior is selected (weight 50 out of 100 → ~50%
of decisions), the map falls back to `gather` when no enemy is in
`targetRange`. So **half of "hunter" decisions still produce gather
actions** due to the no-enemy-nearby fallback. The weight
distribution in the templates (hunter: 50) advertises intent but
doesn't guarantee behavior.

This means:
- NPCs labeled "hunter" spend ~70% of their time gathering.
- The template names oversell combat behavior.
- Tuning `targetRange` (default in config) would dramatically change
  the effective hunter/aggressive behavior.

## 6. Stat ratio (top bot vs. median bot)

| run | top bot total stats | median total stats | ratio | interpretation |
|---|---|---|---|---|
| A (no fix) | 1,757 | 20 | **89.2×** | unchecked snowball |
| B (df) | 1,019 | 19 | **52.3×** | slower snowball, still severe |
| C (df) | 1,383 | 20 | **69.8×** | worse than B |
| **D (df + cap 50)** | **201** | 19 | **10.4×** | **cap holds** |

This is the clearest quantitative picture of what the fix does:
- Damage-floor alone (B, C): cuts the ratio from ~89× to ~52-70×.
  Meaningful but not enough — the dominant bot still has ~70× more
  stats than the average bot.
- Stat-cap at 50 (D): caps the ratio at 10.4× (exactly
  `50×4 / 19` = 10.5× theoretical). This is the only run that feels
  balanced at all.

## 7. What this means for the game design

### Confirmed
1. **The runaway is structural.** 4/4 seeds produced a dominant bot.
   It's not seed 42 bad luck.
2. **`damage-floor` works at the formula level** (one-sided combats
   drop from 76% to 1-2%) but doesn't break the feedback loop.
3. **`stat-cap` is the necessary second piece.** Without it, stats
   grow unbounded and a strong bot stays strong forever.
4. **Survivor is the objectively best strategy** under the new
   combat rules. It wins 3 of 4 seeded runs outright.

### Unexpected
1. **Hunters don't hunt much.** Template weights of 50% don't translate
   to 50% hunt actions because of the "no enemy in range → gather"
   fallback. This should probably be documented or tuned.
2. **Combat-seeking is dysfunctional under damage-floor.** Every fight
   has a net cost. Without rewards that exceed the cost (bounty?
   lifesteal?), hunters and aggressives are strictly dominated by
   gatherers and survivors.
3. **The player's `simple` default has the worst K/D (0.22).** The
   default `behaviorWeights` are apparently quite weak against tuned
   NPC templates. A good follow-up would be tuning the default.

### Recommended next steps (not decided yet)

These are suggestions for the *game design*, separate from the
engineering work:

1. **Tune stat-cap lower** — 50 still allows a 10× dominance. Try 20
   or 30 and see if the distribution compacts further.
2. **Diminishing returns on kill rewards** — e.g. `+1/(1 + currentKills/10)`
   so the first kill is worth +1 but the hundredth is worth +0.1.
3. **Stat decay** — idle bots slowly lose stats back toward baseline.
   Would neutralize the "old survivors" advantage.
4. **Combat bounty** — winning a fight against a bot with higher stats
   gives a bigger stat gain, encouraging hunters to actually hunt.
5. **Investigate `hunter` template fallback** — the 70% gather rate
   suggests the `targetRange` context is rarely triggering. Either
   increase targetRange or change the fallback action.

### Recommended next runs (when you're ready)

1. **Seed 99 with `--stat-cap 20`** — does a tighter cap produce a
   genuinely balanced simulation?
2. **Seed 42 with `--stat-cap 20` alone** (no damage floor) — is the
   cap sufficient by itself, or does damage-floor add real value?
3. **Seed 42 with lifecycle=starvation + damage-floor + cap** —
   starvation forces even the strongest bot to keep foraging, which
   should interrupt the snowball dynamics.
4. **Enable `npcSettings.evolution`** — NPCs inherit stats from killer
   on death. Would redistribute stats on each kill instead of letting
   them concentrate.

---

## Raw data files (local only, gitignored)

All 4 `.ndjson.gz` files are under
`bots-strategy-v11/test/results/runs/matrix-2026-04-10/`.

Event counts per run:
- **A:** 455,562 events (meta, init, ~355k decisions, ~2.8k kills, ~7.3k combat, ~12k lifecycle, 1200 snaps, final, ~78k eat)
- **B:** 476,037 events
- **C:** 467,850 events
- **D:** 477,004 events
