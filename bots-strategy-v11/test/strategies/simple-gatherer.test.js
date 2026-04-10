// Strategy adherence: Simple mode, pure Gatherer.
// Unlike bot-ai-simple.test.js which tests single decisions,
// this file verifies the bot STAYS IN CHARACTER over many calls.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

// Configure the simple-mode behavior weights in-place.
function configureSimple(ctx, spec) {
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

// Run N decisions and return a {action: count} distribution.
function runDecisions(bot, mode, count) {
  const dist = {};
  for (let i = 0; i < count; i++) {
    bot[mode]();
    const a = bot.lastAction || 'unknown';
    dist[a] = (dist[a] || 0) + 1;
  }
  return dist;
}

// ---- Pure Gatherer (100% weight) ----------------------------------

test('Gatherer: 500/500 decisions are gather when only gatherer enabled', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 10 });
  configureSimple(ctx, { gatherer: 100 });
  const bot = ctx.bots[0];
  const dist = runDecisions(bot, 'pickTargetSimpleMode', 500);
  assert.strictEqual(dist.gather, 500, `got distribution ${JSON.stringify(dist)}`);
});

test('Gatherer: adherence unaffected by low lives', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 10 });
  configureSimple(ctx, { gatherer: 100 });
  const bot = ctx.bots[0];
  bot.lives = 1; // low lives would matter for survivor, not gatherer
  const dist = runDecisions(bot, 'pickTargetSimpleMode', 300);
  assert.strictEqual(dist.gather, 300);
});

test('Gatherer: adherence unaffected by close enemies', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 10 });
  configureSimple(ctx, { gatherer: 100 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 110; ctx.bots[1].y = 100; // on top of us
  const dist = runDecisions(bot, 'pickTargetSimpleMode', 300);
  assert.strictEqual(dist.gather, 300, 'gatherer ignores nearby threats');
});

test('Gatherer: target always points at a real dot', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureSimple(ctx, { gatherer: 100 });
  const bot = ctx.bots[0];
  for (let i = 0; i < 200; i++) {
    bot.pickTargetSimpleMode();
    const onADot = ctx.yellowDots.some(d => d.x === bot.targetX && d.y === bot.targetY);
    assert.ok(onADot, `target (${bot.targetX}, ${bot.targetY}) should match a dot`);
  }
});

// ---- Gatherer + ClusterFarmer (two gathering behaviors) ----------

test('Gatherer+ClusterFarmer: 100% of decisions are gather or cluster', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  configureSimple(ctx, { gatherer: 60, clusterFarmer: 40 });
  // Populate a dense cluster + some scattered dots
  [[500, 500], [510, 500], [500, 510], [510, 510], [505, 505]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });
  const bot = ctx.bots[0];
  const dist = runDecisions(bot, 'pickTargetSimpleMode', 500);
  const nonFoodActions = Object.entries(dist).filter(([a]) => a !== 'gather' && a !== 'cluster');
  assert.strictEqual(nonFoodActions.length, 0, `non-food actions: ${JSON.stringify(dist)}`);
});

// ---- Emergency override interrupts adherence ---------------------

test('Gatherer: emergency override switches to flee when lives drop', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureSimple(ctx, { gatherer: 100 });
  ctx.globalSettings.emergencyOverride.enabled = true;
  ctx.globalSettings.emergencyOverride.livesThreshold = 2;
  ctx.globalSettings.emergencyOverride.behavior = 'flee';

  const bot = ctx.bots[0];
  bot.lives = 1; // below threshold

  const dist = runDecisions(bot, 'pickTargetSimpleMode', 200);
  assert.strictEqual(dist.flee, 200, 'all decisions should be flee while under emergency');
});
