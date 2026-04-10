// Test helpers — shared fixtures and assertion utilities.
// Built on top of harness.js.

const assert = require('node:assert');
const { createGameContext, resetGameState } = require('./harness');

// Default seed: respect TEST_SEED env var (set by run.js --seed) so
// that tests using this helper are deterministic by default. Falls
// back to 42 if not set. Callers can still override via options.seed.
const DEFAULT_SEED = process.env.TEST_SEED
  ? parseInt(process.env.TEST_SEED, 10)
  : 42;

/**
 * Create a test context with N bots and M dots pre-spawned.
 * Bot 0 is flagged as the player.
 *
 * @param {object} [options]
 * @param {number} [options.seed] - defaults to TEST_SEED env var or 42
 * @param {number} [options.botCount=5]
 * @param {number} [options.dotCount=10]
 * @returns {object} vm context with populated bots/yellowDots
 */
function createTestContext(options = {}) {
  const { seed = DEFAULT_SEED, botCount = 5, dotCount = 10 } = options;
  const ctx = createGameContext({ seed });

  for (let i = 0; i < dotCount; i++) {
    ctx.yellowDots.push(new ctx.YellowDot());
  }

  for (let i = 0; i < botCount; i++) {
    const bot = new ctx.Bot(i, i === 0);
    ctx.bots.push(bot);
  }
  ctx.playerBot = ctx.bots[0];

  // Advance the monotonic index counter past the initial bots so
  // reproduction offspring get unique indices. This mirrors
  // main.js:startGame(): `nextBotIndex = BOT_COUNT;`
  ctx.nextBotIndex = botCount;

  return ctx;
}

/**
 * Run the basic game loop (collisions + bot updates) for N frames.
 * Does NOT run the full lifecycle updates (invincibility, starvation,
 * reproduction, packs) — use `runSimulation` for those.
 *
 * Order matches main.js:runGameUpdate: processCollisions first, then
 * bot.update() for each bot. Frame index is NOT bumped (frameCount
 * stays stable for unit tests that check timing-sensitive code like
 * re-evaluation timers).
 *
 * @param {object} ctx - vm context from createTestContext
 * @param {number} frames - number of frames to run
 */
function runFrames(ctx, frames) {
  for (let i = 0; i < frames; i++) {
    ctx.processCollisions();
    for (const bot of ctx.bots) {
      bot.update();
    }
  }
}

/**
 * Run the full game loop for N frames — mirrors main.js:runGameUpdate()
 * exactly. Increments frameCount, runs all enabled lifecycle ticks
 * (invincibility/starvation/age/protections/reproduction/packs/corpses),
 * then processCollisions, then bot.update for every bot.
 *
 * Use this for integration/invariants/simulation tests that need
 * realistic behavior over time. Unit tests can continue to use
 * runFrames if they only need bot movement + collisions.
 *
 * @param {object} ctx - vm context from createTestContext
 * @param {number} frames - number of frames to run
 * @param {object} [options]
 * @param {function} [options.onFrame] - optional callback(frameNum, ctx) per frame
 */
function runSimulation(ctx, frames, options = {}) {
  const onFrame = options.onFrame;
  const ls = ctx.lifecycleSettings;

  for (let i = 0; i < frames; i++) {
    ctx.frameCount++;

    // Invincibility
    if (ls.respawnInvincibility.enabled) {
      for (const bot of ctx.bots) {
        ctx.updateInvincibility(bot);
      }
    }

    // Starvation (iterate in reverse so death removals don't skip bots)
    if (ls.starvation.enabled) {
      for (let j = ctx.bots.length - 1; j >= 0; j--) {
        const bot = ctx.bots[j];
        const result = ctx.updateStarvation(bot);
        if (result === 'death') ctx.handleStarvationDeath(bot);
      }
    }

    // Age
    if (ls.age.enabled) {
      for (let j = ctx.bots.length - 1; j >= 0; j--) {
        const bot = ctx.bots[j];
        const result = ctx.updateAge(bot);
        if (result === 'death') ctx.handleAgeDeath(bot);
      }
    }

    // Protection cleanup
    if (typeof ctx.updateProtections === 'function') {
      ctx.updateProtections();
    }

    // Reproduction cooldowns
    if (typeof ctx.updateReproductionCooldowns === 'function') {
      ctx.updateReproductionCooldowns();
    }

    // Asexual reproduction check
    if (ls.reproduction.asexual.enabled) {
      ctx.checkAsexualReproduction();
    }

    // Sexual reproduction mating progress
    if (ls.reproduction.sexual.enabled) {
      ctx.updateAllMatingProgress();
    }

    // Pack formation / updates (every 60 frames, matching main.js)
    if (ls.packs.enabled && ctx.frameCount % 60 === 0) {
      ctx.evaluatePackFormation();
      ctx.updatePacks();
    }

    // Corpse expiry
    if (ls.age.enabled) {
      ctx.updateCorpses();
    }

    // Collisions + bot updates (same order as main.js)
    ctx.processCollisions();
    for (const bot of ctx.bots) {
      bot.update();
    }

    if (onFrame) onFrame(ctx.frameCount, ctx);
  }
}

/**
 * Snapshot the simulation state for determinism comparisons.
 * Captures every mutable field that affects either the bot's
 * observable behavior OR the next decision cycle. Two snapshots
 * that are byte-identical imply the simulation will produce
 * identical next-frame results.
 *
 * What is NOT captured (intentional):
 *   - Diagnostic fields (_stuckFrames, _stuckLogged, _lastX/_lastY)
 *   - lastDecisionInfo (free-form object, only used for debug display)
 *   - npcStrategy metadata (set at construction, effectively immutable)
 */
function snapshotState(ctx) {
  return {
    frameCount: ctx.frameCount,
    nextBotIndex: ctx.nextBotIndex,
    dots: ctx.yellowDots.map(d => ({ x: d.x, y: d.y })),
    corpses: (ctx.corpses || []).map(c => ({
      x: c.x, y: c.y, originalBotIndex: c.originalBotIndex,
      createdAtFrame: c.createdAtFrame, nutritionValue: c.nutritionValue,
    })),
    packs: ctx.packs ? Array.from(ctx.packs.entries()).map(([id, pack]) => ({
      id, founderId: pack.founderId, leaderId: pack.leaderId,
      members: Array.from(pack.members).sort((a, b) => a - b),
      formedAtFrame: pack.formedAtFrame,
    })) : [],
    protectionPairs: ctx.protectionPairs
      ? Array.from(ctx.protectionPairs.entries()).sort().map(([k, v]) => [k, v])
      : [],
    bots: ctx.bots.map(b => ({
      index: b.index,
      // Position & movement
      x: b.x, y: b.y,
      targetX: b.targetX, targetY: b.targetY,
      angle: b.angle,
      idleTime: b.idleTime, maxIdle: b.maxIdle,
      _reEvalTimer: b._reEvalTimer || 0,
      // Stats
      speed: b.speed, attack: b.attack, defence: b.defence, lives: b.lives,
      initialLives: b.initialLives,
      // Combat / damage
      combatCooldown: b.combatCooldown,
      justTookDamage: !!b.justTookDamage,
      justDealtDamage: !!b.justDealtDamage,
      damageTimer: b.damageTimer || 0,
      damageDealtTimer: b.damageDealtTimer || 0,
      lastAttackerIndex: b.lastAttacker ? b.lastAttacker.index : null,
      frameLastTookDamage: b.frameLastTookDamage || 0,
      killCount: b.killCount,
      // Lifecycle
      lifetime: b.lifetime,
      age: b.age || 0,
      invincibilityFrames: b.invincibilityFrames || 0,
      starvationCounter: b.starvationCounter || 0,
      isStarving: !!b.isStarving,
      starvationTickCounter: b.starvationTickCounter || 0,
      speedBoostFrames: b.speedBoostFrames || 0,
      // Reproduction / lineage
      reproductionCooldown: b.reproductionCooldown || 0,
      offspringCount: b.offspringCount || 0,
      generation: b.generation || 0,
      isPlayerOffspring: !!b.isPlayerOffspring,
      playerLineage: b.playerLineage || 0,
      // Relationships
      parentId: b.relationships ? b.relationships.parentId : null,
      childIds: b.relationships ? [...b.relationships.childIds].sort((a, b) => a - b) : [],
      packId: b.relationships ? b.relationships.packId : null,
      // AI state
      lastAction: b.lastAction || '',
      currentFSMState: b.currentFSMState || '',
      // Visual (affects nothing mechanically but should match)
      hue: b.hue,
    })),
  };
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

/**
 * Deep-compare two snapshots field by field. Returns a string
 * describing the first mismatch, or null if the snapshots match.
 *
 * Handles primitives, arrays (by length and element equality), and
 * nested objects (by recursive key comparison). Does NOT handle
 * cyclic references — not needed for snapshots.
 */
function findSnapshotMismatch(a, b, path = '') {
  // Primitive + null/undefined comparison
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) return `${path || 'root'}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
    return null;
  }

  // Array comparison
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) {
    return `${path}: array/non-array type mismatch`;
  }
  if (aIsArr) {
    if (a.length !== b.length) {
      return `${path}.length: ${a.length} vs ${b.length}`;
    }
    for (let i = 0; i < a.length; i++) {
      const child = findSnapshotMismatch(a[i], b[i], `${path}[${i}]`);
      if (child) return child;
    }
    return null;
  }

  // Object comparison — iterate union of keys to catch missing keys
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return `${path}: key count ${aKeys.length} vs ${bKeys.length}`;
  }
  for (const key of aKeys) {
    if (!(key in b)) {
      return `${path}.${key}: missing in second snapshot`;
    }
    const child = findSnapshotMismatch(a[key], b[key], path ? `${path}.${key}` : key);
    if (child) return child;
  }
  return null;
}

module.exports = {
  createGameContext,
  createTestContext,
  resetGameState,
  runFrames,
  runSimulation,
  snapshotState,
  findSnapshotMismatch,
  assertApprox,
  assertInRange,
  assertUnique,
  assertAllBotsInBounds,
  assertAllStatsNonNegative,
  totalStats,
};
