// Unit tests for Bot class core behavior (game.js).
// This is the first test file — it also serves as a smoke test
// that the harness, RNG, and helpers all work end-to-end.

const { test } = require('node:test');
const assert = require('node:assert');
const {
  createGameContext,
  createTestContext,
  assertApprox,
  assertInRange,
  totalStats,
} = require('../helpers');

// ---- Harness sanity -----------------------------------------------

test('harness loads without errors', () => {
  const ctx = createGameContext({ seed: 42 });
  assert.strictEqual(typeof ctx.Bot, 'function', 'Bot class should be exposed');
  assert.strictEqual(typeof ctx.YellowDot, 'function', 'YellowDot class should be exposed');
  assert.strictEqual(typeof ctx.handleCombat, 'function', 'handleCombat should be exposed');
  assert.strictEqual(typeof ctx.processCollisions, 'function', 'processCollisions should be exposed');
});

test('harness exposes config constants', () => {
  const ctx = createGameContext({ seed: 42 });
  assert.strictEqual(ctx.WORLD_WIDTH, 2000);
  assert.strictEqual(ctx.WORLD_HEIGHT, 2000);
  assert.strictEqual(ctx.BOT_COUNT, 20);
  assert.strictEqual(ctx.DOT_COUNT, 50);
  // Compare fields individually because cross-vm-context objects don't
  // share Object.prototype and deepStrictEqual rejects them even when
  // values are identical.
  assert.strictEqual(ctx.STARTING_STATS.speed, 5);
  assert.strictEqual(ctx.STARTING_STATS.attack, 5);
  assert.strictEqual(ctx.STARTING_STATS.defence, 5);
  assert.strictEqual(ctx.STARTING_STATS.lives, 3);
});

test('harness exposes strategy defs', () => {
  const ctx = createGameContext({ seed: 42 });
  assert.ok(ctx.BEHAVIORS, 'BEHAVIORS should exist');
  assert.ok(ctx.BEHAVIORS.gatherer, 'gatherer behavior should exist');
  assert.ok(ctx.BEHAVIORS.hunter, 'hunter behavior should exist');
  assert.ok(ctx.BEHAVIORS.survivor, 'survivor behavior should exist');
});

test('seeded RNG produces deterministic bot positions', () => {
  const ctx1 = createGameContext({ seed: 42 });
  const ctx2 = createGameContext({ seed: 42 });
  const b1 = new ctx1.Bot(0, false);
  const b2 = new ctx2.Bot(0, false);
  assert.strictEqual(b1.x, b2.x, 'x should match');
  assert.strictEqual(b1.y, b2.y, 'y should match');
  assert.strictEqual(b1.hue, b2.hue, 'hue should match');
});

test('different seeds produce different bot positions', () => {
  const ctx1 = createGameContext({ seed: 42 });
  const ctx2 = createGameContext({ seed: 999 });
  const b1 = new ctx1.Bot(0, false);
  const b2 = new ctx2.Bot(0, false);
  assert.notStrictEqual(
    `${b1.x},${b1.y},${b1.hue}`,
    `${b2.x},${b2.y},${b2.hue}`,
  );
});

// ---- Bot constructor ----------------------------------------------

test('Bot constructor: player bot has expected defaults', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(0, true);
  assert.strictEqual(bot.index, 0);
  assert.strictEqual(bot.isPlayer, true);
  assert.strictEqual(bot.speed, 5);
  assert.strictEqual(bot.attack, 5);
  assert.strictEqual(bot.defence, 5);
  assert.strictEqual(bot.lives, 3);
  assert.strictEqual(bot.initialLives, 3);
  assert.strictEqual(bot.killCount, 0);
  assert.strictEqual(bot.combatCooldown, 0);
  assert.strictEqual(bot.hue, 200, 'player bot has blue hue 200');
});

test('Bot constructor: NPC bot gets random hue', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(1, false);
  assertInRange(bot.hue, 0, 360);
  assert.notStrictEqual(bot.hue, 200, 'NPC hue should not equal player blue');
});

test('Bot constructor: spawns within world bounds', () => {
  const ctx = createGameContext({ seed: 42 });
  for (let i = 0; i < 20; i++) {
    const bot = new ctx.Bot(i, false);
    assertInRange(bot.x, 20, ctx.WORLD_WIDTH - 20);
    assertInRange(bot.y, 20, ctx.WORLD_HEIGHT - 20);
  }
});

// ---- distanceTo ---------------------------------------------------

test('Bot.distanceTo: euclidean distance 3-4-5', () => {
  const ctx = createGameContext({ seed: 42 });
  const a = new ctx.Bot(0, false);
  const b = new ctx.Bot(1, false);
  a.x = 0; a.y = 0;
  b.x = 3; b.y = 4;
  assert.strictEqual(a.distanceTo(b), 5);
});

test('Bot.distanceTo: zero distance for coincident bots', () => {
  const ctx = createGameContext({ seed: 42 });
  const a = new ctx.Bot(0, false);
  const b = new ctx.Bot(1, false);
  a.x = 100; a.y = 100;
  b.x = 100; b.y = 100;
  assert.strictEqual(a.distanceTo(b), 0);
});

test('Bot.distanceTo: null target returns Infinity', () => {
  const ctx = createGameContext({ seed: 42 });
  const a = new ctx.Bot(0, false);
  assert.strictEqual(a.distanceTo(null), Infinity);
});

// ---- findNearestDot / findNearestBot ------------------------------

test('Bot.findNearestDot: returns closest by distance', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(0, false);
  bot.x = 100; bot.y = 100;

  const d1 = new ctx.YellowDot();
  d1.x = 150; d1.y = 100;  // dist 50
  const d2 = new ctx.YellowDot();
  d2.x = 500; d2.y = 500;  // dist ~566
  const d3 = new ctx.YellowDot();
  d3.x = 110; d3.y = 110;  // dist ~14.14
  ctx.yellowDots.push(d1, d2, d3);

  const { dot, dist } = bot.findNearestDot();
  assert.strictEqual(dot, d3, 'should return closest dot');
  assertApprox(dist, Math.sqrt(200), 1e-6);
});

test('Bot.findNearestDot: empty dots returns null, Infinity', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(0, false);
  const { dot, dist } = bot.findNearestDot();
  assert.strictEqual(dot, null);
  assert.strictEqual(dist, Infinity);
});

test('Bot.findNearestBot: excludes self, returns closest other', () => {
  const ctx = createGameContext({ seed: 42 });
  const b0 = new ctx.Bot(0, false);
  b0.x = 0; b0.y = 0;
  const b1 = new ctx.Bot(1, false);
  b1.x = 100; b1.y = 0;
  const b2 = new ctx.Bot(2, false);
  b2.x = 50; b2.y = 0;   // closest
  ctx.bots.push(b0, b1, b2);

  const { bot, dist } = b0.findNearestBot();
  assert.strictEqual(bot, b2);
  assert.strictEqual(dist, 50);
});

test('Bot.findWeakestBot: returns bot with fewest lives', () => {
  const ctx = createGameContext({ seed: 42 });
  const b0 = new ctx.Bot(0, false);
  const b1 = new ctx.Bot(1, false); b1.lives = 1;
  const b2 = new ctx.Bot(2, false); b2.lives = 10;
  ctx.bots.push(b0, b1, b2);
  const weakest = b0.findWeakestBot();
  assert.strictEqual(weakest, b1);
});

test('Bot.countNearbyEnemies: counts bots within radius', () => {
  const ctx = createGameContext({ seed: 42 });
  const b0 = new ctx.Bot(0, false);
  b0.x = 0; b0.y = 0;
  const b1 = new ctx.Bot(1, false); b1.x = 100; b1.y = 0;   // in range
  const b2 = new ctx.Bot(2, false); b2.x = 199; b2.y = 0;   // in range (< 200)
  const b3 = new ctx.Bot(3, false); b3.x = 300; b3.y = 0;   // out
  ctx.bots.push(b0, b1, b2, b3);

  assert.strictEqual(b0.countNearbyEnemies(200), 2);
  assert.strictEqual(b0.countNearbyEnemies(150), 1);
  assert.strictEqual(b0.countNearbyEnemies(50), 0);
});

// ---- evaluateCombatAdvantage --------------------------------------

test('evaluateCombatAdvantage: stronger bot has positive advantage', () => {
  const ctx = createGameContext({ seed: 42 });
  const strong = new ctx.Bot(0, false);
  strong.attack = 10; strong.defence = 10; strong.lives = 10;
  const weak = new ctx.Bot(1, false);
  weak.attack = 2; weak.defence = 2; weak.lives = 2;
  assert.ok(strong.evaluateCombatAdvantage(weak) > 0);
});

test('evaluateCombatAdvantage: weaker bot has negative advantage', () => {
  const ctx = createGameContext({ seed: 42 });
  const weak = new ctx.Bot(0, false);
  weak.attack = 2; weak.defence = 2; weak.lives = 2;
  const strong = new ctx.Bot(1, false);
  strong.attack = 10; strong.defence = 10; strong.lives = 10;
  assert.ok(weak.evaluateCombatAdvantage(strong) < 0);
});

test('evaluateCombatAdvantage: mirror match has zero advantage', () => {
  const ctx = createGameContext({ seed: 42 });
  const a = new ctx.Bot(0, false);
  a.attack = 5; a.defence = 5; a.lives = 5;
  const b = new ctx.Bot(1, false);
  b.attack = 5; b.defence = 5; b.lives = 5;
  assertApprox(a.evaluateCombatAdvantage(b), 0, 1e-9);
});

// ---- Stat mutations -----------------------------------------------

test('Bot.addRandomStat: increments exactly one stat by 1', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(0, false);
  const before = totalStats(bot);
  bot.addRandomStat();
  const after = totalStats(bot);
  assert.strictEqual(after - before, 1);
});

test('Bot.addPartialRandomStat: increments one stat by 0.1', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(0, false);
  const before = totalStats(bot);
  bot.addPartialRandomStat();
  const after = totalStats(bot);
  assertApprox(after - before, 0.1, 1e-9);
});

test('Bot.resetStats: restores initial values for NPC', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(1, false);
  bot.speed = 99; bot.attack = 99; bot.defence = 99; bot.lives = 99;
  bot.resetStats();
  assert.strictEqual(bot.speed, 5);
  assert.strictEqual(bot.attack, 5);
  assert.strictEqual(bot.defence, 5);
  assert.strictEqual(bot.lives, 3);
});

// ---- Spawning -----------------------------------------------------

test('Bot.spawnAtRandom: keeps bot in bounds over many iterations', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(0, false);
  for (let i = 0; i < 100; i++) {
    bot.spawnAtRandom();
    assertInRange(bot.x, 20, ctx.WORLD_WIDTH - 20);
    assertInRange(bot.y, 20, ctx.WORLD_HEIGHT - 20);
  }
});

test('Bot.spawnAtRandom: sets a target different from position', () => {
  const ctx = createGameContext({ seed: 42 });
  const bot = new ctx.Bot(0, false);
  bot.spawnAtRandom();
  // Target should be defined
  assert.ok(typeof bot.targetX === 'number');
  assert.ok(typeof bot.targetY === 'number');
  assertInRange(bot.targetX, 100, ctx.WORLD_WIDTH - 100);
  assertInRange(bot.targetY, 100, ctx.WORLD_HEIGHT - 100);
});

// ---- YellowDot ----------------------------------------------------

test('YellowDot.respawn: produces position within bounds', () => {
  const ctx = createGameContext({ seed: 42 });
  const dot = new ctx.YellowDot();
  for (let i = 0; i < 100; i++) {
    dot.respawn();
    assertInRange(dot.x, 50, ctx.WORLD_WIDTH - 50);
    assertInRange(dot.y, 50, ctx.WORLD_HEIGHT - 50);
  }
});

// ---- createTestContext fixture ------------------------------------

test('createTestContext: populates bots and dots as requested', () => {
  const ctx = createTestContext({ seed: 42, botCount: 8, dotCount: 15 });
  assert.strictEqual(ctx.bots.length, 8);
  assert.strictEqual(ctx.yellowDots.length, 15);
  assert.strictEqual(ctx.playerBot, ctx.bots[0]);
  assert.strictEqual(ctx.bots[0].isPlayer, true);
  for (let i = 1; i < ctx.bots.length; i++) {
    assert.strictEqual(ctx.bots[i].isPlayer, false);
  }
});
