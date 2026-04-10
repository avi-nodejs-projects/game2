// Bots v11 Test Harness
// ---------------------------------------------------------------
// Loads the pure-logic layer of v11 into a Node `vm` context so
// the game engine can be tested without a browser or canvas.
//
// Zero changes to v11 source files. We stub just enough of the DOM
// that files which *might* touch it at load time don't crash.
// Globals normally declared in main.js (bots, yellowDots, camera,
// playerBot, simulationRunning, etc.) are pre-populated on the
// context so combat.js and related functions can reference them.
//
// Math.random can be overridden with a seeded mulberry32 PRNG so
// tests that rely on randomness are deterministic.
//
// IMPORTANT: `const`, `let`, and `class` declarations do NOT become
// properties of the vm global object (unlike `var`/`function`). To
// work around this without touching v11 source, we:
//   1. Concatenate all model files into a single script
//   2. Append an epilogue that assigns each top-level binding to
//      `this.X = X` (where `this` is the vm global object)
//   3. Run the whole thing in ONE vm.runInContext call
// This keeps the lexical bindings visible to the epilogue.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { mulberry32 } = require('./rng');

const V11_JS = path.join(__dirname, '..', 'js');

// Model-layer files in dependency order. NOT included: main.js
// (DOM init), bot-render.js (canvas), debug.js (DOM), ui-*.js
// (DOM), billboards.js (canvas).
const MODEL_FILES = [
  'config.js',
  'log.js',
  'game.js',
  'bot-ai.js',
  'lifecycle.js',
  'reproduction.js',
  'relationships.js',
  'packs.js',
  'corpse.js',
  'combat.js',
];

// Top-level const/let/class bindings that need to be exposed to the
// vm global object. Function declarations are auto-exposed. This
// list must be kept in sync if new top-level bindings are added in
// v11 model files.
//
// Primitive `let` bindings (frameCount, decisionCount, strategyMode,
// etc.) are exposed via Object.defineProperty getter/setter pairs
// that close over the lexical binding. This makes `ctx.frameCount`
// a LIVE view of the binding: reads return the current value, and
// writes mutate the actual let variable. Object bindings use the
// same mechanism for consistency; their contents propagate
// naturally via reference.
const LEXICAL_BINDINGS_TO_EXPOSE = [
  // config.js constants
  'WORLD_WIDTH', 'WORLD_HEIGHT', 'BOT_COUNT', 'DOT_COUNT',
  'STARTING_STATS', 'TOTAL_POINTS', 'MIN_STAT',
  'DEFAULT_PLAYER_STATS', 'DEFAULT_GLOBAL_SETTINGS',
  'DEFAULT_SIMULATION_SETTINGS', 'DEFAULT_NPC_SETTINGS',
  'combatSettings', 'DEFAULT_COMBAT_SETTINGS',
  'NPC_STRATEGY_TEMPLATES',
  // config.js mutable state
  'playerStats', 'preferredBonusStat', 'strategyMode', 'nextBotIndex',
  'globalSettings', 'debugMode', 'showTargetLine', 'showContextValues',
  'lastDecisionInfo', 'simulationSettings', 'npcSettings',
  'simulationLog', 'decisionCount', 'simulationRunning',
  'simulationPaused', 'frameCount', 'simulationSpeed',
  // config.js behavior/strategy/rule/FSM definitions
  'BEHAVIORS', 'behaviorWeights', 'SUBJECTS', 'OPERATORS', 'ACTIONS',
  'RULE_TEMPLATES', 'CONDITION_PRESETS', 'rules', 'DEFAULT_RULES',
  'states', 'transitions', 'DEFAULT_STATES', 'DEFAULT_TRANSITIONS',
  'STATE_ACTIONS', 'currentStateId', 'selectedState', 'selectedTool',
  'transitionStart',
  // config.js lifecycle / billboards
  'lifecycleSettings', 'billboardSettings', 'DEFAULT_BILLBOARD_SETTINGS',
  // config.js game-wide collections
  'corpses', 'packs', 'nextPackId', 'protectionPairs',
  // game.js classes
  'YellowDot', 'Bot',
  // bot-ai.js internal caches (exposed for test control)
  '_ctxGlobalCache', '_ctxGlobalCacheFrame',
  // corpse.js class
  'Corpse',
];

// ---- DOM stubs ----------------------------------------------------

function makeEmptyEl() {
  return {
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    removeChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getContext() { return null; },
    style: {},
    classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; },
    },
    dataset: {},
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    children: [],
    parentNode: null,
  };
}

function stubDocument() {
  const el = makeEmptyEl();
  return {
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeEmptyEl(); },
    addEventListener() {},
    removeEventListener() {},
    body: el,
    documentElement: el,
    head: el,
  };
}

// ---- Seeded Math wrapper ------------------------------------------

// Build a Math-like object whose `random` is our seeded PRNG while
// every other method/constant delegates to the host Math.
function createSeededMath(seed) {
  const rng = mulberry32(seed);
  const wrapper = {};
  for (const key of Object.getOwnPropertyNames(Math)) {
    if (key === 'random') continue;
    const val = Math[key];
    wrapper[key] = typeof val === 'function' ? val.bind(Math) : val;
  }
  wrapper.random = rng;
  return wrapper;
}

// ---- Context creation ---------------------------------------------

/**
 * Build the combined script that loads all model files and exposes
 * their top-level bindings to the vm global object.
 */
function buildCombinedScript() {
  const parts = [];

  for (const file of MODEL_FILES) {
    const filepath = path.join(V11_JS, file);
    let src;
    try {
      src = fs.readFileSync(filepath, 'utf8');
    } catch (err) {
      throw new Error(`Harness: could not read ${file}: ${err.message}`);
    }
    parts.push(`// ===== BEGIN ${file} =====`);
    parts.push(src);
    parts.push(`// ===== END ${file} =====`);
  }

  // Epilogue — expose lexical bindings to the global object via
  // live getter/setter properties. The getter/setter close over the
  // lexical binding, so `ctx.X` reads always return the current
  // value and `ctx.X = v` mutates the actual binding. This is
  // essential for primitive `let` bindings (frameCount, etc.); for
  // objects it's consistent and cheap.
  //
  // Each defineProperty is guarded because not every binding may
  // be defined (the list is a superset across files).
  parts.push('// ===== EPILOGUE: expose bindings to vm global =====');
  for (const name of LEXICAL_BINDINGS_TO_EXPOSE) {
    parts.push(
      `try { Object.defineProperty(this, ${JSON.stringify(name)}, {` +
      ` get: function() { return ${name}; },` +
      ` set: function(_v) { ${name} = _v; },` +
      ` configurable: true, enumerable: true });` +
      ` } catch (e) {}`
    );
  }

  return parts.join('\n');
}

// Wrap console to silently drop noisy diagnostics. v11's bot.update()
// emits a "STUCK BOT DETECTED" warning when a bot is stationary for
// 120+ frames, followed by ~13 console.log lines showing position,
// target, stats, etc. All are useful browser diagnostics but pure
// noise in long simulation tests.
//
// We match the stuck-bot block by PREFIX rather than a counting
// window, so legitimate messages between stuck-bot follow-ups are
// never suppressed by accident. Each follow-up line from
// js/game.js has a distinctive two-space prefix:
//
//   '  Position:', '  Target:', '  Distance to target:',
//   '  Idle time / max:', '  Last action:', '  Stats:',
//   '  Combat cooldown:', '  Strategy mode:', '  Last context:',
//   '  Frame:'
function createFilteredConsole(options) {
  if (options.silent) {
    return { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  }

  // Prefixes that identify stuck-bot follow-up lines, matched against
  // the first argument when it's a string.
  const STUCK_FOLLOWUP_PREFIXES = [
    '  Position:',
    '  Target:',
    '  Distance to target:',
    '  Idle time / max:',
    '  Last action:',
    '  Stats:',
    '  Combat cooldown:',
    '  Strategy mode:',
    '  Last context:',
    '  Frame:',
  ];

  const shouldSuppress = (args) => {
    const first = args[0];
    if (typeof first !== 'string') return false;
    if (first.includes('STUCK BOT DETECTED')) return true;
    for (const prefix of STUCK_FOLLOWUP_PREFIXES) {
      if (first === prefix || first.startsWith(prefix)) return true;
    }
    return false;
  };

  return {
    log:   (...args) => { if (!shouldSuppress(args)) console.log(...args); },
    warn:  (...args) => { if (!shouldSuppress(args)) console.warn(...args); },
    error: (...args) => { if (!shouldSuppress(args)) console.error(...args); },
    info:  (...args) => { if (!shouldSuppress(args)) console.info(...args); },
    debug: (...args) => { if (!shouldSuppress(args)) console.debug(...args); },
  };
}

/**
 * Create a loaded vm context with all model files executed.
 *
 * @param {object} [options]
 * @param {number} [options.seed] - Seed for deterministic Math.random.
 *   If omitted, the host Math is used.
 * @param {boolean} [options.silent=false] - Completely silence the
 *   vm's console (log/warn/error). Default suppresses only known
 *   noisy diagnostics (stuck-bot warnings).
 * @returns {object} vm context object. All model globals are exposed
 *   as properties (ctx.Bot, ctx.YellowDot, ctx.bots, ctx.handleCombat, etc.)
 */
function createGameContext(options = {}) {
  const context = {
    // Primitive host refs the loaded code needs
    Math: options.seed !== undefined ? createSeededMath(options.seed) : Math,
    Date, JSON, Array, Object, String, Number, Boolean, Symbol,
    Map, Set, WeakMap, WeakSet, Promise,
    Error, TypeError, RangeError,
    Infinity, NaN,
    parseInt, parseFloat, isNaN, isFinite,
    console: createFilteredConsole(options),

    // Minimal DOM stubs (no model file currently touches these at
    // load time, but we stub them for safety)
    document: stubDocument(),
    window: {
      addEventListener() {},
      removeEventListener() {},
      requestAnimationFrame() { return 0; },
      cancelAnimationFrame() {},
    },

    // State normally declared in main.js. combat.js references these
    // inside function bodies via late binding, so they must exist on
    // the context before any combat function is called.
    bots: [],
    yellowDots: [],
    playerBot: null,
    camera: {
      x: 1000, y: 1000,
      followBot: null, followIndex: 0,
      smoothing: 0.08, offsetY: -100,
      autoFollow: true,
    },
    canvas: null,
    ctx: null,
    rafHandle: null,
  };

  vm.createContext(context);

  const combined = buildCombinedScript();
  try {
    vm.runInContext(combined, context, { filename: 'v11-model-bundle.js' });
  } catch (err) {
    throw new Error(`Harness: failed to load v11 model bundle: ${err.message}\n${err.stack}`);
  }

  return context;
}

/**
 * Reset the mutable state of a loaded context so tests can reuse it.
 * Cheaper than creating a fresh context for every test.
 */
function resetGameState(context) {
  context.bots.length = 0;
  context.yellowDots.length = 0;
  context.playerBot = null;
  context.camera.x = 1000;
  context.camera.y = 1000;
  context.camera.followBot = null;
  context.camera.followIndex = 0;
  if (context.packs && typeof context.packs.clear === 'function') {
    context.packs.clear();
  }
  if (context.protectionPairs && typeof context.protectionPairs.clear === 'function') {
    context.protectionPairs.clear();
  }
  if (context.corpses && Array.isArray(context.corpses)) {
    context.corpses.length = 0;
  }
}

module.exports = {
  createGameContext,
  resetGameState,
  MODEL_FILES,
  LEXICAL_BINDINGS_TO_EXPOSE,
};
