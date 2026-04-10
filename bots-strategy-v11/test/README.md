# Bots v11 — Test Suite

Headless Node test suite for the v11 game engine. Loads the pure-logic
layer (`js/config.js`, `js/game.js`, `js/bot-ai.js`, `js/combat.js`, ...)
into a `vm` context so tests run without a browser or canvas.

## Quick start

```bash
# Full suite (includes slow simulation tests, may take minutes)
node bots-strategy-v11/test/run.js

# Quick suite — skip slow/simulation tests, finishes in ~1s
node bots-strategy-v11/test/run.js --quick

# One suite only
node bots-strategy-v11/test/run.js --suite unit

# Deterministic run (sets TEST_SEED env var visible to tests)
node bots-strategy-v11/test/run.js --seed 42

# Show full TAP output on stdout
node bots-strategy-v11/test/run.js --verbose

# Help
node bots-strategy-v11/test/run.js --help
```

Or use Node's built-in test runner directly:

```bash
node --test bots-strategy-v11/test/unit/bot-core.test.js
```

## Output

The runner prints a short bulletin per suite and writes full TAP
output + a machine-readable summary to `test/results/`:

```
Bots v11 tests — QUICK seed=42
───────────────────────────────────────────────────────
  unit         ✓  56 passed   (239ms)
  strategies   (skipped — directory does not exist)
  ...
───────────────────────────────────────────────────────
 ✓ 56 passed, 0 failed
   Total: 239ms
   Log: bots-strategy-v11/test/results/20260410-121805-quick.log
```

The `test/results/` directory is gitignored. On failures, a separate
`*-failures.log` is written with the error details and stack traces.
`last-run.json` is a machine-readable summary of the most recent run.

## Layout

```
test/
├── README.md           ← you are here
├── DESIGN.md           ← design decisions, phase plan, known gotchas
├── harness.js          ← vm context loader, DOM stubs, seeded Math
├── rng.js              ← mulberry32 seeded PRNG
├── helpers.js          ← createTestContext, runFrames, assertions
├── run.js              ← CLI runner (TAP parser, file logging)
├── results/            ← per-run log files (gitignored)
├── unit/               ← per-method tests
├── strategies/         ← Simple/Advanced/Expert verification (future)
├── integration/        ← multi-system scenarios (future)
├── invariants/         ← properties that always hold (future)
└── simulation/         ← long-running stability tests (future, slow)
```

## Writing a test

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, totalStats } = require('../helpers');

test('Bot gains a stat when eating a dot', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 1 });
  const bot = ctx.bots[0];
  ctx.yellowDots[0].x = bot.x;
  ctx.yellowDots[0].y = bot.y;
  const before = totalStats(bot);
  ctx.processCollisions();
  const after = totalStats(bot);
  assert.ok(after > before);
});
```

Key things the harness gives you:

- `ctx.Bot`, `ctx.YellowDot`, `ctx.Corpse` — the classes
- `ctx.bots`, `ctx.yellowDots`, `ctx.corpses` — live arrays
- `ctx.WORLD_WIDTH`, `ctx.STARTING_STATS`, `ctx.BEHAVIORS`, etc. — constants
- `ctx.handleCombat`, `ctx.processCollisions`, etc. — game-loop functions
- `ctx.frameCount`, `ctx.decisionCount`, etc. — **live bindings** (read/write)
- `ctx.globalSettings`, `ctx.lifecycleSettings`, `ctx.playerStats` — mutable config

Tests should use `createTestContext` (from `helpers.js`) rather than
`createGameContext` (from `harness.js`) directly. The helper respects
the `TEST_SEED` env var for determinism and pre-populates bots + dots.

## Known gotchas

1. **Cross-vm object identity.** Objects created inside the vm have a
   different `Object.prototype` than the host. `assert.deepStrictEqual`
   will fail on otherwise-equal objects. Compare fields individually
   or use `assertApprox` for numbers.

2. **`const`/`let`/`class` are not auto-globals.** In a vm context,
   only `var` and `function` declarations become properties of the
   global object. The harness works around this by concatenating all
   model files into one script and appending `Object.defineProperty`
   calls that expose every top-level binding via live getter/setter.
   If you add a new top-level `const`/`let`/`class` to a model file,
   add its name to `LEXICAL_BINDINGS_TO_EXPOSE` in `harness.js`.

3. **Rendering functions are unreachable.** `bot.draw()`, `drawField()`,
   minimap helpers, and any `ui-*.js` code are NOT loaded. Tests that
   call them will throw `… is not a function`.

4. **`main.js` is not loaded.** Its collision/combat functions were
   extracted to `js/combat.js` (which IS loaded) — use those instead.
   `main.js` still owns the game loop, camera, and canvas init.

See `DESIGN.md` for the full design rationale and phase plan.
