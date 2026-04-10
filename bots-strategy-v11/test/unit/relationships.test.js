// Unit tests for relationships.js — parent/child tracking,
// protection system, generational relationships.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

// ---- setParent ----------------------------------------------------

test('setParent: assigns parentId and increments generation', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const parent = ctx.bots[0];
  const child = ctx.bots[1];
  parent.generation = 5;
  ctx.setParent(child, parent);
  assert.strictEqual(child.relationships.parentId, parent.index);
  assert.strictEqual(child.generation, 6);
});

test('setParent: adds child to parent.childIds', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const parent = ctx.bots[0];
  const child = ctx.bots[1];
  ctx.setParent(child, parent);
  assert.ok(parent.relationships.childIds.includes(child.index));
});

test('setParent: increments parent.offspringCount', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const parent = ctx.bots[0];
  parent.offspringCount = 3;
  ctx.setParent(ctx.bots[1], parent);
  assert.strictEqual(parent.offspringCount, 4);
});

test('setParent: player offspring get isPlayerOffspring=true', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const player = ctx.bots[0]; // isPlayer true by default
  const child = ctx.bots[1];
  ctx.setParent(child, player);
  assert.strictEqual(child.isPlayerOffspring, true);
  assert.strictEqual(child.playerLineage, 1);
});

test('setParent: playerLineage grows across generations', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const player = ctx.bots[0];
  const gen1 = ctx.bots[1];
  const gen2 = ctx.bots[2];
  ctx.setParent(gen1, player);
  ctx.setParent(gen2, gen1);
  assert.strictEqual(gen1.playerLineage, 1);
  assert.strictEqual(gen2.playerLineage, 2);
  assert.strictEqual(gen2.isPlayerOffspring, true);
});

test('setParent: non-player lineage stays clean', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const npcParent = ctx.bots[1];
  const npcChild = ctx.bots[2];
  ctx.setParent(npcChild, npcParent);
  assert.strictEqual(npcChild.isPlayerOffspring, false);
});

// ---- getParent / getChildren / getGeneration ---------------------

test('getParent: returns null for orphan bot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  assert.strictEqual(ctx.getParent(ctx.bots[0]), null);
});

test('getParent: returns the parent bot', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const parent = ctx.bots[0];
  const child = ctx.bots[1];
  ctx.setParent(child, parent);
  assert.strictEqual(ctx.getParent(child), parent);
});

test('getChildren: returns empty array for childless bot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  assert.deepStrictEqual(Array.from(ctx.getChildren(ctx.bots[0])), []);
});

test('getChildren: returns all direct children', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  const parent = ctx.bots[0];
  ctx.setParent(ctx.bots[1], parent);
  ctx.setParent(ctx.bots[2], parent);
  ctx.setParent(ctx.bots[3], parent);
  const kids = ctx.getChildren(parent);
  assert.strictEqual(kids.length, 3);
});

test('getGeneration: defaults to 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  assert.strictEqual(ctx.getGeneration(ctx.bots[0]), 0);
});

// ---- getAllDescendants / getAllAncestors -------------------------

test('getAllDescendants: collects multi-level descendants', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  ctx.setParent(ctx.bots[1], ctx.bots[0]);
  ctx.setParent(ctx.bots[2], ctx.bots[1]);
  ctx.setParent(ctx.bots[3], ctx.bots[2]);
  const desc = ctx.getAllDescendants(ctx.bots[0]);
  assert.strictEqual(desc.length, 3);
});

test('getAllAncestors: walks up the chain', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  ctx.setParent(ctx.bots[1], ctx.bots[0]);
  ctx.setParent(ctx.bots[2], ctx.bots[1]);
  ctx.setParent(ctx.bots[3], ctx.bots[2]);
  const anc = ctx.getAllAncestors(ctx.bots[3]);
  assert.strictEqual(anc.length, 3);
  assert.strictEqual(anc[0].index, ctx.bots[2].index);
});

// ---- areRelated ---------------------------------------------------

test('areRelated: parent and child are related', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const parent = ctx.bots[0];
  const child = ctx.bots[1];
  ctx.setParent(child, parent);
  assert.strictEqual(ctx.areRelated(parent, child), true);
  assert.strictEqual(ctx.areRelated(child, parent), true);
});

test('areRelated: grandparent and grandchild are related', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.setParent(ctx.bots[1], ctx.bots[0]);
  ctx.setParent(ctx.bots[2], ctx.bots[1]);
  assert.strictEqual(ctx.areRelated(ctx.bots[0], ctx.bots[2]), true);
});

test('areRelated: strangers are not related', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  // bot[1] and bot[2] have no family link
  assert.strictEqual(ctx.areRelated(ctx.bots[1], ctx.bots[2]), false);
});

test('areRelated: respects maxGenerations bound', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  ctx.setParent(ctx.bots[1], ctx.bots[0]);
  ctx.setParent(ctx.bots[2], ctx.bots[1]);
  ctx.setParent(ctx.bots[3], ctx.bots[2]);
  // bot[0] and bot[3] are 3 generations apart
  assert.strictEqual(ctx.areRelated(ctx.bots[0], ctx.bots[3], 2), false);
  assert.strictEqual(ctx.areRelated(ctx.bots[0], ctx.bots[3], 4), true);
});

// ---- Protection system -------------------------------------------

test('addProtection: isProtected returns true within duration', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.frameCount = 0;
  ctx.addProtection(ctx.bots[0], ctx.bots[1], 300);
  assert.strictEqual(ctx.isProtected(ctx.bots[0], ctx.bots[1]), true);
  assert.strictEqual(ctx.isProtected(ctx.bots[1], ctx.bots[0]), true, 'should be symmetric');
});

test('isProtected: false after duration elapses', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.frameCount = 0;
  ctx.addProtection(ctx.bots[0], ctx.bots[1], 300);
  ctx.frameCount = 301;
  assert.strictEqual(ctx.isProtected(ctx.bots[0], ctx.bots[1]), false);
});

test('isProtected: false for unrelated bots', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  assert.strictEqual(ctx.isProtected(ctx.bots[0], ctx.bots[1]), false);
  assert.strictEqual(ctx.isProtected(ctx.bots[1], ctx.bots[2]), false);
});

test('addProtection: populates protectedFrom arrays', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.frameCount = 0;
  ctx.addProtection(ctx.bots[0], ctx.bots[1], 300);
  assert.ok(ctx.bots[0].relationships.protectedFrom.some(p => p.botId === ctx.bots[1].index));
  assert.ok(ctx.bots[1].relationships.protectedFrom.some(p => p.botId === ctx.bots[0].index));
});

test('updateProtections: removes expired entries from protectionPairs', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.frameCount = 0;
  ctx.addProtection(ctx.bots[0], ctx.bots[1], 100);
  assert.ok(ctx.protectionPairs.size > 0);
  ctx.frameCount = 200;
  ctx.updateProtections();
  assert.strictEqual(ctx.protectionPairs.size, 0);
});

test('updateProtections: keeps live entries', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.frameCount = 0;
  ctx.addProtection(ctx.bots[0], ctx.bots[1], 300);
  ctx.frameCount = 150; // half-way
  ctx.updateProtections();
  assert.ok(ctx.protectionPairs.size > 0);
});

test('getProtectedBots: returns current live protections', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.frameCount = 0;
  ctx.addProtection(ctx.bots[0], ctx.bots[1], 300);
  ctx.addProtection(ctx.bots[0], ctx.bots[2], 300);
  const protecteds = ctx.getProtectedBots(ctx.bots[0]);
  assert.strictEqual(protecteds.length, 2);
});

test('clearBotProtections: removes all protections involving a bot', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.frameCount = 0;
  ctx.addProtection(ctx.bots[0], ctx.bots[1], 300);
  ctx.addProtection(ctx.bots[0], ctx.bots[2], 300);
  ctx.clearBotProtections(ctx.bots[0]);
  assert.strictEqual(ctx.bots[0].relationships.protectedFrom.length, 0);
  // protectionPairs entries involving bot 0 should be gone
  for (const key of ctx.protectionPairs.keys()) {
    const indices = key.split('-').map(Number);
    assert.ok(!indices.includes(ctx.bots[0].index));
  }
});

// ---- shouldProtectByGeneration -----------------------------------

test('shouldProtectByGeneration: false when protection duration is 0', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.offspring.protection.duration = 0;
  ctx.setParent(ctx.bots[1], ctx.bots[0]);
  assert.strictEqual(
    ctx.shouldProtectByGeneration(ctx.bots[0], ctx.bots[1]),
    false
  );
});

test('shouldProtectByGeneration: true for parent-child at gen 1', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.reproduction.offspring.protection.duration = 300;
  ctx.lifecycleSettings.reproduction.offspring.protection.generations = 1;
  ctx.setParent(ctx.bots[1], ctx.bots[0]);
  assert.strictEqual(
    ctx.shouldProtectByGeneration(ctx.bots[0], ctx.bots[1]),
    true
  );
});

// ---- clearRelationshipsOnDeath -----------------------------------

test('clearRelationshipsOnDeath: removes bot from parent.childIds', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const parent = ctx.bots[0];
  const child = ctx.bots[1];
  ctx.setParent(child, parent);
  assert.ok(parent.relationships.childIds.includes(child.index));
  ctx.clearRelationshipsOnDeath(child);
  assert.ok(!parent.relationships.childIds.includes(child.index));
});

test('clearRelationshipsOnDeath: clears bot protections', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.frameCount = 0;
  ctx.addProtection(ctx.bots[0], ctx.bots[1], 300);
  ctx.clearRelationshipsOnDeath(ctx.bots[0]);
  assert.strictEqual(ctx.bots[0].relationships.protectedFrom.length, 0);
});

// ---- resetRelationshipsOnRespawn ---------------------------------

test('resetRelationshipsOnRespawn: clears mate history', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.relationships.mateHistory = [{ partnerId: 5, frame: 100 }];
  ctx.resetRelationshipsOnRespawn(bot);
  assert.strictEqual(bot.relationships.mateHistory.length, 0);
});

test('resetRelationshipsOnRespawn: keeps parent/child lineage', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const parent = ctx.bots[0];
  const child = ctx.bots[1];
  ctx.setParent(child, parent);
  const parentIdBefore = child.relationships.parentId;
  ctx.resetRelationshipsOnRespawn(child);
  assert.strictEqual(child.relationships.parentId, parentIdBefore);
});
