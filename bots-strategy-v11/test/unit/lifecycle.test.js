// Unit tests for lifecycle.js — invincibility, starvation, age,
// and lifecycle initialization helpers.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

// ---- Invincibility -----------------------------------------------

test('applyInvincibility: sets invincibilityFrames when enabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  const bot = ctx.bots[0];
  ctx.applyInvincibility(bot, 180);
  assert.strictEqual(bot.invincibilityFrames, 180);
});

test('applyInvincibility: no-op when disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = false;
  const bot = ctx.bots[0];
  ctx.applyInvincibility(bot, 180);
  assert.strictEqual(bot.invincibilityFrames, 0);
});

test('applyInvincibility: uses default duration when none specified', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  ctx.lifecycleSettings.respawnInvincibility.duration = 240;
  const bot = ctx.bots[0];
  ctx.applyInvincibility(bot);
  assert.strictEqual(bot.invincibilityFrames, 240);
});

test('updateInvincibility: decrements frames toward 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.invincibilityFrames = 10;
  ctx.updateInvincibility(bot);
  assert.strictEqual(bot.invincibilityFrames, 9);
});

test('updateInvincibility: no-op at 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.invincibilityFrames = 0;
  ctx.updateInvincibility(bot);
  assert.strictEqual(bot.invincibilityFrames, 0);
});

test('isInvincible: true when frames > 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.invincibilityFrames = 1;
  assert.strictEqual(ctx.isInvincible(bot), true);
  bot.invincibilityFrames = 0;
  assert.strictEqual(ctx.isInvincible(bot), false);
});

test('breakInvincibility: zeros frames immediately', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.invincibilityFrames = 100;
  ctx.breakInvincibility(bot, 'test');
  assert.strictEqual(bot.invincibilityFrames, 0);
});

test('breakInvincibility: no-op when not invincible', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.invincibilityFrames = 0;
  ctx.breakInvincibility(bot, 'test');
  assert.strictEqual(bot.invincibilityFrames, 0);
});

// ---- Starvation --------------------------------------------------

test('updateStarvation: increments starvationCounter while enabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  const bot = ctx.bots[0];
  bot.starvationCounter = 0;
  ctx.updateStarvation(bot);
  assert.strictEqual(bot.starvationCounter, 1);
});

test('updateStarvation: no-op when disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = false;
  const bot = ctx.bots[0];
  bot.starvationCounter = 0;
  ctx.updateStarvation(bot);
  assert.strictEqual(bot.starvationCounter, 0);
});

test('updateStarvation: sets isStarving after threshold reached', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.inactivityThreshold = 10;
  const bot = ctx.bots[0];
  bot.starvationCounter = 10;
  ctx.updateStarvation(bot);
  assert.strictEqual(bot.isStarving, true);
});

test('updateStarvation: applies damage on tick interval', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.inactivityThreshold = 0;
  ctx.lifecycleSettings.starvation.tickInterval = 1;
  ctx.lifecycleSettings.starvation.damagePerTick = 0.5;
  const bot = ctx.bots[0];
  const before = bot.lives;
  bot.starvationCounter = 10; // past threshold
  ctx.updateStarvation(bot);
  assert.strictEqual(bot.lives, before - 0.5);
});

test('updateStarvation: returns death when lives reach 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.inactivityThreshold = 0;
  ctx.lifecycleSettings.starvation.tickInterval = 1;
  ctx.lifecycleSettings.starvation.damagePerTick = 10;
  const bot = ctx.bots[0];
  bot.lives = 5;
  bot.starvationCounter = 10;
  const result = ctx.updateStarvation(bot);
  assert.strictEqual(result, 'death');
});

test('updateStarvation: scaling makes stronger bots starve faster', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.scaling.enabled = true;
  ctx.lifecycleSettings.starvation.scaling.baselineStats = 18;
  ctx.lifecycleSettings.starvation.scaling.factor = 0.5;
  ctx.lifecycleSettings.starvation.inactivityThreshold = 100;

  const weakProgress = ctx.getStarvationProgress({
    speed: 5, attack: 5, defence: 5, lives: 3, starvationCounter: 50,
  });
  const strongProgress = ctx.getStarvationProgress({
    speed: 15, attack: 15, defence: 15, lives: 15, starvationCounter: 50,
  });
  assert.ok(strongProgress > weakProgress,
    `stronger bot should progress faster: strong=${strongProgress}, weak=${weakProgress}`);
});

test('resetStarvationTimer: zeros counter and clears flag', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  const bot = ctx.bots[0];
  bot.starvationCounter = 500;
  bot.isStarving = true;
  bot.starvationTickCounter = 30;
  ctx.resetStarvationTimer(bot, 'test');
  assert.strictEqual(bot.starvationCounter, 0);
  assert.strictEqual(bot.isStarving, false);
  assert.strictEqual(bot.starvationTickCounter, 0);
});

test('resetStarvationTimer: no-op when starvation disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = false;
  const bot = ctx.bots[0];
  bot.starvationCounter = 500;
  ctx.resetStarvationTimer(bot, 'test');
  assert.strictEqual(bot.starvationCounter, 500);
});

test('getStarvationProgress: 0 when counter is 0', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  const bot = ctx.bots[0];
  bot.starvationCounter = 0;
  assert.strictEqual(ctx.getStarvationProgress(bot), 0);
});

test('getStarvationProgress: clamps to 1 past threshold', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.inactivityThreshold = 100;
  ctx.lifecycleSettings.starvation.scaling.enabled = false;
  const bot = ctx.bots[0];
  bot.starvationCounter = 500;
  assert.strictEqual(ctx.getStarvationProgress(bot), 1);
});

// ---- Stat decay --------------------------------------------------

test('applyStarvationStatDecay: decays one stat by decayPerTick', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.statDecay.enabled = true;
  ctx.lifecycleSettings.starvation.statDecay.decayPerTick = 0.2;
  ctx.lifecycleSettings.starvation.statDecay.order = 'random';
  const bot = ctx.bots[0];
  const before = bot.speed + bot.attack + bot.defence;
  ctx.applyStarvationStatDecay(bot);
  const after = bot.speed + bot.attack + bot.defence;
  assert.ok(Math.abs(after - before - (-0.2)) < 1e-9);
});

test('applyStarvationStatDecay: highestFirst targets highest stat', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.statDecay.order = 'highestFirst';
  ctx.lifecycleSettings.starvation.statDecay.decayPerTick = 0.5;
  const bot = ctx.bots[0];
  bot.speed = 3; bot.attack = 10; bot.defence = 5;
  const result = ctx.applyStarvationStatDecay(bot);
  assert.strictEqual(result.stat, 'attack');
  assert.strictEqual(bot.attack, 9.5);
});

test('applyStarvationStatDecay: lowestFirst targets lowest stat', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.statDecay.order = 'lowestFirst';
  ctx.lifecycleSettings.starvation.statDecay.decayPerTick = 0.5;
  const bot = ctx.bots[0];
  bot.speed = 3; bot.attack = 10; bot.defence = 5;
  const result = ctx.applyStarvationStatDecay(bot);
  assert.strictEqual(result.stat, 'speed');
});

test('applyStarvationStatDecay: respects minStats floor', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.statDecay.order = 'highestFirst';
  ctx.lifecycleSettings.starvation.statDecay.decayPerTick = 0.5;
  ctx.lifecycleSettings.starvation.statDecay.minStats = { speed: 3, attack: 3, defence: 3 };
  const bot = ctx.bots[0];
  bot.speed = 3; bot.attack = 3; bot.defence = 3;
  // All at min → no decay possible
  const result = ctx.applyStarvationStatDecay(bot);
  assert.strictEqual(result, null);
});

// ---- Age ---------------------------------------------------------

test('updateAge: increments age when enabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = true;
  const bot = ctx.bots[0];
  bot.age = 0;
  ctx.updateAge(bot);
  assert.strictEqual(bot.age, 1);
});

test('updateAge: no-op when disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = false;
  const bot = ctx.bots[0];
  bot.age = 0;
  ctx.updateAge(bot);
  assert.strictEqual(bot.age, 0);
});

test('updateAge: returns death at maxAge', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.maxAge = 100;
  const bot = ctx.bots[0];
  bot.age = 99;
  const result = ctx.updateAge(bot);
  assert.strictEqual(result, 'death');
});

test('getAgeProgress: ratio of age to maxAge', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.maxAge = 100;
  const bot = ctx.bots[0];
  bot.age = 50;
  assert.strictEqual(ctx.getAgeProgress(bot), 0.5);
});

test('getAgeProgress: 0 when age disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = false;
  const bot = ctx.bots[0];
  bot.age = 100;
  assert.strictEqual(ctx.getAgeProgress(bot), 0);
});

test('getAgeVisualFactor: 1 before decayStart', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.maxAge = 100;
  ctx.lifecycleSettings.age.visualDecayStart = 0.8;
  const bot = ctx.bots[0];
  bot.age = 50; // 0.5 progress < 0.8
  assert.strictEqual(ctx.getAgeVisualFactor(bot), 1);
});

test('getAgeVisualFactor: 0.5 at maxAge (full decay)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.maxAge = 100;
  ctx.lifecycleSettings.age.visualDecayStart = 0.8;
  const bot = ctx.bots[0];
  bot.age = 100;
  assert.strictEqual(ctx.getAgeVisualFactor(bot), 0.5);
});

// ---- Initialization ----------------------------------------------

test('initBotLifecycleProperties: creates zeroed state', () => {
  const ctx = createTestContext({ botCount: 0, dotCount: 0 });
  const bot = { isPlayer: false, index: 0 };
  ctx.initBotLifecycleProperties(bot);
  assert.strictEqual(bot.invincibilityFrames, 0);
  assert.strictEqual(bot.starvationCounter, 0);
  assert.strictEqual(bot.isStarving, false);
  assert.strictEqual(bot.age, 0);
  assert.strictEqual(bot.reproductionCooldown, 0);
  assert.strictEqual(bot.offspringCount, 0);
  assert.strictEqual(bot.generation, 0);
  assert.ok(bot.relationships);
  assert.ok(bot.matingProgress instanceof ctx.Map);
});

test('resetBotLifecycleOnRespawn: zeros age/starvation/cooldown', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.age = 1000;
  bot.starvationCounter = 300;
  bot.isStarving = true;
  bot.reproductionCooldown = 400;
  ctx.resetBotLifecycleOnRespawn(bot);
  assert.strictEqual(bot.age, 0);
  assert.strictEqual(bot.starvationCounter, 0);
  assert.strictEqual(bot.isStarving, false);
  assert.strictEqual(bot.reproductionCooldown, 0);
});

test('resetBotLifecycleOnRespawn: clears active speed boost', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.speed = 5.5;
  bot.speedBoostFrames = 100;
  ctx.resetBotLifecycleOnRespawn(bot);
  assert.strictEqual(bot.speed, 5.0);
  assert.strictEqual(bot.speedBoostFrames, 0);
});

// ---- shouldApplyLifecycleToBot ------------------------------------

test('shouldApplyLifecycleToBot: false when feature disabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = false;
  assert.strictEqual(
    ctx.shouldApplyLifecycleToBot(ctx.bots[0], 'starvation'),
    false
  );
});

test('shouldApplyLifecycleToBot: true when feature enabled (no overrides)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.playerOverrides.enabled = false;
  assert.strictEqual(
    ctx.shouldApplyLifecycleToBot(ctx.bots[0], 'starvation'),
    true
  );
});

test('shouldApplyLifecycleToBot: player override can disable per bot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.playerOverrides.enabled = true;
  ctx.lifecycleSettings.playerOverrides.starvation = { enabled: false };
  assert.strictEqual(
    ctx.shouldApplyLifecycleToBot(ctx.bots[0], 'starvation'),
    false
  );
});
