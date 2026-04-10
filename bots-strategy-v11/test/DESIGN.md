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

### Phase 2 — Harness + foundation tests (~1 hour)
- `test/harness.js` — vm context loader
- `test/rng.js` — mulberry32
- `test/helpers.js` — fixtures, assertions, file logging
- `test/run.js` — CLI with `--quick`, `--suite`, `--seed`
- `test/unit/bot-core.test.js` — first unit test file to prove harness works
- Update `.gitignore` to exclude `test/results/`

### Phase 3 — Unit tests for pure methods (~3-4 hours)
Per file listed in `unit/`.

### Phase 4 — Strategy tests (~2 hours)
Simple/Advanced/Expert mode verification.

### Phase 5 — Integration + simulation + invariants (~2-3 hours)
Long-running stability, determinism, invariants.

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
