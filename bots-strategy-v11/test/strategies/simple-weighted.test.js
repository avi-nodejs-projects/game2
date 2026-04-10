// Strategy adherence: Simple mode, weighted behavior distribution.
// Verifies that when multiple behaviors are enabled with specific
// weights, the selected-behavior distribution matches those weights
// statistically over many trials.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

function setWeights(ctx, spec) {
  for (const key of Object.keys(ctx.behaviorWeights)) {
    ctx.behaviorWeights[key].enabled = false;
    ctx.behaviorWeights[key].weight = 0;
  }
  for (const [key, weight] of Object.entries(spec)) {
    ctx.behaviorWeights[key].enabled = true;
    ctx.behaviorWeights[key].weight = weight;
  }
  ctx.globalSettings.randomnessNoise = 0;
}

// Run N decisions, return {action: count}.
function distribution(bot, n) {
  const dist = {};
  for (let i = 0; i < n; i++) {
    bot.pickTargetSimpleMode();
    dist[bot.lastAction] = (dist[bot.lastAction] || 0) + 1;
  }
  return dist;
}

// ---- 50/50 split -------------------------------------------------

test('50/50 gatherer vs clusterFarmer: roughly even split', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  setWeights(ctx, { gatherer: 50, clusterFarmer: 50 });
  // Put dots that support both behaviors
  [[500, 500], [510, 510], [520, 520]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });
  const bot = ctx.bots[0];

  const dist = distribution(bot, 1000);
  const gather = dist.gather || 0;
  const cluster = dist.cluster || 0;
  assert.strictEqual(gather + cluster, 1000, 'all decisions should be gather or cluster');
  // With 50/50 and no noise, allow ±8% window (p ≈ 0.5, N=1000 → σ ≈ 16, 5σ tolerance)
  assert.ok(gather >= 420 && gather <= 580, `gather count ${gather} out of range`);
});

// ---- 80/20 asymmetric split --------------------------------------

test('80/20 gatherer vs clusterFarmer: matches weight ratio', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  setWeights(ctx, { gatherer: 80, clusterFarmer: 20 });
  [[500, 500], [510, 510]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });
  const bot = ctx.bots[0];

  const dist = distribution(bot, 1000);
  const gather = dist.gather || 0;
  // Expected ~800, tolerance ±60
  assert.ok(gather >= 740 && gather <= 860, `gather count ${gather} not near 800`);
});

// ---- 3-way split -------------------------------------------------

test('3-way split (gatherer, clusterFarmer, opportunist): all appear', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  setWeights(ctx, { gatherer: 40, clusterFarmer: 30, opportunist: 30 });
  // Need dots in far-from-enemies positions for opportunist to have a safe target
  for (let i = 0; i < 10; i++) {
    const d = new ctx.YellowDot();
    d.x = 500 + i * 20; d.y = 500;
    ctx.yellowDots.push(d);
  }
  const bot = ctx.bots[0];
  bot.x = 200; bot.y = 200;
  ctx.bots[1].x = 1800; ctx.bots[1].y = 1800;

  const dist = distribution(bot, 1500);
  assert.ok((dist.gather || 0) > 0, 'gather should appear');
  assert.ok((dist.cluster || 0) > 0, 'cluster should appear');
  assert.ok((dist.gather_safe || 0) > 0, 'gather_safe should appear');
});

test('3-way split weight ratios roughly match', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  setWeights(ctx, { gatherer: 40, clusterFarmer: 30, opportunist: 30 });
  for (let i = 0; i < 8; i++) {
    const d = new ctx.YellowDot();
    d.x = 500 + i * 20; d.y = 500;
    ctx.yellowDots.push(d);
  }
  const bot = ctx.bots[0];
  bot.x = 200; bot.y = 200;
  ctx.bots[1].x = 1800; ctx.bots[1].y = 1800;

  const N = 2000;
  const dist = distribution(bot, N);
  const gather = (dist.gather || 0) / N;
  const cluster = (dist.cluster || 0) / N;
  const gatherSafe = (dist.gather_safe || 0) / N;

  // Expected: 0.40, 0.30, 0.30. Tolerance ±0.05
  assert.ok(Math.abs(gather - 0.40) < 0.05, `gather ratio ${gather.toFixed(3)}`);
  assert.ok(Math.abs(cluster - 0.30) < 0.05, `cluster ratio ${cluster.toFixed(3)}`);
  assert.ok(Math.abs(gatherSafe - 0.30) < 0.05, `gatherSafe ratio ${gatherSafe.toFixed(3)}`);
});

// ---- Disabled behavior is never picked ---------------------------

test('disabled behavior never fires even if weight > 0', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setWeights(ctx, { gatherer: 50 });
  // Set a disabled hunter with high weight — should be ignored
  ctx.behaviorWeights.hunter.enabled = false;
  ctx.behaviorWeights.hunter.weight = 10000;
  const bot = ctx.bots[0];
  const dist = distribution(bot, 500);
  assert.strictEqual(dist.hunt || 0, 0);
  assert.strictEqual(dist.gather, 500);
});

// ---- Weight=0 excluded -------------------------------------------

test('enabled behavior with weight=0 is excluded', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setWeights(ctx, { gatherer: 100 });
  // Enable hunter but leave weight at 0
  ctx.behaviorWeights.hunter.enabled = true;
  ctx.behaviorWeights.hunter.weight = 0;
  const bot = ctx.bots[0];
  const dist = distribution(bot, 500);
  assert.strictEqual(dist.hunt || 0, 0);
  assert.strictEqual(dist.gather, 500);
});

// ---- Weights proportional, not absolute --------------------------

test('weights 2:1 and 200:100 produce the same distribution', () => {
  const ctx1 = createTestContext({ seed: 1, botCount: 2, dotCount: 0 });
  setWeights(ctx1, { gatherer: 2, clusterFarmer: 1 });
  [[500, 500], [510, 510]].forEach(([x, y]) => {
    const d = new ctx1.YellowDot(); d.x = x; d.y = y;
    ctx1.yellowDots.push(d);
  });
  const d1 = distribution(ctx1.bots[0], 1000);

  const ctx2 = createTestContext({ seed: 1, botCount: 2, dotCount: 0 });
  setWeights(ctx2, { gatherer: 200, clusterFarmer: 100 });
  [[500, 500], [510, 510]].forEach(([x, y]) => {
    const d = new ctx2.YellowDot(); d.x = x; d.y = y;
    ctx2.yellowDots.push(d);
  });
  const d2 = distribution(ctx2.bots[0], 1000);

  // Both should have near-identical distributions (same seed, proportional weights)
  assert.ok(Math.abs((d1.gather || 0) - (d2.gather || 0)) <= 10,
    `gather counts: ${d1.gather} vs ${d2.gather}`);
});

// ---- Noise affects but does not dominate -------------------------

test('noise produces variation but distribution still reflects weights', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  setWeights(ctx, { gatherer: 80, clusterFarmer: 20 });
  ctx.globalSettings.randomnessNoise = 0.3; // significant noise
  [[500, 500], [510, 510]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });

  const dist = distribution(ctx.bots[0], 2000);
  const gather = (dist.gather || 0) / 2000;
  // Still biased toward gather but with wider tolerance
  assert.ok(gather > 0.6 && gather < 0.95, `gather ratio ${gather.toFixed(3)} should still favor gatherer`);
});
