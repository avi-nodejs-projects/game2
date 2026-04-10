// Strategy adherence: Advanced mode rule-list priority.
// Verifies first-match semantics, rule reordering effects, and
// catch-all behavior hold up over many decisions in changing
// game state.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

function setRules(ctx, newRules) {
  ctx.rules.length = 0;
  for (const r of newRules) ctx.rules.push(r);
  ctx.globalSettings.randomnessNoise = 0;
  ctx.globalSettings.emergencyOverride.enabled = false;
}

function runDecisions(bot, n) {
  const dist = {};
  const ruleHits = {};
  for (let i = 0; i < n; i++) {
    bot.pickTargetAdvancedMode();
    dist[bot.lastAction] = (dist[bot.lastAction] || 0) + 1;
    const idx = bot.lastDecisionInfo.firedRule;
    const key = idx === null ? 'default' : `rule${idx}`;
    ruleHits[key] = (ruleHits[key] || 0) + 1;
  }
  return { dist, ruleHits };
}

// ---- Deterministic first-match over many decisions ---------------

test('advanced: deterministic rule matching over 500 decisions with static state', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 2 }], action: 'flee' },
    { conditions: [], action: 'gather' },
  ]);
  const { dist, ruleHits } = runDecisions(bot, 500);
  assert.strictEqual(dist.flee, 500, 'all decisions should be flee');
  assert.strictEqual(ruleHits.rule0, 500, 'rule 0 should fire every time');
});

test('advanced: changing state shifts which rule fires', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 2 }], action: 'flee' },
    { conditions: [{ subject: 'my.lives', operator: '>=', value: 10 }], action: 'hunt' },
    { conditions: [], action: 'gather' },
  ]);

  bot.lives = 1;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');

  bot.lives = 5;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');

  bot.lives = 15;
  // Make enemy strong so combat_advantage isn't catastrophic (irrelevant for 'hunt' here)
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

// ---- Reordering rules changes outcome ----------------------------

test('advanced: reordering rules flips which fires first', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.lives = 3;
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 150; ctx.bots[1].y = 100;

  // Order A: lives-check first
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 5 }], action: 'flee' },
    { conditions: [{ subject: 'nearest_enemy.distance', operator: '<', value: 100 }], action: 'hunt' },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');

  // Order B: distance-check first
  setRules(ctx, [
    { conditions: [{ subject: 'nearest_enemy.distance', operator: '<', value: 100 }], action: 'hunt' },
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 5 }], action: 'flee' },
    { conditions: [], action: 'gather' },
  ]);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

// ---- Catch-all fallback ------------------------------------------

test('advanced: catch-all fires exactly when all specific rules miss', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.lives = 5;  // between 2 and 10
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<', value: 2 }], action: 'flee' },
    { conditions: [{ subject: 'my.lives', operator: '>', value: 10 }], action: 'hunt' },
    { conditions: [], action: 'gather' },  // catch-all
  ]);
  const { ruleHits } = runDecisions(bot, 200);
  assert.strictEqual(ruleHits.rule2, 200);
});

test('advanced: no rule matches at all → default gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.lives = 5;
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<', value: 2 }], action: 'flee' },
    { conditions: [{ subject: 'my.lives', operator: '>', value: 10 }], action: 'hunt' },
    // No catch-all
  ]);
  const { dist, ruleHits } = runDecisions(bot, 200);
  assert.strictEqual(dist.gather, 200);
  assert.strictEqual(ruleHits.default, 200);
  assert.strictEqual(ruleHits.rule0 || 0, 0);
});

// ---- Rule template regression ------------------------------------

test('advanced: "balanced" rule template behaves as expected', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  setRules(ctx, ctx.RULE_TEMPLATES.balanced.rules);

  // Case 1: low lives + close enemy → flee (rule 0)
  bot.lives = 1; bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 150; ctx.bots[1].y = 100;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');

  // Case 2: high lives + good advantage + close enemy → hunt (rule 1)
  bot.lives = 10; bot.attack = 20; bot.defence = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');

  // Case 3: no threats, no clusters → gather (catch-all)
  ctx.bots[1].x = 1800; ctx.bots[1].y = 1800;
  for (let i = ctx.yellowDots.length - 1; i >= 0; i--) ctx.yellowDots.splice(i, 1);
  const d = new ctx.YellowDot(); d.x = 200; d.y = 200;
  ctx.yellowDots.push(d);
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

test('advanced: "aggressive" rule template picks flee when low, hunt when advantaged', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  setRules(ctx, ctx.RULE_TEMPLATES.aggressive.rules);

  bot.lives = 1;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'flee');

  bot.lives = 20; bot.attack = 20; bot.defence = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  bot.pickTargetAdvancedMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

// ---- Rule stability --------------------------------------------

test('advanced: identical state → identical rule decision (no randomness)', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  setRules(ctx, [
    { conditions: [{ subject: 'my.lives', operator: '<=', value: 2 }], action: 'flee' },
    { conditions: [], action: 'gather' },
  ]);
  bot.lives = 1;
  const results = [];
  for (let i = 0; i < 100; i++) {
    bot.pickTargetAdvancedMode();
    results.push(bot.lastAction);
  }
  // All identical
  assert.ok(results.every(r => r === 'flee'));
});
