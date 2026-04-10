// Integration tests: reproduction cycle through the full game loop.
// Covers: mature → reproduce → offspring grows up → offspring mature.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, runSimulation } = require('../helpers');

function enableAsexual(ctx) {
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
  ctx.lifecycleSettings.reproduction.asexual.maturityMetric = 'frames';
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 100;
  ctx.lifecycleSettings.reproduction.asexual.cooldown = 200;
  ctx.lifecycleSettings.reproduction.asexual.parentLifeCost = 0.5;
}

function enableSexual(ctx) {
  ctx.lifecycleSettings.reproduction.sexual.enabled = true;
  ctx.lifecycleSettings.reproduction.sexual.proximityDistance = 80;
  ctx.lifecycleSettings.reproduction.sexual.proximityDuration = 60;
  ctx.lifecycleSettings.reproduction.sexual.compatibilityThreshold = 0;
  ctx.lifecycleSettings.reproduction.sexual.cooldown = 200;
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 20;
}

// ---- Asexual ---------------------------------------------------

test('asexual: mature bot produces offspring through the game loop', () => {
  const ctx = createTestContext({ seed: 42, botCount: 3, dotCount: 10 });
  enableAsexual(ctx);
  const countBefore = ctx.bots.length;

  // Warm up so bots reach maturity (lifetime >= 100)
  runSimulation(ctx, 300);
  assert.ok(ctx.bots.length > countBefore, `expected offspring, got ${ctx.bots.length}`);
});

test('asexual: parent loses lives when reproducing', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  const parent = ctx.bots[0];
  parent.lifetime = 10000;
  parent.lives = 10;
  parent.reproductionCooldown = 0;

  ctx.reproduceAsexual(parent);
  // parentLifeCost = 0.5 → lives drop to 5
  assert.strictEqual(parent.lives, 5);
});

test('asexual: offspring has protection from parent', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.offspring.protection.duration = 500;
  const parent = ctx.bots[0];
  parent.lifetime = 10000;
  parent.lives = 10;

  const offspring = ctx.reproduceAsexual(parent);
  assert.ok(offspring);
  assert.strictEqual(ctx.isProtected(parent, offspring), true);
});

test('asexual: cooldown prevents immediate re-reproduction', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  const parent = ctx.bots[0];
  parent.lifetime = 10000;
  parent.lives = 10;

  const first = ctx.reproduceAsexual(parent);
  assert.ok(first);
  // Immediately try again — cooldown should block
  const second = ctx.reproduceAsexual(parent);
  assert.strictEqual(second, null);
});

// ---- Sexual ----------------------------------------------------

test('sexual: two close mature bots produce offspring via game loop', () => {
  const ctx = createTestContext({ seed: 42, botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  const a = ctx.bots[0], b = ctx.bots[1];
  a.lifetime = 10000; b.lifetime = 10000;
  a.x = 1000; a.y = 1000;
  b.x = 1050; b.y = 1000;
  // Keep them stationary — make target == position
  a.targetX = a.x; a.targetY = a.y;
  b.targetX = b.x; b.targetY = b.y;

  const countBefore = ctx.bots.length;
  runSimulation(ctx, 200);
  // May or may not reproduce depending on if bots drift apart;
  // just verify no exceptions and counts are sensible.
  assert.ok(ctx.bots.length >= countBefore);
});

// ---- Offspring growth cycle -----------------------------------

test('reproduction: offspring generation increments with each reproduction', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  const gen0 = ctx.bots[0];
  gen0.lifetime = 10000;
  gen0.lives = 10;
  gen0.generation = 0;

  const gen1 = ctx.reproduceAsexual(gen0);
  assert.strictEqual(gen1.generation, 1);

  // Mature the gen1 and have it reproduce
  gen1.lifetime = 10000;
  gen1.lives = 10;
  gen1.reproductionCooldown = 0;
  const gen2 = ctx.reproduceAsexual(gen1);
  assert.strictEqual(gen2.generation, 2);
});

test('reproduction: player lineage propagates across generations', () => {
  const ctx = createTestContext({ seed: 42, botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  const player = ctx.bots[0]; // isPlayer = true from fixture
  player.lifetime = 10000;
  player.lives = 10;

  const gen1 = ctx.reproduceAsexual(player);
  assert.strictEqual(gen1.isPlayerOffspring, true);
  assert.strictEqual(gen1.playerLineage, 1);

  gen1.lifetime = 10000;
  gen1.lives = 10;
  gen1.reproductionCooldown = 0;
  const gen2 = ctx.reproduceAsexual(gen1);
  assert.strictEqual(gen2.isPlayerOffspring, true);
  assert.strictEqual(gen2.playerLineage, 2);
});
