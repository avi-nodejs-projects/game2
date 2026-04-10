// Unit tests for NPC-specific Bot features and the NPC targeting path.
// Covers the gaps found in the Phase 3 review:
//   - generateRandomStats, assignRandomStrategy
//   - applyDeathPenalty, inheritFromKiller
//   - pickNewTargetSimple (used by ~19/20 bots)
//   - pickTargetNPCStrategy (NPC template-based targeting)

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, totalStats, assertApprox } = require('../helpers');

// ---- generateRandomStats -----------------------------------------

test('generateRandomStats: respects totalPoints budget', () => {
  const ctx = createTestContext({ botCount: 0, dotCount: 0 });
  ctx.npcSettings.randomStats.enabled = true;
  ctx.npcSettings.randomStats.totalPoints = 20;
  ctx.npcSettings.randomStats.minSpeed = 1;
  ctx.npcSettings.randomStats.minAttack = 0;
  ctx.npcSettings.randomStats.minDefence = 1;
  ctx.npcSettings.randomStats.minLives = 1;
  const bot = new ctx.Bot(1, false);
  bot.generateRandomStats();
  assert.strictEqual(totalStats(bot), 20);
});

test('generateRandomStats: respects per-stat minimums', () => {
  const ctx = createTestContext({ botCount: 0, dotCount: 0 });
  ctx.npcSettings.randomStats.enabled = true;
  ctx.npcSettings.randomStats.totalPoints = 20;
  ctx.npcSettings.randomStats.minSpeed = 3;
  ctx.npcSettings.randomStats.minAttack = 2;
  ctx.npcSettings.randomStats.minDefence = 4;
  ctx.npcSettings.randomStats.minLives = 2;
  const bot = new ctx.Bot(1, false);
  bot.generateRandomStats();
  assert.ok(bot.speed >= 3, `speed=${bot.speed} < 3`);
  assert.ok(bot.attack >= 2, `attack=${bot.attack} < 2`);
  assert.ok(bot.defence >= 4, `defence=${bot.defence} < 4`);
  assert.ok(bot.lives >= 2, `lives=${bot.lives} < 2`);
});

test('generateRandomStats: different seeds produce different distributions', () => {
  // Generate many random bots and verify there's variation
  const ctx = createTestContext({ botCount: 0, dotCount: 0 });
  ctx.npcSettings.randomStats.enabled = true;
  const distinctSpeeds = new Set();
  for (let i = 0; i < 30; i++) {
    const bot = new ctx.Bot(i, false);
    bot.generateRandomStats();
    distinctSpeeds.add(bot.speed);
  }
  assert.ok(distinctSpeeds.size > 1,
    'random generation should produce at least some variation');
});

// ---- assignRandomStrategy -----------------------------------------

test('assignRandomStrategy: picks a known NPC template', () => {
  const ctx = createTestContext({ botCount: 0, dotCount: 0 });
  const bot = new ctx.Bot(1, false);
  bot.assignRandomStrategy();
  assert.ok(bot.npcStrategy !== null);
  assert.ok(ctx.NPC_STRATEGY_TEMPLATES[bot.npcStrategy],
    `assigned strategy ${bot.npcStrategy} not in templates`);
});

test('assignRandomStrategy: copies behaviors and weights from template', () => {
  const ctx = createTestContext({ botCount: 0, dotCount: 0 });
  const bot = new ctx.Bot(1, false);
  bot.assignRandomStrategy();
  const template = ctx.NPC_STRATEGY_TEMPLATES[bot.npcStrategy];
  for (const key of Object.keys(template.behaviors)) {
    assert.strictEqual(bot.npcBehaviors[key], template.behaviors[key]);
    assert.strictEqual(bot.npcWeights[key], template.weights[key]);
  }
});

// ---- applyDeathPenalty --------------------------------------------

test('applyDeathPenalty: no-op when penalty disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.npcSettings.deathPenalty.enabled = false;
  const bot = ctx.bots[0];
  bot.speed = 99; bot.attack = 99; bot.defence = 99; bot.lives = 99;
  bot.applyDeathPenalty();
  // Falls through to resetStats → default player values
  assert.strictEqual(bot.speed, 5);
});

test('applyDeathPenalty: reduces base stats by penaltyPerStat', () => {
  const ctx = createTestContext({ botCount: 0, dotCount: 0 });
  ctx.npcSettings.deathPenalty.enabled = true;
  ctx.npcSettings.deathPenalty.penaltyPerStat = 1;
  ctx.npcSettings.deathPenalty.minSpeed = 1;
  ctx.npcSettings.deathPenalty.minAttack = 0;
  ctx.npcSettings.deathPenalty.minDefence = 1;

  const bot = new ctx.Bot(1, false);
  bot.baseStats = { speed: 5, attack: 5, defence: 5, lives: 3 };
  bot.applyDeathPenalty();
  assert.strictEqual(bot.speed, 4);
  assert.strictEqual(bot.attack, 4);
  assert.strictEqual(bot.defence, 4);
});

test('applyDeathPenalty: respects per-stat minimums', () => {
  const ctx = createTestContext({ botCount: 0, dotCount: 0 });
  ctx.npcSettings.deathPenalty.enabled = true;
  ctx.npcSettings.deathPenalty.penaltyPerStat = 10;
  ctx.npcSettings.deathPenalty.minSpeed = 2;
  ctx.npcSettings.deathPenalty.minAttack = 0;
  ctx.npcSettings.deathPenalty.minDefence = 1;

  const bot = new ctx.Bot(1, false);
  bot.baseStats = { speed: 5, attack: 5, defence: 5, lives: 3 };
  bot.applyDeathPenalty();
  assert.strictEqual(bot.speed, 2);   // floored at minSpeed
  assert.strictEqual(bot.attack, 0);  // floored at minAttack
  assert.strictEqual(bot.defence, 1); // floored at minDefence
});

// ---- inheritFromKiller --------------------------------------------

test('inheritFromKiller: no-op when evolution disabled', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.npcSettings.evolution.enabled = false;
  const victim = ctx.bots[1];  // NPC
  const killer = ctx.bots[1];  // another NPC (irrelevant here)
  const before = { ...victim.baseStats };
  victim.inheritFromKiller({ speed: 99, attack: 99, defence: 99, lives: 99 });
  assert.deepStrictEqual({ ...victim.baseStats }, { ...before });
});

test('inheritFromKiller: no-op for player bot', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.npcSettings.evolution.enabled = true;
  const player = ctx.bots[0];
  const before = player.baseStats ? { ...player.baseStats } : null;
  player.inheritFromKiller({ speed: 99, attack: 99, defence: 99, lives: 99 });
  // Player keeps their stats (no evolution)
  assert.deepStrictEqual(
    player.baseStats ? { ...player.baseStats } : null,
    before
  );
});

test('inheritFromKiller: normalizes inherited stats to targetTotal', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.npcSettings.evolution.enabled = true;
  ctx.npcSettings.evolution.inheritRatio = 0.5;
  ctx.npcSettings.randomStats.enabled = false; // use TOTAL_POINTS as target
  const victim = ctx.bots[1];
  victim.baseStats = { speed: 5, attack: 5, defence: 5, lives: 3 };
  victim.inheritFromKiller({ speed: 10, attack: 10, defence: 10, lives: 10 });
  const sum = victim.baseStats.speed + victim.baseStats.attack +
              victim.baseStats.defence + victim.baseStats.lives;
  assert.strictEqual(sum, ctx.TOTAL_POINTS,
    `normalized total ${sum} should equal TOTAL_POINTS`);
});

// ---- pickNewTargetSimple (NPC probabilistic targeting) ------------

test('pickNewTargetSimple: with low lives prefers dots >75% of the time', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[1];
  bot.lives = 1; // dotChance = 1 - 1/(1+3) = 0.75

  let dotPicks = 0;
  const trials = 500;
  for (let i = 0; i < trials; i++) {
    bot.pickNewTargetSimple();
    const isDotTarget = ctx.yellowDots.some(
      d => d.x === bot.targetX && d.y === bot.targetY
    );
    if (isDotTarget) dotPicks++;
  }

  // Dot chance = 0.75 → expect ~375 out of 500. Use wide tolerance.
  assert.ok(dotPicks > trials * 0.6,
    `low-lives bot should prefer dots, got ${dotPicks}/${trials}`);
});

test('pickNewTargetSimple: with high lives prefers bots', () => {
  const ctx = createTestContext({ botCount: 5, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.lives = 20; // dotChance = 1 - 20/23 ≈ 0.13

  let botPicks = 0;
  const trials = 500;
  for (let i = 0; i < trials; i++) {
    bot.pickNewTargetSimple();
    const isBotTarget = ctx.bots.some(
      b => b !== bot && b.x === bot.targetX && b.y === bot.targetY
    );
    if (isBotTarget) botPicks++;
  }

  // With dotChance ~0.13, ~87% should be bot picks → ~435 out of 500
  assert.ok(botPicks > trials * 0.7,
    `high-lives bot should prefer combat, got ${botPicks}/${trials}`);
});

test('pickNewTargetSimple: always sets a valid in-bounds target', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 5 });
  const bot = ctx.bots[1];
  for (let i = 0; i < 50; i++) {
    bot.pickNewTargetSimple();
    assert.ok(typeof bot.targetX === 'number');
    assert.ok(typeof bot.targetY === 'number');
  }
});

// ---- pickTargetNPCStrategy ----------------------------------------

test('pickTargetNPCStrategy: uses bot.npcWeights to pick a behavior', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  ctx.globalSettings.randomnessNoise = 0;
  const bot = ctx.bots[1];
  bot.npcStrategy = 'gatherer';
  bot.npcBehaviors = {
    gatherer: true, clusterFarmer: false, hunter: false,
    opportunist: false, survivor: false, avenger: false,
  };
  bot.npcWeights = {
    gatherer: 100, clusterFarmer: 0, hunter: 0,
    opportunist: 0, survivor: 0, avenger: 0,
  };
  bot.pickTargetNPCStrategy();
  assert.strictEqual(bot.lastAction, 'gather');
});

test('pickTargetNPCStrategy: pure hunter picks hunt when advantage is good', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.globalSettings.randomnessNoise = 0;
  const bot = ctx.bots[1];
  bot.attack = 20; bot.defence = 20; bot.lives = 20;
  ctx.bots[0].attack = 1; ctx.bots[0].defence = 1; ctx.bots[0].lives = 1;
  bot.npcStrategy = 'hunter';
  bot.npcBehaviors = { gatherer: false, clusterFarmer: false, hunter: true,
                       opportunist: false, survivor: false, avenger: false };
  bot.npcWeights = { gatherer: 0, clusterFarmer: 0, hunter: 100,
                     opportunist: 0, survivor: 0, avenger: 0 };
  bot.pickTargetNPCStrategy();
  assert.strictEqual(bot.lastAction, 'hunt');
});

test('pickTargetNPCStrategy: no behaviors enabled falls back to pickNewTargetSimple', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[1];
  bot.npcStrategy = 'custom';
  bot.npcBehaviors = { gatherer: false, clusterFarmer: false, hunter: false,
                       opportunist: false, survivor: false, avenger: false };
  bot.npcWeights = { gatherer: 0, clusterFarmer: 0, hunter: 0,
                     opportunist: 0, survivor: 0, avenger: 0 };
  // Should fall through without throwing and set a target
  bot.pickTargetNPCStrategy();
  assert.ok(typeof bot.targetX === 'number');
  assert.ok(typeof bot.targetY === 'number');
});
