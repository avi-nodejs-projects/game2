// Unit tests for corpse.js — Corpse class, creation, consumption,
// expiry, and collision.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, totalStats, assertApprox } = require('../helpers');

// Helper: enable age/corpse system for the context
function enableAgeSystem(ctx) {
  ctx.lifecycleSettings.age.enabled = true;
  // Other settings come from defaults (nutrition 2.0, duration 600, etc.)
}

// ---- Corpse constructor -------------------------------------------

test('Corpse constructor: copies position, size, hue from bot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  bot.x = 500; bot.y = 600; bot.hue = 123;

  const corpse = new ctx.Corpse(bot);
  assert.strictEqual(corpse.x, 500);
  assert.strictEqual(corpse.y, 600);
  assert.strictEqual(corpse.originalHue, 123);
  assert.strictEqual(corpse.size, bot.size);
  assert.strictEqual(corpse.originalBotIndex, bot.index);
});

test('Corpse constructor: inherits packId from bot relationships', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  bot.relationships.packId = 'pack-7';
  const corpse = new ctx.Corpse(bot);
  assert.strictEqual(corpse.packId, 'pack-7');
});

test('Corpse constructor: packId is null when bot has no relationships', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  bot.relationships = null;
  const corpse = new ctx.Corpse(bot);
  assert.strictEqual(corpse.packId, null);
});

test('Corpse constructor: records createdAtFrame from current frameCount', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 100;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  assert.strictEqual(corpse.createdAtFrame, 100);
});

// ---- Corpse.update (expiry) ---------------------------------------

test('Corpse.update: returns true before duration elapses', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 0;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  // Default duration is 600
  ctx.frameCount = 100;
  assert.strictEqual(corpse.update(), true);
});

test('Corpse.update: returns false after duration elapses', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 0;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  ctx.frameCount = 601; // past the 600-frame duration
  assert.strictEqual(corpse.update(), false);
});

test('Corpse.update: duration=0 means permanent', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.lifecycleSettings.age.corpse.duration = 0;
  ctx.frameCount = 0;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  ctx.frameCount = 10_000_000;
  assert.strictEqual(corpse.update(), true);
});

// ---- getTimeRemaining ---------------------------------------------

test('Corpse.getTimeRemaining: returns Infinity for duration=0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.lifecycleSettings.age.corpse.duration = 0;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  assert.strictEqual(corpse.getTimeRemaining(), Infinity);
});

test('Corpse.getTimeRemaining: counts down with frameCount', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 0;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  // Duration 600, created at frame 0
  assert.strictEqual(corpse.getTimeRemaining(), 600);
  ctx.frameCount = 200;
  assert.strictEqual(corpse.getTimeRemaining(), 400);
  ctx.frameCount = 599;
  assert.strictEqual(corpse.getTimeRemaining(), 1);
});

test('Corpse.getTimeRemaining: clamps to 0 past expiry', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 0;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  ctx.frameCount = 10_000;
  assert.strictEqual(corpse.getTimeRemaining(), 0);
});

// ---- getFadeAlpha -------------------------------------------------

test('Corpse.getFadeAlpha: returns base opacity for permanent corpses', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.lifecycleSettings.age.corpse.duration = 0;
  ctx.lifecycleSettings.age.corpse.opacity = 0.7;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  assertApprox(corpse.getFadeAlpha(), 0.7);
});

test('Corpse.getFadeAlpha: returns base opacity before fade starts', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 0;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  // Fade starts at 30% remaining, i.e. when 70% elapsed (420 frames)
  ctx.frameCount = 100;
  assertApprox(corpse.getFadeAlpha(), 0.7);
});

test('Corpse.getFadeAlpha: fades toward 0.2 in the last 30%', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 0;
  const corpse = new ctx.Corpse(ctx.bots[0]);
  // Just past fade start
  ctx.frameCount = 500; // 100 remaining of 600
  const alpha = corpse.getFadeAlpha();
  assert.ok(alpha < 0.7 && alpha > 0.2,
    `fade should be in progress, got ${alpha}`);
});

// ---- createCorpse -------------------------------------------------

test('createCorpse: adds a new corpse to corpses array', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  assert.strictEqual(ctx.corpses.length, 0);
  ctx.createCorpse(ctx.bots[0]);
  assert.strictEqual(ctx.corpses.length, 1);
  assert.ok(ctx.corpses[0] instanceof ctx.Corpse);
});

// ---- updateCorpses (expiry) ---------------------------------------

test('updateCorpses: removes expired corpses', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 0;
  ctx.createCorpse(ctx.bots[0]);
  ctx.frameCount = 601; // past duration
  ctx.updateCorpses();
  assert.strictEqual(ctx.corpses.length, 0);
});

test('updateCorpses: keeps fresh corpses', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.frameCount = 0;
  ctx.createCorpse(ctx.bots[0]);
  ctx.frameCount = 300; // half the duration
  ctx.updateCorpses();
  assert.strictEqual(ctx.corpses.length, 1);
});

// ---- checkBotCorpseCollision --------------------------------------

test('checkBotCorpseCollision: true when within sum of radii', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  bot.size = 10;
  bot.x = 100; bot.y = 100;
  const corpse = new ctx.Corpse(bot);
  corpse.x = 105; corpse.y = 100;
  corpse.size = 10;
  assert.strictEqual(ctx.checkBotCorpseCollision(bot, corpse), true);
});

test('checkBotCorpseCollision: false when out of range', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  bot.size = 10;
  bot.x = 100; bot.y = 100;
  const corpse = new ctx.Corpse(bot);
  corpse.x = 500; corpse.y = 500;
  corpse.size = 10;
  assert.strictEqual(ctx.checkBotCorpseCollision(bot, corpse), false);
});

// ---- canConsumeCorpse ---------------------------------------------

test('canConsumeCorpse: non-pack corpse is food by default', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  const corpse = new ctx.Corpse(bot);
  corpse.packId = null; // non-pack
  assert.strictEqual(ctx.canConsumeCorpse(bot, corpse), true);
});

test('canConsumeCorpse: same-pack corpse is protected by default', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  bot.relationships.packId = 'pack-A';
  const corpse = new ctx.Corpse(bot);
  corpse.packId = 'pack-A';
  // Default packMembers='protected', cannibalOverride=true but packs.cannibalism.enabled=false
  assert.strictEqual(ctx.canConsumeCorpse(bot, corpse), false);
});

test('canConsumeCorpse: same-pack corpse is food when packMembers=food', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.lifecycleSettings.age.corpseInteraction.packMembers = 'food';
  const bot = ctx.bots[0];
  bot.relationships.packId = 'pack-A';
  const corpse = new ctx.Corpse(bot);
  corpse.packId = 'pack-A';
  assert.strictEqual(ctx.canConsumeCorpse(bot, corpse), true);
});

test('canConsumeCorpse: nonPackMembers=protected blocks non-pack consumption', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.lifecycleSettings.age.corpseInteraction.nonPackMembers = 'protected';
  const bot = ctx.bots[0];
  const corpse = new ctx.Corpse(bot);
  corpse.packId = null;
  assert.strictEqual(ctx.canConsumeCorpse(bot, corpse), false);
});

// ---- consumeCorpse ------------------------------------------------

test('consumeCorpse: grants nutritionValue stat points to bot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  const corpse = new ctx.Corpse(bot);
  corpse.nutritionValue = 2.0;
  ctx.corpses.push(corpse);

  const before = totalStats(bot);
  ctx.consumeCorpse(bot, corpse);
  const after = totalStats(bot);

  // 2.0 nutrition = 20 calls of +0.1 = 2.0 stat points
  assertApprox(after - before, 2.0, 1e-9);
});

test('consumeCorpse: removes corpse from array', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  ctx.createCorpse(bot);
  assert.strictEqual(ctx.corpses.length, 1);
  ctx.consumeCorpse(bot, ctx.corpses[0]);
  assert.strictEqual(ctx.corpses.length, 0);
});

// ---- processCorpseCollisions --------------------------------------

test('processCorpseCollisions: bot eats overlapping corpse', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  enableAgeSystem(ctx);
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  // Create a corpse by placing one directly
  const otherBot = new ctx.Bot(99, false);
  otherBot.x = 100; otherBot.y = 100;
  ctx.createCorpse(otherBot);
  // Both at the same position → collision
  assert.strictEqual(ctx.corpses.length, 1);

  const before = totalStats(bot);
  ctx.processCorpseCollisions();
  const after = totalStats(bot);
  assert.ok(after > before, 'stats should have grown');
  assert.strictEqual(ctx.corpses.length, 0, 'corpse should be consumed');
});

// ---- clearCorpses -------------------------------------------------

test('clearCorpses: empties the corpses array', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  enableAgeSystem(ctx);
  ctx.createCorpse(ctx.bots[0]);
  ctx.createCorpse(ctx.bots[1]);
  assert.strictEqual(ctx.corpses.length, 2);
  ctx.clearCorpses();
  assert.strictEqual(ctx.corpses.length, 0);
});
