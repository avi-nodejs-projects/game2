// Integration tests: multi-bot combat scenarios.
// Scale: 5-10 bots — enough for crowded-field dynamics
// without cognitive overload.

const { test } = require('node:test');
const assert = require('node:assert');
const {
  createTestContext, runSimulation,
  assertAllBotsInBounds, totalStats,
} = require('../helpers');

// ---- Combat chain: one kill, next engagement -----------------

test('combat: two paired kills resolve cleanly over 500 frames', () => {
  const ctx = createTestContext({ seed: 42, botCount: 6, dotCount: 10 });
  // Pair them up as 3 vs 3 along a line
  const positions = [
    [200, 1000], [220, 1000],   // pair 1 adjacent
    [800, 1000], [820, 1000],   // pair 2 adjacent
    [1400, 1000], [1420, 1000], // pair 3 adjacent
  ];
  positions.forEach(([x, y], i) => {
    ctx.bots[i].x = x; ctx.bots[i].y = y;
  });
  runSimulation(ctx, 500);

  assert.strictEqual(ctx.bots.length, 6, 'bot count unchanged (no lifecycle)');
  assertAllBotsInBounds(ctx);
});

// ---- Crowded field: combat does not throw -------------------

test('combat: 10 bots crowded in same area for 300 frames', () => {
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 20 });
  // Cluster all bots near the center
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 1000 + (i - 5) * 15;
    ctx.bots[i].y = 1000;
  }
  runSimulation(ctx, 300);
  assert.strictEqual(ctx.bots.length, 10);
  assertAllBotsInBounds(ctx);
  // At least one bot should have a kill
  const totalKills = ctx.bots.reduce((s, b) => s + b.killCount, 0);
  assert.ok(totalKills > 0, `expected some kills in a crowded fight, got ${totalKills}`);
});

// ---- Stalemate-only combat (all high defence) --------------

test('combat: all-defensive bots use the division-formula path', () => {
  const ctx = createTestContext({ seed: 42, botCount: 6, dotCount: 0 });
  for (const bot of ctx.bots) {
    bot.attack = 2;
    bot.defence = 10; // defence > any opponent's attack → stalemate
    bot.lives = 10;
  }
  // Place bots adjacent so they collide
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 500 + i * 15;
    ctx.bots[i].y = 500;
  }
  runSimulation(ctx, 100);
  // Bots should still be alive (stalemate damages ~0.2 per combat, not enough to kill in 100 frames)
  assert.strictEqual(ctx.bots.length, 6);
});

// ---- Combat awards stat gains consistently ------------------

test('combat: kill victor gets stat increase, loser resets', () => {
  const ctx = createTestContext({ seed: 42, botCount: 2, dotCount: 0 });
  const winner = ctx.bots[0];
  const loser = ctx.bots[1];
  winner.attack = 50; winner.defence = 10; winner.lives = 20;
  loser.attack = 1; loser.defence = 1; loser.lives = 1;
  winner.x = 500; winner.y = 500;
  loser.x = 510; loser.y = 500;
  const winnerStatsBefore = totalStats(winner);
  const winnerKillsBefore = winner.killCount;

  runSimulation(ctx, 10);

  // Winner gained +1 stat and +1 kill
  assert.ok(totalStats(winner) >= winnerStatsBefore + 1);
  assert.ok(winner.killCount > winnerKillsBefore);
  // Loser reset to defaults after death
  assert.strictEqual(loser.speed, 5);
  assert.strictEqual(loser.attack, 5);
  assert.strictEqual(loser.defence, 5);
  assert.strictEqual(loser.lives, 3);
});

// ---- Invincibility prevents early-frame deaths --------------

test('combat: invincibility protects newly-spawned bots for duration', () => {
  const ctx = createTestContext({ seed: 42, botCount: 2, dotCount: 0 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  ctx.lifecycleSettings.respawnInvincibility.duration = 100;
  ctx.lifecycleSettings.respawnInvincibility.canDealDamage = false;
  ctx.lifecycleSettings.respawnInvincibility.breakOnCombatInitiation = false;

  const a = ctx.bots[0];
  const b = ctx.bots[1];
  a.attack = 100; a.defence = 10; a.lives = 10;
  b.attack = 100; b.defence = 10; b.lives = 10;
  a.invincibilityFrames = 100;
  b.invincibilityFrames = 100;
  a.x = 500; a.y = 500;
  b.x = 510; b.y = 500;

  // Run 50 frames (bots still invincible)
  runSimulation(ctx, 50);
  assert.strictEqual(a.lives, 10, 'invincible bots should not take damage');
  assert.strictEqual(b.lives, 10);
});
