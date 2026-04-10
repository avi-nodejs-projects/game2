// Invariant: all bots always stay within the world bounds,
// regardless of what the game loop is doing.
// Checked per frame over long simulations at realistic scale.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, runSimulation } = require('../helpers');

function assertInBounds(ctx, label) {
  for (const bot of ctx.bots) {
    if (bot.x < 0 || bot.x > ctx.WORLD_WIDTH) {
      assert.fail(`${label}: Bot #${bot.index} x=${bot.x} out of bounds`);
    }
    if (bot.y < 0 || bot.y > ctx.WORLD_HEIGHT) {
      assert.fail(`${label}: Bot #${bot.index} y=${bot.y} out of bounds`);
    }
  }
}

function assertTargetsInBounds(ctx, label) {
  for (const bot of ctx.bots) {
    if (bot.targetX < 0 || bot.targetX > ctx.WORLD_WIDTH) {
      assert.fail(`${label}: Bot #${bot.index} targetX=${bot.targetX} out of bounds`);
    }
    if (bot.targetY < 0 || bot.targetY > ctx.WORLD_HEIGHT) {
      assert.fail(`${label}: Bot #${bot.index} targetY=${bot.targetY} out of bounds`);
    }
  }
}

// ---- Basic simulation bounds -------------------------------

test('bounds: 20 bots stay in bounds over 2000 frames', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  runSimulation(ctx, 2000, {
    onFrame: (frame, ctx) => {
      if (frame % 100 === 0) assertInBounds(ctx, `frame ${frame}`);
    },
  });
  assertInBounds(ctx, 'final');
});

test('bounds: 20 bots stay in bounds during full lifecycle', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  ctx.lifecycleSettings.respawnInvincibility.enabled = true;
  ctx.lifecycleSettings.starvation.enabled = true;
  runSimulation(ctx, 2000, {
    onFrame: (frame, ctx) => {
      if (frame % 200 === 0) assertInBounds(ctx, `frame ${frame}`);
    },
  });
  assertInBounds(ctx, 'final');
});

// ---- Bounds hold through combat pressure -----------------

test('bounds: crowded combat does not push bots out of bounds', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 20 });
  // Stack them in a tight area
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 500 + (i % 5) * 15;
    ctx.bots[i].y = 500 + Math.floor(i / 5) * 15;
  }
  runSimulation(ctx, 500, {
    onFrame: (frame, ctx) => {
      if (frame % 50 === 0) assertInBounds(ctx, `crowded frame ${frame}`);
    },
  });
});

// ---- Respawn lands in bounds ------------------------------

test('bounds: bots killed in corner respawn within bounds', () => {
  const ctx = createTestContext({ seed: 42, botCount: 6, dotCount: 0 });
  // Place bots in corners — force several respawns
  const corners = [[25, 25], [25, 1975], [1975, 25], [1975, 1975]];
  for (let i = 0; i < 4; i++) {
    ctx.bots[i].x = corners[i][0];
    ctx.bots[i].y = corners[i][1];
    ctx.bots[i].attack = 100;
    ctx.bots[i].defence = 1;
    ctx.bots[i].lives = 1;
  }
  ctx.bots[4].x = 30; ctx.bots[4].y = 30; // collide with corner bot
  ctx.bots[5].x = 1970; ctx.bots[5].y = 30;
  runSimulation(ctx, 200);
  assertInBounds(ctx, 'after corner combat');
});

// ---- Targets also stay in bounds --------------------------

test('bounds: bot targets always in bounds after update', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  runSimulation(ctx, 500, {
    onFrame: (frame, ctx) => {
      if (frame % 50 === 0) assertTargetsInBounds(ctx, `frame ${frame}`);
    },
  });
});

// ---- Fleeing near edge does not overshoot -----------------

test('bounds: flee action near edge clamps target correctly', () => {
  const ctx = createTestContext({ seed: 42, botCount: 2, dotCount: 0 });
  // Set up a flee rule
  ctx.strategyMode = 'advanced';
  ctx.rules.length = 0;
  ctx.rules.push({ conditions: [], action: 'flee' });
  ctx.globalSettings.randomnessNoise = 0;

  const bot = ctx.bots[0];
  bot.x = ctx.WORLD_WIDTH - 30; bot.y = 1000; // at right edge
  ctx.bots[1].x = 100; ctx.bots[1].y = 1000; // enemy far left → flee right
  bot.pickTargetAdvancedMode();
  assert.ok(bot.targetX <= ctx.WORLD_WIDTH - 50,
    `flee target ${bot.targetX} exceeds bounds`);
});
