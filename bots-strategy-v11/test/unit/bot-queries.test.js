// Unit tests for Bot query methods — findDotClusters, findSafestDot,
// and deeper coverage of evaluateCombatAdvantage edge cases.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, assertApprox } = require('../helpers');

// ---- findSafestDot -----------------------------------------------

test('findSafestDot: returns null when no dots are safe', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 1 });
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  const dot = ctx.yellowDots[0];
  bot.x = 0; bot.y = 0;
  dot.x = 100; dot.y = 0;
  enemy.x = 110; enemy.y = 0;  // 10u from dot, far from 150u default
  assert.strictEqual(bot.findSafestDot(150), null);
});

test('findSafestDot: returns the one safe dot when only one qualifies', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 2 });
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  const d1 = ctx.yellowDots[0];
  const d2 = ctx.yellowDots[1];

  bot.x = 0; bot.y = 0;
  enemy.x = 500; enemy.y = 0;

  d1.x = 50; d1.y = 0;  // 450u from enemy → safe
  d2.x = 480; d2.y = 0; // 20u from enemy → unsafe

  assert.strictEqual(bot.findSafestDot(150), d1);
});

test('findSafestDot: scores safety minus half distance', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 2 });
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  const d1 = ctx.yellowDots[0];
  const d2 = ctx.yellowDots[1];

  bot.x = 0; bot.y = 0;
  enemy.x = 1000; enemy.y = 0;

  // Both safe, but d1 closer to bot should score higher
  d1.x = 100; d1.y = 0;  // enemy dist 900, me dist 100 → score 900 - 50 = 850
  d2.x = 500; d2.y = 0;  // enemy dist 500, me dist 500 → score 500 - 250 = 250

  assert.strictEqual(bot.findSafestDot(150), d1);
});

test('findSafestDot: uses minEnemyDist threshold correctly', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 1 });
  const bot = ctx.bots[0];
  const enemy = ctx.bots[1];
  const dot = ctx.yellowDots[0];
  bot.x = 0; bot.y = 0;
  dot.x = 100; dot.y = 0;
  enemy.x = 250; enemy.y = 0; // 150u from dot

  // With default 150, the dot is just barely safe (>=)
  assert.strictEqual(bot.findSafestDot(150), dot);
  // With 200, the dot is unsafe
  assert.strictEqual(bot.findSafestDot(200), null);
});

// ---- findDotClusters ----------------------------------------------

test('findDotClusters: returns one cluster when all dots are close together', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  // Push 5 dots within 150u of each other
  for (let i = 0; i < 5; i++) {
    const d = new ctx.YellowDot();
    d.x = 1000 + i * 20;
    d.y = 1000;
    ctx.yellowDots.push(d);
  }
  const clusters = bot.findDotClusters();
  assert.strictEqual(clusters.length, 1);
  assert.strictEqual(clusters[0].dots.length, 5);
});

test('findDotClusters: returns multiple clusters when dots are far apart', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  // Three distant groups
  const positions = [
    [100, 100], [110, 110],             // cluster A
    [1000, 1000], [1010, 1010],         // cluster B
    [1800, 1800],                        // cluster C (single)
  ];
  for (const [x, y] of positions) {
    const d = new ctx.YellowDot();
    d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  }
  const clusters = bot.findDotClusters(150);
  assert.strictEqual(clusters.length, 3);
});

test('findDotClusters: respects custom cluster radius', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const d1 = new ctx.YellowDot(); d1.x = 100; d1.y = 100;
  const d2 = new ctx.YellowDot(); d2.x = 200; d2.y = 100; // 100u away
  ctx.yellowDots.push(d1, d2);

  // Small radius: two separate clusters
  const small = bot.findDotClusters(50);
  assert.strictEqual(small.length, 2);
  // Large radius: one combined cluster
  const large = bot.findDotClusters(200);
  assert.strictEqual(large.length, 1);
});

test('findDotClusters: clusters sorted by value (descending)', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 500; bot.y = 500;

  // Near large cluster: many dots nearby → high value
  for (let i = 0; i < 5; i++) {
    const d = new ctx.YellowDot();
    d.x = 500 + i * 10;
    d.y = 500;
    ctx.yellowDots.push(d);
  }
  // Far small cluster: 1 dot, distant → low value
  const d = new ctx.YellowDot();
  d.x = 1900; d.y = 1900;
  ctx.yellowDots.push(d);

  const clusters = bot.findDotClusters();
  assert.ok(clusters[0].value > clusters[clusters.length - 1].value);
  assert.strictEqual(clusters[0].dots.length, 5);
});

test('findDotClusters: cluster center is average of dot positions', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 0; bot.y = 0;

  const d1 = new ctx.YellowDot(); d1.x = 100; d1.y = 100;
  const d2 = new ctx.YellowDot(); d2.x = 200; d2.y = 200;
  ctx.yellowDots.push(d1, d2);

  const clusters = bot.findDotClusters(200);
  assert.strictEqual(clusters.length, 1);
  assertApprox(clusters[0].centerX, 150, 1e-9);
  assertApprox(clusters[0].centerY, 150, 1e-9);
});

test('findDotClusters: single-dot clusters have size 1', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const d = new ctx.YellowDot(); d.x = 500; d.y = 500;
  ctx.yellowDots.push(d);
  const clusters = bot.findDotClusters();
  assert.strictEqual(clusters.length, 1);
  assert.strictEqual(clusters[0].size, 1);
});

test('findDotClusters: empty dot array returns empty list', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const clusters = bot.findDotClusters();
  assert.strictEqual(clusters.length, 0);
});

// ---- evaluateCombatAdvantage: edge cases --------------------------

test('evaluateCombatAdvantage: uses division formula when both defences dominate', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  // Both have def > opponent attack → stalemate → division formula
  a.attack = 2; a.defence = 10; a.lives = 10;
  b.attack = 2; b.defence = 10; b.lives = 10;
  // With matched stats, advantage should be 0
  assertApprox(a.evaluateCombatAdvantage(b), 0, 1e-9);
});

test('evaluateCombatAdvantage: higher lives advantage survives more hits', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.attack = 5; a.defence = 2; a.lives = 20;
  b.attack = 5; b.defence = 2; b.lives = 2;
  assert.ok(a.evaluateCombatAdvantage(b) > 0);
});

test('evaluateCombatAdvantage: asymmetric — higher attack wins stalemate', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0];
  const b = ctx.bots[1];
  // Both have defence > attack → stalemate path
  a.attack = 4; a.defence = 10; a.lives = 10;
  b.attack = 2; b.defence = 10; b.lives = 10;
  // a deals more damage via division (4/10 = 0.4 > 2/10 = 0.2)
  assert.ok(a.evaluateCombatAdvantage(b) > 0);
});

// ---- countNearbyEnemies edge cases --------------------------------

test('countNearbyEnemies: zero radius sees no one', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 100; ctx.bots[1].y = 100;
  // Even at same position, radius 0 means strictly less than 0 — nothing
  assert.strictEqual(bot.countNearbyEnemies(0), 0);
});

test('countNearbyEnemies: large radius catches everyone', () => {
  const ctx = createTestContext({ botCount: 5, dotCount: 0 });
  const bot = ctx.bots[0];
  assert.strictEqual(bot.countNearbyEnemies(99999), 4);
});

test('countNearbyEnemies: excludes self', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  // No other bots matter — self is excluded
  ctx.bots[1].x = 100; ctx.bots[1].y = 100; // right on top
  ctx.bots[2].x = 100; ctx.bots[2].y = 100; // right on top
  assert.strictEqual(bot.countNearbyEnemies(1), 2);
});
