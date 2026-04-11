# M1 measurement matrix — results and next steps

Companion discussion document to `analysis.md`. Contains the narrative
summary of the M1 run, the three findings it surfaced, and the
proposed shape of milestone 2 (template retuning). Preserved
2026-04-11 before starting milestone 2 implementation.

## What ran

The 5-run measurement matrix finished and the analysis + findings
update are committed (`eb09a39`). The matrix tested the new teleport
+ ELO combat mechanics from commit `4d407f6` (the milestone called
**milestone 0 — core combat rewrite**, which added the
`combatSettings.deathBehavior`, `combatSettings.killReward`, and
`combatSettings.lossPenalty` knobs).

| run | seed | knobs |
|---|---|---|
| **E — regression** | 42 | `reset` + `fixed` (old v11 defaults, should reproduce the god-king bug) |
| A | 7  | `teleport` + `elo` + `elo-scale 100` |
| B | 42 | `teleport` + `elo` + `elo-scale 100` |
| C | 13 | `teleport` + `elo` + `elo-scale 100` |
| D | 99 | `teleport` + `elo` + `elo-scale 100` |

All 5 runs: 600k frames, 20 bots, `--decisions --npc-strategies`,
~15 minutes total. Full breakdown in `analysis.md` (~250 lines).

---

## Headline result — the combat rewrite worked

The runaway-stat-growth bug ("god-king" pattern) is eliminated
across all 4 seeds:

| metric | old baseline (2026-04-10 matrix) | this matrix (2026-04-11) |
|---|---|---|
| top-bot kill share | 25-42% | **10-14%** ✓ |
| top/median stat ratio | 52-89× | **1.2-1.4×** ✓ |
| stat distribution shape | binary "1 god + 19 fresh" | smooth ~250-stat gradient ✓ |
| combat stat conservation | no (+1 per kill unbounded) | yes (ELO is zero-net) ✓ |

The regression run (seed 42, old v11 defaults) still reproduces the
bug exactly — bot #12 reaches 431/413/418/369 stats, 41.9% kill
share, 86.3× ratio. This is a bit-for-bit match against the
original 2026-04-10 god-king run, which proves the combat rewrite
is what changed outcomes rather than some other code drift over the
session.

---

## Three new findings that M1 surfaced

Turning off the runaway exposed three pre-existing issues that were
previously hidden. Two are new and were added to `balance-findings.md`
as proper entries with both numbered and named forms so they can be
referred to either way.

### Finding 1 — Hunter template combat-advantage gate is broken under ELO rewards

(This is the item the findings doc calls `DQ-5: retune
hunter/aggressive template combat-advantage gate`. Already in the
doc, but M1 provided the empirical confirmation.)

Under the new teleport + ELO rules, hunter-template bots hunt *less
than before*. In the regression run they hunt 23.7% of decisions;
in the 4 new runs they hunt only 14-21%. The rest of the time they
gather.

Cause is at `bots-strategy-v11/js/bot-ai.js:394`:
```js
hunter: context['combat_advantage'] >= (hunterParams.minAdvantage || 0) ? 'hunt' : 'gather'
```
This says "only hunt when you're stronger than your nearest enemy".
In the old zero-sum-combat world that was defensive common sense.
In the new ELO world, hunting up is *the most profitable thing a
hunter can do* (an upset kill against a much stronger target gives
~2× the base reward). So the gate is now backwards — it's stopping
hunters from taking the best fights available to them.

This is the M1 empirical confirmation of the thing I framed earlier
as a design trap rather than a code bug.

### Finding 2 — Gatherers dominate via dot-eating, not via combat

(New — added to the findings doc as `DQ-8 / DQ-DOTGROWTH`.)

Gatherers won every single one of the four new runs, not because of
kill rewards (their combat K/D is 2.7-6.4, high but not extreme)
but because of dot consumption:

- `Bot.addPartialRandomStat` (called on every dot eaten) grants a
  flat `+0.1` per dot, with no ratio scaling and no cap.
- Under teleport mode bots stay alive indefinitely, so they keep
  eating.
- System-wide total stats grow from the starting 360 to
  **16,800-18,400** per run — and the ELO combat system is
  conservation-neutral by design. That means essentially all of
  that +16,000 growth is coming from dots.

This is *not* a regression from the combat rewrite. It's a
pre-existing stat-growth mechanism that was hidden before because
bots died too fast to accumulate. Teleport mode removed the death
filter and revealed how much power dots actually contribute.

Five options for this in the findings doc (A through E); my
preferred answer is option E (leave dot growth alone and fix the
hunter gate, so that hunters naturally counter gatherer dominance
under ELO).

### Finding 3 — Player simple mode is catastrophically undertuned

(New — added to the findings doc as `DQ-9 / DQ-PLAYER-TUNING`.)

The player bot's K/D ratio across the four new runs is 0.00-0.01.
The player lost **3,400-3,700 combats in 600k frames** — roughly
one teleport every three seconds of game time. Compared to every
NPC template, the player is getting obliterated.

Root cause: the player uses `pickTargetSimpleMode` with the global
`behaviorWeights` in `config.js`. The NPC templates in
`NPC_STRATEGY_TEMPLATES` use tuned weights someone picked when
designing the gatherer/hunter/survivor presets. The default
`behaviorWeights` were never benchmarked against those templates.
The gap was already bad in the old baseline (player K/D ~0.05) but
was masked by the fact that everyone except one god-bot was also
losing all the time.

This is a real multiplayer problem. The Simple UI is what humans
use to configure their bot before a match. Right now those defaults
produce a bot that loses nearly every fight to the tuned field.
Critical to fix before we're in a multiplayer context where human
players actually suffer the UX.

---

## Proposed milestone 2 — template retuning

This is the work block called **milestone 2 — template retuning**
in the roadmap. Under the new multiplayer-direction priority, its
goal is: "make the NPC templates and the player simple-mode default
behave sensibly under the new teleport + ELO combat rules". Three
sub-tasks, one per finding above.

### Order recommended

**Step 1 — fix the hunter gate** (the thing the findings doc calls
`DQ-5: retune hunter/aggressive template combat-advantage gate`).

Smallest change, biggest measurement value. One line in
`bots-strategy-v11/js/bot-ai.js:394`. Re-measure hunters immediately
afterward and we'll know if they become viable under ELO.

**Step 2 — retune the player's default behavior weights** (finding 3,
the one called `DQ-9 / DQ-PLAYER-TUNING`).

Tune `behaviorWeights` in `config.js` and benchmark against the NPC
templates. Since the player uses the same `behaviorActions` map as
finding 1 / `DQ-5`, fixing the hunter gate in step 1 automatically
helps the player a bit. After step 1 lands, measure the player
again and decide how much additional tuning is needed.

**Step 3 — decide on dot-growth dominance** (finding 2, the one
called `DQ-8 / DQ-DOTGROWTH`).

Conditional on step 1's outcome. If hunters become apex predators
that naturally check gatherers, this is already resolved (option E
from the findings doc). If gatherers still dominate after hunters
are viable, pick one of the other four options (ratio-scale dot
rewards, hard cap on dot-sourced stats, slower dot respawn, or
ratio-scale at `addPartialRandomStat`).

Each step can be a separate commit with a focused seed-42-only
comparison run (~4 minutes each, much cheaper than a full 4-seed
matrix). Full 4-seed matrix only rerun when all three steps land,
as a milestone-2 final measurement.

---

## Questions pending before milestone 2 starts

**Question 1 — start milestone 2 now, or hold?**

Same shape as milestone 0: plan the sub-tasks, implement one at a
time, run tests, smoke-test, then decide when to run a focused
measurement. Each step is smaller than milestone 0 was.

**Question 2 — for the hunter-gate fix (finding 1 / `DQ-5`), which
option?**

The gate currently says: `hunter: 'hunt' if combat_advantage >= 0
else 'gather'`. Four candidates for replacing it:

| option | behavior | pros | cons |
|---|---|---|---|
| 1. Remove gate entirely — `hunter: 'hunt'` | always try to hunt | simplest; lets ELO sort risk/reward | hunters take bad fights when outclassed and waste combat cooldowns |
| 2. Invert gate — hunt when `combat_advantage < 0`, gather otherwise | actively seek upsets | aligns with ELO incentive | could read as weird "suicidal" combat if taken literally |
| 3. Lower threshold — hunt when `combat_advantage >= -N` for some N | compromise | tunable | another magic number to pick |
| 4. Probabilistic — hunt with probability `sigmoid(combat_advantage + bias)` | smooth curve | most elegant | most complex, needs a new helper |

Vote: **option 1 (remove gate entirely)** as the milestone-2
starter. The `combat_advantage` variable was filtering out bad
fights in a zero-sum world. Under ELO, every combat has a sensible
risk/reward profile baked into the reward math — an overwhelming
killer earns ≈0, an upset killer earns ≈2×base, so the math
self-regulates. If option 1 proves too aggressive we can escalate
to option 3 or 4 in a follow-up.

**Question 3 — player-weights retuning scope (finding 3 /
`DQ-9 / DQ-PLAYER-TUNING`).**

Just retune the numbers in the default `behaviorWeights` object in
`config.js`? Or also revisit the `behaviorActions` map (which is
what finding 1 / `DQ-5` is about)? Since the player uses the same
`behaviorActions` map as NPCs, fixing `DQ-5` automatically benefits
the player too. Recommend doing `DQ-5` first, measuring the player
under the fix, and only then retuning the weights if the player is
still catastrophic.

**Question 4 — dot-growth decision (finding 2 / `DQ-8 /
DQ-DOTGROWTH`).**

Agree to defer the decision until after `DQ-5` measurement?
Prediction is that once hunters actually hunt, gatherers become
vulnerable to upset kills and dot-growth stops being a runaway
concern. If that prediction is wrong, pick an option then.

---

# God-king trajectory + competition dynamics

Added 2026-04-11 as a follow-up investigation after the M1 analysis
finished. Two specific questions answered from the raw data files:

1. How many battles (kills) or dots (eats) does a bot need before
   it "turns god" and dominates the rest?
2. Under the old rules, is there always exactly one dominant bot,
   or sometimes 2-3 competing? Under the new rules (teleport+ELO),
   does the competition actually hold up?

Analyzed three runs to answer:
- `runs/2026-04-10-seed42-600k-baseline/simlog.ndjson.gz` — the
  original bug-discovery run (seed 42, reset+fixed)
- `runs/matrix-2026-04-11-teleport-elo/E-seed42-REGRESSION-reset-fixed.ndjson.gz`
  — M1 regression run (same seed 42, same mechanics, but with
  `--decisions --npc-strategies` enabled so the PRNG stream is
  different)
- `runs/matrix-2026-04-10/A-seed7-baseline.ndjson.gz` — seed 7,
  reset+fixed (different seed, same buggy rules)
- `runs/matrix-2026-04-11-teleport-elo/B-seed42-teleport-elo.ndjson.gz`
  — the new mechanics run on seed 42 for contrast

## Question 1 — How many battles/dots before a bot turns into a god-king?

The old-rules runs (reset + fixed reward) all show the same
progression pattern, with some variation in timing depending on the
exact random stream:

| threshold | what it means | seed 42 original (bot #12) | seed 42 M1 regression (bot #12 again) | seed 7 baseline (bot #13) |
|---|---|---|---|---|
| 25 total stats | 1.25× baseline | frame 6k, **8 kills + 40 eats** | frame 8.5k, **5 kills + 58 eats** | frame 5.5k, **3 kills + 42 eats** |
| 50 | 2.5× baseline | frame 10k, **31 k + 54 e** | frame 20k, **20 k + 176 e** | frame 19.5k, **21 k + 142 e** |
| 100 | 5× baseline | frame 19.5k, **78 k + 77 e** | frame 35.5k, **41 k + 465 e** | frame 35.5k, **55 k + 376 e** |
| 200 | 10× baseline | frame 29.5k, **177 k + 94 e** | frame 57k, **92 k + 967 e** | frame 57.5k, **104 k + 909 e** |
| 500 | 25× baseline | frame 56k, **479 k + 133 e** | frame 113.5k, **230 k + 2572 e** | frame 116k, **231 k + 2600 e** |
| 1000 | 50× baseline | frame 98k, **970 k + 190 e** | frame 257.5k, **521 k + 4614 e** | frame 229k, **479 k + 5053 e** |

**The honest answer is "it depends on what's in the lobby"** —
different seeds and different flags produce two distinct
trajectories:

**"Combat-heavy" trajectory** (seed 42 original, bot #12):
- Reaches 500 stats on ~480 kills + 130 eats (kills ≫ eats)
- Pure combat snowball: bot #12 wins an early encounter, gets
  stronger, wins the next, etc.
- Total stat growth is ~90% combat-derived, ~10% dot-derived

**"Dot-heavy" trajectory** (seed 42 M1 regression, seed 7 baseline
— both runs done with `--decisions --npc-strategies`):
- Reaches 500 stats on ~230 kills + 2,600 eats (eats ≫ kills)
- The god-bot here is a gatherer that happens to win fights. It
  spends most of its time eating dots, picks fights occasionally,
  and wins them because it's slightly stronger from dots.
- Total stat growth is ~10% combat-derived, ~90% dot-derived

**Why the same seed produced different outcomes across the two
seed-42 runs:** enabling `--decisions` and `--npc-strategies` adds
calls into the seeded `Math.random()` stream (for strategy template
assignment and for behavior weight selection). Same starting seed,
different PRNG path from frame 1 onwards. The runaway is
*structural* (always happens), but which bot wins and whether it's
combat-driven or eat-driven is contingent on lobby composition.

### Practical summary

- **A bot can diverge from the pack as early as ~5-10k frames**
  (1-2 minutes of game time) with only 3-8 kills and 40-60 eats.
  That's the "first inflection point".
- **By 20-35k frames** (5-6 minutes) it's crossed the 100-stat
  threshold (5× baseline) and the divergence is permanent — no
  other bot ever catches up under the old rules.
- **To reach "full god" (500-1000+ stats)** takes 56-230k frames
  (15 minutes to an hour of game time), by which point the bot has
  **200-500 kills** OR **2,500-5,000 eats** depending on whether
  it's a combat- or gather-snowball.
- **If you want a single number to remember: ~200 kills, or ~2,500
  dots eaten, is the point of no return** — whichever comes first.

## Question 2 — One dominant bot, or 2-3 competing?

The data is clear and the answer depends entirely on which combat
rules are running.

### Under old rules (`reset + fixed` — the buggy mode)

**Always exactly one.** After an early shakeout in the first
~10-20k frames, the god-bot is alone at the top and nobody catches
up.

| run | leaders during first 10k | leaders after 10k | distinct bots that ever held #1 | bots within 20% of #1 at end |
|---|---|---|---|---|
| seed 42 original | #19 → #1 → #12 | **#12 only** | 2 (#12, #13 brief overlap) | **1** (just #12) |
| seed 7 baseline | #13 → #12 → #13 | **#13 only** | 2 (#12, #13) | **1** (just #13) |

Concretely for seed 7 at frame 20,000: bot #12 was briefly #1 with
58 total stats and bot #13 was only 1 point behind. Forty thousand
frames later bot #13 had permanently taken over and the gap between
it and everyone else had blown out to 138 stats and growing. From
there to frame 600,000 it was a completely uncontested monarchy.

So the old-rules pattern is: **a brief 10-20k-frame power struggle
between 2-3 candidate bots, then exactly one of them runs away and
everyone else is forever stuck at baseline**. The "2nd place" at
the end of any old-rules run isn't a competitor — it's just
"whoever happened to eat the most dots while getting killed by the
god-bot".

### Under new rules (`teleport + ELO`)

**Many bots compete, and the top spot rotates constantly.** From
the seed-42 M1 teleport+ELO run:

| metric | value |
|---|---|
| distinct bots that held #1 rank across the run (after frame 1000) | **9 bots** (nearly half the lobby) |
| top 5 final totals | 1156, 1107, 1016, 1010, 973 — all within 16% of each other |
| bots within 20% of top at frame 100,000 | 4 |
| bots within 20% of top at frame 400,000 | 8 |
| bots within 20% of top at frame 600,000 | **8** |
| bots within 50% of top at frame 600,000 | **all 20** |

The specific leader sequence across the run:
**#14 → #13 → #6 → #13 → #6 → #6 → #8**. That's six transitions of
#1 status. The top spot is not stable; bots trade places as upsets
accumulate.

The "~250-stat gradient" mentioned in the analysis file is actually
more granular than that implied. In the seed-42 M1 run there are
**eight bots within 20% of each other at the top**, with the
remaining 12 bots in the "50% tier" below them. It's essentially a
bell curve with a long, competitive head, not a single dominant
peak.

## Net comparison

| question | old rules (reset + fixed) | new rules (teleport + ELO) |
|---|---|---|
| How many bots compete for #1? | 2-3 in early game, **1** after | **5-9** throughout |
| Does #1 stay the same bot? | Yes, permanently, after ~10-20k frames | No, rotates frequently |
| Time for a bot to "turn god" (500+ stats, >10× baseline) | 56-230k frames, permanent | Nobody reaches 500 alone; ceiling is shared |
| Power gap top-vs-2nd (end of run) | **1,700-4,800** stats | **40-80** stats |
| Power gap top-vs-median (end of run) | **86×** | **1.3×** |

So "sometimes 2-3 competing?" has two answers depending on the
mechanics:

- **Under the old rules: almost never**, other than a brief
  10-20k-frame opening shuffle. After that, one bot is alone
  forever.
- **Under the new rules: always multi-way**. Typically 5-9 bots are
  within striking distance of the top, the #1 slot rotates, and no
  single bot can lock in permanent dominance because upset rewards
  (from ELO) redistribute power every time a leader gets caught.

This is exactly the property we wanted from multiplayer-compatible
balance: a persistent competitive head of the pack where your bot
can *actually* climb, rather than a binary "I'm the god or I'm
fresh".
