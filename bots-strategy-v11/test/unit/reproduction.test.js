// Unit tests for reproduction.js — asexual and sexual reproduction,
// offspring stat inheritance, strategy blending, mating progress.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

function enableAsexual(ctx) {
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
}

function enableSexual(ctx) {
  ctx.lifecycleSettings.reproduction.sexual.enabled = true;
}

// ---- canReproduceAsexual ------------------------------------------

test('canReproduceAsexual: false when disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.lifetime = 10000;
  assert.strictEqual(ctx.canReproduceAsexual(bot), false);
});

test('canReproduceAsexual: false when not mature', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 1800;
  const bot = ctx.bots[0];
  bot.lifetime = 100; // way under threshold
  assert.strictEqual(ctx.canReproduceAsexual(bot), false);
});

test('canReproduceAsexual: false when on cooldown', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  const bot = ctx.bots[0];
  bot.lifetime = 10000;
  bot.reproductionCooldown = 500;
  assert.strictEqual(ctx.canReproduceAsexual(bot), false);
});

test('canReproduceAsexual: false when not enough lives', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.asexual.parentLifeCost = 0.9;
  const bot = ctx.bots[0];
  bot.lifetime = 10000;
  bot.lives = 1; // 1 - 0.9 = 0.1 < 1 → fail
  assert.strictEqual(ctx.canReproduceAsexual(bot), false);
});

test('canReproduceAsexual: true when all conditions met', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.asexual.parentLifeCost = 0.5;
  const bot = ctx.bots[0];
  bot.lifetime = 10000;
  bot.lives = 4;
  bot.reproductionCooldown = 0;
  assert.strictEqual(ctx.canReproduceAsexual(bot), true);
});

// ---- isMature -----------------------------------------------------

test('isMature: frames metric uses lifetime', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.asexual.maturityMetric = 'frames';
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 500;
  const bot = ctx.bots[0];
  bot.lifetime = 499;
  assert.strictEqual(ctx.isMature(bot), false);
  bot.lifetime = 500;
  assert.strictEqual(ctx.isMature(bot), true);
});

test('isMature: stats metric sums speed+attack+defence+lives', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.asexual.maturityMetric = 'stats';
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 25;
  const bot = ctx.bots[0];
  bot.speed = 5; bot.attack = 5; bot.defence = 5; bot.lives = 10; // total 25
  assert.strictEqual(ctx.isMature(bot), true);
  bot.lives = 5; // total 20
  assert.strictEqual(ctx.isMature(bot), false);
});

test('isMature: kills metric checks killCount', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.asexual.maturityMetric = 'kills';
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 5;
  const bot = ctx.bots[0];
  bot.killCount = 3;
  assert.strictEqual(ctx.isMature(bot), false);
  bot.killCount = 5;
  assert.strictEqual(ctx.isMature(bot), true);
});

// ---- reproduceAsexual ---------------------------------------------

test('reproduceAsexual: creates a new bot in the bots array', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  const parent = ctx.bots[0];
  parent.lifetime = 10000;
  parent.lives = 10;
  const before = ctx.bots.length;
  const offspring = ctx.reproduceAsexual(parent);
  assert.ok(offspring);
  assert.strictEqual(ctx.bots.length, before + 1);
});

test('reproduceAsexual: parent loses a fraction of lives', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.asexual.parentLifeCost = 0.5;
  const parent = ctx.bots[0];
  parent.lifetime = 10000;
  parent.lives = 10;
  ctx.reproduceAsexual(parent);
  assert.strictEqual(parent.lives, 5);
});

test('reproduceAsexual: parent gets reproduction cooldown', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.asexual.cooldown = 900;
  const parent = ctx.bots[0];
  parent.lifetime = 10000;
  parent.lives = 10;
  ctx.reproduceAsexual(parent);
  assert.strictEqual(parent.reproductionCooldown, 900);
});

test('reproduceAsexual: offspring is marked as generation 1 (parent at 0)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  const parent = ctx.bots[0];
  parent.lifetime = 10000;
  parent.lives = 10;
  const offspring = ctx.reproduceAsexual(parent);
  assert.strictEqual(offspring.generation, parent.generation + 1);
});

test('reproduceAsexual: offspring has protection from parent', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.offspring.protection.duration = 300;
  const parent = ctx.bots[0];
  parent.lifetime = 10000;
  parent.lives = 10;
  const offspring = ctx.reproduceAsexual(parent);
  assert.strictEqual(ctx.isProtected(parent, offspring), true);
});

test('reproduceAsexual: returns null when preconditions fail', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  const parent = ctx.bots[0];
  parent.lifetime = 10; // not mature
  const result = ctx.reproduceAsexual(parent);
  assert.strictEqual(result, null);
});

// ---- calculateOffspringStatsAsexual -------------------------------

test('calculateOffspringStatsAsexual: stats near parent with noise', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.statNoise = 0.1;
  const parent = ctx.bots[0];
  parent.speed = 10; parent.attack = 5; parent.defence = 5; parent.lives = 4;
  const stats = ctx.calculateOffspringStatsAsexual(parent);
  // ±10% noise → each stat within 10%
  assert.ok(stats.speed >= 9 && stats.speed <= 11);
  assert.ok(stats.attack >= 4.5 && stats.attack <= 5.5);
  assert.ok(stats.defence >= 4.5 && stats.defence <= 5.5);
  assert.ok(stats.lives >= 3.6 && stats.lives <= 4.4);
});

test('calculateOffspringStatsAsexual: attack can be 0 but speed/defence/lives >= 1', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.statNoise = 0.5;
  const parent = ctx.bots[0];
  parent.speed = 1; parent.attack = 0; parent.defence = 1; parent.lives = 1;
  const stats = ctx.calculateOffspringStatsAsexual(parent);
  assert.ok(stats.speed >= 1);
  assert.ok(stats.attack >= 0);
  assert.ok(stats.defence >= 1);
  assert.ok(stats.lives >= 1);
});

// ---- calculateSpawnPosition ---------------------------------------

test('calculateSpawnPosition: within world bounds', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  const parent = ctx.bots[0];
  parent.x = 50; parent.y = 50;
  for (let i = 0; i < 10; i++) {
    const pos = ctx.calculateSpawnPosition(parent);
    assert.ok(pos.x >= 50 && pos.x <= ctx.WORLD_WIDTH - 50);
    assert.ok(pos.y >= 50 && pos.y <= ctx.WORLD_HEIGHT - 50);
  }
});

test('calculateSpawnPosition: nearParent mode stays within max spawn distance', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.spawnLocation = 'nearParent';
  ctx.lifecycleSettings.reproduction.asexual.spawnDistance = { min: 80, max: 120 };
  const parent = ctx.bots[0];
  parent.x = 1000; parent.y = 1000;
  const pos = ctx.calculateSpawnPosition(parent);
  const dx = pos.x - parent.x;
  const dy = pos.y - parent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  assert.ok(dist >= 80 && dist <= 120, `dist was ${dist}`);
});

// ---- canReproduceSexual -------------------------------------------

test('canReproduceSexual: false when disabled', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.bots[0].lifetime = 10000;
  ctx.bots[1].lifetime = 10000;
  assert.strictEqual(
    ctx.canReproduceSexual(ctx.bots[0], ctx.bots[1]),
    false
  );
});

test('canReproduceSexual: false when on cooldown', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.sexual.compatibilityThreshold = 0;
  ctx.bots[0].lifetime = 10000; ctx.bots[1].lifetime = 10000;
  ctx.bots[0].reproductionCooldown = 500;
  assert.strictEqual(
    ctx.canReproduceSexual(ctx.bots[0], ctx.bots[1]),
    false
  );
});

test('canReproduceSexual: false when compatibility too low', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.sexual.compatibilityThreshold = 0.99;
  ctx.bots[0].lifetime = 10000; ctx.bots[1].lifetime = 10000;
  // Give them very different strategies so similarity is low
  ctx.bots[0].npcBehaviors = { gatherer: true, hunter: false };
  ctx.bots[0].npcWeights = { gatherer: 100, hunter: 0 };
  ctx.bots[1].npcBehaviors = { gatherer: false, hunter: true };
  ctx.bots[1].npcWeights = { gatherer: 0, hunter: 100 };
  assert.strictEqual(
    ctx.canReproduceSexual(ctx.bots[0], ctx.bots[1]),
    false
  );
});

// ---- calculateOffspringStatsSexual --------------------------------

test('calculateOffspringStatsSexual: averages parent stats with noise', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.strategyInheritance.noise = 0;
  const p1 = ctx.bots[0];
  const p2 = ctx.bots[1];
  // Keep parent totals under TOTAL_POINTS * 1.5 (=27) so normalization
  // doesn't kick in — otherwise the scale factor adjusts the results.
  p1.speed = 8; p1.attack = 4; p1.defence = 4; p1.lives = 8;  // total 24
  p2.speed = 4; p2.attack = 8; p2.defence = 8; p2.lives = 4;  // total 24
  // Expected averages: 6, 6, 6, 6 → total 24 < 27, no normalization
  const stats = ctx.calculateOffspringStatsSexual(p1, p2);
  assert.ok(Math.abs(stats.speed - 6) < 0.1);
  assert.ok(Math.abs(stats.attack - 6) < 0.1);
  assert.ok(Math.abs(stats.defence - 6) < 0.1);
  assert.ok(Math.abs(stats.lives - 6) < 0.1);
});

test('calculateOffspringStatsSexual: normalizes runaway totals to 1.5x TOTAL_POINTS', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.strategyInheritance.noise = 0;
  const p1 = ctx.bots[0];
  const p2 = ctx.bots[1];
  // Both parents at extreme stats → average 30, triggers normalization
  p1.speed = 30; p1.attack = 30; p1.defence = 30; p1.lives = 30;
  p2.speed = 30; p2.attack = 30; p2.defence = 30; p2.lives = 30;
  const stats = ctx.calculateOffspringStatsSexual(p1, p2);
  const total = stats.speed + stats.attack + stats.defence + stats.lives;
  // Should be normalized to about 1.5 * TOTAL_POINTS = 27
  assert.ok(total <= 28, `total ${total} should be near 27 after normalization`);
});

// ---- blendHue -----------------------------------------------------

test('blendHue: midpoint between nearby hues', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  // Noise factor is ±15, so the mean of many blends should be near the midpoint.
  const results = [];
  for (let i = 0; i < 200; i++) results.push(ctx.blendHue(0, 120));
  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  assert.ok(mean > 40 && mean < 80, `mean was ${mean}, expected ~60`);
});

test('blendHue: result stays in [0, 360)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  for (let i = 0; i < 100; i++) {
    const h = ctx.blendHue(Math.random() * 360, Math.random() * 360);
    assert.ok(h >= 0 && h < 360, `hue ${h} out of range`);
  }
});

test('blendHue: handles hue wraparound correctly', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  // Hues 350 and 10 should blend near 0, not 180
  const results = [];
  for (let i = 0; i < 100; i++) results.push(ctx.blendHue(350, 10));
  // Most values should be near 0 (or 360), not near 180
  const nearZero = results.filter(h => h < 50 || h > 310).length;
  assert.ok(nearZero > 90, `${nearZero}/100 were near the wraparound`);
});

// ---- updateReproductionCooldowns ----------------------------------

test('updateReproductionCooldowns: decrements all cooldowns', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.bots[0].reproductionCooldown = 100;
  ctx.bots[1].reproductionCooldown = 50;
  ctx.bots[2].reproductionCooldown = 0;
  ctx.updateReproductionCooldowns();
  assert.strictEqual(ctx.bots[0].reproductionCooldown, 99);
  assert.strictEqual(ctx.bots[1].reproductionCooldown, 49);
  assert.strictEqual(ctx.bots[2].reproductionCooldown, 0);
});

// ---- checkAsexualReproduction --------------------------------------

test('checkAsexualReproduction: no-op when disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.asexual.enabled = false;
  ctx.bots[0].lifetime = 10000;
  const before = ctx.bots.length;
  ctx.checkAsexualReproduction();
  assert.strictEqual(ctx.bots.length, before);
});

test('checkAsexualReproduction: mature bot reproduces', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAsexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  const bot = ctx.bots[0];
  bot.lifetime = 10000;
  bot.lives = 10;
  bot.reproductionCooldown = 0;
  ctx.checkAsexualReproduction();
  assert.strictEqual(ctx.bots.length, 2);
});

// ---- updateMatingProgress -----------------------------------------

test('updateMatingProgress: increments when bots are close', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.sexual.proximityDistance = 100;
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.x = 100; a.y = 100;
  b.x = 150; b.y = 100; // 50u apart < 100
  a.matingProgress.clear(); b.matingProgress.clear();
  ctx.updateMatingProgress(a, b);
  assert.strictEqual(a.matingProgress.get(b.index), 1);
  assert.strictEqual(b.matingProgress.get(a.index), 1);
});

test('updateMatingProgress: resets when bots drift apart', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.sexual.proximityDistance = 100;
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.matingProgress.set(b.index, 50);
  b.matingProgress.set(a.index, 50);
  a.x = 0; a.y = 0; b.x = 500; b.y = 500; // far
  ctx.updateMatingProgress(a, b);
  assert.strictEqual(a.matingProgress.get(b.index), undefined);
});

// ---- reproduceSexual ----------------------------------------------

test('reproduceSexual: creates offspring between the two parents', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  const p1 = ctx.bots[0], p2 = ctx.bots[1];
  p1.lifetime = 10000; p2.lifetime = 10000;
  p1.x = 500; p1.y = 500;
  p2.x = 600; p2.y = 600;
  const before = ctx.bots.length;
  const child = ctx.reproduceSexual(p1, p2);
  assert.ok(child);
  assert.strictEqual(ctx.bots.length, before + 1);
  // Spawn position should be near the midpoint
  assert.ok(Math.abs(child.x - 550) <= 30);
  assert.ok(Math.abs(child.y - 550) <= 30);
});

test('reproduceSexual: both parents get cooldown', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.sexual.cooldown = 1200;
  const p1 = ctx.bots[0], p2 = ctx.bots[1];
  p1.lifetime = 10000; p2.lifetime = 10000;
  ctx.reproduceSexual(p1, p2);
  assert.strictEqual(p1.reproductionCooldown, 1200);
  assert.strictEqual(p2.reproductionCooldown, 1200);
});

test('reproduceSexual: offspring tracks both parents', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  const p1 = ctx.bots[0], p2 = ctx.bots[1];
  p1.lifetime = 10000; p2.lifetime = 10000;
  const child = ctx.reproduceSexual(p1, p2);
  assert.strictEqual(child.relationships.parentId, p1.index);
  assert.strictEqual(child.relationships.secondParentId, p2.index);
});

test('reproduceSexual: both parents record mate history', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  const p1 = ctx.bots[0], p2 = ctx.bots[1];
  p1.lifetime = 10000; p2.lifetime = 10000;
  ctx.reproduceSexual(p1, p2);
  assert.strictEqual(p1.relationships.mateHistory.length, 1);
  assert.strictEqual(p1.relationships.mateHistory[0].botIndex, p2.index);
  assert.strictEqual(p2.relationships.mateHistory.length, 1);
  assert.strictEqual(p2.relationships.mateHistory[0].botIndex, p1.index);
});

test('reproduceSexual: offspring gets protection from both parents', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 10;
  ctx.lifecycleSettings.reproduction.offspring.protection.duration = 300;
  const p1 = ctx.bots[0], p2 = ctx.bots[1];
  p1.lifetime = 10000; p2.lifetime = 10000;
  const child = ctx.reproduceSexual(p1, p2);
  assert.strictEqual(ctx.isProtected(p1, child), true);
  assert.strictEqual(ctx.isProtected(p2, child), true);
});

// ---- updateAllMatingProgress --------------------------------------

test('updateAllMatingProgress: no-op when sexual reproduction disabled', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.sexual.enabled = false;
  const a = ctx.bots[0], b = ctx.bots[1];
  a.x = 100; a.y = 100; b.x = 110; b.y = 100;
  a.matingProgress.clear(); b.matingProgress.clear();
  ctx.updateAllMatingProgress();
  assert.strictEqual(a.matingProgress.size, 0);
});

test('updateAllMatingProgress: pairs nearby bots', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.sexual.proximityDistance = 100;
  ctx.bots[0].x = 100; ctx.bots[0].y = 100;
  ctx.bots[1].x = 150; ctx.bots[1].y = 100; // close to bot 0
  ctx.bots[2].x = 1800; ctx.bots[2].y = 1800; // far
  for (const b of ctx.bots) b.matingProgress.clear();
  ctx.updateAllMatingProgress();
  assert.strictEqual(ctx.bots[0].matingProgress.get(ctx.bots[1].index), 1);
  assert.strictEqual(ctx.bots[0].matingProgress.get(ctx.bots[2].index), undefined);
});

test('updateAllMatingProgress: skips pairs in combat cooldown', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableSexual(ctx);
  ctx.lifecycleSettings.reproduction.sexual.proximityDistance = 100;
  const a = ctx.bots[0], b = ctx.bots[1];
  a.x = 100; a.y = 100; b.x = 150; b.y = 100;
  a.combatCooldown = 30;
  a.matingProgress.clear(); b.matingProgress.clear();
  ctx.updateAllMatingProgress();
  assert.strictEqual(a.matingProgress.size, 0);
});

// ---- inheritStrategy ----------------------------------------------

test('inheritStrategy: no-op when neither parent has a strategy', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const p1 = ctx.bots[0];
  const p2 = ctx.bots[1];
  const child = ctx.bots[2];
  p1.isPlayer = false; p2.isPlayer = false;
  p1.npcStrategy = null; p2.npcStrategy = null;
  child.npcBehaviors = null;
  ctx.inheritStrategy(child, p1, p2);
  assert.strictEqual(child.npcBehaviors, null);
});

test('inheritStrategy: blend method averages parent weights', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.strategyInheritance.method = 'blend';
  ctx.lifecycleSettings.reproduction.strategyInheritance.noise = 0;
  ctx.lifecycleSettings.reproduction.strategyInheritance.mutationChance = 0;
  const p1 = ctx.bots[0];
  const p2 = ctx.bots[1];
  const child = ctx.bots[2];
  p1.isPlayer = false; p2.isPlayer = false;
  p1.npcStrategy = 'custom';
  p1.npcWeights = { gatherer: 100, clusterFarmer: 0, hunter: 0,
                    opportunist: 0, survivor: 0, avenger: 0 };
  p1.npcBehaviors = { gatherer: true, clusterFarmer: false, hunter: false,
                      opportunist: false, survivor: false, avenger: false };
  p2.npcStrategy = 'custom';
  p2.npcWeights = { gatherer: 0, clusterFarmer: 0, hunter: 100,
                    opportunist: 0, survivor: 0, avenger: 0 };
  p2.npcBehaviors = { gatherer: false, clusterFarmer: false, hunter: true,
                      opportunist: false, survivor: false, avenger: false };

  ctx.inheritStrategy(child, p1, p2);
  // Each of gatherer/hunter averaged to 50
  assert.strictEqual(child.npcWeights.gatherer, 50);
  assert.strictEqual(child.npcWeights.hunter, 50);
  assert.strictEqual(child.npcWeights.clusterFarmer, 0);
});

test('inheritStrategy: randomParent method picks one parent exactly', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.strategyInheritance.method = 'randomParent';
  ctx.lifecycleSettings.reproduction.strategyInheritance.mutationChance = 0;
  const p1 = ctx.bots[0];
  const p2 = ctx.bots[1];
  const child = ctx.bots[2];
  p1.isPlayer = false; p2.isPlayer = false;
  p1.npcStrategy = 'gatherer';
  p1.npcBehaviors = { gatherer: true };
  p1.npcWeights = { gatherer: 100 };
  p2.npcStrategy = 'hunter';
  p2.npcBehaviors = { hunter: true };
  p2.npcWeights = { hunter: 100 };
  ctx.inheritStrategy(child, p1, p2);
  // Weights should match exactly one parent (100 total = 100 from one parent)
  const childSum = (child.npcWeights.gatherer || 0) + (child.npcWeights.hunter || 0);
  assert.strictEqual(childSum, 100);
});

test('inheritStrategy: dominant method picks parent with higher stats', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.strategyInheritance.method = 'dominant';
  ctx.lifecycleSettings.reproduction.strategyInheritance.mutationChance = 0;
  const p1 = ctx.bots[0];
  const p2 = ctx.bots[1];
  const child = ctx.bots[2];
  p1.isPlayer = false; p2.isPlayer = false;
  p1.speed = 1; p1.attack = 1; p1.defence = 1; p1.lives = 1; // total 4
  p2.speed = 10; p2.attack = 10; p2.defence = 10; p2.lives = 10; // total 40
  p1.npcStrategy = 'gatherer';
  p1.npcBehaviors = { gatherer: true }; p1.npcWeights = { gatherer: 100 };
  p2.npcStrategy = 'hunter';
  p2.npcBehaviors = { hunter: true }; p2.npcWeights = { hunter: 100 };
  ctx.inheritStrategy(child, p1, p2);
  // Child should inherit from p2 (stronger)
  assert.strictEqual(child.npcWeights.hunter, 100);
});
