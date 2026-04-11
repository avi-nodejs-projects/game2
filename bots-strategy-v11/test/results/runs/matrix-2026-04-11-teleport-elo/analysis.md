# M1 — 5-Run Matrix Analysis (teleport + ELO)

**Goal:** measure the DQ-6 / DQ-7 combat rewrite (commit `4d407f6`)
against the 2026-04-10 baseline, across 4 seeds, plus a regression
run to confirm the original bug still reproduces with the old knobs.

**Runs:** 600k frames each, 20 bots, 50 dots, 2000×2000 world,
`--decisions --npc-strategies`. Total ~15 minutes for all 5.

| id | seed | knobs |
|---|---|---|
| **E** | 42 | `--death-behavior reset --kill-reward fixed --loss-penalty none` (**regression**) |
| A | 7 | `--death-behavior teleport --kill-reward elo --loss-penalty elo --elo-scale 100` |
| B | 42 | (same M1 config as A) |
| C | 13 | (same M1 config) |
| D | 99 | (same M1 config) |

Files under `matrix-2026-04-11-teleport-elo/`, ~5 MB gzipped each.

---

## TL;DR — the rewrite worked

**The runaway is dead.** Across 4 seeds with teleport + ELO:
- Top bot's kill share dropped from **25-42% → 10-14%**.
- Top/median stat ratio dropped from **52-89× → 1.2-1.4×**.
- Stat distribution is now a **bell curve with a ~250-stat gradient**
  instead of a binary "1 god + 19 baseline" population.
- Regression run E confirms the old bug still reproduces (41.9% kill
  share, 86.3× ratio) with the original knobs — proving the
  rewrite is what changed the outcomes, not some other drift.

**But M2 work is clearly needed:**
- **Gatherer dominance persists** via dot-eating (not combat). Top
  killers in every M1 run are still gatherers — they now snowball
  via eating instead of via kill rewards.
- **Hunter K/D is still 0.72-1.01** (≤ 1.0 in every run). The
  `combat_advantage ≥ 0` gate in `bot-ai.js:394` (confirmed finding
  #6 in balance-findings.md) is still preventing hunter templates
  from hunting up, even though hunting up is now profitable under
  ELO. DQ-5 is validated as a real issue.
- **Player `simple` mode is catastrophically bad** — K/D of 0.00-0.01
  across all 4 M1 runs (the player lost 3400-3700 "combats" in 600k
  frames). The default `behaviorWeights` are badly tuned against
  the NPC templates.

---

## 1. Runaway check (the headline result)

| run | seed | mode | totalKills | top killer | top kills | share | top stats | runaway? |
|---|---|---|---|---|---|---|---|---|
| **E** | 42 | reset+fixed (REGRESSION) | 2,464 | #12 (gatherer) | 1,032 | **41.9%** | **431/413/418/369** | **YES** |
| A | 7  | teleport+elo | 9,616  | #9 (gatherer)  | 1,301 | 13.5% | 283/284/288/230 | no |
| B | 42 | teleport+elo | 7,889  | #13 (gatherer) | 853   | 10.8% | 262/255/259/240 | no |
| C | 13 | teleport+elo | 10,022 | #11 (gatherer) | 1,402 | 14.0% | 293/293/293/294 | no |
| D | 99 | teleport+elo | 9,341  | #16 (gatherer) | 993   | 10.6% | 262/264/267/37  | no |

Interpretation:
- **Run E is the regression sanity check.** With the old knobs, bot
  #12 reaches the same 431/413/418/369 stat profile from the original
  2026-04-10 bug discovery run. The bug reproduces exactly. ✓
- **A-D all have top kill share under 15%**, vs 25-42% in the old
  matrix. No single bot dominates.
- **Top bots in A-D still accumulate substantial stats** (~1100-1200
  total), but the difference is that everyone else is up there too —
  median bots are at 830-920, not stuck at baseline 20.

## 2. Stat distribution — top vs. median

| run | top total | median total | **ratio** | system sum (start=360) |
|---|---|---|---|---|
| E (regression) | 1,631 | 19 | **86.3×** | 2,019 |
| A | 1,085 | 833 | **1.3×** | 16,821 |
| B | 1,156 | 910 | **1.3×** | 18,387 |
| C | 1,172 | 832 | **1.4×** | 17,167 |
| D | 1,117 | 924 | **1.2×** | 18,427 |

**86.3× → 1.2-1.4×** is the biggest win. The binary god/fresh pattern
is gone; there's a power gradient of ~250-330 total stats between
top and median, which is a healthy competitive spread (strong bots
are strong, but not *inaccessibly* so).

**Why are totals so high (16k-18k)?** Combat is roughly conservative
under ELO (killer gain ≈ loser loss), so the extra ~16,400 stats per
run are **from dot consumption**. Bots in teleport mode don't die —
they keep eating. 20 bots × 600k frames with ~0.1 stat/dot means
dots are now the primary source of stat accumulation. **This is the
new runaway source** that M2 needs to address (see §6 below).

## 3. Combat outcome distribution

| run | total combats | mutual | one-sided | zero-dmg | one-sided % |
|---|---|---|---|---|---|
| E | 5,939 | 1,311 | 4,609 | 19 | **77.6%** |
| A | 35,971 | 14,146 | 21,467 | 358 | 59.7% |
| B | 33,779 | 10,607 | 22,798 | 374 | 67.5% |
| C | 33,183 | 11,312 | 21,522 | 349 | 64.9% |
| D | 33,917 | 9,284  | 24,219 | 414 | 71.4% |

Observations:
- **Teleport runs have 6× more combat events** (34k vs 6k). Because
  bots don't die and reset, they keep encountering each other.
  Combat is cheaper per event (ELO rewards ≈ 0-2 per kill) but
  there's much more of it.
- **One-sided combat % is still 60-71%** in teleport runs. Without
  `damageFloor` enabled, the `attack - defence` formula still clamps
  to zero for weaker attackers. But under ELO + teleport, one-sided
  combat is self-limiting — a dominant bot only earns ~0.03 stats
  per "bully kill", so it doesn't snowball. **damageFloor is no
  longer necessary.** It could still be enabled for cleaner combat
  feel but it's no longer load-bearing for balance.

## 4. Strategy distribution per seed (from `--npc-strategies`)

| run | seed | gatherer | hunter | survivor | opportunist | aggressive | simple |
|---|---|---|---|---|---|---|---|
| E | 42 | 5 | 3 | 8 | 1 | 2 | 1 |
| A | 7  | 4 | 3 | 2 | 5 | 5 | 1 |
| B | 42 | 5 | 3 | 8 | 1 | 2 | 1 |
| C | 13 | 3 | 2 | 4 | 4 | 6 | 1 |
| D | 99 | 7 | 3 | 5 | 2 | 2 | 1 |

B has the same distribution as E because same seed. A/C/D produce
different strategy mixes, which is good — we're testing across
genuine variation.

## 5. Per-strategy K/D ratios

### E (seed 42, REGRESSION — matches 2026-04-10 baseline)
| strategy | bots | K/D |
|---|---|---|
| gatherer | 5 | **2.06** |
| survivor | 8 | 0.97 |
| hunter | 3 | 0.80 |
| aggressive | 2 | 0.39 |
| opportunist | 1 | 0.37 |
| simple (player) | 1 | **0.05** |

### A (seed 7, teleport+elo)
| strategy | bots | K/D |
|---|---|---|
| **gatherer** | 4 | **6.41** |
| **survivor** | 2 | **27.30** |
| opportunist | 5 | 1.32 |
| hunter | 3 | 1.01 |
| aggressive | 5 | 0.48 |
| simple (player) | 1 | 0.00 |

### B (seed 42, teleport+elo)
| strategy | bots | K/D |
|---|---|---|
| **gatherer** | 5 | **4.35** |
| **survivor** | 8 | **3.75** |
| hunter | 3 | 0.72 |
| opportunist | 1 | 0.78 |
| aggressive | 2 | 0.56 |
| simple (player) | 1 | 0.00 |

### C (seed 13, teleport+elo)
| strategy | bots | K/D |
|---|---|---|
| **survivor** | 4 | **6.16** |
| **gatherer** | 3 | **2.93** |
| opportunist | 4 | 1.38 |
| hunter | 2 | 0.81 |
| aggressive | 6 | 0.67 |
| simple (player) | 1 | 0.01 |

### D (seed 99, teleport+elo)
| strategy | bots | K/D |
|---|---|---|
| **survivor** | 5 | **4.59** |
| **gatherer** | 7 | **2.71** |
| opportunist | 2 | 0.90 |
| hunter | 3 | 0.72 |
| aggressive | 2 | 0.48 |
| simple (player) | 1 | 0.00 |

**Cross-run K/D medians:**
- gatherer: 2.06 → 2.71/2.93/4.35/6.41 (range **2.7-6.4** with fix)
- survivor: 0.97 → 3.75/4.59/6.16/27.30 (range **3.75-27.30** with fix)
- hunter: 0.80 → 0.72/0.72/0.81/1.01 (range **0.72-1.01** with fix)
- aggressive: 0.39 → 0.48/0.48/0.56/0.67 (range **0.48-0.67** with fix)
- opportunist: 0.37 → 0.78/0.90/1.32/1.38 (range **0.78-1.38** with fix)
- simple/player: 0.05 → 0.00/0.00/0.00/0.01 (range **0.00-0.01** with fix)

**What this tells us:**
- **Gatherers and survivors still win** — they win harder, not less
  hard, than the baseline. K/D values jumped from ~2 to 3-6 for
  gatherers and from ~1 to 4-27 for survivors. Teleport + ELO fixed
  the *extreme* concentration but not the *relative* advantage.
- **Hunters stuck below 1.0** — hunter K/D barely moved. The gate in
  `bot-ai.js:394` (`combat_advantage ≥ 0`) still decides when to
  hunt, and under ELO, hunting down gives tiny rewards, so hunters
  waste their cooldowns on low-value combats.
- **Aggressives are worse than hunters** — probably because they
  have 55% hunter weight + 30% avenger weight, both of which gate
  on combat advantage. They fight when unlikely to win.
- **Opportunists improved** the most (0.37 → 1.38) — their mixed
  strategy with survivor components benefits from the new rules.
- **Player is catastrophic** — dropped from already-bad 0.05 to
  basically-zero. Discussed below.

## 6. The new runaway source — gatherers via dot-eating

With the combat runaway fixed, a subtler pattern emerges:
**gatherers win all four M1 runs**. Their combat K/D isn't as high
as survivors' (2.7-6.4 vs 3.75-27.3), but they're the top killers
by raw count in every single run.

Why? Two reinforcing mechanics:

1. **Dot-eating is still a fixed +0.1 stat per dot.** No ratio
   scaling, no cap. A gatherer that eats 2000 dots in a run gains
   +200 stats in pure dot rewards.
2. **In teleport mode, gatherers never die.** Under the old reset
   mechanic, a gatherer would eventually wander into combat and
   lose, resetting to baseline. Now they teleport after losses,
   keeping their accumulated stats. They come back, eat more dots.
3. **High-stat gatherers now trivially win combat** against the
   ~200-900 stat baseline of other NPCs. Combat K/D 2.7-6.4 is
   bonus income on top of the dot-growth engine.

**This isn't a bug of the rewrite — it's an unmasked pre-existing
feature.** Dot-eating was always a stat-growth mechanism; it just
used to be hidden because bots died too fast to benefit from it.
Teleport mode removed the death filter, revealing the gatherer
dominance.

**M2 needs to decide whether to address dot-eating as a runaway
source.** Options:
- **A. Leave it alone.** Dot growth is slow (~0.1 per eat), creates
  a rising tide, and gives everyone a reason to farm. The ~250-stat
  gap between top and median is modest.
- **B. Ratio-scale dot rewards too.** `addPartialRandomStat()`
  currently hardcodes 0.1 — could be scaled by `(baseline / current
  total)` to give diminishing returns as a bot grows.
- **C. Hard cap on dot-sourced stats only.** Gatherers gain until N
  stats then can't grow from dots anymore.
- **D. Make dots respawn slower.** Reduce total dot income across
  the population, forcing scarcity.
- **E. Accept the gatherer archetype as dominant.** Focus M2 on
  making hunters viable (DQ-5) so there's a counter-strategy.

My preference is **E + DQ-5** — gatherer dominance is OK if
hunters can actually hunt them down. Under ELO, hunting a 1000-stat
gatherer gives a huge reward (~2×base) to a 200-stat hunter. Fix
the template gating and hunters become apex predators.

## 7. Action histogram — does the hunter template hunt yet?

| run | hunter decisions | gather% | hunt% | flee% |
|---|---|---|---|---|
| E (regression) | 56,811 | 69.4% | 23.7% | 6.9% |
| A | 35,679 | 78.2% | 21.0% | 0.8% |
| B | 38,881 | **85.0%** | **14.2%** | 0.8% |
| C | 22,291 | 78.7% | 20.8% | 0.4% |
| D | 38,666 | 83.3% | 16.2% | 0.5% |

**Hunters are hunting *less* in M1 than in the regression run**
(14-21% vs 23.7%). Why? Because under ELO, the `combat_advantage`
context variable is still computed from raw stat totals, and in
teleport mode, hunter templates often have lower totals than the
gatherer-dominated field around them. Their combat_advantage is
more often negative → they default to 'gather' → they don't gain
via the hunt path.

**This is exactly what DQ-5 predicted.** The combat_advantage gate
was sensible in a world where combat was zero-sum; under ELO, it
becomes counterproductive because hunting up is the most profitable
thing a hunter can do and the gate forbids it.

## 8. The player's `simple` mode is broken

Player K/D dropped from a mediocre 0.05 (old baseline + regression)
to basically zero (0.00-0.01) in all M1 runs. The player lost 3,400
to 3,700 "combats" in 600k frames — that's about one teleport every
160-180 frames, which is roughly every 3 seconds of game time.

Why is the player so bad?
- The player uses `pickTargetSimpleMode` with the default
  `behaviorWeights` in `config.js`.
- NPC templates use *tuned* weights chosen by whoever designed the
  gatherer/hunter/survivor presets.
- The default `behaviorWeights` have *not* been tuned for a world
  where other bots are running tuned presets.
- On top of that, the player starts with `playerStats = {5,5,5,3}`
  which is baseline — they're the same strength as a fresh bot but
  everyone around them has been accumulating stats for thousands of
  frames.

**This is a real problem for multiplayer.** Humans in multiplayer
will initially configure their bot in the Simple UI, which
currently gives them a bot that loses ~every fight. Needs tuning
in M2.

## 9. Final state — top 5 per run

**E — seed 42, reset+fixed (regression)**
```
#12 (gatherer   ) k=1032 stats=431/413/418/369   ← god-bot as expected
# 3 (hunter     ) k= 191 stats=5/5/5/3
#15 (aggressive ) k= 110 stats=5/5/5/3
#16 (gatherer   ) k= 110 stats=5/5/5/3
#18 (survivor   ) k= 105 stats=6/7/9/3
```

**A — seed 7, teleport+elo**
```
# 9 (gatherer)   k=1301 stats=283/284/288/230
#10 (gatherer)   k=1055 stats=258/251/251/259
#12 (gatherer)   k= 968 stats=257/262/258/268
# 5 (hunter)     k= 821 stats=210/227/204/207
# 1 (survivor)   k= 783 stats=289/304/307/74
```

**B — seed 42, teleport+elo**
```
#13 (gatherer)   k= 853 stats=262/255/259/240
# 6 (survivor)   k= 785 stats=290/275/275/100
# 5 (gatherer)   k= 632 stats=234/230/236/210
# 4 (hunter)     k= 615 stats=231/241/211/164
#14 (gatherer)   k= 547 stats=244/237/253/160
```

**C — seed 13, teleport+elo**
```
#11 (gatherer)   k=1402 stats=293/293/293/294
# 3 (gatherer)   k=1017 stats=247/249/237/148
# 2 (aggressive) k= 985 stats=201/187/189/189
#18 (survivor)   k= 952 stats=323/327/314/133
#10 (opportunist) k=792 stats=250/255/231/238
```

**D — seed 99, teleport+elo**
```
#16 (gatherer)   k= 993 stats=262/264/267/37
# 4 (gatherer)   k= 835 stats=268/252/251/249
#11 (gatherer)   k= 811 stats=261/246/250/104
# 9 (gatherer)   k= 709 stats=233/232/234/226
# 3 (survivor)   k= 563 stats=279/279/284/273
```

Note how the **top 5 in each M1 run have comparable stats**
(200-330 range), vs the regression where #1 is at 431 and #2 is at
baseline 5/5/5/3. That's the "gradient not binary" pattern.

---

## M1 verdict — what's next for M2

**Confirmed working:**
- ✅ DQ-6 (teleport not kill) eliminates the binary god/fresh
  population pattern
- ✅ DQ-7 (ELO rewards) prevents the +1-per-kill snowball
- ✅ Runaway gone across 4 seeds
- ✅ Regression reproduces the original bug with old knobs

**Unresolved, now measurable:**
- ⚠️ **DQ-5 (hunter template gate)** is validated — hunters still
  gather 78-85% of decisions even under ELO. The
  `combat_advantage ≥ 0` gate needs to be softened or inverted.
- ⚠️ **DQ-8 (NEW): gatherer dominance via dot-eating.** The
  pre-existing dot-growth mechanism is now the primary source of
  stat accumulation. Not a regression from the rewrite — an
  unmasked feature. Needs a design decision (options A-E in §6).
- ⚠️ **DQ-9 (NEW): player `simple` mode default weights are bad.**
  K/D 0.00-0.01 across all 4 M1 runs. Default `behaviorWeights`
  need retuning against the NPC templates.

**Out of scope for M1, still valid:**
- `damageFloor` is no longer load-bearing for balance under
  teleport+ELO. It could be removed from the primary balance
  surface and relegated to sandbox/regression-test tooling.
- `statCap` remains a safety-ceiling option, not a primary
  mechanism.

## Recommended M2 shape

1. **DQ-5: fix hunter gate.** Replace `combat_advantage ≥ 0` with
   something ELO-aware: either drop the gate entirely, lower it to
   `≥ -N`, or invert it so hunters prefer combats where they'd
   upset (which is most rewarding under ELO).
2. **DQ-8: decide on dot-growth.** Options A-E in §6. My vote: **E**
   (leave alone) + DQ-5 fix, then re-measure. If gatherers are
   still dominant after hunters become viable, revisit.
3. **DQ-9: retune player `simple` default weights.** Pure engineering
   tuning exercise. Benchmark against the 4 NPC templates.
4. **Re-run a smaller seed-42-only comparison matrix** after each
   fix so we can attribute changes to the right knob.

Follow-ups in the balance-findings doc as OQ/DQ entries.

---

## Raw data

Files (all under `matrix-2026-04-11-teleport-elo/`, local only):
- `E-seed42-REGRESSION-reset-fixed.ndjson.gz` (3.8 MB)
- `A-seed7-teleport-elo.ndjson.gz`  (4.7 MB)
- `B-seed42-teleport-elo.ndjson.gz` (4.7 MB)
- `C-seed13-teleport-elo.ndjson.gz` (4.7 MB)
- `D-seed99-teleport-elo.ndjson.gz` (4.7 MB)

Event counts per run: ~492k-510k events (M1), ~420k events (E).
Decisions per run: ~400k (decision event type from the
pickNewTarget wrap).
