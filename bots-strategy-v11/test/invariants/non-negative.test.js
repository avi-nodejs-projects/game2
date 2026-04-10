// Invariant: stats should never be persistently negative.
// Lives CAN go transiently negative during combat before the death
// handler fires within the same frame, but by end-of-frame the
// dead bot has been reset. speed/attack/defence never go below 0.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, runSimulation } = require('../helpers');

function assertStatsSane(ctx, label) {
  for (const bot of ctx.bots) {
    // speed, attack, defence: never negative
    assert.ok(bot.speed >= 0, `${label}: Bot #${bot.index} speed=${bot.speed}`);
    assert.ok(bot.attack >= 0, `${label}: Bot #${bot.index} attack=${bot.attack}`);
    assert.ok(bot.defence >= 0, `${label}: Bot #${bot.index} defence=${bot.defence}`);
    // lives: after death handler fires, they should be >= 0
    assert.ok(bot.lives >= 0, `${label}: Bot #${bot.index} lives=${bot.lives}`);
    // Numeric integrity
    assert.ok(Number.isFinite(bot.speed), `${label}: Bot #${bot.index} speed not finite`);
    assert.ok(Number.isFinite(bot.attack), `${label}: Bot #${bot.index} attack not finite`);
    assert.ok(Number.isFinite(bot.defence), `${label}: Bot #${bot.index} defence not finite`);
    assert.ok(Number.isFinite(bot.lives), `${label}: Bot #${bot.index} lives not finite`);
  }
}

// ---- Stats sane under basic play --------------------------

test('non-negative: 20-bot sim for 2000 frames keeps all stats >= 0', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  runSimulation(ctx, 2000, {
    onFrame: (frame, ctx) => {
      if (frame % 100 === 0) assertStatsSane(ctx, `frame ${frame}`);
    },
  });
  assertStatsSane(ctx, 'final');
});

// ---- Stats sane under heavy combat ------------------------

test('non-negative: crowded lethal combat keeps stats sane', () => {
  const ctx = createTestContext({ seed: 42, botCount: 15, dotCount: 20 });
  // Make them all stat-advantaged so kills happen often
  for (const bot of ctx.bots) {
    bot.attack = 20;
    bot.defence = 3;
    bot.lives = 5;
  }
  // Cluster them
  for (let i = 0; i < ctx.bots.length; i++) {
    ctx.bots[i].x = 500 + (i % 4) * 15;
    ctx.bots[i].y = 500 + Math.floor(i / 4) * 15;
  }
  runSimulation(ctx, 500, {
    onFrame: (frame, ctx) => {
      if (frame % 50 === 0) assertStatsSane(ctx, `combat frame ${frame}`);
    },
  });
});

// ---- Stats sane under starvation -------------------------

test('non-negative: prolonged starvation + recovery keeps stats sane', () => {
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 5 });
  ctx.lifecycleSettings.starvation.enabled = true;
  ctx.lifecycleSettings.starvation.statDecay.enabled = true;
  ctx.lifecycleSettings.starvation.inactivityThreshold = 60;
  ctx.lifecycleSettings.starvation.damagePerTick = 0.5;
  ctx.lifecycleSettings.starvation.resetConditions.onDotEaten = true;

  runSimulation(ctx, 1000, {
    onFrame: (frame, ctx) => {
      if (frame % 100 === 0) assertStatsSane(ctx, `starvation frame ${frame}`);
    },
  });
});

// ---- Stats sane under reproduction -----------------------

test('non-negative: asexual reproduction keeps offspring stats sane', () => {
  const ctx = createTestContext({ seed: 42, botCount: 5, dotCount: 20 });
  ctx.lifecycleSettings.reproduction.asexual.enabled = true;
  ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 50;
  ctx.lifecycleSettings.reproduction.asexual.cooldown = 100;
  ctx.lifecycleSettings.reproduction.asexual.statNoise = 0.3; // high noise

  runSimulation(ctx, 500, {
    onFrame: (frame, ctx) => {
      if (frame % 50 === 0) assertStatsSane(ctx, `repro frame ${frame}`);
    },
  });
});

// ---- Combat cooldown never negative -----------------------

test('non-negative: combatCooldown never goes negative', () => {
  const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 30 });
  runSimulation(ctx, 1000, {
    onFrame: (frame, ctx) => {
      if (frame % 100 === 0) {
        for (const bot of ctx.bots) {
          assert.ok(bot.combatCooldown >= 0,
            `frame ${frame}: Bot #${bot.index} cooldown=${bot.combatCooldown}`);
        }
      }
    },
  });
});

// ---- No NaN anywhere -------------------------------------

test('non-negative: no NaN in stats, positions, or angles', () => {
  const ctx = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  runSimulation(ctx, 1000, {
    onFrame: (frame, ctx) => {
      if (frame % 100 === 0) {
        for (const bot of ctx.bots) {
          assert.ok(!Number.isNaN(bot.x), `Bot #${bot.index} x is NaN`);
          assert.ok(!Number.isNaN(bot.y), `Bot #${bot.index} y is NaN`);
          assert.ok(!Number.isNaN(bot.angle), `Bot #${bot.index} angle is NaN`);
          assert.ok(!Number.isNaN(bot.lives), `Bot #${bot.index} lives is NaN`);
        }
      }
    },
  });
});
