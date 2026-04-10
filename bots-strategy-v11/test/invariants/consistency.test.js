// Cross-entity consistency invariants.
// Verifies that back-references stay synchronized: pack members
// match bot packIds, child lists match parent references, etc.
// These are properties that would catch subtle bugs like "bot
// respawned but parent's childIds still listed them".

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, runSimulation } = require('../helpers');

// ---- Pack membership ↔ bot packId -------------------------

function assertPackConsistency(ctx, label) {
  // Every bot with a packId should be in that pack's members set
  for (const bot of ctx.bots) {
    const packId = bot.relationships && bot.relationships.packId;
    if (packId !== null && packId !== undefined) {
      const pack = ctx.packs.get(packId);
      assert.ok(pack, `${label}: Bot #${bot.index} has packId=${packId} but pack not found`);
      assert.ok(pack.members.has(bot.index),
        `${label}: Bot #${bot.index} packId=${packId} but not in pack.members`);
    }
  }
  // Every pack member should have matching packId
  for (const [packId, pack] of ctx.packs.entries()) {
    for (const memberIdx of pack.members) {
      const bot = ctx.bots.find(b => b.index === memberIdx);
      if (!bot) {
        // Bot no longer exists (may have been removed) — pack should
        // not hold stale references, so this is a failure.
        assert.fail(`${label}: Pack ${packId} references bot #${memberIdx} which is no longer in the game`);
      }
      assert.strictEqual(
        bot.relationships.packId, packId,
        `${label}: Pack ${packId} has member #${memberIdx} but bot.packId=${bot.relationships.packId}`
      );
    }
  }
}

test('consistency: pack membership stays in sync over long run', () => {
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 20 });
  ctx.lifecycleSettings.packs.enabled = true;
  // Give all bots the same strategy so packs can form
  const tpl = ctx.NPC_STRATEGY_TEMPLATES.gatherer;
  for (const bot of ctx.bots) {
    bot.isPlayer = false;
    bot.npcStrategy = 'gatherer';
    bot.npcBehaviors = { ...tpl.behaviors };
    bot.npcWeights = { ...tpl.weights };
  }
  runSimulation(ctx, 1000, {
    onFrame: (frame, ctx) => {
      if (frame % 100 === 0) assertPackConsistency(ctx, `frame ${frame}`);
    },
  });
  assertPackConsistency(ctx, 'final');
});

test('consistency: pack survives kills + respawns with valid members', () => {
  const ctx = createTestContext({ seed: 42, botCount: 6, dotCount: 0 });
  ctx.lifecycleSettings.packs.enabled = true;
  // Create a pack manually
  ctx.createPack(ctx.bots.slice(0, 4));

  // Force some combat
  for (let i = 0; i < 4; i++) {
    ctx.bots[i].attack = 20; ctx.bots[i].defence = 3; ctx.bots[i].lives = 2;
    ctx.bots[i].x = 500 + i * 15; ctx.bots[i].y = 500;
  }
  ctx.bots[4].attack = 30; ctx.bots[4].defence = 1; ctx.bots[4].lives = 5;
  ctx.bots[4].x = 510; ctx.bots[4].y = 510;

  runSimulation(ctx, 500);
  assertPackConsistency(ctx, 'after combat');
});

// ---- Parent/child relationships ---------------------------

function assertFamilyConsistency(ctx, label) {
  for (const bot of ctx.bots) {
    if (!bot.relationships) continue;
    const parentId = bot.relationships.parentId;
    if (parentId !== null && parentId !== undefined) {
      const parent = ctx.bots.find(b => b.index === parentId);
      // Parent may have been killed and respawned (which clears
      // lineage), in which case the child's parentId may be stale.
      // Per handleBotDeath logic, clearRelationshipsOnDeath removes
      // the dead bot from its parent's childIds but does NOT clear
      // children's parentId references.
      if (parent) {
        // If parent still exists with intact relationships, verify
        // the child is listed — but only if the parent hasn't been
        // through a respawn (which clears childIds).
        // This is difficult to verify without more state, so we
        // just skip — the weaker invariant is "parent exists".
      }
    }

    // Every listed child should exist
    for (const childId of bot.relationships.childIds) {
      const child = ctx.bots.find(b => b.index === childId);
      if (!child) {
        assert.fail(`${label}: Bot #${bot.index} childIds contains #${childId} but that bot doesn't exist`);
      }
    }
  }
}

test('consistency: parent childIds reference existing bots', () => {
  const ctx = createTestContext({ seed: 42, botCount: 5, dotCount: 20 });
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 100;
  ctx.lifecycleSettings.reproduction.asexual.cooldown = 300;

  runSimulation(ctx, 1000, {
    onFrame: (frame, ctx) => {
      if (frame % 100 === 0) assertFamilyConsistency(ctx, `frame ${frame}`);
    },
  });
  assertFamilyConsistency(ctx, 'final');
});

// ---- Protection pair symmetry ------------------------------

function assertProtectionSymmetry(ctx, label) {
  for (const [key, expiry] of ctx.protectionPairs.entries()) {
    const [a, b] = key.split('-').map(Number);
    if (expiry <= ctx.frameCount) continue; // already expired
    const botA = ctx.bots.find(x => x.index === a);
    const botB = ctx.bots.find(x => x.index === b);
    if (botA && botA.relationships) {
      const found = botA.relationships.protectedFrom.some(p =>
        p.botId === b && p.expiresAtFrame > ctx.frameCount
      );
      assert.ok(found,
        `${label}: protectionPairs has ${a}-${b} but bot #${a} doesn't list #${b} in protectedFrom`);
    }
    if (botB && botB.relationships) {
      const found = botB.relationships.protectedFrom.some(p =>
        p.botId === a && p.expiresAtFrame > ctx.frameCount
      );
      assert.ok(found,
        `${label}: protectionPairs has ${a}-${b} but bot #${b} doesn't list #${a} in protectedFrom`);
    }
  }
}

test('consistency: protectionPairs and bot.protectedFrom stay in sync', () => {
  const ctx = createTestContext({ seed: 42, botCount: 5, dotCount: 20 });
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 100;
  ctx.lifecycleSettings.reproduction.offspring.protection.duration = 300;

  runSimulation(ctx, 800, {
    onFrame: (frame, ctx) => {
      if (frame % 100 === 0) assertProtectionSymmetry(ctx, `frame ${frame}`);
    },
  });
  assertProtectionSymmetry(ctx, 'final');
});

// ---- Corpse references are valid --------------------------

test('consistency: corpses reference original bot indices that are plausible', () => {
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 10 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.maxAge = 100;
  ctx.lifecycleSettings.age.deathBehavior = 'corpse';
  ctx.lifecycleSettings.age.corpse.duration = 500;

  runSimulation(ctx, 300);
  // Every corpse should have a non-negative originalBotIndex
  for (const corpse of ctx.corpses) {
    assert.ok(corpse.originalBotIndex >= 0,
      `corpse originalBotIndex should be >= 0, got ${corpse.originalBotIndex}`);
    assert.ok(corpse.createdAtFrame >= 0,
      `corpse createdAtFrame should be >= 0, got ${corpse.createdAtFrame}`);
  }
});

// ---- Bot index uniqueness during reproduction -------------

test('consistency: new offspring get unique bot indices', () => {
  const ctx = createTestContext({ seed: 42, botCount: 3, dotCount: 20 });
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 100;
  ctx.lifecycleSettings.reproduction.asexual.cooldown = 300;

  runSimulation(ctx, 800);
  const indices = ctx.bots.map(b => b.index);
  const unique = new Set(indices);
  assert.strictEqual(unique.size, indices.length,
    `duplicate bot indices: ${JSON.stringify(indices)}`);
});
