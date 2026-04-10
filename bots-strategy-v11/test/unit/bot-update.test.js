// Unit tests for Bot.update — movement, idle behavior, target
// cycling, boundary clamping, combat cooldown decrement, and
// re-evaluation timer.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, assertApprox, assertInRange } = require('../helpers');

// ---- Movement toward target ---------------------------------------

test('update: bot moves toward its target', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.targetX = 200; bot.targetY = 100;
  bot.speed = 5; // move speed = 0.5 + 5*0.2 = 1.5
  bot.update();
  // Moved toward +x by ~1.5
  assertApprox(bot.x, 101.5, 0.01);
  assertApprox(bot.y, 100, 0.01);
});

test('update: movement vector normalized (diagonal movement)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.targetX = 200; bot.targetY = 200; // 45° diagonal
  bot.speed = 5; // speed 1.5
  const x0 = bot.x;
  const y0 = bot.y;
  bot.update();
  const dx = bot.x - x0;
  const dy = bot.y - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  assertApprox(dist, 1.5, 0.01); // moved exactly 1.5 units
});

test('update: higher speed stat moves bot faster', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const slow = ctx.bots[0];
  const fast = ctx.bots[1];
  slow.x = 100; slow.y = 100; slow.targetX = 200; slow.targetY = 100;
  fast.x = 100; fast.y = 100; fast.targetX = 200; fast.targetY = 100;
  slow.speed = 1;  // move speed 0.7
  fast.speed = 10; // move speed 2.5
  slow.update();
  fast.update();
  assert.ok(fast.x - 100 > slow.x - 100,
    'fast bot should have moved further');
});

test('update: sets angle based on movement direction', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.targetX = 200; bot.targetY = 100; // directly right
  bot.update();
  // atan2(0, 100) = 0
  assertApprox(bot.angle, 0, 0.01);
});

test('update: sets angle for upward movement', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.targetX = 100; bot.targetY = 0; // directly up (negative y)
  bot.update();
  // atan2(-100, 0) = -PI/2
  assertApprox(bot.angle, -Math.PI / 2, 0.01);
});

// ---- Idle behavior at target --------------------------------------

test('update: idles when within 5 units of target', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.targetX = 100; bot.targetY = 100; // exactly at target
  bot.idleTime = 0;
  bot.maxIdle = 9999; // don't pick new target
  bot.update();
  assert.strictEqual(bot.idleTime, 1);
});

test('update: picks new target after max idle reached', () => {
  // With seed 42 and an empty dot array, pickNewTarget will
  // fall back to a random wander target.
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.targetX = 100; bot.targetY = 100;
  bot.idleTime = 100;
  bot.maxIdle = 50;
  // Force re-eval timer to not interfere
  bot._reEvalTimer = 0;
  bot.update();
  // Target should have changed (picked something new)
  // Either a dot/bot target was picked, or a random wander target.
  // It's extremely unlikely to land back on exactly (100, 100).
  assert.ok(bot.targetX !== 100 || bot.targetY !== 100);
});

// ---- Boundary clamping --------------------------------------------

test('update: bot stays within world bounds (x min)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 15; bot.y = 1000;
  bot.targetX = -100; bot.targetY = 1000; // off-map target
  bot.speed = 10;
  for (let i = 0; i < 20; i++) bot.update();
  assertInRange(bot.x, 20, ctx.WORLD_WIDTH - 20);
});

test('update: bot stays within world bounds (x max)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = ctx.WORLD_WIDTH - 15;
  bot.y = 1000;
  bot.targetX = ctx.WORLD_WIDTH + 100;
  bot.targetY = 1000;
  bot.speed = 10;
  for (let i = 0; i < 20; i++) bot.update();
  assertInRange(bot.x, 20, ctx.WORLD_WIDTH - 20);
});

test('update: bot stays within world bounds (y min/max)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 1000; bot.y = 15;
  bot.targetX = 1000; bot.targetY = -100;
  bot.speed = 10;
  for (let i = 0; i < 20; i++) bot.update();
  assertInRange(bot.y, 20, ctx.WORLD_HEIGHT - 20);
});

// ---- combatCooldown decrement -------------------------------------

test('update: decrements combatCooldown', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.combatCooldown = 60;
  bot.update();
  assert.strictEqual(bot.combatCooldown, 59);
});

test('update: combatCooldown never goes below 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.combatCooldown = 0;
  bot.update();
  assert.strictEqual(bot.combatCooldown, 0);
});

// ---- damageTimer decrement ----------------------------------------

test('update: decrements damageTimer and clears justTookDamage', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.damageTimer = 1;
  bot.justTookDamage = true;
  bot.lastAttacker = { dummy: true };
  bot.update();
  assert.strictEqual(bot.damageTimer, 0);
  assert.strictEqual(bot.justTookDamage, false);
  assert.strictEqual(bot.lastAttacker, null);
});

test('update: decrements damageDealtTimer and clears justDealtDamage', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.damageDealtTimer = 1;
  bot.justDealtDamage = true;
  bot.update();
  assert.strictEqual(bot.damageDealtTimer, 0);
  assert.strictEqual(bot.justDealtDamage, false);
});

// ---- lifetime counter ---------------------------------------------

test('update: increments lifetime every call', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.lifetime = 0;
  bot.update();
  bot.update();
  bot.update();
  assert.strictEqual(bot.lifetime, 3);
});

// ---- speedBoostFrames ---------------------------------------------

test('update: decrements speedBoostFrames and removes boost at 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.speed = 6.5; // 5 base + 0.5 boost
  bot.speedBoostFrames = 1;
  bot.update();
  assert.strictEqual(bot.speedBoostFrames, 0);
  // Boost removed: -0.5
  assertApprox(bot.speed, 6, 1e-9);
});

// ---- Re-evaluation timer ------------------------------------------

test('update: re-evaluates target every reEvaluationRate frames', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 1 });
  ctx.globalSettings.reEvaluationRate = 5;
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.targetX = 200; bot.targetY = 100;
  bot._reEvalTimer = 0;
  bot.combatCooldown = 0;

  // Place a dot nearby so pickNewTarget has something to choose
  ctx.yellowDots[0].x = 150;
  ctx.yellowDots[0].y = 100;

  // Run exactly reEvaluationRate+1 updates → should re-target once
  for (let i = 0; i < 6; i++) bot.update();
  // After 5 updates + 1 more, re-eval should have fired
  // Bot may still be heading toward a dot, but the timer should have reset
  assert.ok(bot._reEvalTimer <= 1);
});

test('update: does not re-evaluate while in combat cooldown', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 1 });
  ctx.globalSettings.reEvaluationRate = 5;
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.targetX = 200; bot.targetY = 100;
  bot._reEvalTimer = 999;
  bot.combatCooldown = 30;
  bot.update();
  // Timer should not have advanced
  assert.strictEqual(bot._reEvalTimer, 999);
});
