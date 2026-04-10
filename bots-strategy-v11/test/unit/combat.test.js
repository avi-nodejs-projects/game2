// Unit tests for combat.js — collision detection, combat damage
// formulas, death handling, and the collision processing loop.
// This is the most safety-critical test file — the combat math
// shapes the entire game's strategic feel.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, totalStats, assertApprox } = require('../helpers');

// ---- checkBotDotCollision ----------------------------------------

test('checkBotDotCollision: true when within sum of radii', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 1 });
  const bot = ctx.bots[0];
  const dot = ctx.yellowDots[0];
  bot.size = 10; bot.x = 100; bot.y = 100;
  dot.size = 6; dot.x = 110; dot.y = 100; // distance 10 < 16
  assert.strictEqual(ctx.checkBotDotCollision(bot, dot), true);
});

test('checkBotDotCollision: false when outside sum of radii', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 1 });
  const bot = ctx.bots[0];
  const dot = ctx.yellowDots[0];
  bot.size = 10; bot.x = 100; bot.y = 100;
  dot.size = 6; dot.x = 200; dot.y = 100; // distance 100 > 16
  assert.strictEqual(ctx.checkBotDotCollision(bot, dot), false);
});

test('checkBotBotCollision: true when touching', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.size = 10; a.x = 100; a.y = 100;
  b.size = 10; b.x = 115; b.y = 100; // distance 15 < 20
  assert.strictEqual(ctx.checkBotBotCollision(a, b), true);
});

test('checkBotBotCollision: false when far apart', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.size = 10; a.x = 0; a.y = 0;
  b.size = 10; b.x = 500; b.y = 500;
  assert.strictEqual(ctx.checkBotBotCollision(a, b), false);
});

// ---- Helpers for combat tests -------------------------------------

function setupCombatPair(ctx, statsA, statsB) {
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  Object.assign(a, statsA);
  Object.assign(b, statsB);
  a.combatCooldown = 0;
  b.combatCooldown = 0;
  a.invincibilityFrames = 0;
  b.invincibilityFrames = 0;
  return [a, b];
}

// ---- handleCombat: basic damage formula ---------------------------

test('handleCombat: primary formula deals attack - defence', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 10, defence: 5, lives: 10 },
    { attack: 4, defence: 2, lives: 10 }
  );
  ctx.handleCombat(a, b);
  // a takes b.attack - a.defence = 4 - 5 = -1 → 0 (clamped)
  // b takes a.attack - b.defence = 10 - 2 = 8
  assert.strictEqual(a.lives, 10);
  assert.strictEqual(b.lives, 2);
});

test('handleCombat: negative damage clamped to 0 (no healing)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 10, defence: 100, lives: 10 },
    { attack: 1, defence: 2, lives: 10 }
  );
  ctx.handleCombat(a, b);
  // a.defence (100) >> b.attack (1) → a takes 0 damage
  assert.strictEqual(a.lives, 10);
});

test('handleCombat: stalemate triggers division formula', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  // Both have high defence vs opponent attack → damage1 and damage2 both <= 0
  const [a, b] = setupCombatPair(ctx,
    { attack: 5, defence: 10, lives: 10 },
    { attack: 5, defence: 10, lives: 10 }
  );
  ctx.handleCombat(a, b);
  // Division formula: damage = opponent.attack / max(defence, 0.1)
  // Each takes 5 / 10 = 0.5 damage
  assertApprox(a.lives, 9.5, 1e-9);
  assertApprox(b.lives, 9.5, 1e-9);
});

test('handleCombat: sets combat cooldown to 60 for both bots', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 5, defence: 3, lives: 10 },
    { attack: 5, defence: 3, lives: 10 }
  );
  ctx.handleCombat(a, b);
  assert.strictEqual(a.combatCooldown, 60);
  assert.strictEqual(b.combatCooldown, 60);
});

test('handleCombat: no-op when attacker has cooldown', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 5, defence: 3, lives: 10 },
    { attack: 5, defence: 3, lives: 10 }
  );
  a.combatCooldown = 30;
  ctx.handleCombat(a, b);
  assert.strictEqual(a.lives, 10, 'no combat should have occurred');
  assert.strictEqual(b.lives, 10);
});

// ---- handleCombat: damage flags -----------------------------------

test('handleCombat: sets justTookDamage when taking damage', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 10, defence: 3, lives: 10 },
    { attack: 3, defence: 3, lives: 10 }
  );
  ctx.handleCombat(a, b);
  assert.strictEqual(b.justTookDamage, true);
  assert.strictEqual(b.damageTimer, 120);
  assert.strictEqual(b.lastAttacker, a);
});

test('handleCombat: sets justDealtDamage when dealing damage', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 10, defence: 3, lives: 10 },
    { attack: 3, defence: 3, lives: 10 }
  );
  ctx.handleCombat(a, b);
  assert.strictEqual(a.justDealtDamage, true);
  assert.strictEqual(a.damageDealtTimer, 120);
});

// ---- handleCombat: kill logic -------------------------------------

test('handleCombat: kill increments killer.killCount', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 100, defence: 3, lives: 10 },
    { attack: 1, defence: 1, lives: 1 }
  );
  const killsBefore = a.killCount;
  ctx.handleCombat(a, b);
  assert.strictEqual(a.killCount, killsBefore + 1);
});

test('handleCombat: kill awards killer +1 stat', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 100, defence: 3, lives: 10 },
    { attack: 1, defence: 1, lives: 1 }
  );
  // We can't check which stat grew because it's random, but the
  // total should increase by exactly 1.
  const sumBefore = totalStats(a);
  ctx.handleCombat(a, b);
  // Note: after combat, a's stats remain unchanged EXCEPT for the
  // +1 stat from the kill. b was reset, so we check a only.
  // Combat damage to a: b.attack - a.defence = 1 - 3 = 0
  // So a's stat total = original + 1 (kill bonus)
  assertApprox(totalStats(a), sumBefore + 1, 1e-9);
});

test('handleCombat: killed bot gets stats reset (default behavior)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 100, defence: 3, lives: 10 },
    { attack: 1, defence: 1, lives: 1 }
  );
  b.speed = 99; b.attack = 99; b.defence = 99; // high pre-death stats
  ctx.handleCombat(a, b);
  // Default NPC stats: speed=5, attack=5, defence=5, lives=3
  assert.strictEqual(b.speed, 5);
  assert.strictEqual(b.attack, 5);
  assert.strictEqual(b.defence, 5);
  assert.strictEqual(b.lives, 3);
});

test('handleCombat: killed bot respawns at a new position', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 100, defence: 3, lives: 10 },
    { attack: 1, defence: 1, lives: 1 }
  );
  b.x = 500; b.y = 500;
  ctx.handleCombat(a, b);
  // Position likely changed after spawnAtRandom
  assert.ok(typeof b.x === 'number' && typeof b.y === 'number');
  // Within bounds
  assert.ok(b.x >= 20 && b.x <= ctx.WORLD_WIDTH - 20);
  assert.ok(b.y >= 20 && b.y <= ctx.WORLD_HEIGHT - 20);
});

test('handleCombat: both die scenario uses null killer', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 100, defence: 0.1, lives: 1 },
    { attack: 100, defence: 0.1, lives: 1 }
  );
  const aKillsBefore = a.killCount;
  const bKillsBefore = b.killCount;
  ctx.handleCombat(a, b);
  // Both should be dead and reset
  assert.strictEqual(a.lives, 3);
  assert.strictEqual(b.lives, 3);
  // Neither gets a kill credited
  assert.strictEqual(a.killCount, aKillsBefore);
  assert.strictEqual(b.killCount, bKillsBefore);
});

// ---- handleCombat: invincibility ----------------------------------

test('handleCombat: both invincible → no combat', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  const [a, b] = setupCombatPair(ctx,
    { attack: 10, defence: 2, lives: 10 },
    { attack: 10, defence: 2, lives: 10 }
  );
  a.invincibilityFrames = 100;
  b.invincibilityFrames = 100;
  ctx.handleCombat(a, b);
  assert.strictEqual(a.lives, 10);
  assert.strictEqual(b.lives, 10);
  assert.strictEqual(a.combatCooldown, 0, 'no combat = no cooldown');
});

test('handleCombat: invincible bot takes no damage', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  ctx.lifecycleSettings.respawnInvincibility.canDealDamage = false;
  ctx.lifecycleSettings.respawnInvincibility.breakOnCombatInitiation = false;
  const [a, b] = setupCombatPair(ctx,
    { attack: 10, defence: 2, lives: 10 },
    { attack: 10, defence: 2, lives: 10 }
  );
  a.invincibilityFrames = 100;
  ctx.handleCombat(a, b);
  assert.strictEqual(a.lives, 10, 'invincible a should take 0 damage');
});

// ---- handleCombat: protection -------------------------------------

test('handleCombat: protected pair does not fight', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const [a, b] = setupCombatPair(ctx,
    { attack: 10, defence: 2, lives: 10 },
    { attack: 10, defence: 2, lives: 10 }
  );
  ctx.frameCount = 0;
  ctx.addProtection(a, b, 300);
  ctx.handleCombat(a, b);
  assert.strictEqual(a.lives, 10);
  assert.strictEqual(b.lives, 10);
});

// ---- handleBotDeath -----------------------------------------------

test('handleBotDeath: clears combat flags', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.justTookDamage = true;
  bot.damageTimer = 60;
  bot.justDealtDamage = true;
  bot.damageDealtTimer = 60;
  bot.lastAttacker = ctx.bots[1];
  ctx.handleBotDeath(bot, null);
  assert.strictEqual(bot.justTookDamage, false);
  assert.strictEqual(bot.damageTimer, 0);
  assert.strictEqual(bot.justDealtDamage, false);
  assert.strictEqual(bot.lastAttacker, null);
});

test('handleBotDeath: resets age and starvation counters', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.age = 5000;
  bot.lifetime = 5000;
  bot.starvationCounter = 300;
  bot.isStarving = true;
  ctx.handleBotDeath(bot, null);
  assert.strictEqual(bot.age, 0);
  assert.strictEqual(bot.lifetime, 0);
  assert.strictEqual(bot.starvationCounter, 0);
  assert.strictEqual(bot.isStarving, false);
});

test('handleBotDeath: clears speedBoostFrames', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.speedBoostFrames = 50;
  ctx.handleBotDeath(bot, null);
  assert.strictEqual(bot.speedBoostFrames, 0);
});

test('handleBotDeath: resets generation/player lineage fields', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.generation = 3;
  bot.isPlayerOffspring = true;
  bot.playerLineage = 2;
  ctx.handleBotDeath(bot, null);
  assert.strictEqual(bot.generation, 0);
  assert.strictEqual(bot.isPlayerOffspring, false);
  assert.strictEqual(bot.playerLineage, 0);
});

test('handleBotDeath: applies invincibility on respawn when enabled', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  ctx.lifecycleSettings.respawnInvincibility.duration = 180;
  const bot = ctx.bots[0];
  ctx.handleBotDeath(bot, null);
  assert.strictEqual(bot.invincibilityFrames, 180);
});

// ---- handleAgeDeath (three behaviors) -----------------------------

test('handleAgeDeath: corpse behavior creates a corpse and removes bot', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.deathBehavior = 'corpse';
  const bot = ctx.bots[1];
  ctx.handleAgeDeath(bot);
  assert.strictEqual(ctx.corpses.length, 1);
  assert.ok(!ctx.bots.includes(bot), 'bot should be removed from array');
});

test('handleAgeDeath: respawn behavior keeps bot, resets state', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.deathBehavior = 'respawn';
  const bot = ctx.bots[1];
  bot.age = 36000;
  bot.speed = 99;
  ctx.handleAgeDeath(bot);
  assert.ok(ctx.bots.includes(bot), 'bot should still be in array');
  assert.strictEqual(bot.age, 0);
  assert.strictEqual(bot.speed, 5, 'stats should be reset');
});

test('handleAgeDeath: remove behavior removes bot from array', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.lifecycleSettings.age.enabled = true;
  ctx.lifecycleSettings.age.deathBehavior = 'remove';
  const bot = ctx.bots[1];
  ctx.handleAgeDeath(bot);
  assert.strictEqual(ctx.bots.length, 2);
  assert.ok(!ctx.bots.includes(bot));
  // No corpse created in 'remove' mode
  assert.strictEqual(ctx.corpses.length, 0);
});

// ---- handleStarvationDeath ----------------------------------------

test('handleStarvationDeath: triggers normal death (stats reset)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.speed = 50; bot.attack = 50;
  ctx.handleStarvationDeath(bot);
  assert.strictEqual(bot.speed, 5);
  assert.strictEqual(bot.attack, 5);
});

// ---- processCollisions --------------------------------------------

test('processCollisions: bot-dot collision awards +0.1 stat', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 1 });
  const bot = ctx.bots[0];
  const dot = ctx.yellowDots[0];
  bot.x = 100; bot.y = 100;
  dot.x = 100; dot.y = 100;
  const before = totalStats(bot);
  ctx.processCollisions();
  assertApprox(totalStats(bot) - before, 0.1, 1e-9);
});

test('processCollisions: bot-dot collision respawns the dot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 1 });
  const bot = ctx.bots[0];
  const dot = ctx.yellowDots[0];
  bot.x = 100; bot.y = 100;
  dot.x = 100; dot.y = 100;
  ctx.processCollisions();
  // Dot moved (respawned)
  assert.ok(dot.x !== 100 || dot.y !== 100);
});

test('processCollisions: bot-bot overlap triggers combat', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.x = 100; a.y = 100; a.size = 10;
  b.x = 105; b.y = 100; b.size = 10;
  a.attack = 10; a.defence = 5; a.lives = 10;
  b.attack = 3; b.defence = 2; b.lives = 10;
  a.combatCooldown = 0;
  b.combatCooldown = 0;
  ctx.processCollisions();
  // b should have lost lives: a.attack - b.defence = 10 - 2 = 8
  assert.strictEqual(b.lives, 2);
});

test('processCollisions: no combat when bots do not touch', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.x = 0; a.y = 0; a.size = 10;
  b.x = 1000; b.y = 1000; b.size = 10;
  a.attack = 10; a.lives = 10;
  b.defence = 2; b.lives = 10;
  ctx.processCollisions();
  assert.strictEqual(b.lives, 10);
});

// ---- combatSettings: configurable stalemate breaker ---------------

function setupStalematePair(ctx) {
  // Two perfectly matched tanks neither can damage the other
  // via the primary subtraction formula.
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.x = 100; a.y = 100; a.size = 10;
  b.x = 105; b.y = 100; b.size = 10;
  a.attack = 5; a.defence = 10; a.lives = 10;
  b.attack = 5; b.defence = 10; b.lives = 10;
  a.combatCooldown = 0;
  b.combatCooldown = 0;
  return { a, b };
}

test('stalemateBreaker: division formula still works (default)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const { a, b } = setupStalematePair(ctx);
  // Default: stalemateBreaker.enabled = true, formula = 'division'
  ctx.handleCombat(a, b);
  // damage = attack / defence = 5 / 10 = 0.5 each
  assertApprox(a.lives, 9.5, 1e-6);
  assertApprox(b.lives, 9.5, 1e-6);
});

test('stalemateBreaker: disabling it causes no damage on mutual block', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.stalemateBreaker.enabled = false;
  const { a, b } = setupStalematePair(ctx);
  ctx.handleCombat(a, b);
  assert.strictEqual(a.lives, 10);
  assert.strictEqual(b.lives, 10);
  // Cooldowns still set so they don't fight every frame
  assert.strictEqual(a.combatCooldown, 60);
  assert.strictEqual(b.combatCooldown, 60);
});

test("stalemateBreaker: 'skip' formula behaves like disabled", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.stalemateBreaker.formula = 'skip';
  const { a, b } = setupStalematePair(ctx);
  ctx.handleCombat(a, b);
  assert.strictEqual(a.lives, 10);
  assert.strictEqual(b.lives, 10);
});

test("stalemateBreaker: 'forceRespawnBoth' respawns both bots", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.stalemateBreaker.formula = 'forceRespawnBoth';
  const { a, b } = setupStalematePair(ctx);
  const aStartLives = a.initialLives;
  ctx.handleCombat(a, b);
  // Both respawned to their initial lives
  assert.strictEqual(a.lives, aStartLives);
  assert.strictEqual(b.lives, b.initialLives);
  // Neither got a kill
  assert.strictEqual(a.killCount || 0, 0);
  assert.strictEqual(b.killCount || 0, 0);
});

// ---- combatSettings: damage floor ---------------------------------

test('damageFloor: disabled by default — invincible defender takes no damage', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.x = 100; a.y = 100; a.size = 10;
  b.x = 105; b.y = 100; b.size = 10;
  a.attack = 5; a.defence = 1; a.lives = 10;
  b.attack = 100; b.defence = 1000; b.lives = 10; // mathematically invincible
  a.combatCooldown = 0; b.combatCooldown = 0;
  ctx.handleCombat(a, b);
  // a takes 100 - 1 = 99 (dies), b takes max(5 - 1000, 0) = 0
  assert.strictEqual(b.lives, 10, 'god-bot should be untouched without floor');
});

test('damageFloor: enabled lets weak attacker chip at god-bot', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.damageFloor.enabled = true;
  ctx.combatSettings.damageFloor.fraction = 0.1;
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.x = 100; a.y = 100; a.size = 10;
  b.x = 105; b.y = 100; b.size = 10;
  a.attack = 5; a.defence = 1; a.lives = 10;
  b.attack = 100; b.defence = 1000; b.lives = 10;
  a.combatCooldown = 0; b.combatCooldown = 0;
  ctx.handleCombat(a, b);
  // b should have taken max(5 - 1000, 5 * 0.1) = 0.5 damage
  assertApprox(b.lives, 9.5, 1e-6);
});

// ---- combatSettings: stat cap -------------------------------------

test('statCap: disabled by default — addRandomStat grows freely', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const b = ctx.bots[0];
  b.speed = 100; b.attack = 100; b.defence = 100; b.lives = 100;
  b.addRandomStat();
  const total = b.speed + b.attack + b.defence + b.lives;
  assert.strictEqual(total, 401, 'no cap → one stat grew to 101');
});

test('statCap: enabled stops growth of any capped stat', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.combatSettings.statCap.enabled = true;
  ctx.combatSettings.statCap.maxPerStat = 50;
  const b = ctx.bots[0];
  b.isPlayer = false; // avoid preferredStat branch
  b.speed = 50; b.attack = 50; b.defence = 50; b.lives = 50;
  // Call many times — no stat should ever exceed cap
  for (let i = 0; i < 100; i++) b.addRandomStat();
  assert.ok(b.speed <= 50);
  assert.ok(b.attack <= 50);
  assert.ok(b.defence <= 50);
  assert.ok(b.lives <= 50);
});

test('statCap: redirects growth to uncapped stat when one is at max', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  ctx.combatSettings.statCap.enabled = true;
  ctx.combatSettings.statCap.maxPerStat = 10;
  const b = ctx.bots[0];
  b.isPlayer = false;
  b.speed = 10; b.attack = 5; b.defence = 5; b.lives = 5;
  // Repeatedly add — speed already capped, other stats should grow
  const before = b.attack + b.defence + b.lives;
  for (let i = 0; i < 10; i++) b.addRandomStat();
  assert.strictEqual(b.speed, 10, 'capped stat should not grow');
  const after = b.attack + b.defence + b.lives;
  assert.strictEqual(after, before + 10, 'uncapped stats absorbed all growth');
});
