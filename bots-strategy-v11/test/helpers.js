// Test helpers — shared fixtures and assertion utilities.
// Built on top of harness.js.

const assert = require('node:assert');
const { createGameContext, resetGameState } = require('./harness');

/**
 * Create a test context with N bots and M dots pre-spawned.
 * Bot 0 is flagged as the player.
 *
 * @param {object} [options]
 * @param {number} [options.seed=42]
 * @param {number} [options.botCount=5]
 * @param {number} [options.dotCount=10]
 * @returns {object} vm context with populated bots/yellowDots
 */
function createTestContext(options = {}) {
  const { seed = 42, botCount = 5, dotCount = 10 } = options;
  const ctx = createGameContext({ seed });

  for (let i = 0; i < dotCount; i++) {
    ctx.yellowDots.push(new ctx.YellowDot());
  }

  for (let i = 0; i < botCount; i++) {
    const bot = new ctx.Bot(i, i === 0);
    ctx.bots.push(bot);
  }
  ctx.playerBot = ctx.bots[0];

  return ctx;
}

/**
 * Run the basic game loop (bot updates + collisions) for N frames.
 * Does NOT run the full lifecycle updates (invincibility, starvation,
 * reproduction, packs) — those are triggered by main.js.runGameUpdate
 * which we don't load. Tests that need those must set up lifecycle
 * settings and call the specific update functions themselves.
 *
 * @param {object} ctx - vm context from createTestContext
 * @param {number} frames - number of frames to run
 */
function runFrames(ctx, frames) {
  for (let i = 0; i < frames; i++) {
    for (const bot of ctx.bots) {
      bot.update();
    }
    ctx.processCollisions();
  }
}

// ---- Assertion helpers --------------------------------------------

/**
 * Assert that a numeric value is approximately equal (within epsilon).
 */
function assertApprox(actual, expected, epsilon = 1e-6, message) {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    assert.fail(
      message ||
      `Expected ${actual} ≈ ${expected} (within ${epsilon}), diff=${diff}`
    );
  }
}

/**
 * Assert that a value is within a range [min, max] inclusive.
 */
function assertInRange(actual, min, max, message) {
  if (actual < min || actual > max) {
    assert.fail(
      message ||
      `Expected ${actual} to be in [${min}, ${max}]`
    );
  }
}

/**
 * Assert that an array contains no duplicates (by identity).
 */
function assertUnique(arr, message) {
  const seen = new Set();
  for (const item of arr) {
    if (seen.has(item)) {
      assert.fail(message || `Duplicate item found: ${item}`);
    }
    seen.add(item);
  }
}

/**
 * Assert that all bots in a context are within world bounds.
 */
function assertAllBotsInBounds(ctx) {
  for (const bot of ctx.bots) {
    if (bot.x < 0 || bot.x > ctx.WORLD_WIDTH) {
      assert.fail(`Bot #${bot.index} x=${bot.x} out of bounds [0,${ctx.WORLD_WIDTH}]`);
    }
    if (bot.y < 0 || bot.y > ctx.WORLD_HEIGHT) {
      assert.fail(`Bot #${bot.index} y=${bot.y} out of bounds [0,${ctx.WORLD_HEIGHT}]`);
    }
  }
}

/**
 * Assert that all bot stats are non-negative (where that invariant holds).
 */
function assertAllStatsNonNegative(ctx) {
  for (const bot of ctx.bots) {
    assert.ok(bot.speed >= 0, `Bot #${bot.index} speed=${bot.speed} negative`);
    assert.ok(bot.attack >= 0, `Bot #${bot.index} attack=${bot.attack} negative`);
    assert.ok(bot.defence >= 0, `Bot #${bot.index} defence=${bot.defence} negative`);
    // lives CAN go negative briefly during combat before death handler fires
  }
}

/**
 * Compute total stats for a bot (sum of speed + attack + defence + lives).
 */
function totalStats(bot) {
  return bot.speed + bot.attack + bot.defence + bot.lives;
}

module.exports = {
  createGameContext,
  createTestContext,
  resetGameState,
  runFrames,
  assertApprox,
  assertInRange,
  assertUnique,
  assertAllBotsInBounds,
  assertAllStatsNonNegative,
  totalStats,
};
