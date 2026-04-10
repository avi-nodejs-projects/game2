// Ultra-long-run stability: 60k-frame simulation at realistic scale.
// 60k frames ≈ 10 minutes of game time (60fps).
// This is the SLOWEST test in the suite — skipped in --quick mode.

const { test } = require('node:test');
const assert = require('node:assert');
const {
  createTestContext, runSimulation,
  assertAllBotsInBounds,
} = require('../helpers');

// ---- 60k frames of plain gameplay ---------------------

test('stability-60k: 20 bots / 50 dots survive 60k frames of plain play', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  runSimulation(ctx, 60_000, {
    onFrame: (frame, ctx) => {
      // Sample bounds + counts every 5000 frames
      if (frame % 5000 === 0) {
        assert.strictEqual(ctx.bots.length, 20, `frame ${frame}: bot count changed`);
        assert.strictEqual(ctx.yellowDots.length, 50, `frame ${frame}: dot count changed`);
        assertAllBotsInBounds(ctx);
      }
    },
  });
});

// ---- 60k frames with full lifecycle -------------------

test('stability-60k: full lifecycle for 10 minutes (60k frames)', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.resetConditions.onDotEaten = true;
  ctx.lifecycleSettings.starvation.resetConditions.onKill = true;

  runSimulation(ctx, 60_000, {
    onFrame: (frame, ctx) => {
      if (frame % 10000 === 0) {
        assertAllBotsInBounds(ctx);
        // Population can't run away (no reproduction)
        assert.strictEqual(ctx.bots.length, 20);
      }
    },
  });
  // Final sanity
  assertAllBotsInBounds(ctx);
});
