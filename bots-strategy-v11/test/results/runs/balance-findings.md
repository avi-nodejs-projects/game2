# v11 Balance Findings & Open Questions

Living document tracking open questions about v11 game balance that
came out of long-running simulations. Each entry has a status so we
can resolve them over time without losing context.

**Last updated:** 2026-04-11

---

## Context

Discovered via long-run simulation logs under
`bots-strategy-v11/test/results/runs/`:

- **`2026-04-10-seed42-600k-baseline/`** — single 600k-frame run that
  first exposed the god-king runaway (one bot reached ~1,200 in every
  stat, 4,731 kills, 0 deaths).
- **`matrix-2026-04-10/`** — 4-run matrix (seeds 7/42/13/99, mix of
  fixes) that confirmed the runaway is structural and measured the
  effect of each new knob.

See `matrix-2026-04-10/analysis.md` for the full numeric breakdown.
This doc is the *decisions pending* companion — raw findings + open
questions + design suggestions.

## Confirmed findings (not open)

1. **Runaway stat growth is structural, not seed-specific.** 4/4
   seeds produced a dominant bot with 25-38% kill share.
2. **`combatSettings.damageFloor` works at the formula level** —
   one-sided combats drop from 76% to 1-2%. But it does NOT break
   the +1-stat-per-kill feedback loop; top/median stat ratio only
   drops from 89× to 52-70×.
3. **`combatSettings.statCap` is the necessary second piece.** Run D
   (`damageFloor 0.1 + statCap 50`) is the only run that produced
   a recognisably balanced distribution (10.4× ratio).
4. **Under damageFloor rules, combat is a net cost.** K/D by
   template (Run B, seed 42):
   - survivor 1.70, gatherer 1.28, hunter 0.58, aggressive 0.56,
     opportunist 0.37, player(simple) 0.22
5. **Survivor template wins 3 of 4 seeded runs** (seeds 13, 42, 99).
   Pure snowball: survivor avoids fights → retains stats → eventually
   strong enough that its flee-threshold stops triggering → becomes
   unstoppable.
6. **Hunter/aggressive templates gather most of the time** despite
   their template weights claiming otherwise. `bot-ai.js:392`
   `behaviorActions.hunter` falls back to `'gather'` when no enemy
   is in `targetRange`. Actual action mix for `hunter` template in
   Run B: gather 69.6%, hunt 22.7%, flee 7.7%.
7. **Player `simple` default has the worst K/D (0.22).** The default
   `behaviorWeights` in config.js appear to be badly tuned compared
   to the NPC templates.

---

## Open questions — simulation follow-ups

Runs to queue next. Each ≈ 200s with `--decisions --npc-strategies`
at 600k frames.

### OQ-1: Does a tighter `statCap` produce real balance?

- **Status:** pending
- **Command:**
  ```
  node bots-strategy-v11/test/simlog.js --seed 99 --frames 600000 \
    --snap-every 500 --gzip --decisions --npc-strategies \
    --damage-floor 0.1 --stat-cap 20 \
    --out .../matrix-*/D2-seed99-cap20.ndjson.gz
  ```
- **Hypothesis:** at cap=20, top/median ratio should drop from 10.4×
  (cap=50) to ~4-5×. If survivors still dominate even at cap=20,
  the problem isn't stat accumulation — it's that survival alone
  wins fights once fights are mutual.
- **Decision needed:** does a tighter cap give balance, or do we
  need deeper mechanics (OQ-3/OQ-4)?

### OQ-2: Is `statCap` alone sufficient, without `damageFloor`?

- **Status:** pending
- **Command:**
  ```
  node bots-strategy-v11/test/simlog.js --seed 42 --frames 600000 \
    --snap-every 500 --gzip --decisions --npc-strategies \
    --stat-cap 20 \
    --out .../matrix-*/E-seed42-cap20-only.ndjson.gz
  ```
- **Hypothesis:** with cap=20 but no damageFloor, a capped bot still
  has ~4× the stats of a baseline bot. The original one-sided formula
  means the capped bot is still invincible to baseline bots. The cap
  just delays the problem instead of preventing it.
- **Decision needed:** can we drop damageFloor and simplify to just
  statCap, or are both genuinely needed?

### OQ-3: Does `lifecycle=starvation` neutralise the survivor snowball?

- **Status:** pending
- **Command:**
  ```
  node bots-strategy-v11/test/simlog.js --seed 42 --frames 600000 \
    --snap-every 500 --gzip --decisions --npc-strategies \
    --damage-floor 0.1 --stat-cap 50 --lifecycle starvation \
    --out .../matrix-*/F-seed42-starve-full.ndjson.gz
  ```
- **Hypothesis:** starvation forces even a stat-rich survivor to
  keep foraging. If it fails to eat or kill, it loses stats — a
  natural negative feedback loop that counters accumulation.
  Starvation scales with total stats, so the survivor's advantage
  *increases its starvation rate*, which is exactly the feedback
  we want.
- **Decision needed:** is starvation enough to fix balance *without*
  needing a stat-cap, or do we need both?

### OQ-4: Does `npcSettings.evolution` redistribute stats properly?

- **Status:** pending
- **Command:** needs a new simlog flag `--evolution` (not implemented
  yet). Alternative: hand-edit `ctx.npcSettings.evolution.enabled`
  inside simlog via a temporary injection, OR add the flag first.
- **Hypothesis:** `evolution` makes respawning bots inherit some of
  the killer's stats. This should redistribute accumulated power
  on every kill instead of letting it concentrate in the winner.
  If true, it's a more elegant fix than hard caps.
- **Decision needed:** add the `--evolution` flag to simlog, then
  run this test.

---

## Open questions — game design

Design suggestions from the matrix analysis. Each would change
game feel in a different direction — user decision required, not
just engineering.

### DQ-1: Tune default `statCap` lower

- **Status:** pending
- **Current default:** `maxPerStat: 50` (cap disabled by default)
- **Proposal:** change default to 20 or 30 if balance runs (OQ-1)
  confirm it works. Keep the setting opt-in.
- **Tradeoff:** a tighter cap produces a flatter power curve (less
  "my bot became powerful" satisfaction) but more competitive
  gameplay.

### DQ-2: Diminishing returns on kill rewards

- **Status:** pending
- **Proposal:** replace `addRandomStat()` +1-per-kill with
  `addStat(amount)` where `amount = 1 / (1 + currentKills/K)` for
  some K (e.g. K=10). First kill +1, tenth kill +0.5, hundredth
  kill +0.09.
- **Where:** `bots-strategy-v11/js/game.js:addRandomStat`
- **Tradeoff:** elegant, no hard cap, naturally slows winners
  without preventing any single bot from staying competitive.
  Harder to reason about than a fixed cap.

### DQ-3: Stat decay for idle bots

- **Status:** pending
- **Proposal:** every N frames (e.g. 3600 = 1 minute at 60fps), bots
  that haven't dealt damage or eaten lose 0.1 from a random stat,
  floored at the initial baseline.
- **Where:** probably a new `lifecycle.statDecay.*` block.
- **Tradeoff:** forces active play. Counters "old survivors"
  dominance. But can feel punishing for defensive playstyles.
- **Overlap warning:** `lifecycle.starvation` already does something
  similar (resets on eat/kill/damage). Decay might be redundant —
  test starvation first (OQ-3) before adding a new system.

### DQ-4: Combat bounty — stronger targets give bigger rewards

- **Status:** pending
- **Proposal:** kill reward = `baseReward * sqrt(victim.totalStats / my.totalStats)`.
  Killing a bot weaker than you gives <+1. Killing a bot stronger
  than you gives >+1. Rewards risk-taking.
- **Where:** `combat.js:handleCombat` — replace the
  `addRandomStat()` call with a bounty-aware version.
- **Tradeoff:** fixes the "hunters are dominated" problem by
  giving them a real incentive to pick on strong targets.
  Could encourage reckless play that destabilises NPC behavior.

### DQ-5: Fix hunter/aggressive template behavior-action fallback

- **Status:** pending (also covered in matrix analysis §5)
- **Problem:** `bot-ai.js:392` — `behaviorActions.hunter` falls back
  to `'gather'` when no enemy is in range. Result: hunter-template
  bots gather ~70% of the time. Template name is misleading.
- **Proposal options:**
  - Change fallback to `'patrol'` (a movement-only action that roams
    looking for enemies) — needs a new action type.
  - Widen `hunter.targetRange` default so "no enemy in range" is
    rarely true in a 2000×2000 map.
  - Keep the fallback but add a `patrol_seeking_enemy` bias when
    the fallback triggers, to actively move toward regions with
    enemies.
- **Tradeoff:** none really — the current behavior is just a bug in
  intent. Question is which fallback feels right.
- **Impact:** would change K/D numbers across the board. All future
  balance runs should use the fixed hunter semantics.

---

## How to use this doc

- **Picking a new task:** scan the `## Open questions` sections,
  find one with `Status: pending`, run the suggested command (for
  OQ) or discuss the proposal (for DQ).
- **After resolving:** change `Status: pending` →
  `Status: resolved — <short reason>`, link to the commit / run
  that decided it. Don't delete resolved entries — the history is
  the value.
- **Adding new findings:** put numeric / factual findings under
  `Confirmed findings`. Put open items under one of the two
  `Open questions` sections. Prefix new items with `OQ-` (sim run)
  or `DQ-` (design decision) and the next number.
- **Referring to this doc:** link from commit messages and other
  markdown files as `bots-strategy-v11/test/results/runs/balance-findings.md`.

## Related files

- `bots-strategy-v11/test/results/runs/2026-04-10-seed42-600k-baseline/observations.md`
  — original bug-discovery analysis
- `bots-strategy-v11/test/results/runs/matrix-2026-04-10/analysis.md`
  — full numeric breakdown of the 4-run matrix
- `bots-strategy-v11/CLAUDE.md` §Combat Settings — documentation of
  the `combatSettings` config block
- `bots-strategy-v11/js/combat.js` — `handleCombat` with stalemate
  branch + damage-floor logic
- `bots-strategy-v11/js/game.js:addRandomStat` — stat-cap enforcement
  point (also where DQ-2 would be implemented)
