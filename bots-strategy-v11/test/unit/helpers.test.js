// Unit tests for test/helpers.js — the fixtures and assertion utilities.
// Tests the helpers themselves so regressions in the test support layer
// don't silently break downstream tests.

const { test } = require('node:test');
const assert = require('node:assert');
const {
  createTestContext,
  runFrames,
  assertApprox,
  assertInRange,
  assertUnique,
  assertAllBotsInBounds,
  assertAllStatsNonNegative,
  totalStats,
} = require('../helpers');

// ---- totalStats ---------------------------------------------------

test('totalStats: sums speed + attack + defence + lives', () => {
  const ctx = createTestContext({ seed: 1, botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  // Player defaults: speed=5, attack=5, defence=5, lives=3
  assert.strictEqual(totalStats(bot), 18);
});

test('totalStats: reflects stat changes', () => {
  const ctx = createTestContext({ seed: 1, botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const before = totalStats(bot);
  bot.attack += 3;
  assert.strictEqual(totalStats(bot), before + 3);
});

// ---- assertApprox -------------------------------------------------

test('assertApprox: passes within default epsilon', () => {
  assertApprox(0.1 + 0.2, 0.3);
});

test('assertApprox: passes at the boundary', () => {
  assertApprox(1.0, 1.0000001, 1e-6);
});

test('assertApprox: throws when outside epsilon', () => {
  assert.throws(() => {
    assertApprox(1.0, 2.0, 0.0001);
  });
});

test('assertApprox: custom message included in error', () => {
  try {
    assertApprox(1, 2, 0.01, 'custom explanation');
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(
      err.message.includes('custom explanation'),
      `error message should contain custom message, got: ${err.message}`,
    );
  }
});

// ---- assertInRange ------------------------------------------------

test('assertInRange: passes for value in range', () => {
  assertInRange(3, 1, 5);
});

test('assertInRange: inclusive at min boundary', () => {
  assertInRange(1, 1, 5);
});

test('assertInRange: inclusive at max boundary', () => {
  assertInRange(5, 1, 5);
});

test('assertInRange: throws below min', () => {
  assert.throws(() => assertInRange(0, 1, 5));
});

test('assertInRange: throws above max', () => {
  assert.throws(() => assertInRange(6, 1, 5));
});

// ---- assertUnique -------------------------------------------------

test('assertUnique: passes for unique primitives', () => {
  assertUnique([1, 2, 3, 'a', 'b']);
});

test('assertUnique: passes for empty array', () => {
  assertUnique([]);
});

test('assertUnique: passes for distinct objects', () => {
  assertUnique([{}, {}, {}]);
});

test('assertUnique: throws on duplicate primitive', () => {
  assert.throws(() => assertUnique([1, 2, 1]));
});

test('assertUnique: throws on duplicate object reference', () => {
  const obj = { x: 1 };
  assert.throws(() => assertUnique([obj, obj]));
});

// ---- assertAllBotsInBounds ----------------------------------------

test('assertAllBotsInBounds: passes for freshly-spawned bots', () => {
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 0 });
  assertAllBotsInBounds(ctx);
});

test('assertAllBotsInBounds: throws when a bot is out of bounds', () => {
  const ctx = createTestContext({ seed: 42, botCount: 3, dotCount: 0 });
  ctx.bots[1].x = -100;
  assert.throws(() => assertAllBotsInBounds(ctx));
});

test('assertAllBotsInBounds: throws when a bot y exceeds max', () => {
  const ctx = createTestContext({ seed: 42, botCount: 3, dotCount: 0 });
  ctx.bots[0].y = ctx.WORLD_HEIGHT + 100;
  assert.throws(() => assertAllBotsInBounds(ctx));
});

// ---- assertAllStatsNonNegative ------------------------------------

test('assertAllStatsNonNegative: passes for default bots', () => {
  const ctx = createTestContext({ seed: 42, botCount: 5, dotCount: 0 });
  assertAllStatsNonNegative(ctx);
});

test('assertAllStatsNonNegative: throws on negative speed', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  ctx.bots[0].speed = -0.1;
  assert.throws(() => assertAllStatsNonNegative(ctx));
});

test('assertAllStatsNonNegative: allows negative lives (transient state)', () => {
  // Lives CAN go negative briefly during combat before the death
  // handler fires. The helper must not flag this.
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  ctx.bots[0].lives = -1;
  assertAllStatsNonNegative(ctx); // should not throw
});

// ---- runFrames ----------------------------------------------------

test('runFrames: runs the given number of frames without error', () => {
  const ctx = createTestContext({ seed: 42, botCount: 5, dotCount: 10 });
  runFrames(ctx, 50);
  assert.strictEqual(ctx.bots.length, 5, 'no bots should disappear (no lifecycle)');
});

test('runFrames: bots move during execution', () => {
  const ctx = createTestContext({ seed: 42, botCount: 3, dotCount: 10 });
  const positionsBefore = ctx.bots.map(b => `${b.x},${b.y}`).join('|');
  runFrames(ctx, 100);
  const positionsAfter = ctx.bots.map(b => `${b.x},${b.y}`).join('|');
  assert.notStrictEqual(positionsBefore, positionsAfter, 'positions should change');
});

test('runFrames: bots stay in bounds over 500 frames', () => {
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 20 });
  runFrames(ctx, 500);
  assertAllBotsInBounds(ctx);
});

test('runFrames: at least one bot accumulates fractional stats from eating', () => {
  // With bots moving and dots spawning, over 500 frames at least one
  // bot should have picked up partial stats (+0.1 per dot). We can't
  // rely on total stats monotonically increasing because dying bots
  // reset their stats, so instead check that at least one bot shows
  // evidence of eating (a stat with a fractional component).
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 30 });
  runFrames(ctx, 500);
  const anyFractional = ctx.bots.some(b =>
    b.speed % 1 !== 0 || b.attack % 1 !== 0 ||
    b.defence % 1 !== 0 || b.lives % 1 !== 0
  );
  assert.ok(anyFractional, 'at least one bot should have eaten a dot after 500 frames');
});

// ---- createTestContext fixture ------------------------------------

test('createTestContext: default options give 5 bots and 10 dots', () => {
  const ctx = createTestContext();
  assert.strictEqual(ctx.bots.length, 5);
  assert.strictEqual(ctx.yellowDots.length, 10);
});

test('createTestContext: honors custom counts', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 7 });
  assert.strictEqual(ctx.bots.length, 3);
  assert.strictEqual(ctx.yellowDots.length, 7);
});

test('createTestContext: bot 0 is player', () => {
  const ctx = createTestContext();
  assert.strictEqual(ctx.bots[0].isPlayer, true);
  assert.strictEqual(ctx.playerBot, ctx.bots[0]);
  for (let i = 1; i < ctx.bots.length; i++) {
    assert.strictEqual(ctx.bots[i].isPlayer, false);
  }
});

test('createTestContext: deterministic under same explicit seed', () => {
  const a = createTestContext({ seed: 123, botCount: 3, dotCount: 5 });
  const b = createTestContext({ seed: 123, botCount: 3, dotCount: 5 });
  for (let i = 0; i < 3; i++) {
    assert.strictEqual(a.bots[i].x, b.bots[i].x);
    assert.strictEqual(a.bots[i].y, b.bots[i].y);
  }
});
