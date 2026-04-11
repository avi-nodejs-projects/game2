# v11 Test Suite — Design & Plan

> Persistent design document. If the session crashes mid-task, restart by reading this file.

## Goal

Comprehensive test suite for the v11 game engine covering:
- Unit tests for all pure-logic methods
- Strategy verification (Simple/Advanced/Expert modes)
- Long simulation stability testing
- Invariants (bounds, counts, non-negative stats)
- Determinism (same seed → identical trace)

## User Decisions (locked in)

0. **UI tests out of scope.** Local Node tests only. No headless browser.
1. **Main.js refactor = Option B.** Extract combat/collision functions from `main.js` into a new `js/combat.js`. Commit + push + pause for review before advancing.
2. **Test location:** `bots-strategy-v11/test/`
3. **Coverage strategy: pragmatic.** Skip trivial getters and one-line passthroughs. Cover anything with branching, math, or state mutation.
4. **Deep testing.** Full suite may take ≤20 min. `--quick` flag skips long simulations; quick run should finish in <1 min.
5. **Output:** Test results written to files under `test/results/`. Console shows a short bulletin + summary only.

## Architecture

### Harness (`test/harness.js`)
- Uses Node's built-in `vm` module to load v11 source files into a shared sandbox context.
- **Zero changes to v11 source files** beyond the Option B refactor (which is a cleanup, not a test-driven change).
- Minimal DOM stubs to allow files that touch `document`/`window` to load without crashing.
- Optional seeded RNG via `Math.random` override on the context.
- Reset function for fresh context between test cases when needed.

### Key files
```
bots-strategy-v11/test/
├── DESIGN.md             ← THIS FILE
├── harness.js            — vm context loader, DOM stubs
├── rng.js                — mulberry32 seeded PRNG
├── helpers.js            — shared fixtures, assertion helpers, file logging
├── run.js                — CLI: quick mode, suite selection, result file writing
├── results/              — per-run output files (gitignored)
│   ├── last-run.json     — latest run summary
│   └── <timestamp>-<suite>.log
├── unit/
│   ├── config.test.js
│   ├── bot-core.test.js        — constructor, stats, spawning
│   ├── bot-queries.test.js     — findNearest*, distanceTo, clusters
│   ├── bot-combat-eval.test.js — evaluateCombatAdvantage
│   ├── bot-update.test.js      — movement, idle, targeting cycle
│   ├── bot-ai-simple.test.js   — pickTargetSimpleMode, behaviors
│   ├── bot-ai-advanced.test.js — rule evaluation, conditions
│   ├── bot-ai-expert.test.js   — FSM transitions, state actions
│   ├── bot-ai-context.test.js  — getContext
│   ├── combat.test.js          — damage formulas, stalemate, kill
│   ├── lifecycle.test.js       — invincibility, starvation, age
│   ├── reproduction.test.js    — asexual/sexual, inheritance
│   ├── relationships.test.js   — parent/child, protection
│   ├── packs.test.js           — formation, territory, cannibalism
│   └── corpse.test.js          — corpse creation, consumption, expiry
├── strategies/
│   ├── simple-gatherer.test.js
│   ├── simple-hunter.test.js
│   ├── simple-survivor.test.js
│   ├── simple-weighted.test.js
│   ├── advanced-rules.test.js
│   ├── advanced-conditions.test.js
│   ├── expert-fsm.test.js
│   └── adherence.test.js
├── integration/
│   ├── combat-scenarios.test.js
│   ├── pack-formation.test.js
│   ├── reproduction-cycle.test.js
│   ├── starvation-recovery.test.js
│   └── hunter-vs-gatherer.test.js
├── simulation/                  — [SLOW, skipped in --quick]
│   ├── stability-10k.test.js
│   ├── stability-60k.test.js
│   ├── determinism.test.js
│   └── population-stability.test.js
└── invariants/
    ├── bounds.test.js
    ├── counts.test.js
    ├── non-negative.test.js
    └── stat-conservation.test.js
```

### v11 files — testability

| File | Role | Loadable in Node? | Notes |
|------|------|-------|-------|
| `config.js` | Constants, defs | ✅ | Pure |
| `log.js` | Simulation logging | ⚠️ | May touch DOM for export; stub needed |
| `game.js` | Bot + YellowDot | ✅ | Pure |
| `bot-ai.js` | AI decision methods | ✅ | Extends Bot.prototype |
| `lifecycle.js` | Invincibility, starvation, age | ✅ | Pure |
| `reproduction.js` | Asexual/sexual reproduction | ✅ | Pure |
| `relationships.js` | Parent/child, protection | ✅ | Pure |
| `packs.js` | Pack formation | ✅ | Pure |
| `corpse.js` | Corpse class | ✅ | Pure |
| `combat.js` | [NEW] Combat/collision | ✅ | Created in Phase 1 |
| `main.js` | Camera, render loop, init | ❌ | Skipped (DOM-dependent after extract) |
| `bot-render.js` | Canvas rendering | ❌ | Skipped |
| `debug.js`, `ui-*.js`, `billboards.js` | UI/rendering | ❌ | Skipped |

### Required load order (in vm context)
```
config.js → log.js → game.js → bot-ai.js → lifecycle.js →
reproduction.js → relationships.js → packs.js → corpse.js → combat.js
```

## Phases

### ✅ Phase 0 — Design (done when this file exists)
- [x] Save decisions & architecture to `test/DESIGN.md`

### ✅ Phase 1 — `main.js` refactor (Option B) — COMPLETE
**Goal:** Extract pure combat/collision functions from `main.js` into a new `js/combat.js`.

**Functions extracted:**
- `checkBotDotCollision(bot, dot)`
- `checkBotBotCollision(bot1, bot2)`
- `handleCombat(bot1, bot2)`
- `handleBotDeath(deadBot, killerBot)`
- `handleAgeDeath(bot)`
- `handleStarvationDeath(bot)`
- `processCollisions()`

**Outcome:**
- `js/combat.js` created (463 lines)
- `js/main.js` shrunk from 1195 → 753 lines
- `index.html` loads `combat.js` between `bot-ai.js` and `bot-render.js`, before `main.js`
- `codebase-map.json` updated to reflect the new file and exports
- Committed as `bfaa8ae`

**Review findings addressed:**
- Map staleness: exports list, task pattern, dependency graph all updated
- DESIGN.md status marker updated (this section)

**Deferred note (not a bug):** `bots`, `yellowDots`, and `camera` are declared in `main.js` but referenced by `combat.js`. This works via late-binding (function bodies resolve free variables at call time, not parse time) but is a minor dependency-inversion smell. For the upcoming test harness we will pre-populate these in the vm context; out of scope for Phase 1.

### ✅ Phase 2 — Harness + foundation tests — COMPLETE
- [x] `test/rng.js` — mulberry32 seeded PRNG
- [x] `test/harness.js` — vm context loader with DOM stubs, pre-populated state, seeded Math wrapper
- [x] `test/helpers.js` — fixtures (`createTestContext`, `runFrames`), assertion helpers (`assertApprox`, `assertInRange`, etc.)
- [x] `test/run.js` — CLI runner with `--quick`, `--suite`, `--seed`, `--verbose`, TAP parsing, bulletin output, file logging
- [x] `test/unit/bot-core.test.js` — 26 tests covering Bot class fundamentals
- [x] `.gitignore` — `bots-strategy-v11/test/results/` excluded

**Harness notes:**
- v11 uses `const`/`let`/`class` at the top level of each file. These do NOT become properties of the vm global object (unlike `var`/`function`). Workaround: concatenate all model files into a single script and append an epilogue that defines `Object.defineProperty` getters/setters for each known top-level binding. The getter/setter close over the lexical binding, so `ctx.frameCount` is a **live view** — reads return the current value and writes mutate the actual `let` variable. Essential for primitive lets like `frameCount`, `decisionCount`. The list of bindings lives in `LEXICAL_BINDINGS_TO_EXPOSE` in `harness.js` and must be updated when new top-level const/let/class declarations are added to v11.
- Seeded `Math.random` via a wrapper object that delegates all other Math methods to the host Math. Does NOT mutate the host Math.
- State globals normally declared in main.js (`bots`, `yellowDots`, `camera`, etc.) are pre-populated on the context before loading files, so combat.js function bodies have everything they need at call time.
- Node v25 changed `--test <dir>` behavior; the runner expands test files recursively and passes them individually to work around version differences.
- Cross-vm-context object identity quirk: `deepStrictEqual` fails on otherwise-equal objects because they don't share `Object.prototype` with the host. Tests should compare fields individually.
- `createTestContext` auto-consumes `TEST_SEED` env var (set by `run.js --seed`) so tests using the helper are deterministic by default.

**Review findings addressed (see commit after `16cc022`):**
- P1: live binding views via Object.defineProperty (frameCount etc. now bidirectional)
- P2: `_ctxGlobalCache`, `_ctxGlobalCacheFrame` added to exposure list
- P2: `TEST_SEED` auto-consumption in `createTestContext`
- P2: `test/unit/helpers.test.js` formalizes helper verification (30 tests)
- P3: `test/README.md` added with quick-start and gotchas

**Smoke test:** `node test/run.js --quick` → 56/56 pass in ~240ms.

### ✅ Phase 3 — Unit tests for pure methods — COMPLETE
Added 383 tests across 13 unit files + 1 helper test file:
- `config.test.js` (32), `corpse.test.js` (26), `relationships.test.js` (31)
- `combat.test.js` (32)
- `bot-queries.test.js` (17), `bot-update.test.js` (18)
- `bot-ai-context.test.js` (36), `bot-ai-simple.test.js` (22),
  `bot-ai-advanced.test.js` (13), `bot-ai-expert.test.js` (12)
- `lifecycle.test.js` (35), `reproduction.test.js` (43)
- `packs.test.js` (49), `bot-npc.test.js` (17)

Review caught 12 uncovered functions (most notably `pickNewTargetSimple`
used by 19/20 bots) and added targeted tests. Final unit-suite: 439
tests in ~500ms.

Commits: `8323d51`, `dd78fa7`, `fbcf8f1`, `33e3d9d`, `a5983fe`, `e7b28a9`,
review fixes `92580a8`.

### ✅ Phase 4 — Strategy adherence tests — COMPLETE
Added 68 tests across 8 strategy files verifying that bots STAY IN
CHARACTER over many decisions (not just single calls like Phase 3):
- `simple-gatherer.test.js` (6), `simple-hunter.test.js` (7),
  `simple-survivor.test.js` (7), `simple-weighted.test.js` (8)
- `advanced-rules.test.js` (8), `advanced-conditions.test.js` (14)
- `expert-fsm.test.js` (10), `adherence.test.js` (8)

Approach: call strategy methods in 500-2000 iteration loops with
`randomnessNoise = 0`, assert statistical properties of the action
distribution. `adherence.test.js` uses the full game loop via
`runFrames` to verify end-to-end behavior.

Commits: `ca0ccf8`, `def84e6`, `15cd37b`.

### ✅ Phase 5 — Integration + invariants + simulation — COMPLETE
Added 72 tests across 13 files, plus `runSimulation` helper and a
console filter for v11's noisy stuck-bot diagnostic.

**5a integration (29 tests, 5 files, 5-10 bots):**
- combat-scenarios, pack-formation, reproduction-cycle,
  starvation-recovery, hunter-vs-gatherer

**5b invariants (26 tests, 4 files, 10-20 bots):**
- bounds, counts, non-negative, determinism

**5c simulation (17 tests, 4 files, 20 bots / 50 dots — SLOW):**
- stability-10k, stability-60k, determinism-long, population-stability

The simulation suite is marked slow and skipped in `--quick` mode.
Full simulation verifies the v11 defaults run cleanly for 60,000
frames (10 minutes of game time) with every lifecycle feature on,
and that determinism holds across 10,000-frame runs.

Commits: `2d42864`, `6335446`, `f530b32`.

## Final state (after initial 6 phases + simlog/balance follow-up)

- **594 tests** across 31 files, all passing (full suite)
- **Quick suite:** ~2.3s (577 tests, skips simulation/)
- **Full suite:** ~52s
- **Deterministic** across seeds and across runs
- **Targeted v11 source changes** (originally zero except the Phase 1
  combat.js extraction; later extended in Phase 7 with `combatSettings`
  — see note below).

## Original 6 phases complete (see Phase 6 + 7 below for follow-up work).

| Phase | Title | Tests | Key commits |
|-------|-------|-------|-------------|
| 0 | Design | (doc) | `bfaa8ae` |
| 1 | combat.js extraction | (refactor) | `bfaa8ae`, `538e88c` |
| 2 | Harness foundation | 56 | `16cc022`, `249c67f` |
| 3 | Unit tests | +383 → 439 | 6 group commits + `92580a8` |
| 4 | Strategy adherence | +68 → 507 | `ca0ccf8`, `def84e6`, `15cd37b` |
| 5 | Integration/invariants/simulation | +72 → 579 | `2d42864`, `6335446`, `f530b32` |

## Phase 6 — Machine-readable simulation logger (simlog)

Built `test/simlog.js` as a streaming NDJSON simulation logger so long
runs (hundreds of thousands of frames) can produce analysis-friendly
datasets without incurring browser/canvas cost. Hooks into the same
vm context the test harness uses. Events: meta, init, snap, eat,
combat, kill, lifecycle (passthrough), decision, final.

Key commits: `cc1052a` (initial), `2b15edc` (progress output fix),
`70e4b8a` (CLI flags for combat settings), `3f0d891` (all-bot decision
logging via `Bot.prototype.pickNewTarget` wrap + `--npc-strategies`).

## Phase 7 — Balance findings + configurable combat

Running the simlog baseline (seed 42, 600k frames) exposed a runaway
stat-growth bug in v11 combat: once a bot's `defence` exceeds every
opponent's `attack`, the primary `attack - defence` formula clamps to
zero, the stalemate branch never fires (because the winner still deals
damage), and the +1-stat-per-kill loop snowballs without bound.

Fixed by adding `combatSettings` to config.js with three tunable knobs
(all defaulting to original v11 behavior):

  - `stalemateBreaker` — {enabled, formula} — division / forceRespawnBoth / skip
  - `damageFloor`      — {enabled, fraction} — minimum damage guarantee
  - `statCap`          — {enabled, maxPerStat} — hard per-stat ceiling

+9 unit tests in `unit/combat.test.js` covering each knob. These are
the first intentional v11 source changes outside Phase 1: config.js,
combat.js, and game.js were all modified. `harness.js` was updated to
expose `combatSettings` via the vm bindings.

Follow-up work (runs + open questions) lives in:
- `test/results/runs/balance-findings.md` — tracked OQ/DQ items
- `test/results/runs/matrix-2026-04-10/analysis.md` — 4-run comparison

Key commits: `ece900b` (combat settings + runaway fix + baseline
observations), `381fc6d` (4-run matrix analysis), `2d50303` (balance
findings doc).

## Pragmatic coverage guide

### Worth testing
- Any method with branching logic (`if`/`switch`)
- Any method with math/formulas (combat damage, cluster scoring, combat advantage)
- Any method that mutates state (stat gain, death, spawn)
- Any method that iterates collections with filtering
- Any method with side effects
- Pack formation / relationship graph operations
- Rule evaluation in Advanced mode
- FSM transition logic in Expert mode

### Skip (not worth the ink)
- Trivial getters (`get totalStats() { return this.a + this.b + this.c; }`)
- One-line delegations
- Canvas rendering functions
- DOM manipulation
- Event listener wiring

## Running tests

```bash
# Full suite (deep, up to 20 min)
node bots-strategy-v11/test/run.js

# Quick suite (<1 min, skips simulation/*)
node bots-strategy-v11/test/run.js --quick

# Specific suite
node bots-strategy-v11/test/run.js --suite unit
node bots-strategy-v11/test/run.js --suite strategies

# With a seed (for determinism)
node bots-strategy-v11/test/run.js --seed 42

# Or use Node's built-in runner directly
node --test bots-strategy-v11/test/unit/
```

## Console output format

Short bulletin after each suite, summary at the end:
```
▶ unit/         ✓ 124 passed   ✗ 0 failed   (2.3s)
▶ strategies/   ✓ 18 passed    ✗ 0 failed   (4.1s)
▶ integration/  ✓ 12 passed    ✗ 1 failed   (8.7s)
▶ invariants/   ✓ 6 passed     ✗ 0 failed   (0.9s)
▶ simulation/   ✓ 4 passed     ✗ 0 failed   (11m 23s)   [skipped in --quick]

──────────────────────────────────────
 164 passed, 1 failed, 0 skipped
 Total: 11m 39s
 Log: test/results/2026-04-10-1042-full.log
 Failures: test/results/2026-04-10-1042-failures.log
──────────────────────────────────────
```

Detailed output (per-test pass/fail, error traces, stack, state dumps) goes to files under `test/results/`. Console stays quiet and scannable.

## Open questions (deferred)

- Whether to add coverage reporting (e.g., c8) — probably yes, later, once the harness is proven.
- Whether to enforce a failure threshold for flaky simulation tests — probably use seeded runs to avoid flakiness entirely.
