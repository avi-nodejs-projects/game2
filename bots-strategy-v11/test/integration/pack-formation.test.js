// Integration tests: organic pack formation through the game loop.
// Verifies that packs form naturally via the runSimulation path
// (not by calling createPack directly like the unit tests did).

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, runSimulation } = require('../helpers');

function enablePacks(ctx) {
  ctx.lifecycleSettings.packs.enabled = true;
  ctx.lifecycleSettings.packs.formation.proximityDistance = 150;
  ctx.lifecycleSettings.packs.formation.proximityDuration = 180;
  ctx.lifecycleSettings.packs.formation.similarityThreshold = 0.5;
}

// Give all bots the same NPC strategy so similarity = 1.
function setSharedStrategy(ctx, templateKey) {
  const template = ctx.NPC_STRATEGY_TEMPLATES[templateKey];
  for (const bot of ctx.bots) {
    bot.isPlayer = false;
    bot.npcStrategy = templateKey;
    bot.npcBehaviors = { ...template.behaviors };
    bot.npcWeights = { ...template.weights };
  }
}

// ---- Organic formation ------------------------------------

test('packs: similar bots kept close eventually form a pack', () => {
  const ctx = createTestContext({ seed: 42, botCount: 8, dotCount: 0 });
  enablePacks(ctx);
  setSharedStrategy(ctx, 'gatherer');

  // Cluster them in a tight area
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 1000 + (i % 4) * 30;
    ctx.bots[i].y = 1000 + Math.floor(i / 4) * 30;
    ctx.bots[i].targetX = ctx.bots[i].x;
    ctx.bots[i].targetY = ctx.bots[i].y;
  }
  // Run long enough for formation (pack check fires every 60 frames,
  // proximityDuration = 180 → needs ~3 cycles)
  runSimulation(ctx, 400);

  assert.ok(ctx.packs.size >= 1, `expected at least 1 pack, got ${ctx.packs.size}`);
});

test('packs: dispersed bots never form a pack', () => {
  const ctx = createTestContext({ seed: 42, botCount: 8, dotCount: 0 });
  enablePacks(ctx);
  ctx.lifecycleSettings.packs.formation.proximityDistance = 50; // very tight
  setSharedStrategy(ctx, 'gatherer');

  // Spread bots across the field
  const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75, Math.PI,
                  Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75];
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 1000 + Math.cos(angles[i]) * 900;
    ctx.bots[i].y = 1000 + Math.sin(angles[i]) * 900;
    ctx.bots[i].targetX = ctx.bots[i].x;
    ctx.bots[i].targetY = ctx.bots[i].y;
  }
  runSimulation(ctx, 400);

  assert.strictEqual(ctx.packs.size, 0);
});

test('packs: respects maximum pack size', () => {
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 0 });
  enablePacks(ctx);
  ctx.lifecycleSettings.packs.size.max = 3;
  ctx.lifecycleSettings.packs.size.overflowBehavior = 'reject';
  setSharedStrategy(ctx, 'gatherer');

  // Cluster all 10
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 1000 + (i % 5) * 20;
    ctx.bots[i].y = 1000 + Math.floor(i / 5) * 20;
    ctx.bots[i].targetX = ctx.bots[i].x;
    ctx.bots[i].targetY = ctx.bots[i].y;
  }
  runSimulation(ctx, 400);

  // Every pack should have at most 3 members
  for (const [_, pack] of ctx.packs.entries()) {
    assert.ok(pack.members.size <= 3, `pack ${pack.id} has ${pack.members.size} > 3`);
  }
});

test('packs: formation does not throw with mismatched strategies', () => {
  const ctx = createTestContext({ seed: 42, botCount: 8, dotCount: 0 });
  enablePacks(ctx);
  // Give different strategies so similarity < threshold
  for (let i = 0; i < ctx.bots.length; i++) {
    const templateKey = i % 2 === 0 ? 'gatherer' : 'hunter';
    const template = ctx.NPC_STRATEGY_TEMPLATES[templateKey];
    ctx.bots[i].isPlayer = false;
    ctx.bots[i].npcStrategy = templateKey;
    ctx.bots[i].npcBehaviors = { ...template.behaviors };
    ctx.bots[i].npcWeights = { ...template.weights };
    ctx.bots[i].x = 1000 + (i % 4) * 30;
    ctx.bots[i].y = 1000 + Math.floor(i / 4) * 30;
  }
  // Should not throw; may or may not form packs depending on similarity
  runSimulation(ctx, 400);
  // Just verify we didn't crash and the world is still sane
  assert.strictEqual(ctx.bots.length, 8);
});

// ---- Pack survives frame updates ---------------------------

test('packs: once formed, pack persists across many frames', () => {
  const ctx = createTestContext({ seed: 42, botCount: 4, dotCount: 0 });
  enablePacks(ctx);
  setSharedStrategy(ctx, 'gatherer');

  // Manually create the pack (use unit-level API) then ensure it
  // survives through runSimulation without being accidentally
  // disbanded.
  ctx.bots.forEach((b, i) => {
    b.x = 1000 + i * 10;
    b.y = 1000;
  });
  const pack = ctx.createPack(ctx.bots.slice(0, 4));
  const packId = pack.id;

  runSimulation(ctx, 300);
  assert.ok(ctx.packs.has(packId), 'pack should still exist');
  assert.strictEqual(ctx.packs.get(packId).members.size, 4);
});
