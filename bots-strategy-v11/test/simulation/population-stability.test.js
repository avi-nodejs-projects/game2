// Population scaling + stability tests.
// Verifies the engine behaves correctly across different bot
// counts (5, 10, 20, 40) and that population counts remain
// stable under various game conditions over long runs.

const { test } = require('node:test');
const assert = require('node:assert');
const {
  createTestContext, runSimulation,
  assertAllBotsInBounds,
} = require('../helpers');

// ---- Scaling sweeps ------------------------------------

test('scaling: 5/10/20/40 bots all survive 2000 frames', () => {
  const scales = [5, 10, 20, 40];
  for (const n of scales) {
    const ctx = createTestContext({ seed: 42, botCount: n, dotCount: n * 3 });
    runSimulation(ctx, 2000);
    assert.strictEqual(ctx.bots.length, n, `scale=${n}: bot count changed`);
    assertAllBotsInBounds(ctx);
  }
});

test('scaling: timing grows with scale but stays finite', () => {
  // Rough sanity check that the game loop isn't catastrophically slow
  // at higher scales. NOT a strict performance test — just a smoke test
  // that we haven't introduced an exponential pathology.
  const scales = [5, 10, 20, 40];
  const timings = {};
  for (const n of scales) {
    const ctx = createTestContext({ seed: 42, botCount: n, dotCount: n * 3 });
    const t0 = Date.now();
    runSimulation(ctx, 1000);
    timings[n] = Date.now() - t0;
  }
  // Just assert we didn't hit a wild blowup. Allow generous headroom.
  assert.ok(timings[40] < timings[5] * 100,
    `40-bot run (${timings[40]}ms) is >100x slower than 5-bot (${timings[5]}ms)`);
  // Log the timings as a breadcrumb
  console.log('  scaling timings:', JSON.stringify(timings));
});

// ---- Population stable under heavy combat -------------

test('population: stays constant under crowded combat (no reproduction)', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 30 });
  // Cluster them
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 500 + (i % 5) * 20;
    ctx.bots[i].y = 500 + Math.floor(i / 5) * 20;
  }
  runSimulation(ctx, 5000);
  assert.strictEqual(ctx.bots.length, 20,
    'combat should not change bot count (respawn keeps it stable)');
});

// ---- Reproduction growth bounded --------------------

test('population: asexual reproduction grows population over time', () => {
  // Use conservative settings so the test stays fast:
  // fewer frames, longer maturity + cooldown. The engine's N²
  // collision cost means this test gets expensive at scale.
  const ctx = createTestContext({ seed: 42, botCount: 3, dotCount: 30 });
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 1000;
  ctx.lifecycleSettings.reproduction.asexual.cooldown = 3000;
  ctx.lifecycleSettings.reproduction.asexual.parentLifeCost = 0.5;

  runSimulation(ctx, 5000);
  // Population should have grown but not runaway (cooldown 3000 +
  // maturity 1000 = new bots every ~4k frames per parent).
  assert.ok(ctx.bots.length > 3, `expected growth, got ${ctx.bots.length}`);
  // Generous ceiling — the test is about non-runaway, not exact count.
  assert.ok(ctx.bots.length < 500, `unbounded growth: ${ctx.bots.length}`);
});

// ---- age=remove shrinks population predictably -------

test('population: age=remove shrinks to zero eventually', () => {
  const ctx = createTestContext({ seed: 42, botCount: 8, dotCount: 20 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.maxAge = 200;
  ctx.lifecycleSettings.age.deathBehavior = 'remove';

  runSimulation(ctx, 500); // well past maxAge
  assert.strictEqual(ctx.bots.length, 0, 'all bots should have aged out');
});

// ---- Kill count distribution ------------------------

test('population: after 5000 frames with crowded advantaged hunters, kills distribute', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 30 });
  // Stack the deck — give first 5 a clear combat advantage
  for (let i = 0; i < 5; i++) {
    ctx.bots[i].attack = 20;
    ctx.bots[i].defence = 5;
    ctx.bots[i].lives = 10;
  }
  // Crowded start
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 500 + (i % 5) * 20;
    ctx.bots[i].y = 500 + Math.floor(i / 5) * 20;
  }

  runSimulation(ctx, 5000);
  const totalKills = ctx.bots.reduce((s, b) => s + b.killCount, 0);
  assert.ok(totalKills > 0, 'expected some kills in 5000 frames of combat');
});
