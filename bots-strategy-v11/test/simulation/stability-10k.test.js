// Long-run stability: 10k-frame simulation at realistic scale.
// This is the SLOW suite — skipped in --quick mode.
// 20 bots + 50 dots (the actual v11 game defaults).

const { test } = require('node:test');
const assert = require('node:assert');
const {
  createTestContext, runSimulation,
  assertAllBotsInBounds,
} = require('../helpers');

// ---- 10k frame basic stability --------------------------

test('stability-10k: 20 bots / 50 dots run 10k frames without errors', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  runSimulation(ctx, 10_000);
  assert.strictEqual(ctx.bots.length, 20);
  assert.strictEqual(ctx.yellowDots.length, 50);
  assertAllBotsInBounds(ctx);
});

// ---- 10k with full lifecycle ----------------------------

test('stability-10k: full lifecycle (invincibility + starvation + age=respawn)', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.resetConditions.onDotEaten = true;
  ctx.lifecycleSettings.starvation.resetConditions.onKill = true;
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.deathBehavior = 'respawn';

  runSimulation(ctx, 10_000);
  assert.strictEqual(ctx.bots.length, 20);
  assertAllBotsInBounds(ctx);
});

// ---- 10k with reproduction ------------------------------

test('stability-10k: reproduction cycles through multiple generations', () => {
  const ctx = createTestContext({ seed: 42, botCount: 5, dotCount: 30 });
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 500;
  ctx.lifecycleSettings.reproduction.asexual.cooldown = 1000;

  runSimulation(ctx, 10_000);
  // Should have grown past initial 5 — some multi-generation lineage
  assert.ok(ctx.bots.length >= 5);
  assertAllBotsInBounds(ctx);
  const maxGen = Math.max(...ctx.bots.map(b => b.generation));
  assert.ok(maxGen >= 1, `expected at least one offspring, max generation ${maxGen}`);
});

// ---- 10k with packs -------------------------------------

test('stability-10k: pack system runs without errors', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  ctx.lifecycleSettings.packs.enabled = true;

  // Give all bots the same strategy so packs can form
  const gathererTpl = ctx.NPC_STRATEGY_TEMPLATES.gatherer;
  for (const bot of ctx.bots) {
    bot.isPlayer = false;
    bot.npcStrategy = 'gatherer';
    bot.npcBehaviors = { ...gathererTpl.behaviors };
    bot.npcWeights = { ...gathererTpl.weights };
  }

  runSimulation(ctx, 10_000);
  assert.strictEqual(ctx.bots.length, 20);
  // May have packs or not depending on proximity dynamics
});

// ---- 10k with everything enabled ------------------------

test('stability-10k: "all features on" maxi-simulation', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.resetConditions.onDotEaten = true;
  ctx.lifecycleSettings.starvation.resetConditions.onKill = true;
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.deathBehavior = 'respawn';
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 1500;
  ctx.lifecycleSettings.packs.enabled = true;

  runSimulation(ctx, 10_000);
  // Just survive without throwing; any bot count change is fine
  assertAllBotsInBounds(ctx);
  // Bot count can grow with reproduction but should stay bounded
  assert.ok(ctx.bots.length >= 1);
  assert.ok(ctx.bots.length < 1000, `runaway growth: ${ctx.bots.length}`);
});
