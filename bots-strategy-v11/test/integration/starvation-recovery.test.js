// Integration tests: starvation ticks, damage, and recovery
// through the full game loop.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, runSimulation } = require('../helpers');

function enableStarvation(ctx, overrides = {}) {
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.inactivityThreshold = 60;
  ctx.lifecycleSettings.starvation.tickInterval = 30;
  ctx.lifecycleSettings.starvation.damagePerTick = 0.5;
  ctx.lifecycleSettings.starvation.resetConditions.onDotEaten = true;
  ctx.lifecycleSettings.starvation.resetConditions.onDamageDealt = true;
  ctx.lifecycleSettings.starvation.resetConditions.onKill = true;
  Object.assign(ctx.lifecycleSettings.starvation, overrides);
}

// ---- Starvation accumulates ----------------------------------

test('starvation: isolated bot with no dots progresses into starving state', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableStarvation(ctx);
  const bot = ctx.bots[0];
  bot.x = 1000; bot.y = 1000;
  bot.targetX = 1000; bot.targetY = 1000;

  runSimulation(ctx, 80); // past threshold
  assert.strictEqual(bot.isStarving, true);
});

test('starvation: bot loses lives over time when starving', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableStarvation(ctx);
  const bot = ctx.bots[0];
  bot.lives = 5;

  runSimulation(ctx, 300);
  assert.ok(bot.lives < 5, `lives should have dropped, got ${bot.lives}`);
});

test('starvation: dies when lives drop to 0', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableStarvation(ctx);
  ctx.lifecycleSettings.starvation.damagePerTick = 10;
  const bot = ctx.bots[0];
  bot.lives = 5;

  runSimulation(ctx, 200);
  // Bot should have died and respawned — lives back to defaults
  assert.strictEqual(bot.lives, 3);
});

// ---- Recovery via eating -------------------------------------

test('starvation: eating a dot resets the starvation counter', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 1 });
  enableStarvation(ctx);
  const bot = ctx.bots[0];
  // Run long enough for bot to get hungry
  runSimulation(ctx, 80);
  const starvationBefore = bot.starvationCounter;
  assert.ok(starvationBefore > 0, 'counter should be building up');

  // Place a dot directly on the bot and run ONE frame.
  // Within that frame: updateStarvation bumps the counter to N+1,
  // then processCollisions → eat → resetStarvationTimer → counter=0.
  // At end-of-frame the counter is 0.
  ctx.yellowDots[0].x = bot.x;
  ctx.yellowDots[0].y = bot.y;
  runSimulation(ctx, 1);

  assert.strictEqual(bot.isStarving, false, 'should no longer be starving');
  assert.strictEqual(bot.starvationCounter, 0, 'counter reset after eating');
});

test('starvation: winning combat resets the counter', () => {
  const ctx = createTestContext({ seed: 42, botCount: 2, dotCount: 0 });
  enableStarvation(ctx);
  const bot = ctx.bots[0];
  const prey = ctx.bots[1];
  bot.attack = 100; bot.defence = 10; bot.lives = 10;
  prey.attack = 1; prey.defence = 1; prey.lives = 1;

  // Warm up starvation
  bot.starvationCounter = 200;
  bot.isStarving = true;

  // Place prey on top — combat → kill → starvation reset
  bot.x = 500; bot.y = 500;
  prey.x = 510; prey.y = 500;

  runSimulation(ctx, 5);
  assert.strictEqual(bot.isStarving, false);
});

// ---- Scaled starvation: stronger bots starve faster ----------

test('starvation: stronger bots hit the threshold sooner (scaling)', () => {
  const ctx = createTestContext({ seed: 42, botCount: 2, dotCount: 0 });
  enableStarvation(ctx, { inactivityThreshold: 200 });
  ctx.lifecycleSettings.starvation.scaling.enabled = true;
  ctx.lifecycleSettings.starvation.scaling.baselineStats = 18;
  ctx.lifecycleSettings.starvation.scaling.factor = 0.5;

  const weak = ctx.bots[0];
  const strong = ctx.bots[1];
  // Move apart so they don't interact
  weak.x = 500; weak.y = 500;
  strong.x = 1500; strong.y = 1500;
  weak.targetX = weak.x; weak.targetY = weak.y;
  strong.targetX = strong.x; strong.targetY = strong.y;

  // Make one bot much stronger
  strong.speed = 20; strong.attack = 20; strong.defence = 20; strong.lives = 20;

  runSimulation(ctx, 150);
  // Strong bot should hit effective threshold first → starving=true
  assert.strictEqual(strong.isStarving, true);
  // Weak bot (18 total stats) still below threshold
  assert.strictEqual(weak.isStarving, false);
});

// ---- Stat decay during starvation ----------------------------

test('starvation: stat decay reduces stats while starving', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableStarvation(ctx);
  ctx.lifecycleSettings.starvation.statDecay.enabled = true;
  ctx.lifecycleSettings.starvation.statDecay.decayPerTick = 0.1;
  ctx.lifecycleSettings.starvation.statDecay.order = 'highestFirst';
  const bot = ctx.bots[0];
  bot.speed = 10; bot.attack = 5; bot.defence = 5;
  bot.lives = 100;  // Keep alive so stat decay is the dominant effect

  runSimulation(ctx, 400);
  assert.ok(bot.speed < 10, `speed should have decayed, got ${bot.speed}`);
});
