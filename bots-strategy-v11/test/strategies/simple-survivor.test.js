// Strategy adherence: Simple mode, pure Survivor.
// The survivor behavior is conditional on lives <= activationThreshold
// AND nearest enemy within threatRadius. These tests verify the
// flee/gather split behaves consistently over many decisions.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

function configureSurvivor(ctx, overrides = {}) {
  for (const key of Object.keys(ctx.behaviorWeights)) {
    ctx.behaviorWeights[key].enabled = false;
    ctx.behaviorWeights[key].weight = 0;
  }
  ctx.behaviorWeights.survivor.enabled = true;
  ctx.behaviorWeights.survivor.weight = 100;
  Object.assign(ctx.behaviorWeights.survivor.params, overrides);
  ctx.globalSettings.randomnessNoise = 0;
  ctx.globalSettings.emergencyOverride.enabled = false;
}

function countActions(bot, n) {
  const dist = {};
  for (let i = 0; i < n; i++) {
    bot.pickTargetSimpleMode();
    dist[bot.lastAction] = (dist[bot.lastAction] || 0) + 1;
  }
  return dist;
}

// ---- Both conditions met → flee ----------------------------------

test('Survivor: low lives + close enemy → 300/300 flee', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureSurvivor(ctx, { activationThreshold: 3, threatRadius: 200 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.lives = 2; // <= threshold
  ctx.bots[1].x = 150; ctx.bots[1].y = 100; // 50u < 200
  const dist = countActions(bot, 300);
  assert.strictEqual(dist.flee, 300);
});

test('Survivor: flee target points away from nearest enemy', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  configureSurvivor(ctx);
  const bot = ctx.bots[0];
  bot.x = 1000; bot.y = 1000;
  bot.lives = 1;
  ctx.bots[1].x = 900; ctx.bots[1].y = 1000; // enemy to the left
  bot.pickTargetSimpleMode();
  assert.ok(bot.targetX > 1000, `flee target should be east of bot, got ${bot.targetX}`);
});

// ---- Lives above threshold → gather ------------------------------

test('Survivor: high lives → 300/300 gather regardless of enemy proximity', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureSurvivor(ctx, { activationThreshold: 3, threatRadius: 200 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.lives = 10; // well above threshold
  ctx.bots[1].x = 150; ctx.bots[1].y = 100;
  const dist = countActions(bot, 300);
  assert.strictEqual(dist.gather, 300);
});

// ---- Enemy outside threat radius → gather ------------------------

test('Survivor: low lives but distant enemy → gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureSurvivor(ctx, { activationThreshold: 3, threatRadius: 200 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.lives = 1;
  ctx.bots[1].x = 1500; ctx.bots[1].y = 1500; // far away
  const dist = countActions(bot, 300);
  assert.strictEqual(dist.gather, 300);
});

// ---- Threshold sensitivity ---------------------------------------

test('Survivor: activation threshold boundary works', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureSurvivor(ctx, { activationThreshold: 5, threatRadius: 500 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 200; ctx.bots[1].y = 100;

  bot.lives = 5; // at boundary — condition is <=
  let dist = countActions(bot, 100);
  assert.strictEqual(dist.flee, 100, 'should flee at threshold');

  bot.lives = 6;
  dist = countActions(bot, 100);
  assert.strictEqual(dist.gather, 100, 'should gather above threshold');
});

test('Survivor: threatRadius boundary works', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureSurvivor(ctx, { activationThreshold: 3, threatRadius: 200 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.lives = 2;

  ctx.bots[1].x = 250; ctx.bots[1].y = 100; // 150u < 200 → flee
  let dist = countActions(bot, 100);
  assert.strictEqual(dist.flee, 100);

  ctx.bots[1].x = 400; ctx.bots[1].y = 100; // 300u > 200 → gather
  dist = countActions(bot, 100);
  assert.strictEqual(dist.gather, 100);
});

// ---- Bouncing between states -------------------------------------

test('Survivor: toggles as enemy moves in and out of threat radius', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureSurvivor(ctx, { activationThreshold: 3, threatRadius: 200 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.lives = 1;
  const enemy = ctx.bots[1];

  // Close → flee
  enemy.x = 150; enemy.y = 100;
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'flee');

  // Far → gather
  enemy.x = 1500; enemy.y = 100;
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');

  // Close again → flee
  enemy.x = 180; enemy.y = 100;
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'flee');
});
