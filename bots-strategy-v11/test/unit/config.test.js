// Unit tests for config.js — integrity checks on constants,
// default settings, templates, and behavior/rule/action definitions.
// Pragmatic: we don't test every field, just structural invariants
// that would catch typos, missing entries, or malformed templates.

const { test } = require('node:test');
const assert = require('node:assert');
const { createGameContext } = require('../harness');

// ---- World constants ---------------------------------------------

test('config: world dimensions are 2000x2000', () => {
  const ctx = createGameContext();
  assert.strictEqual(ctx.WORLD_WIDTH, 2000);
  assert.strictEqual(ctx.WORLD_HEIGHT, 2000);
});

test('config: bot count is positive', () => {
  const ctx = createGameContext();
  assert.ok(ctx.BOT_COUNT > 0);
  assert.ok(ctx.BOT_COUNT >= 2, 'need at least 2 bots for meaningful simulation');
});

test('config: dot count exceeds bot count (food is plentiful)', () => {
  const ctx = createGameContext();
  assert.ok(ctx.DOT_COUNT > ctx.BOT_COUNT);
});

// ---- Stats -------------------------------------------------------

test('config: STARTING_STATS sum matches TOTAL_POINTS', () => {
  const ctx = createGameContext();
  const s = ctx.STARTING_STATS;
  const sum = s.speed + s.attack + s.defence + s.lives;
  assert.strictEqual(sum, ctx.TOTAL_POINTS,
    `STARTING_STATS sum (${sum}) should equal TOTAL_POINTS (${ctx.TOTAL_POINTS})`);
});

test('config: STARTING_STATS all meet MIN_STAT', () => {
  const ctx = createGameContext();
  const s = ctx.STARTING_STATS;
  assert.ok(s.speed >= ctx.MIN_STAT);
  assert.ok(s.attack >= 0, 'attack can be 0');
  assert.ok(s.defence >= ctx.MIN_STAT);
  assert.ok(s.lives >= ctx.MIN_STAT);
});

test('config: DEFAULT_PLAYER_STATS matches STARTING_STATS initially', () => {
  const ctx = createGameContext();
  assert.strictEqual(ctx.DEFAULT_PLAYER_STATS.speed, ctx.STARTING_STATS.speed);
  assert.strictEqual(ctx.DEFAULT_PLAYER_STATS.attack, ctx.STARTING_STATS.attack);
  assert.strictEqual(ctx.DEFAULT_PLAYER_STATS.defence, ctx.STARTING_STATS.defence);
  assert.strictEqual(ctx.DEFAULT_PLAYER_STATS.lives, ctx.STARTING_STATS.lives);
});

// ---- Global settings ---------------------------------------------

test('config: globalSettings has sensible defaults', () => {
  const ctx = createGameContext();
  const gs = ctx.globalSettings;
  assert.ok(gs.reEvaluationRate > 0);
  assert.ok(gs.behaviorSwitchCooldown >= 0);
  assert.ok(gs.randomnessNoise >= 0 && gs.randomnessNoise <= 1);
  assert.ok(gs.emergencyOverride);
  assert.strictEqual(typeof gs.emergencyOverride.enabled, 'boolean');
});

// ---- NPC strategy templates --------------------------------------

test('config: NPC_STRATEGY_TEMPLATES contains all expected keys', () => {
  const ctx = createGameContext();
  const expected = ['gatherer', 'hunter', 'survivor', 'opportunist', 'aggressive'];
  for (const key of expected) {
    assert.ok(ctx.NPC_STRATEGY_TEMPLATES[key], `template ${key} should exist`);
  }
});

test('config: each NPC template has name, behaviors, weights', () => {
  const ctx = createGameContext();
  for (const [key, tpl] of Object.entries(ctx.NPC_STRATEGY_TEMPLATES)) {
    assert.ok(tpl.name, `${key} missing name`);
    assert.ok(tpl.behaviors, `${key} missing behaviors`);
    assert.ok(tpl.weights, `${key} missing weights`);
  }
});

test('config: NPC template behaviors and weights share the same keys', () => {
  const ctx = createGameContext();
  for (const [key, tpl] of Object.entries(ctx.NPC_STRATEGY_TEMPLATES)) {
    const bKeys = Object.keys(tpl.behaviors).sort();
    const wKeys = Object.keys(tpl.weights).sort();
    assert.deepStrictEqual(bKeys, wKeys,
      `${key}: behaviors and weights should cover the same behavior set`);
  }
});

test('config: NPC template behavior keys match BEHAVIORS keys', () => {
  const ctx = createGameContext();
  const behaviorKeys = Object.keys(ctx.BEHAVIORS).sort();
  for (const [key, tpl] of Object.entries(ctx.NPC_STRATEGY_TEMPLATES)) {
    const tplKeys = Object.keys(tpl.behaviors).sort();
    assert.deepStrictEqual(tplKeys, behaviorKeys,
      `${key}: behavior keys should match BEHAVIORS definition`);
  }
});

test('config: NPC template weights sum to 100', () => {
  const ctx = createGameContext();
  for (const [key, tpl] of Object.entries(ctx.NPC_STRATEGY_TEMPLATES)) {
    const sum = Object.values(tpl.weights).reduce((a, b) => a + b, 0);
    assert.strictEqual(sum, 100,
      `${key}: weights should sum to 100, got ${sum}`);
  }
});

// ---- Behaviors ---------------------------------------------------

test('config: BEHAVIORS has all expected entries', () => {
  const ctx = createGameContext();
  const expected = ['gatherer', 'clusterFarmer', 'hunter', 'opportunist', 'survivor', 'avenger'];
  for (const key of expected) {
    assert.ok(ctx.BEHAVIORS[key], `behavior ${key} should exist`);
  }
});

test('config: each BEHAVIOR has name, desc, defaultWeight', () => {
  const ctx = createGameContext();
  for (const [key, b] of Object.entries(ctx.BEHAVIORS)) {
    assert.ok(b.name, `${key} missing name`);
    assert.ok(b.desc, `${key} missing desc`);
    assert.strictEqual(typeof b.defaultWeight, 'number',
      `${key} defaultWeight should be a number`);
    assert.strictEqual(typeof b.enabled, 'boolean',
      `${key} enabled should be boolean`);
  }
});

test('config: behaviorWeights state mirrors BEHAVIORS', () => {
  const ctx = createGameContext();
  const behaviorKeys = Object.keys(ctx.BEHAVIORS).sort();
  const weightKeys = Object.keys(ctx.behaviorWeights).sort();
  assert.deepStrictEqual(weightKeys, behaviorKeys);
});

// ---- Rule system -------------------------------------------------

test('config: SUBJECTS is a non-empty object', () => {
  const ctx = createGameContext();
  assert.ok(typeof ctx.SUBJECTS === 'object');
  assert.ok(Object.keys(ctx.SUBJECTS).length > 0);
});

test('config: SUBJECTS includes expected core variables', () => {
  const ctx = createGameContext();
  const core = ['my.lives', 'my.attack', 'my.defence', 'my.speed',
                'nearest_enemy.distance', 'combat_advantage'];
  for (const s of core) {
    assert.ok(ctx.SUBJECTS[s], `subject ${s} should exist`);
  }
});

test('config: OPERATORS contains all comparison operators', () => {
  const ctx = createGameContext();
  const expected = ['<', '<=', '>', '>=', '=', '!='];
  for (const op of expected) {
    assert.ok(ctx.OPERATORS.includes(op), `operator ${op} should exist`);
  }
});

test('config: ACTIONS has all expected actions', () => {
  const ctx = createGameContext();
  const expected = ['flee', 'hunt', 'hunt_weak', 'gather', 'gather_safe', 'cluster', 'wander'];
  for (const a of expected) {
    assert.ok(ctx.ACTIONS[a], `action ${a} should exist`);
  }
});

// ---- Rule templates ----------------------------------------------

test('config: RULE_TEMPLATES contains expected templates', () => {
  const ctx = createGameContext();
  const expected = ['aggressive', 'safe', 'balanced', 'glassCannon'];
  for (const key of expected) {
    assert.ok(ctx.RULE_TEMPLATES[key], `template ${key} should exist`);
  }
});

test('config: each rule template has name and rules array', () => {
  const ctx = createGameContext();
  for (const [key, tpl] of Object.entries(ctx.RULE_TEMPLATES)) {
    assert.ok(tpl.name, `${key} missing name`);
    assert.ok(Array.isArray(tpl.rules), `${key} rules should be array`);
    assert.ok(tpl.rules.length > 0, `${key} should have at least one rule`);
  }
});

test('config: rule template rules all use valid actions', () => {
  const ctx = createGameContext();
  for (const [key, tpl] of Object.entries(ctx.RULE_TEMPLATES)) {
    for (const rule of tpl.rules) {
      assert.ok(ctx.ACTIONS[rule.action],
        `${key}: rule action '${rule.action}' not in ACTIONS`);
    }
  }
});

test('config: rule template conditions use valid subjects and operators', () => {
  const ctx = createGameContext();
  for (const [key, tpl] of Object.entries(ctx.RULE_TEMPLATES)) {
    for (const rule of tpl.rules) {
      for (const cond of (rule.conditions || [])) {
        assert.ok(ctx.SUBJECTS[cond.subject],
          `${key}: condition subject '${cond.subject}' not in SUBJECTS`);
        assert.ok(ctx.OPERATORS.includes(cond.operator),
          `${key}: condition operator '${cond.operator}' not in OPERATORS`);
      }
    }
  }
});

test('config: rule templates end with a catch-all rule (empty conditions)', () => {
  const ctx = createGameContext();
  for (const [key, tpl] of Object.entries(ctx.RULE_TEMPLATES)) {
    const last = tpl.rules[tpl.rules.length - 1];
    assert.ok(
      !last.conditions || last.conditions.length === 0,
      `${key}: last rule should be a catch-all (empty conditions)`
    );
  }
});

// ---- Default rules / states --------------------------------------

test('config: DEFAULT_RULES is a non-empty array', () => {
  const ctx = createGameContext();
  assert.ok(Array.isArray(ctx.DEFAULT_RULES));
  assert.ok(ctx.DEFAULT_RULES.length > 0);
});

test('config: DEFAULT_STATES is a non-empty array for FSM mode', () => {
  const ctx = createGameContext();
  assert.ok(Array.isArray(ctx.DEFAULT_STATES));
  assert.ok(ctx.DEFAULT_STATES.length > 0);
});

// ---- Lifecycle defaults ------------------------------------------

test('config: lifecycleSettings has all feature subsections', () => {
  const ctx = createGameContext();
  const ls = ctx.lifecycleSettings;
  assert.ok(ls.respawnInvincibility, 'respawnInvincibility missing');
  assert.ok(ls.starvation, 'starvation missing');
  assert.ok(ls.age, 'age missing');
  assert.ok(ls.reproduction, 'reproduction missing');
  assert.ok(ls.reproduction.asexual, 'reproduction.asexual missing');
  assert.ok(ls.reproduction.sexual, 'reproduction.sexual missing');
  assert.ok(ls.packs, 'packs missing');
});

test('config: lifecycle features are disabled by default', () => {
  // User-reported expectation: fresh install has all lifecycle
  // features off, so the basic game plays the classic way.
  const ctx = createGameContext();
  const ls = ctx.lifecycleSettings;
  assert.strictEqual(ls.respawnInvincibility.enabled, false);
  assert.strictEqual(ls.starvation.enabled, false);
  assert.strictEqual(ls.age.enabled, false);
  assert.strictEqual(ls.reproduction.asexual.enabled, false);
  assert.strictEqual(ls.reproduction.sexual.enabled, false);
  assert.strictEqual(ls.packs.enabled, false);
});

// ---- Mutable state initial values --------------------------------

test('config: frameCount starts at 0', () => {
  const ctx = createGameContext();
  assert.strictEqual(ctx.frameCount, 0);
});

test('config: decisionCount starts at 0', () => {
  const ctx = createGameContext();
  assert.strictEqual(ctx.decisionCount, 0);
});

test('config: simulationRunning starts false', () => {
  const ctx = createGameContext();
  assert.strictEqual(ctx.simulationRunning, false);
});

test('config: strategyMode defaults to simple', () => {
  const ctx = createGameContext();
  assert.strictEqual(ctx.strategyMode, 'simple');
});
