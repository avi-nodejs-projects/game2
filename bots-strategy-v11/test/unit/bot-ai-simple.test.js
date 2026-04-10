// Unit tests for Bot.pickTargetSimpleMode — weighted behavior
// blending, emergency override, default fallback, and executeAction
// delegation per behavior.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

// Helper: disable all behaviors except the named ones
function enableOnly(ctx, enabled) {
  for (const key of Object.keys(ctx.behaviorWeights)) {
    ctx.behaviorWeights[key].enabled = enabled.includes(key);
    if (enabled.includes(key)) {
      ctx.behaviorWeights[key].weight = 100;
    }
  }
}

// Helper: silence noise so weighted selection is deterministic
function noNoise(ctx) {
  ctx.globalSettings.randomnessNoise = 0;
}

// ---- No behaviors enabled → gather fallback ----------------------

test('simpleMode: no enabled behaviors falls back to gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  for (const key of Object.keys(ctx.behaviorWeights)) {
    ctx.behaviorWeights[key].enabled = false;
  }
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

// ---- Single-behavior dispatch -----------------------------------

test('simpleMode: only gatherer enabled → action is gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  noNoise(ctx);
  enableOnly(ctx, ['gatherer']);
  const bot = ctx.bots[0];
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test('simpleMode: only clusterFarmer enabled → action is cluster', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['clusterFarmer']);
  // Need some dots for executeAction('cluster') to find a cluster
  for (let i = 0; i < 5; i++) {
    const d = new ctx.YellowDot(); d.x = 500 + i * 5; d.y = 500;
    ctx.yellowDots.push(d);
  }
  const bot = ctx.bots[0];
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'cluster');
});

test('simpleMode: only opportunist enabled → action is gather_safe', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  noNoise(ctx);
  enableOnly(ctx, ['opportunist']);
  const bot = ctx.bots[0];
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather_safe');
});

// ---- Hunter conditional on combat advantage ----------------------

test('simpleMode: hunter with combat_advantage >= min → hunt action', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['hunter']);
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  // Make our bot much stronger
  bot.attack = 20; bot.defence = 20; bot.lives = 20;
  enemy.attack = 1; enemy.defence = 1; enemy.lives = 1;
  // Default minAdvantage = 0, so advantage > 0 satisfies hunter
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

test('simpleMode: hunter with combat_advantage < min → gather (not hunt)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['hunter']);
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  // Make bot weaker
  bot.attack = 1; bot.defence = 1; bot.lives = 1;
  enemy.attack = 20; enemy.defence = 20; enemy.lives = 20;
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

// ---- Survivor conditional on lives + proximity ------------------

test('simpleMode: survivor with low lives + close enemy → flee', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['survivor']);
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.lives = 2; // at activation threshold
  ctx.bots[1].x = 150; ctx.bots[1].y = 100; // 50u away < 200 threatRadius
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'flee');
});

test('simpleMode: survivor with high lives → gather (no flee)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['survivor']);
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  bot.lives = 10; // well above threshold
  ctx.bots[1].x = 150; ctx.bots[1].y = 100;
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test('simpleMode: survivor with low lives but far enemy → gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['survivor']);
  const bot = ctx.bots[0];
  bot.x = 0; bot.y = 0;
  bot.lives = 1;
  ctx.bots[1].x = 1500; ctx.bots[1].y = 1500; // far
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

// ---- Avenger conditional -----------------------------------------

test('simpleMode: avenger with no lastAttacker → gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['avenger']);
  const bot = ctx.bots[0];
  bot.lastAttacker = null;
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test('simpleMode: avenger with weak lastAttacker → hunt', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['avenger']);
  const bot = ctx.bots[0];
  const attacker = ctx.bots[1];
  attacker.lives = 1; // below finishThreshold (default 2)
  bot.lastAttacker = attacker;
  // frames_since_damage_taken returns 999 if frameLastTookDamage is 0,
  // so we set both to a non-zero "recently" value.
  ctx.frameCount = 100;
  bot.frameLastTookDamage = 50; // 50 frames ago — within pursuitDuration=180
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

test('simpleMode: avenger with stale damage → gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  noNoise(ctx);
  enableOnly(ctx, ['avenger']);
  const bot = ctx.bots[0];
  const attacker = ctx.bots[1];
  attacker.lives = 1;
  bot.lastAttacker = attacker;
  bot.frameLastTookDamage = 0;
  ctx.frameCount = 500; // > default pursuitDuration 180
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

// ---- Emergency override ------------------------------------------

test('simpleMode: emergency override fires when lives <= threshold', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  noNoise(ctx);
  enableOnly(ctx, ['gatherer']);
  ctx.globalSettings.emergencyOverride.enabled = true;
  ctx.globalSettings.emergencyOverride.livesThreshold = 2;
  ctx.globalSettings.emergencyOverride.behavior = 'flee';
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'flee');
});

test('simpleMode: emergency override respects threshold boundary', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  noNoise(ctx);
  enableOnly(ctx, ['gatherer']);
  ctx.globalSettings.emergencyOverride.enabled = true;
  ctx.globalSettings.emergencyOverride.livesThreshold = 2;
  ctx.globalSettings.emergencyOverride.behavior = 'flee';
  const bot = ctx.bots[0];
  bot.lives = 3; // above threshold
  bot.pickTargetSimpleMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

// ---- executeAction delegation -----------------------------------

test('executeAction: gather sets target to nearest dot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 1 });
  const bot = ctx.bots[0];
  bot.x = 0; bot.y = 0;
  ctx.yellowDots[0].x = 500; ctx.yellowDots[0].y = 500;
  bot.executeAction('gather', bot.getContext());
  assert.strictEqual(bot.targetX, 500);
  assert.strictEqual(bot.targetY, 500);
});

test('executeAction: flee moves target away from nearest enemy', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  bot.x = 1000; bot.y = 1000;
  enemy.x = 800; enemy.y = 1000; // enemy is to the left
  bot.executeAction('flee', bot.getContext());
  // Target should be to the right of bot (away from enemy)
  assert.ok(bot.targetX > bot.x,
    `expected targetX > ${bot.x}, got ${bot.targetX}`);
});

test('executeAction: hunt sets target to nearest enemy', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  bot.x = 0; bot.y = 0;
  enemy.x = 500; enemy.y = 500;
  bot.executeAction('hunt', bot.getContext());
  assert.strictEqual(bot.targetX, 500);
  assert.strictEqual(bot.targetY, 500);
});

test('executeAction: hunt_weak sets target to weakest bot', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const bot = ctx.bots[0];
  ctx.bots[1].lives = 5;
  ctx.bots[2].lives = 1; // weakest
  ctx.bots[2].x = 1234; ctx.bots[2].y = 1567; // in bounds
  bot.executeAction('hunt_weak', bot.getContext());
  assert.strictEqual(bot.targetX, 1234);
  assert.strictEqual(bot.targetY, 1567);
});

test('executeAction: cluster sets target to nearest dot in cluster', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 0; bot.y = 0;
  // Create a cluster
  [[500, 500], [510, 505], [495, 510]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });
  bot.executeAction('cluster', bot.getContext());
  // Target should be one of the cluster dots
  assert.ok(bot.targetX >= 495 && bot.targetX <= 510);
  assert.ok(bot.targetY >= 500 && bot.targetY <= 510);
});

test('executeAction: wander picks a random in-bounds target', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.executeAction('wander', bot.getContext());
  assert.ok(bot.targetX >= 50 && bot.targetX <= ctx.WORLD_WIDTH - 50);
  assert.ok(bot.targetY >= 50 && bot.targetY <= ctx.WORLD_HEIGHT - 50);
});

test('executeAction: target clamped to world bounds', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  // Put bot near edge and flee in a direction that would leave the field
  bot.x = ctx.WORLD_WIDTH - 30; bot.y = 1000;
  enemy.x = 100; enemy.y = 1000;
  bot.executeAction('flee', bot.getContext());
  assert.ok(bot.targetX <= ctx.WORLD_WIDTH - 50);
});

test('executeAction: resets idleTime to 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 1 });
  const bot = ctx.bots[0];
  bot.idleTime = 99;
  bot.executeAction('gather', bot.getContext());
  assert.strictEqual(bot.idleTime, 0);
});
