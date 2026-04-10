// Unit tests for packs.js — strategy similarity, formation, joining,
// leaving, disbanding, leadership, territory, cannibalism.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, assertApprox } = require('../helpers');

function enablePacks(ctx) {
  ctx.lifecycleSettings.packs.enabled = true;
}

// Helper: give a bot an NPC strategy with known weights
function setStrategy(bot, weights) {
  bot.npcStrategy = 'custom';
  bot.npcBehaviors = {};
  bot.npcWeights = {};
  for (const key of ['gatherer', 'clusterFarmer', 'hunter', 'opportunist', 'survivor', 'avenger']) {
    bot.npcWeights[key] = weights[key] || 0;
    bot.npcBehaviors[key] = (weights[key] || 0) > 0;
  }
}

// ---- calculateStrategySimilarity ---------------------------------

test('strategySimilarity: identical weights → 1.0', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  setStrategy(ctx.bots[0], { gatherer: 50, hunter: 50 });
  setStrategy(ctx.bots[1], { gatherer: 50, hunter: 50 });
  ctx.bots[0].isPlayer = false;
  ctx.bots[1].isPlayer = false;
  assertApprox(ctx.calculateStrategySimilarity(ctx.bots[0], ctx.bots[1]), 1.0, 1e-9);
});

test('strategySimilarity: orthogonal strategies → 0', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  setStrategy(ctx.bots[0], { gatherer: 100 });
  setStrategy(ctx.bots[1], { hunter: 100 });
  ctx.bots[0].isPlayer = false;
  ctx.bots[1].isPlayer = false;
  assertApprox(ctx.calculateStrategySimilarity(ctx.bots[0], ctx.bots[1]), 0, 1e-9);
});

test('strategySimilarity: 0 when a bot has no strategy', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.bots[0].isPlayer = false;
  ctx.bots[1].isPlayer = false;
  ctx.bots[0].npcWeights = null;
  assert.strictEqual(
    ctx.calculateStrategySimilarity(ctx.bots[0], ctx.bots[1]),
    0
  );
});

// ---- createPack --------------------------------------------------

test('createPack: creates a pack with the given members', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  assert.ok(pack);
  assert.ok(pack.id !== undefined);
  assert.strictEqual(pack.members.size, 2);
  assert.ok(pack.members.has(ctx.bots[0].index));
  assert.ok(pack.members.has(ctx.bots[1].index));
});

test('createPack: sets packId on all members', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  assert.strictEqual(ctx.bots[0].relationships.packId, pack.id);
  assert.strictEqual(ctx.bots[1].relationships.packId, pack.id);
});

test('createPack: records founderId and formedAtFrame', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.frameCount = 500;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  assert.strictEqual(pack.founderId, ctx.bots[0].index);
  assert.strictEqual(pack.formedAtFrame, 500);
});

test('createPack: pack stored in global packs Map', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  assert.strictEqual(ctx.packs.get(pack.id), pack);
});

// ---- joinPack ----------------------------------------------------

test('joinPack: adds bot to pack and sets packId', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  const result = ctx.joinPack(ctx.bots[2], pack);
  assert.strictEqual(result, true);
  assert.strictEqual(pack.members.size, 3);
  assert.strictEqual(ctx.bots[2].relationships.packId, pack.id);
});

test('joinPack: rejects when at max size with reject overflow', () => {
  const ctx = createTestContext({ botCount: 6, dotCount: 0 });
  ctx.lifecycleSettings.packs.size.max = 2;
  ctx.lifecycleSettings.packs.size.overflowBehavior = 'reject';
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  const result = ctx.joinPack(ctx.bots[2], pack);
  assert.strictEqual(result, false);
  assert.strictEqual(pack.members.size, 2);
});

test('joinPack: kicks weakest when at max with kick overflow', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  ctx.lifecycleSettings.packs.size.max = 2;
  ctx.lifecycleSettings.packs.size.overflowBehavior = 'kick';
  // Make bot 1 the weakest
  ctx.bots[0].speed = 10; ctx.bots[0].attack = 10; ctx.bots[0].defence = 10; ctx.bots[0].lives = 10;
  ctx.bots[1].speed = 1; ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.joinPack(ctx.bots[2], pack);
  // Weakest (bot 1) should have been kicked; but pack disbands at <2 members
  // so this results in only bot 0 + bot 2 being tracked. Since leaving
  // at size 2→1 triggers disband, the outcome is subtle. Just verify
  // bot 1 no longer has this pack id.
  assert.strictEqual(
    ctx.bots[1].relationships.packId,
    null,
    'weakest should have been kicked from pack'
  );
});

// ---- leavePack ---------------------------------------------------

test('leavePack: removes bot from pack and clears packId', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2]]);
  ctx.leavePack(ctx.bots[2], 'test');
  assert.strictEqual(pack.members.size, 2);
  assert.strictEqual(ctx.bots[2].relationships.packId, null);
});

test('leavePack: disbands when too few members remain', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  const packId = pack.id;
  ctx.leavePack(ctx.bots[0], 'test');
  // Pack should be disbanded (< 2 members)
  assert.strictEqual(ctx.packs.get(packId), undefined);
});

test('leavePack: no-op for bot not in a pack', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.relationships.packId = null;
  // Should not throw
  ctx.leavePack(bot, 'test');
  assert.strictEqual(bot.relationships.packId, null);
});

// ---- disbandPack --------------------------------------------------

test('disbandPack: clears packId on all members', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2]]);
  ctx.disbandPack(pack, 'test');
  for (const bot of ctx.bots) {
    assert.strictEqual(bot.relationships.packId, null);
  }
});

test('disbandPack: removes pack from global map', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  const id = pack.id;
  ctx.disbandPack(pack, 'test');
  assert.strictEqual(ctx.packs.get(id), undefined);
});

// ---- selectPackLeader --------------------------------------------

test('selectPackLeader: strongest selection picks highest total stats', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.packs.leadership.selection = 'strongest';
  ctx.bots[0].speed = 1; ctx.bots[0].attack = 1; ctx.bots[0].defence = 1; ctx.bots[0].lives = 1;
  ctx.bots[1].speed = 10; ctx.bots[1].attack = 10; ctx.bots[1].defence = 10; ctx.bots[1].lives = 10;
  ctx.bots[2].speed = 5; ctx.bots[2].attack = 5; ctx.bots[2].defence = 5; ctx.bots[2].lives = 5;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2]]);
  const leaderId = ctx.selectPackLeader(pack);
  assert.strictEqual(leaderId, ctx.bots[1].index);
});

test('selectPackLeader: oldest selection picks highest age', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.packs.leadership.selection = 'oldest';
  ctx.bots[0].age = 100;
  ctx.bots[1].age = 500;
  ctx.bots[2].age = 200;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2]]);
  const leaderId = ctx.selectPackLeader(pack);
  assert.strictEqual(leaderId, ctx.bots[1].index);
});

test('selectPackLeader: founder selection picks the founder', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.packs.leadership.selection = 'founder';
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2]]);
  const leaderId = ctx.selectPackLeader(pack);
  assert.strictEqual(leaderId, ctx.bots[0].index, 'first member is founder');
});

// ---- findWeakestPackMember ---------------------------------------

test('findWeakestPackMember: returns member with lowest total stats', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.bots[0].speed = 10; ctx.bots[0].attack = 10; ctx.bots[0].defence = 10; ctx.bots[0].lives = 10;
  ctx.bots[1].speed = 1; ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  ctx.bots[2].speed = 5; ctx.bots[2].attack = 5; ctx.bots[2].defence = 5; ctx.bots[2].lives = 5;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2]]);
  const weakest = ctx.findWeakestPackMember(pack);
  assert.strictEqual(weakest, ctx.bots[1]);
});

// ---- getPackMembers / arePackMates / getBotPack ------------------

test('getPackMembers: returns all bot instances in pack', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2]]);
  const members = ctx.getPackMembers(pack);
  assert.strictEqual(members.length, 3);
});

test('arePackMates: true for same-pack bots', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  assert.strictEqual(ctx.arePackMates(ctx.bots[0], ctx.bots[1]), true);
});

test('arePackMates: false for different packs', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.createPack([ctx.bots[2], ctx.bots[3]]);
  assert.strictEqual(ctx.arePackMates(ctx.bots[0], ctx.bots[2]), false);
});

test('arePackMates: false when neither is in a pack', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  assert.strictEqual(ctx.arePackMates(ctx.bots[0], ctx.bots[1]), false);
});

test('getBotPack: returns the pack object', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  assert.strictEqual(ctx.getBotPack(ctx.bots[0]), pack);
});

test('getBotPack: returns null for bot not in pack', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  assert.strictEqual(ctx.getBotPack(ctx.bots[0]), null);
});

// ---- Territory ---------------------------------------------------

test('updatePackTerritory: creates territory at average of member positions', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.packs.territory.enabled = true;
  ctx.lifecycleSettings.packs.territory.positioning.preferDotClusters = false;
  ctx.lifecycleSettings.packs.territory.positioning.avoidEnemyClusters = false;
  ctx.bots[0].x = 100; ctx.bots[0].y = 100;
  ctx.bots[1].x = 300; ctx.bots[1].y = 300;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.updatePackTerritory(pack);
  assert.ok(pack.territory);
  assertApprox(pack.territory.center.x, 200, 1e-9);
  assertApprox(pack.territory.center.y, 200, 1e-9);
});

test('isInTerritory: true when point inside radius', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.packs.territory.enabled = true;
  const pack = { territory: { center: { x: 500, y: 500 }, radius: 100 } };
  assert.strictEqual(ctx.isInTerritory(500, 500, pack), true);
  assert.strictEqual(ctx.isInTerritory(550, 500, pack), true);
});

test('isInTerritory: false when point outside radius', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const pack = { territory: { center: { x: 500, y: 500 }, radius: 100 } };
  assert.strictEqual(ctx.isInTerritory(800, 500, pack), false);
});

test('isInTerritory: false when pack has no territory', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const pack = { territory: null };
  assert.strictEqual(ctx.isInTerritory(500, 500, pack), false);
});

test('isDefendingTerritory: false when bot has no pack', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  assert.strictEqual(ctx.isDefendingTerritory(ctx.bots[0]), false);
});

test('isDefendingTerritory: always mode returns true', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.packs.territory.enabled = true;
  ctx.lifecycleSettings.packs.territory.defenseMode = 'always';
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.updatePackTerritory(pack);
  assert.strictEqual(ctx.isDefendingTerritory(ctx.bots[0]), true);
});

// ---- Cannibalism -------------------------------------------------

test('canCannibalize: false when cannibalism disabled', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.packs.cannibalism.enabled = false;
  ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  assert.strictEqual(ctx.canCannibalize(ctx.bots[0], ctx.bots[1]), false);
});

test('canCannibalize: starving trigger requires isStarving=true', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.packs.cannibalism.enabled = true;
  ctx.lifecycleSettings.packs.cannibalism.trigger = 'starving';
  ctx.lifecycleSettings.packs.cannibalism.packOnly = true;
  ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.bots[0].isStarving = false;
  assert.strictEqual(ctx.canCannibalize(ctx.bots[0], ctx.bots[1]), false);
  ctx.bots[0].isStarving = true;
  assert.strictEqual(ctx.canCannibalize(ctx.bots[0], ctx.bots[1]), true);
});

test('canCannibalize: lowLives trigger uses threshold', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.packs.cannibalism.enabled = true;
  ctx.lifecycleSettings.packs.cannibalism.trigger = 'lowLives';
  ctx.lifecycleSettings.packs.cannibalism.lowLivesThreshold = 2;
  ctx.lifecycleSettings.packs.cannibalism.packOnly = true;
  ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.bots[0].lives = 5;
  assert.strictEqual(ctx.canCannibalize(ctx.bots[0], ctx.bots[1]), false);
  ctx.bots[0].lives = 1;
  assert.strictEqual(ctx.canCannibalize(ctx.bots[0], ctx.bots[1]), true);
});

test('canCannibalize: always trigger always allowed', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.packs.cannibalism.enabled = true;
  ctx.lifecycleSettings.packs.cannibalism.trigger = 'always';
  ctx.lifecycleSettings.packs.cannibalism.packOnly = true;
  ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  assert.strictEqual(ctx.canCannibalize(ctx.bots[0], ctx.bots[1]), true);
});

test('canCannibalize: packOnly=true blocks non-pack target', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.packs.cannibalism.enabled = true;
  ctx.lifecycleSettings.packs.cannibalism.trigger = 'always';
  ctx.lifecycleSettings.packs.cannibalism.packOnly = true;
  ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  // bot[2] is not in the pack
  assert.strictEqual(ctx.canCannibalize(ctx.bots[0], ctx.bots[2]), false);
});

test('canCannibalize: packOnly=false allows non-pack targets', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.packs.cannibalism.enabled = true;
  ctx.lifecycleSettings.packs.cannibalism.trigger = 'always';
  ctx.lifecycleSettings.packs.cannibalism.packOnly = false;
  assert.strictEqual(ctx.canCannibalize(ctx.bots[0], ctx.bots[2]), true);
});
