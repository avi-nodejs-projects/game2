// Unit tests for Bot.pickTargetAdvancedMode — ordered rule list
// evaluation with first-match semantics. Tests rule priority,
// condition AND-logic, catch-all, and the default fallback.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

// Helper: set the rule list (overrides defaults loaded from config)
function setRules(ctx, newRules) {
  ctx.rules.length = 0;
  for (const r of newRules) ctx.rules.push(r);
}

// ---- First matching rule fires -----------------------------------

test('advancedMode: first matching rule fires (top priority wins)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 2 }], action: 'flee' },
    { conditions: [], action: 'gather' },  // catch-all
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');
  assert.strictEqual(bot.lastDecisionInfo.firedRule, 0);
});

test('advancedMode: second rule fires when first does not match', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 10;
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 2 }], action: 'flee' },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
  assert.strictEqual(bot.lastDecisionInfo.firedRule, 1);
});

test('advancedMode: catch-all rule (empty conditions) always matches', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 3 });
  const bot = ctx.bots[0];
  setRules(ctx, [
    { conditions: [], action: 'wander' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'wander');
});

// ---- Multi-condition AND logic -----------------------------------

test('advancedMode: all conditions must match (AND logic)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.x = 0; bot.y = 0;
  ctx.bots[1].x = 50; ctx.bots[1].y = 0; // close enemy
  setRules(ctx, [
    {
      conditions: [
        { subject: 'my.lives', operator: '<=', value: 2 },
        { subject: 'nearest_enemy.distance', operator: '<', value: 100 },
      ],
      action: 'flee',
    },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');
});

test('advancedMode: partial match (one condition fails) does not fire rule', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.x = 0; bot.y = 0;
  ctx.bots[1].x = 1500; ctx.bots[1].y = 1500; // far enemy
  setRules(ctx, [
    {
      conditions: [
        { subject: 'my.lives', operator: '<=', value: 2 }, // matches
        { subject: 'nearest_enemy.distance', operator: '<', value: 100 }, // fails
      ],
      action: 'flee',
    },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

// ---- Default fallback when nothing matches -----------------------

test('advancedMode: no rule matches → default gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 10;
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<', value: 0 }], action: 'flee' },
    { conditions: [{ subject: 'my.lives', operator: '>', value: 100 }], action: 'hunt' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
  assert.strictEqual(bot.lastDecisionInfo.firedRule, null);
});

// ---- Rule ordering matters ---------------------------------------

test('advancedMode: rule order changes which action fires', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 3; // would match both rules
  bot.x = 0; bot.y = 0;
  ctx.bots[1].x = 50; ctx.bots[1].y = 0;

  // Order A: flee first
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 5 }], action: 'flee' },
    { conditions: [{ subject: 'nearest_enemy.distance', operator: '<', value: 100 }], action: 'hunt' },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');

  // Order B: hunt first
  setRules(ctx, [
    { conditions: [{ subject: 'nearest_enemy.distance', operator: '<', value: 100 }], action: 'hunt' },
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 5 }], action: 'flee' },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

// ---- Emergency override overrides everything ---------------------

test('advancedMode: emergency override short-circuits rule evaluation', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  ctx.globalSettings.emergencyOverride.enabled = true;
  ctx.globalSettings.emergencyOverride.livesThreshold = 2;
  ctx.globalSettings.emergencyOverride.behavior = 'wander';
  const bot = ctx.bots[0];
  bot.lives = 1;
  setRules(ctx, [
    { conditions: [], action: 'hunt' }, // would fire without override
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'wander');
});

// ---- Reason / firedRule metadata ---------------------------------

test('advancedMode: lastDecisionInfo.firedRule records matched index', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 10;
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<', value: 5 }], action: 'flee' },
    { conditions: [{ subject: 'my.lives', operator: '<', value: 15 }], action: 'gather' },
    { conditions: [], action: 'wander' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastDecisionInfo.firedRule, 1);
});

test('advancedMode: reason includes rule number', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  setRules(ctx, [
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.ok(bot.lastDecisionInfo.reason.includes('Rule'));
});

// ---- Condition combinations --------------------------------------

test('advancedMode: rules using combat_advantage work', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.attack = 20; bot.defence = 20; bot.lives = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  setRules(ctx, [
    { conditions: [{ subject: 'combat_advantage', operator: '>', value: 2 }], action: 'hunt' },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

test('advancedMode: rules using best_cluster.size work', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 500; bot.y = 500;
  // Create a cluster of 4 dots
  [[500, 500], [510, 500], [500, 510], [510, 510]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });
  setRules(ctx, [
    { conditions: [{ subject: 'best_cluster.size', operator: '>=', value: 3 }], action: 'cluster' },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'cluster');
});

// ---- Empty rule list ---------------------------------------------

test('advancedMode: empty rule list → default gather', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 3 });
  const bot = ctx.bots[0];
  setRules(ctx, []);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});
