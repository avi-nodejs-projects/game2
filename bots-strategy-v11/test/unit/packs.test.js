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

// ---- selectCannibalismTarget --------------------------------------

test('selectCannibalismTarget: returns null for bot not in a pack', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enablePacks(ctx);
  ctx.lifecycleSettings.packs.cannibalism.enabled = true;
  assert.strictEqual(ctx.selectCannibalismTarget(ctx.bots[0]), null);
});

test('selectCannibalismTarget: picks weakest pack member by default', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  enablePacks(ctx);
  ctx.lifecycleSettings.packs.cannibalism.enabled = true;
  ctx.lifecycleSettings.packs.cannibalism.targetPreference = 'weakest';
  // Make bot[2] the weakest
  ctx.bots[0].speed = 10; ctx.bots[0].attack = 10; ctx.bots[0].defence = 10; ctx.bots[0].lives = 10;
  ctx.bots[1].speed = 10; ctx.bots[1].attack = 10; ctx.bots[1].defence = 10; ctx.bots[1].lives = 10;
  ctx.bots[2].speed = 1;  ctx.bots[2].attack = 1;  ctx.bots[2].defence = 1;  ctx.bots[2].lives = 1;
  ctx.bots[3].speed = 5;  ctx.bots[3].attack = 5;  ctx.bots[3].defence = 5;  ctx.bots[3].lives = 5;
  ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2], ctx.bots[3]]);
  // Attacker = bot[0], should not pick self
  const target = ctx.selectCannibalismTarget(ctx.bots[0]);
  assert.strictEqual(target, ctx.bots[2]);
});

// ---- getTerritoryOwner --------------------------------------------

test('getTerritoryOwner: returns null when no pack territories exist', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  assert.strictEqual(ctx.getTerritoryOwner(500, 500), null);
});

test('getTerritoryOwner: returns pack whose territory contains the point', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enablePacks(ctx);
  ctx.lifecycleSettings.packs.territory.enabled = true;
  ctx.lifecycleSettings.packs.territory.positioning.preferDotClusters = false;
  ctx.lifecycleSettings.packs.territory.positioning.avoidEnemyClusters = false;
  ctx.bots[0].x = 500; ctx.bots[0].y = 500;
  ctx.bots[1].x = 600; ctx.bots[1].y = 600;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.updatePackTerritory(pack);
  // Territory center = (550, 550), radius = 300
  assert.strictEqual(ctx.getTerritoryOwner(600, 600), pack);
  assert.strictEqual(ctx.getTerritoryOwner(2000, 2000), null);
});

// ---- evaluatePackFormation / handlePackFormation ------------------

test('evaluatePackFormation: no-op when packs disabled', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.packs.enabled = false;
  const before = ctx.packs.size;
  ctx.evaluatePackFormation();
  assert.strictEqual(ctx.packs.size, before);
});

test('handlePackFormation: two unpaired bots form a new pack', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enablePacks(ctx);
  const before = ctx.packs.size;
  ctx.handlePackFormation(ctx.bots[0], ctx.bots[1]);
  assert.strictEqual(ctx.packs.size, before + 1);
  assert.notStrictEqual(ctx.bots[0].relationships.packId, null);
  assert.strictEqual(
    ctx.bots[0].relationships.packId,
    ctx.bots[1].relationships.packId
  );
});

test('handlePackFormation: bot joins existing pack of other', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  enablePacks(ctx);
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.handlePackFormation(ctx.bots[0], ctx.bots[2]);
  assert.strictEqual(ctx.bots[2].relationships.packId, pack.id);
  assert.strictEqual(pack.members.size, 3);
});

test('handlePackFormation: two bots from different packs do not merge', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  enablePacks(ctx);
  const packA = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  const packB = ctx.createPack([ctx.bots[2], ctx.bots[3]]);
  ctx.handlePackFormation(ctx.bots[0], ctx.bots[2]);
  // Both packs still distinct
  assert.notStrictEqual(
    ctx.bots[0].relationships.packId,
    ctx.bots[2].relationships.packId
  );
});

test('evaluatePackFormation: bots close together with similar strategy form a pack', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enablePacks(ctx);
  ctx.lifecycleSettings.packs.formation.proximityDistance = 200;
  ctx.lifecycleSettings.packs.formation.proximityDuration = 60;
  ctx.lifecycleSettings.packs.formation.similarityThreshold = 0.5;

  // Give both bots identical NPC strategies so similarity = 1
  const sharedWeights = { gatherer: 50, clusterFarmer: 50, hunter: 0,
                          opportunist: 0, survivor: 0, avenger: 0 };
  for (let i = 0; i < 2; i++) {
    ctx.bots[i].isPlayer = false;
    ctx.bots[i].npcStrategy = 'custom';
    ctx.bots[i].npcBehaviors = { ...sharedWeights };
    for (const k of Object.keys(sharedWeights)) {
      ctx.bots[i].npcBehaviors[k] = sharedWeights[k] > 0;
    }
    ctx.bots[i].npcWeights = { ...sharedWeights };
  }

  ctx.bots[0].x = 100; ctx.bots[0].y = 100;
  ctx.bots[1].x = 150; ctx.bots[1].y = 100; // 50u apart, well within 200

  // evaluatePackFormation runs once per 60 game frames; each call
  // increments proximity by 60. Duration 60 means 1 call is enough.
  ctx.evaluatePackFormation();
  assert.strictEqual(ctx.packs.size, 1, 'one pack should have formed');
});

// ---- updatePacks --------------------------------------------------

test('updatePacks: no-op when packs disabled', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.lifecycleSettings.packs.enabled = false;
  ctx.updatePacks();
  // Still exists — updatePacks returned early
  assert.strictEqual(ctx.packs.get(pack.id), pack);
});

test('updatePacks: disbands on starvation when threshold hit', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enablePacks(ctx);
  ctx.lifecycleSettings.packs.bonds.disbandOnStarvation = true;
  ctx.lifecycleSettings.packs.bonds.starvationDisbandThreshold = 0.5;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1]]);
  ctx.bots[0].isStarving = true;
  ctx.bots[1].isStarving = true; // 100% starving
  ctx.updatePacks();
  assert.strictEqual(ctx.packs.get(pack.id), undefined);
});

test('updatePacks: keeps pack alive below starvation threshold', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  enablePacks(ctx);
  ctx.lifecycleSettings.packs.bonds.disbandOnStarvation = true;
  ctx.lifecycleSettings.packs.bonds.starvationDisbandThreshold = 0.75;
  const pack = ctx.createPack([ctx.bots[0], ctx.bots[1], ctx.bots[2], ctx.bots[3]]);
  ctx.bots[0].isStarving = true;
  ctx.bots[1].isStarving = true;
  // 2 of 4 = 50% < 75%
  ctx.updatePacks();
  assert.strictEqual(ctx.packs.get(pack.id), pack);
});
