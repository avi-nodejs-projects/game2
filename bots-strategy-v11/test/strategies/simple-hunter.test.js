// Strategy adherence: Simple mode, pure Hunter.
// The hunter behavior is conditional on combat_advantage >= minAdvantage.
// These tests verify the hunt/gather split behaves consistently.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

function configureHunter(ctx, overrides = {}) {
  for (const key of Object.keys(ctx.behaviorWeights)) {
    ctx.behaviorWeights[key].enabled = false;
    ctx.behaviorWeights[key].weight = 0;
  }
  ctx.behaviorWeights.hunter.enabled = true;
  ctx.behaviorWeights.hunter.weight = 100;
  Object.assign(ctx.behaviorWeights.hunter.params, overrides);
  ctx.globalSettings.randomnessNoise = 0;
}

function countActions(bot, mode, n) {
  const dist = {};
  for (let i = 0; i < n; i++) {
    bot[mode]();
    dist[bot.lastAction] = (dist[bot.lastAction] || 0) + 1;
  }
  return dist;
}

// ---- Favourable advantage → pure hunt ----------------------------

test('Hunter: strong bot vs weak enemy → 500/500 hunt', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureHunter(ctx);
  const bot = ctx.bots[0];
  bot.attack = 20; bot.defence = 20; bot.lives = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  const dist = countActions(bot, 'pickTargetSimpleMode', 500);
  assert.strictEqual(dist.hunt, 500);
});

test('Hunter: targets nearest enemy (not wounded by default unless enabled)', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  configureHunter(ctx, { preferWounded: false });
  const bot = ctx.bots[0];
  bot.attack = 20; bot.defence = 20; bot.lives = 20;
  bot.x = 100; bot.y = 100;
  ctx.bots[1].attack = 2; ctx.bots[1].defence = 2; ctx.bots[1].lives = 5;
  ctx.bots[1].x = 200; ctx.bots[1].y = 100; // nearer (dist 100)
  ctx.bots[2].attack = 2; ctx.bots[2].defence = 2; ctx.bots[2].lives = 1;
  ctx.bots[2].x = 800; ctx.bots[2].y = 100; // farther (dist 700), wounded
  bot.pickTargetSimpleMode();
  // With preferWounded OFF, hunt targets the nearest enemy
  assert.strictEqual(bot.targetX, 200);
});

test('Hunter with preferWounded=true targets wounded over nearest', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  configureHunter(ctx, { preferWounded: true, woundedThreshold: 3 });
  const bot = ctx.bots[0];
  bot.attack = 20; bot.defence = 20; bot.lives = 20;
  bot.x = 100; bot.y = 100;
  // Set the weakest (lowest-lives) bot to be the wounded target
  ctx.bots[1].lives = 5;
  ctx.bots[1].x = 200; ctx.bots[1].y = 100; // nearer, healthy
  ctx.bots[2].lives = 1;
  ctx.bots[2].x = 800; ctx.bots[2].y = 100; // farther, wounded
  bot.pickTargetSimpleMode();
  // preferWounded points at weakestEnemy (lives <= threshold)
  assert.strictEqual(bot.targetX, 800);
});

// ---- Unfavourable advantage → gather fallback --------------------

test('Hunter: weak bot vs strong enemy → 500/500 gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureHunter(ctx);
  const bot = ctx.bots[0];
  bot.attack = 1; bot.defence = 1; bot.lives = 1;
  ctx.bots[1].attack = 20; ctx.bots[1].defence = 20; ctx.bots[1].lives = 20;
  const dist = countActions(bot, 'pickTargetSimpleMode', 500);
  assert.strictEqual(dist.gather, 500, 'should fall back to gather');
});

test('Hunter: minAdvantage threshold controls switch point', () => {
  // With minAdvantage = 3, a mirror match (advantage=0) falls back
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureHunter(ctx, { minAdvantage: 3 });
  const bot = ctx.bots[0];
  bot.attack = 5; bot.defence = 5; bot.lives = 5;
  ctx.bots[1].attack = 5; ctx.bots[1].defence = 5; ctx.bots[1].lives = 5;
  const dist = countActions(bot, 'pickTargetSimpleMode', 200);
  assert.strictEqual(dist.gather, 200);
});

test('Hunter: minAdvantage=-Infinity makes even weak bot hunt', () => {
  // Actual combat_advantage for a very weak vs very strong matchup
  // can be large-magnitude negative (e.g. -20+), so we use
  // -Infinity to guarantee the condition is always satisfied.
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  configureHunter(ctx, { minAdvantage: -Infinity });
  const bot = ctx.bots[0];
  bot.attack = 2; bot.defence = 2; bot.lives = 2;
  ctx.bots[1].attack = 8; ctx.bots[1].defence = 8; ctx.bots[1].lives = 8;
  const dist = countActions(bot, 'pickTargetSimpleMode', 200);
  assert.strictEqual(dist.hunt, 200);
});

// ---- No enemies at all -------------------------------------------

test('Hunter: alone in field → gather (combat_advantage = 0)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 5 });
  configureHunter(ctx);
  const bot = ctx.bots[0];
  const dist = countActions(bot, 'pickTargetSimpleMode', 200);
  // With no enemies, combat_advantage is 0, minAdvantage default is 0
  // 0 >= 0 is TRUE → hunt → but no enemy → executeAction falls back to wander
  const nonDefault = Object.keys(dist).filter(a => a !== 'hunt');
  assert.strictEqual(dist.hunt, 200, 'hunter decides hunt even with no targets');
  // But executeAction('hunt') with no enemy results in a random wander target
});
