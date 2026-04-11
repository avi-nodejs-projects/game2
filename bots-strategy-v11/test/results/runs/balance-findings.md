# v11 Balance Findings & Open Questions

Living document tracking design decisions about v11 game balance.
Reframed 2026-04-11 around the **online multiplayer** direction — see
the design direction section below. Each entry has a status so we
can resolve items over time without losing context.

**Last updated:** 2026-04-11

---

## Design direction: online multiplayer

The long-term target for v11 is **online multiplayer** — human players
share a field with NPC bots under the same mechanics. This reframes
the whole design problem.

**What the direction locks in:**

- **Progression persists through losses.** A player's bot accumulates
  power over time, and losing a fight costs some ground, not
  everything. Full stat-reset on death is rejected as a multiplayer
  mechanic — replaced by teleport + partial stat penalty
  (**DQ-6 / DQ-TELEPORT**).
- **Runaway is prevented by ratio-scaled combat rewards, not hard
  caps.** Winner gains scale with how much stronger the victim was;
  loser penalties scale with how much weaker the killer was. Strong
  bots can't profit from farming weak ones, and upsets naturally
  redistribute power (**DQ-7 / DQ-ELO**).
- **No socialist mechanics as primary balance.** Hard stat caps,
  forced decay, starvation pressure, and stat inheritance flatten the
  field and hurt individual progression. They're available as sandbox
  / ecosystem mode options but NOT the primary tuning target.

**Items that became superseded when the direction was locked in**
(preserved below in the Superseded Items section for reasoning
continuity):

- OQ-1 (tighter statCap) — hard caps reject persistent progression.
- OQ-2 (statCap alone) — same reason.
- OQ-4 (evolution / stat inheritance) — humans don't inherit each
  other's stats.
- DQ-1 (tune default statCap lower) — same reason as OQ-1.
- DQ-2 (diminishing returns) — **consolidated into DQ-7** since
  ratio-scaling IS a form of diminishing returns (opponent-based
  instead of kill-count-based).
- DQ-3 (idle decay) — punishes AFK players in multiplayer.
- DQ-4 (combat bounty) — **consolidated into DQ-7** since
  ratio-scaling IS a combat bounty, implemented symmetrically.

**Items that stay relevant but change priority:**

- OQ-3 (starvation) — demoted from "primary balance candidate" to
  "sandbox mode option". Not superseded, just not the default.
- DQ-5 (hunter/aggressive template gating) — status correction: not a
  bug, a design trap under runaway rules. Deferred to M2 — retune
  templates after the new combat rules land and we can see what
  hunting looks like in a ratio-rewarded world.

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

---

## Confirmed findings (factual, not open to debate)

1. **Runaway stat growth is structural, not seed-specific.** 4/4
   seeds produced a dominant bot with 25-38% kill share.
2. **`combatSettings.damageFloor` works at the formula level** —
   one-sided combats drop from 76% to 1-2%. But it does NOT break
   the +1-stat-per-kill feedback loop; top/median stat ratio only
   drops from 89× to 52-70×.
3. **`combatSettings.statCap` constrains peak power but not
   dominance.** Run D (`damageFloor 0.1 + statCap 50`) produced the
   only balanced distribution we've seen (10.4× ratio).
4. **Under damageFloor rules, combat is a net cost.** K/D by
   template (Run B, seed 42):
   - survivor 1.70, gatherer 1.28, hunter 0.58, aggressive 0.56,
     opportunist 0.37, player(simple) 0.22
5. **Survivor template wins 3 of 4 seeded runs** (seeds 13, 42, 99).
   Pure snowball: survivor avoids fights → retains stats → eventually
   strong enough that its flee-threshold stops triggering → becomes
   unstoppable.
6. **Hunter/aggressive templates hunt rarely in practice** because
   `bot-ai.js:394` uses `context['combat_advantage'] >= 0` to decide
   between `'hunt'` and `'gather'`. A weaker bot sensibly declines
   combat it would lose, which under runaway rules means "only the
   god-bot ever hunts because it's the only one with positive
   advantage". Not a code bug — a design trap that becomes a problem
   when combat is zero-sum.
7. **Player `simple` default has the worst K/D (0.22).** The default
   `behaviorWeights` in config.js appear to be badly tuned compared
   to the NPC templates.
8. **The "19 bots stuck at baseline" pattern is caused by kill+reset
   mechanics** (not a balance issue per se). Every dead bot full-
   resets to STARTING_STATS, so losers never retain anything. Without
   kill+reset, losers would accumulate a gradient instead of staying
   binary-fresh.

---

## Active roadmap

### M0 — Core combat rewrite (blocks everything else)

Replace the kill+reset + fixed-reward combat loop with
teleport+penalty + ratio-scaled rewards, as two independent opt-in
mechanics. Existing v11 behavior remains the default; new runs opt in
via `combatSettings` and simlog flags.

**Sub-tasks:**
- 0.1. Add `combatSettings.deathBehavior` enum: `'reset'` (current),
  `'teleport'` (new), `'remove'` (ecosystem mode). Default: `'reset'`.
- 0.2. Add `combatSettings.killReward` block: `.mode` in
  `'fixed' | 'ratioLinear' | 'ratioSqrt' | 'elo'`, `.base` for
  base reward, `.kScale` for ELO K factor. Default: `'fixed'`.
- 0.3. Add `combatSettings.lossPenalty` block: same modes as
  killReward. Default: `'none'` (current — losers reset and take no
  stat penalty beyond that).
- 0.4. Implement teleport path in `combat.js:handleBotDeath`. When
  `deathBehavior === 'teleport'`: skip the stat-reset logic, call
  `spawnAtRandom()` only, refill `lives` to max, apply
  `lossPenalty` formulas to stats, preserve relationships/packId/
  childIds/protectedFrom (the bot didn't die, it relocated).
- 0.5. Implement ratio formulas in `game.js:addRandomStat` or a new
  helper that takes `(bot, amount, preferredStat)`. Route the
  existing `bot2.addRandomStat()` calls in `combat.js:handleCombat`
  through a new `applyKillReward(killer, victim)` function that
  computes `amount` per the configured formula.
- 0.6. Add `applyLossPenalty(loser, killer)` symmetrically, called
  before the teleport step (or before the reset step if
  `deathBehavior === 'reset'`, for A/B comparison).
- 0.7. Unit tests (8-12) in `unit/combat.test.js` covering each mode
  enum, each formula, teleport vs reset vs remove behaviors,
  relationship preservation under teleport.
- 0.8. Add simlog CLI flags: `--death-behavior`, `--kill-reward`,
  `--loss-penalty`, plus `--reward-base` and `--reward-k`. Record
  them in the `meta` event.

**Starter formula:** `ratioSqrt` (option C from discussion). See
DQ-7 entry below for rationale and alternatives.

**Done when:** all 8 sub-tasks ship, full test suite passes, simlog
accepts the new flags, and a 10k-frame smoke test with
`--death-behavior teleport --kill-reward ratioSqrt
--loss-penalty ratioSqrt` completes without errors.

### M1 — Measurement run (answers DQ-6 / DQ-7 empirically)

Rerun the 4-seed matrix (seeds 7/42/13/99) with the new mechanics
enabled, so we can compare apples-to-apples against the existing
matrix-2026-04-10 baselines.

**Run config:**
```
--seed <s> --frames 600000 --snap-every 500 --gzip \
  --decisions --npc-strategies \
  --death-behavior teleport --kill-reward ratioSqrt \
  --loss-penalty ratioSqrt
```

**Analysis targets:**
- Does the top/median stat ratio stay bounded? Hypothesis: yes,
  because total stats in the system are conserved by symmetric
  ratio formulas.
- What's the new stat distribution shape? Hypothesis: bell curve
  around baseline instead of the current binary "1 god + 19 fresh".
- Does hunter K/D improve toward 1.0? Hypothesis: yes, because
  hunting up now yields bigger gains than hunting down.
- Does survivor dominance drop? Hypothesis: yes, because survivors
  no longer benefit from the kill+reset asymmetry.
- How does player `simple` mode compare now?

**Done when:** observations.md + raw gz files saved under
`runs/matrix-2026-04-XX-teleport/`, analysis.md written with
side-by-side numeric comparison to the 2026-04-10 matrix.

### M2 — Template retuning (conditional on M1 results)

If M1 shows hunter K/D is still < 1.0 or the player `simple` mode is
still at 0.22, retune:

- **DQ-5 (hunter/aggressive gating):** under ratio-scoring, the
  `combat_advantage >= 0` gate is wrong — hunting UP is profitable
  now, so the gate should be `combat_advantage >= -N` for some N,
  or removed entirely. Decide based on M1 data.
- **Player simple mode:** retune default `behaviorWeights` so the
  player is competitive with NPC templates.

Out of scope until M1 produces data.

### M3 — Multiplayer readiness (deferred)

Design items that depend on the combat rules being settled:
- How a human player replaces an NPC slot in the bot population
- Lobby / session / matchmaking model
- State persistence between sessions (stats carry over, reset, or
  rating-only?)
- Latency / authoritative-server considerations

Not scoped yet. Will become actionable once M0-M2 converge on
stable combat mechanics.

**Known infrastructure gap (discovered 2026-04-11):** v11's `playerStats`
is a global singleton in `js/config.js`, so any two bots flagged
`isPlayer = true` would share the same preferred stat, starting stats,
and reset values. The `playerBot` singleton in `main.js` (and the
debug/ui files that read it) has the same shape. When we implement
multiplayer, the first refactor will be converting `playerStats` into
a per-bot config object — essentially the structure v10's
`docs/2players.md` proposed via `playerConfigs = [{...}, {...}]`.
This does NOT block M0-M2: the combat rewrite and measurement runs
use the test harness with one player, and nothing in `combatSettings`,
`combat.js`, or the new DQ-6/DQ-7 code paths assumes there's only
one player. It's an M3 blocker only.

---

## Active open questions

### DQ-6 / DQ-TELEPORT: Replace kill+reset with teleport+penalty

- **Status:** pending (M0 blocker)
- **Proposal:** when a bot's `lives` reach 0, instead of full stat
  reset and respawn, teleport the bot to a random location, refill
  lives, apply a stat penalty (see DQ-7 for the amount), and preserve
  relationships (packId, parentId, childIds, protectedFrom). The bot
  didn't die — it took a loss and re-entered the game.
- **Where:** `js/combat.js:handleBotDeath`. New enum
  `combatSettings.deathBehavior: 'reset' | 'teleport' | 'remove'`.
- **Rationale:** the current kill+reset mechanic is the direct cause
  of the "19 fresh bots + 1 god" pattern. In multiplayer, full reset
  on every death is unacceptable UX. Teleport preserves progression
  while still imposing a meaningful cost.
- **Tradeoffs:**
  - Pro: smooth progression gradient instead of binary baseline/god
  - Pro: PvP-compatible
  - Pro: breaks combat loops (teleport separates combatants)
  - Con: needs tuning with DQ-7 penalties — too small and the runaway
    continues, too large and it feels like death
  - Con: more things to track across relationships/packs
- **Decision needed:**
  - What happens to `killCount`? (Preserve — it's a player achievement)
  - What happens to `generation`? (Preserve — bot didn't die)
  - What happens to `age` (lifecycle)? (Open — either preserve for
    continuity or reset for a fresh life; starts as preserved)
  - What happens if the player bot teleports? (Same rules — the player
    shouldn't get special treatment here)

### DQ-7 / DQ-ELO: Ratio-scaled combat rewards and penalties

- **Status:** pending (M0 blocker). Consolidates DQ-2 (diminishing
  returns) and DQ-4 (combat bounty).
- **Proposal:** replace the fixed `+1 random stat` kill reward with a
  formula that scales on the power ratio between killer and victim.
  Apply a symmetric penalty to the loser.
- **Formulas to choose from:**

  **Option A — Linear ratio:**
  ```
  R = victim.totalStats / killer.totalStats
  killer gains: base * R         // stronger victim = bigger gain
  loser loses : base * (1/R)     // weaker killer = bigger penalty
  ```
  Volatile: beating a much stronger opponent gives large gains;
  getting beat by a much weaker opponent gives large losses.

  **Option B — Logistic (proper ELO):**
  ```
  expected = 1 / (1 + 10^((victim.total - killer.total) / 400))
  delta    = K * (1 - expected)  // K ~= 32 like chess
  killer gains +delta, loser loses -delta
  ```
  Mathematically clean, self-limiting at the extremes, but
  `totalStats` isn't really a hidden rating so ELO is slightly
  the wrong model.

  **Option C — Square root (starter):**
  ```
  R = victim.totalStats / killer.totalStats
  killer gains: base * sqrt(R)   // e.g. base=1, R=4 → +2
  loser loses : base * sqrt(1/R) // symmetric
  ```
  Compresses extremes compared to linear; less opaque than ELO.
  Recommended starting point for M0.

- **Where:**
  - `js/config.js` — new `combatSettings.killReward` and
    `combatSettings.lossPenalty` blocks
  - `js/combat.js:handleCombat` — wrap `addRandomStat()` calls in a
    new `applyKillReward(killer, victim)` helper
  - `js/game.js:addRandomStat` — generalise to take an `amount`
    parameter instead of hardcoding `1`
- **Self-balancing property:** symmetric formulas conserve total
  stats across combats. A god-bot farming baseline bots gains ~0.5
  per kill and the baseline loses ~0.5; an upset (baseline kills
  god-bot) gains ~2 and the god-bot loses ~2. **Stats redistribute,
  they don't accumulate.** This is the property we've been missing.
- **Tradeoffs:**
  - Pro: no hard caps needed — prevents runaway via math, not policy
  - Pro: rewards risk-taking, punishes bullying
  - Pro: fits multiplayer (ELO-like feel)
  - Con: harder to reason about than `+1 per kill`
  - Con: tuning `base` and the formula choice is non-trivial
  - Con: player `simple` mode K/D will change unpredictably — may
    need retuning (→ M2)
- **Decision needed:**
  - Starter formula: sqrt (C)? linear (A)? ELO (B)? [vote: C]
  - Base reward: `base = 1`? higher? lower?
  - Asymmetry: should `killReward` and `lossPenalty` always use the
    same formula, or can they be independently configured?
    [vote: independent, configured separately, same by default]

### OQ-3: `lifecycle=starvation` as sandbox mode option

- **Status:** pending (demoted from primary balance candidate, M2+)
- **Reason for demotion:** forcing players to constantly forage is
  tedious in a multiplayer PvP context. Starvation remains a
  legitimate *sandbox* / ecosystem mode option but won't be the
  default multiplayer balance tool.
- **Hypothesis (still worth testing later):** starvation scales with
  total stats, so a stat-rich survivor starves faster than a baseline
  bot — a natural negative feedback loop that counters accumulation.
- **Decision needed later:** does starvation + teleport + ratio
  combine interestingly? Run as an additional matrix variant after
  M1 ships.

### DQ-5: Retune hunter/aggressive template gating (deferred to M2)

- **Status:** pending (deferred to M2)
- **Problem statement (corrected):** hunter templates in v11 check
  `combat_advantage >= 0` (bot-ai.js:394) before choosing the 'hunt'
  action. Under runaway rules this concentrates hunting on the
  already-winning bot. Not a code bug — it's defensive combat
  gating that made sense in zero-sum combat.
- **Why deferred:** once DQ-7 ships, hunting up becomes profitable.
  The `combat_advantage >= 0` gate may become counterproductive
  instead of defensive. Rather than guess the right fix, we'll
  wait for M1 data to show whether hunters naturally become viable
  under ratio-scoring, and tune from there.
- **Possible fixes (to decide after M1):**
  - Lower the gate threshold: `combat_advantage >= -1` or `-2`
  - Remove the gate entirely: `hunter: 'hunt'`
  - Make hunting probabilistic based on ratio: `hunt if random() <
    sigmoid(combat_advantage)`
  - Split hunter into "aggressive hunter" (hunts up) and "cautious
    hunter" (hunts down) templates

---

## Superseded items (preserved for reasoning continuity)

These were active open questions before the 2026-04-11 multiplayer
reframe. They're kept in the doc so future sessions understand *why*
they were rejected — don't re-propose them without a reason the
direction has changed.

### OQ-1: Tighter statCap (superseded 2026-04-11)

- **Status:** superseded by multiplayer direction
- **Reason:** hard stat caps create a flat field. Players in a PvP
  game want their bot to grow and the growth to matter. A cap at
  20 means "no one can ever be much better than baseline", which is
  exactly the socialist simulation outcome being rejected.
- **Original proposal:** cap=20 vs cap=50 comparison to see if
  tighter caps give real balance.
- **Original command:**
  ```
  --seed 99 --stat-cap 20 --damage-floor 0.1
  ```
- **What replaced it:** DQ-7 / DQ-ELO — ratio-scaled rewards
  prevent runaway without needing a cap.

### OQ-2: statCap alone, without damageFloor (superseded 2026-04-11)

- **Status:** superseded by multiplayer direction
- **Reason:** same as OQ-1. Moving away from cap-as-primary
  balancing tool entirely.
- **Original proposal:** test whether cap is sufficient without
  the damage floor.

### OQ-4: `npcSettings.evolution` stat inheritance (superseded 2026-04-11)

- **Status:** superseded by multiplayer direction
- **Reason:** you can't inherit a human player's stats when they
  "die" (or teleport). The mechanic fits an NPC ecosystem but
  doesn't translate to mixed human/NPC populations.
- **Original proposal:** enable `npcSettings.evolution` so killer
  inherits victim stats on kill.

### DQ-1: Tune default statCap lower (superseded 2026-04-11)

- **Status:** superseded by multiplayer direction
- **Reason:** same as OQ-1.

### DQ-2: Diminishing returns on kill rewards (consolidated into DQ-7)

- **Status:** consolidated into DQ-7
- **Reason:** ratio-scaling IS a form of diminishing returns — the
  kill-reward formula naturally gives smaller gains the stronger
  the killer gets (because the ratio shrinks as the killer
  outpaces opponents). DQ-7's sqrt/linear/ELO formulas all produce
  diminishing-return curves without needing a separate
  "count your own kills" bookkeeping system. Cleaner design.
- **Original proposal:** `addStat(amount)` where
  `amount = 1 / (1 + currentKills/K)`.

### DQ-3: Stat decay for idle bots (superseded 2026-04-11)

- **Status:** superseded by multiplayer direction
- **Reason:** decay punishes AFK players (who may be reading the
  battle log, configuring their bot mid-game, or just away from
  keyboard briefly). Bad UX for multiplayer. Also redundant with
  lifecycle.starvation which already exists.

### DQ-4: Combat bounty (consolidated into DQ-7)

- **Status:** consolidated into DQ-7
- **Reason:** DQ-7's ratio-scaling IS a combat bounty — killing a
  stronger opponent yields bigger rewards. DQ-4 proposed this
  unilaterally for the winner; DQ-7 adds the symmetric loser
  penalty which is what actually makes the system self-balancing.
- **Original proposal:** `kill reward = baseReward * sqrt(victim /
  killer)` — exactly DQ-7 Option C, just winner-only.

---

## How to use this doc

- **Picking a new task:** scan the `## Active open questions` section
  for items with `Status: pending`. M0 items block everything else
  — start there.
- **After resolving:** change `Status: pending` →
  `Status: resolved — <short reason>`, link to the commit / run
  that decided it. Don't delete resolved entries — the reasoning
  chain is the value.
- **Marking something superseded:** move it to the
  `## Superseded items` section with a reason line. Don't delete.
- **Adding new findings:** factual findings go under
  `## Confirmed findings`. Open items go under
  `## Active open questions`. Use the next number in sequence:
  - `OQ-N` for simulation-run questions
  - `DQ-N` for design-decision questions
  - **Dual-naming for memorable items:** the most important DQ
    entries also get a named alias (e.g. `DQ-6 / DQ-TELEPORT`,
    `DQ-7 / DQ-ELO`) so commits and cross-references can use
    either form. Use both in the header.
- **Referring to this doc:** link from commit messages and other
  markdown files as
  `bots-strategy-v11/test/results/runs/balance-findings.md`.

## Related files

- `bots-strategy-v11/test/results/runs/2026-04-10-seed42-600k-baseline/observations.md`
  — original bug-discovery analysis (time capsule)
- `bots-strategy-v11/test/results/runs/matrix-2026-04-10/analysis.md`
  — full numeric breakdown of the 4-run matrix (time capsule)
- `bots-strategy-v11/CLAUDE.md` §Design Direction — multiplayer
  constraints + §Combat Settings — documentation of the
  `combatSettings` config block
- `CLAUDE.md` (root) §Design Direction — project-wide multiplayer
  framing
- `bots-strategy-v11/js/combat.js` — `handleCombat` + `handleBotDeath`
  (where DQ-6 teleport path will land)
- `bots-strategy-v11/js/game.js:addRandomStat` — where DQ-7 amount
  parameter will be added
- `bots-strategy-v11/js/config.js:combatSettings` — where new
  `deathBehavior`, `killReward`, `lossPenalty` blocks will land
