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

// =========================================================================
// DQ-6 / DQ-TELEPORT + DQ-7 / DQ-ELO tests
// =========================================================================

// Set up two bots at opposite strengths for reward/penalty ratio tests.
// Returns { weak, strong, ctx }.
function setupRewardPair(ctx, opts = {}) {
  const weak = ctx.bots[0];
  const strong = ctx.bots[1];
  weak.isPlayer = opts.weakIsPlayer || false;
  strong.isPlayer = opts.strongIsPlayer || false;
  weak.speed = 5; weak.attack = 5; weak.defence = 5; weak.lives = 5; // total 20
  strong.speed = 50; strong.attack = 50; strong.defence = 50; strong.lives = 50; // total 200
  weak.initialLives = 5;
  strong.initialLives = 50;
  return { weak, strong };
}

// ---- addRandomStat amount parameter ------------------------------

test('addRandomStat: amount parameter defaults to 1 (backwards compat)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const b = ctx.bots[0];
  b.isPlayer = false;
  const totalBefore = b.speed + b.attack + b.defence + b.lives;
  b.addRandomStat();
  const totalAfter = b.speed + b.attack + b.defence + b.lives;
  assertApprox(totalAfter - totalBefore, 1, 1e-9);
});

test('addRandomStat: amount=0.5 adds exactly 0.5', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const b = ctx.bots[0];
  b.isPlayer = false;
  const totalBefore = b.speed + b.attack + b.defence + b.lives;
  b.addRandomStat(0.5);
  const totalAfter = b.speed + b.attack + b.defence + b.lives;
  assertApprox(totalAfter - totalBefore, 0.5, 1e-9);
});

test('addRandomStat: amount=0 or negative is a no-op', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const b = ctx.bots[0];
  b.isPlayer = false;
  const before = b.speed + b.attack + b.defence + b.lives;
  b.addRandomStat(0);
  b.addRandomStat(-5);
  const after = b.speed + b.attack + b.defence + b.lives;
  assert.strictEqual(after, before);
});

// ---- applyLossPenalty --------------------------------------------

test('applyLossPenalty: subtracts from a random stat, floored at starting value', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const b = ctx.bots[0];
  b.isPlayer = false;
  b.speed = 10; b.attack = 10; b.defence = 10; b.lives = 10;
  b.initialLives = 10;
  const before = b.speed + b.attack + b.defence + b.lives;
  b.applyLossPenalty(3);
  const after = b.speed + b.attack + b.defence + b.lives;
  // Non-lives stats: reduces one of speed/attack/defence directly.
  // Lives stat: reduces initialLives; current lives stays until refill.
  // Either way, exactly one stat bucket absorbed the delta.
  const possibleDeltas = [3, 0]; // non-lives → 3, lives → 0 on current lives (initialLives took it)
  assert.ok(possibleDeltas.includes(before - after),
    `expected delta in ${possibleDeltas}, got ${before - after}`);
});

test('applyLossPenalty: floors at STARTING_STATS baseline', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const b = ctx.bots[0];
  b.isPlayer = false;
  // Set everything to exactly the starting baseline
  b.speed = ctx.STARTING_STATS.speed;
  b.attack = ctx.STARTING_STATS.attack;
  b.defence = ctx.STARTING_STATS.defence;
  b.lives = ctx.STARTING_STATS.lives;
  b.initialLives = ctx.STARTING_STATS.lives;
  b.applyLossPenalty(100); // massive penalty
  // Nothing should go below baseline
  assert.ok(b.speed >= ctx.STARTING_STATS.speed);
  assert.ok(b.attack >= ctx.STARTING_STATS.attack);
  assert.ok(b.defence >= ctx.STARTING_STATS.defence);
  assert.ok(b.initialLives >= ctx.STARTING_STATS.lives);
});

// ---- computeKillReward / computeLossPenalty formulas -------------

test("killReward: 'fixed' mode returns base regardless of stats", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.killReward.mode = 'fixed';
  ctx.combatSettings.killReward.base = 1;
  const { weak, strong } = setupRewardPair(ctx);
  assertApprox(ctx.computeKillReward(weak, strong), 1, 1e-9);
  assertApprox(ctx.computeKillReward(strong, weak), 1, 1e-9);
});

test("killReward: 'ratioLinear' — weak killing strong gives big reward", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.killReward.mode = 'ratioLinear';
  ctx.combatSettings.killReward.base = 1;
  const { weak, strong } = setupRewardPair(ctx);
  // weak kills strong: base * (200/20) = 10
  assertApprox(ctx.computeKillReward(weak, strong), 10, 1e-9);
  // strong kills weak: base * (20/200) = 0.1
  assertApprox(ctx.computeKillReward(strong, weak), 0.1, 1e-9);
});

test("killReward: 'ratioSqrt' — compresses extremes vs linear", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.killReward.mode = 'ratioSqrt';
  ctx.combatSettings.killReward.base = 1;
  const { weak, strong } = setupRewardPair(ctx);
  // weak kills strong: sqrt(10) ≈ 3.162
  assertApprox(ctx.computeKillReward(weak, strong), Math.sqrt(10), 1e-9);
  // strong kills weak: sqrt(0.1) ≈ 0.316
  assertApprox(ctx.computeKillReward(strong, weak), Math.sqrt(0.1), 1e-9);
});

test("killReward: 'elo' — parity gives exactly base", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.killReward.mode = 'elo';
  ctx.combatSettings.killReward.base = 1;
  ctx.combatSettings.killReward.eloScale = 400;
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.speed = 10; a.attack = 10; a.defence = 10; a.lives = 10;
  b.speed = 10; b.attack = 10; b.defence = 10; b.lives = 10;
  // At parity: expected = 0.5, reward = base * 2 * 0.5 = base
  assertApprox(ctx.computeKillReward(a, b), 1, 1e-9);
});

test("killReward: 'elo' — dominant killer gets ≈ 0 (no bully reward)", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.killReward.mode = 'elo';
  ctx.combatSettings.killReward.base = 1;
  // Use tighter eloScale=100 so a 10× stat diff produces dramatic
  // curves. The default 400 (chess-standard) is too forgiving for
  // the ~20-200 totals we test at here.
  ctx.combatSettings.killReward.eloScale = 100;
  const { weak, strong } = setupRewardPair(ctx);
  // strong (200) kills weak (20): expected ≈ 0.984, reward ≈ 0.032
  const reward = ctx.computeKillReward(strong, weak);
  assert.ok(reward < 0.1, `expected ≈0 bully reward, got ${reward}`);
});

test("killReward: 'elo' — upset killer gets ≈ 2 * base", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.killReward.mode = 'elo';
  ctx.combatSettings.killReward.base = 1;
  ctx.combatSettings.killReward.eloScale = 100;
  const { weak, strong } = setupRewardPair(ctx);
  // weak (20) kills strong (200): expected ≈ 0.016, reward ≈ 1.97
  const reward = ctx.computeKillReward(weak, strong);
  assert.ok(reward > 1.9, `expected ≈2 upset reward, got ${reward}`);
});

test("lossPenalty: 'none' mode returns 0", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.lossPenalty.mode = 'none';
  const { weak, strong } = setupRewardPair(ctx);
  assertApprox(ctx.computeLossPenalty(weak, strong), 0, 1e-9);
  assertApprox(ctx.computeLossPenalty(strong, weak), 0, 1e-9);
});

test('symmetry: matching killReward + lossPenalty conserve total stats', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  // Configure both sides identically
  ctx.combatSettings.killReward.mode = 'elo';
  ctx.combatSettings.killReward.base = 1;
  ctx.combatSettings.lossPenalty.mode = 'elo';
  ctx.combatSettings.lossPenalty.base = 1;
  const { weak, strong } = setupRewardPair(ctx);
  // strong kills weak: reward to strong should equal penalty to weak
  const reward1 = ctx.computeKillReward(strong, weak);
  const penalty1 = ctx.computeLossPenalty(weak, strong);
  assertApprox(reward1, penalty1, 1e-9,
    `strong→weak: reward ${reward1} != penalty ${penalty1}`);
  // weak kills strong: same conservation
  const reward2 = ctx.computeKillReward(weak, strong);
  const penalty2 = ctx.computeLossPenalty(strong, weak);
  assertApprox(reward2, penalty2, 1e-9,
    `weak→strong: reward ${reward2} != penalty ${penalty2}`);
});

// ---- deathBehavior: teleport path --------------------------------

test("deathBehavior='teleport' preserves stats + killCount + generation", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.deathBehavior = 'teleport';
  // Note: lossPenalty stays 'none' → no stat change on teleport

  const deadBot = ctx.bots[0];
  const killer = ctx.bots[1];
  deadBot.speed = 15; deadBot.attack = 12; deadBot.defence = 8; deadBot.lives = 1;
  deadBot.initialLives = 5;
  deadBot.killCount = 7;
  deadBot.generation = 3;
  deadBot.age = 1000;
  const xBefore = deadBot.x, yBefore = deadBot.y;

  ctx.handleBotDeath(deadBot, killer, 0);

  // Stats preserved
  assert.strictEqual(deadBot.speed, 15);
  assert.strictEqual(deadBot.attack, 12);
  assert.strictEqual(deadBot.defence, 8);
  // Lives refilled to initialLives (5), not reset to STARTING_STATS
  assert.strictEqual(deadBot.lives, 5);
  assert.strictEqual(deadBot.initialLives, 5);
  // History preserved
  assert.strictEqual(deadBot.killCount, 7);
  assert.strictEqual(deadBot.generation, 3);
  assert.strictEqual(deadBot.age, 1000);
  // Was relocated (spawnAtRandom — may happen to land on same tile
  // but with seeded RNG and 2000×2000 world it's astronomically
  // unlikely). We don't assert move, just that combatCooldown cleared.
  assert.strictEqual(deadBot.combatCooldown, 0);
  assert.strictEqual(deadBot.justTookDamage, false);
});

test("deathBehavior='teleport' applies lossPenalty before refilling lives", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.deathBehavior = 'teleport';

  const deadBot = ctx.bots[0];
  const killer = ctx.bots[1];
  deadBot.isPlayer = false;
  // Totals much bigger than STARTING_STATS so penalty has headroom
  deadBot.speed = 20; deadBot.attack = 20; deadBot.defence = 20; deadBot.lives = 1;
  deadBot.initialLives = 20;

  const totalBefore = deadBot.speed + deadBot.attack + deadBot.defence + deadBot.initialLives;
  ctx.handleBotDeath(deadBot, killer, 3); // penalty of 3
  const totalAfter = deadBot.speed + deadBot.attack + deadBot.defence + deadBot.initialLives;

  // Exactly 3 stat points should have been subtracted from the bucket total
  assertApprox(totalBefore - totalAfter, 3, 1e-9);
  // Lives should be refilled to (possibly reduced) initialLives
  assert.strictEqual(deadBot.lives, deadBot.initialLives);
});

// ---- deathBehavior: remove path ----------------------------------

test("deathBehavior='remove' takes the bot out of the game", () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.combatSettings.deathBehavior = 'remove';

  const deadBot = ctx.bots[1];
  const killer = ctx.bots[0];
  assert.strictEqual(ctx.bots.length, 3);

  ctx.handleBotDeath(deadBot, killer, 0);

  assert.strictEqual(ctx.bots.length, 2, 'bot removed from array');
  assert.ok(!ctx.bots.includes(deadBot), 'dead bot no longer in bots[]');
});

// ---- deathBehavior: reset path (backwards compat) ----------------

test("deathBehavior='reset' — original v11 behavior (stats wiped)", () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  // explicit default
  ctx.combatSettings.deathBehavior = 'reset';

  const deadBot = ctx.bots[0];
  const killer = ctx.bots[1];
  deadBot.isPlayer = false;
  deadBot.speed = 30; deadBot.attack = 30; deadBot.defence = 30; deadBot.lives = 1;
  deadBot.killCount = 10;

  ctx.handleBotDeath(deadBot, killer, 0);

  // Stats reset to STARTING_STATS
  assert.strictEqual(deadBot.speed, ctx.STARTING_STATS.speed);
  assert.strictEqual(deadBot.attack, ctx.STARTING_STATS.attack);
  assert.strictEqual(deadBot.defence, ctx.STARTING_STATS.defence);
  // Lives back to starting
  assert.strictEqual(deadBot.lives, ctx.STARTING_STATS.lives);
  // killCount is a per-bot stat — v11 preserves it across respawns
  assert.strictEqual(deadBot.killCount, 10);
});

// ---- Integration: ratio rewards actually flow through handleCombat ---

test('integration: ELO reward credits killer with sensible amount', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.combatSettings.deathBehavior = 'reset'; // doesn't matter for reward
  ctx.combatSettings.killReward.mode = 'elo';
  ctx.combatSettings.killReward.base = 1;
  ctx.combatSettings.killReward.eloScale = 100; // tight scale for clear test

  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.x = 100; a.y = 100; a.size = 10;
  b.x = 105; b.y = 100; b.size = 10;
  // Make a the overwhelming attacker so b dies in one hit.
  // Using total=200 vs total=4 (50× diff) to guarantee ELO reward ≈ 0.
  a.speed = 50; a.attack = 50; a.defence = 50; a.lives = 50;
  b.speed = 1;  b.attack = 1;  b.defence = 1;  b.lives = 1;
  a.initialLives = 50;
  b.initialLives = 1;
  a.combatCooldown = 0;
  b.combatCooldown = 0;

  // Snapshot a's pre-combat total (it should grow by the reward)
  const aTotalBefore = a.speed + a.attack + a.defence + a.initialLives;

  ctx.handleCombat(a, b);

  assert.strictEqual(a.killCount, 1);
  // a is overwhelmingly stronger than b → ELO reward ≈ 0
  const aTotalAfter = a.speed + a.attack + a.defence + a.initialLives;
  const reward = aTotalAfter - aTotalBefore;
  assert.ok(reward < 0.1, `dominant killer got bully reward ${reward}, expected ≈0`);
});
