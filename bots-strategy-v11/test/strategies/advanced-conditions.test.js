// Strategy adherence: Advanced mode condition evaluation.
// Exercises every comparison operator and a representative
// sampling of context subjects to ensure rule conditions work
// end-to-end (not just the isolated evaluateCondition tests
// in Phase 3).

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

function setupRule(ctx, condition, action) {
  ctx.rules.length = 0;
  ctx.rules.push({ conditions: [condition], action });
  ctx.rules.push({ conditions: [], action: 'gather' });  // catch-all
  ctx.globalSettings.randomnessNoise = 0;
  ctx.globalSettings.emergencyOverride.enabled = false;
}

// ---- All 6 operators end-to-end ----------------------------------

test("operator '<': lives < 3 fires when lives=2, not when lives=3", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'my.lives', operator: '<', value: 3 }, 'flee');
  const bot = ctx.bots[0];

  bot.lives = 2;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');

  bot.lives = 3;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test("operator '<=': lives <= 3 fires at 2 and 3", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'my.lives', operator: '<=', value: 3 }, 'flee');
  const bot = ctx.bots[0];

  bot.lives = 3;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');

  bot.lives = 4;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test("operator '>': lives > 5 fires when lives=6, not 5", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'my.lives', operator: '>', value: 5 }, 'hunt');
  const bot = ctx.bots[0];
  bot.attack = 20; bot.defence = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;

  bot.lives = 6;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');

  bot.lives = 5;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test("operator '>=': lives >= 5 fires at 5 and 6", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'my.lives', operator: '>=', value: 5 }, 'hunt');
  const bot = ctx.bots[0];
  bot.attack = 20; bot.defence = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;

  bot.lives = 5;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');

  bot.lives = 4;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test("operator '=': zone == 5 fires exactly for center zone", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'my.zone', operator: '=', value: 5 }, 'wander');
  const bot = ctx.bots[0];

  bot.x = 1000; bot.y = 1000; // center zone (zone 5)
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'wander');

  bot.x = 100; bot.y = 100; // top-left (zone 1)
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test("operator '!=': zone != 5 fires for non-center zones", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'my.zone', operator: '!=', value: 5 }, 'wander');
  const bot = ctx.bots[0];

  bot.x = 100; bot.y = 100;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'wander');

  bot.x = 1000; bot.y = 1000;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

// ---- Subject coverage: different context variables --------------

test('subject my.attack works in rule', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'my.attack', operator: '>=', value: 10 }, 'hunt');
  const bot = ctx.bots[0];
  bot.attack = 15; bot.defence = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

test('subject my.health_percent works in rule', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'my.health_percent', operator: '<', value: 50 }, 'flee');
  const bot = ctx.bots[0];
  bot.lives = 1; bot.initialLives = 5; // 20%
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');
});

test('subject nearest_enemy.distance works in rule', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'nearest_enemy.distance', operator: '<', value: 100 }, 'flee');
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 150; ctx.bots[1].y = 100;  // 50u away
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');
});

test('subject combat_advantage works in rule', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'combat_advantage', operator: '>', value: 0 }, 'hunt');
  const bot = ctx.bots[0];
  bot.attack = 20; bot.defence = 20; bot.lives = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

test('subject best_cluster.size works in rule', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  setupRule(ctx, { subject: 'best_cluster.size', operator: '>=', value: 3 }, 'cluster');
  const bot = ctx.bots[0];
  // Build a 4-dot cluster
  [[500, 500], [510, 500], [500, 510], [510, 510]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'cluster');
});

test('subject nearby_enemy_count works in rule', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 5 });
  setupRule(ctx, { subject: 'nearby_enemy_count', operator: '>=', value: 2 }, 'flee');
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 150; ctx.bots[1].y = 100;
  ctx.bots[2].x = 200; ctx.bots[2].y = 100;
  ctx.bots[3].x = 1800; ctx.bots[3].y = 1800; // far
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');
});

test('subject am_strongest works in rule (1 = true)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setupRule(ctx, { subject: 'am_strongest', operator: '=', value: 1 }, 'hunt');
  const bot = ctx.bots[0];
  bot.attack = 100; bot.defence = 100; bot.lives = 100;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

// ---- Multi-condition AND logic -----------------------------------

test('multi-condition rule: all conditions must hold', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  ctx.rules.length = 0;
  ctx.rules.push({
    conditions: [
      { subject: 'my.lives', operator: '<=', value: 3 },
      { subject: 'nearest_enemy.distance', operator: '<', value: 200 },
    ],
    action: 'flee',
  });
  ctx.rules.push({ conditions: [], action: 'gather' });
  ctx.globalSettings.randomnessNoise = 0;
  ctx.globalSettings.emergencyOverride.enabled = false;

  const bot = ctx.bots[0];
  bot.lives = 2;
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 150; ctx.bots[1].y = 100;

  // Both conditions true → flee
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');

  // Only lives matches → gather
  ctx.bots[1].x = 1800; ctx.bots[1].y = 1800;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');

  // Only distance matches (high lives) → gather
  bot.lives = 10;
  ctx.bots[1].x = 150; ctx.bots[1].y = 100;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});
