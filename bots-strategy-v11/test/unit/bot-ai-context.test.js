// Unit tests for Bot.getContext — the 35+ context variables used
// by the rule system. Each variable has a distinct purpose and
// independent derivation from game state.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext, assertApprox } = require('../helpers');

// ---- Self stats ---------------------------------------------------

test('getContext: my.lives reflects bot.lives', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.lives = 7.5;
  const c = bot.getContext();
  assert.strictEqual(c['my.lives'], 7.5);
});

test('getContext: my.attack/defence/speed reflect stats', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.attack = 8;
  bot.defence = 4;
  bot.speed = 6;
  const c = bot.getContext();
  assert.strictEqual(c['my.attack'], 8);
  assert.strictEqual(c['my.defence'], 4);
  assert.strictEqual(c['my.speed'], 6);
});

test('getContext: my.health_percent = lives/initialLives*100', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.lives = 2;
  bot.initialLives = 4;
  const c = bot.getContext();
  assert.strictEqual(c['my.health_percent'], 50);
});

test('getContext: my.total_stats sums all four stats', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.speed = 5; bot.attack = 5; bot.defence = 5; bot.lives = 3;
  const c = bot.getContext();
  assert.strictEqual(c['my.total_stats'], 18);
});

test('getContext: my.relative_power is ratio of own/avg', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  // All bots have default 18 → ratio 1.0
  const c = ctx.bots[0].getContext();
  assertApprox(c['my.relative_power'], 1.0, 1e-9);
});

test('getContext: my.zone is 1-9 based on grid position', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  // Top-left corner → zone 1
  bot.x = 100; bot.y = 100;
  let c = bot.getContext();
  assert.strictEqual(c['my.zone'], 1);
  // Bottom-right corner → zone 9
  bot.x = ctx.WORLD_WIDTH - 100; bot.y = ctx.WORLD_HEIGHT - 100;
  c = bot.getContext();
  assert.strictEqual(c['my.zone'], 9);
});

// ---- am_strongest / am_weakest ------------------------------------

test('getContext: am_strongest=1 when bot has highest total stats', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.speed = 10; bot.attack = 10; bot.defence = 10; bot.lives = 10;
  // Other bots have default 18 totals
  const c = bot.getContext();
  assert.strictEqual(c['am_strongest'], 1);
});

test('getContext: am_weakest=1 when bot has lowest total stats', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.speed = 1; bot.attack = 1; bot.defence = 1; bot.lives = 1;
  const c = bot.getContext();
  assert.strictEqual(c['am_weakest'], 1);
});

test('getContext: am_strongest=0 when someone else is stronger', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  ctx.bots[1].speed = 50; // bigger than player
  const c = ctx.bots[0].getContext();
  assert.strictEqual(c['am_strongest'], 0);
});

// ---- nearest_enemy.* ----------------------------------------------

test('getContext: nearest_enemy.distance matches findNearestBot', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0]; const b = ctx.bots[1];
  a.x = 0; a.y = 0;
  b.x = 300; b.y = 400; // distance 500
  const c = a.getContext();
  assertApprox(c['nearest_enemy.distance'], 500, 1e-9);
});

test('getContext: nearest_enemy.lives matches target lives', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.bots[1].lives = 7;
  const c = ctx.bots[0].getContext();
  assert.strictEqual(c['nearest_enemy.lives'], 7);
});

test('getContext: nearest_enemy.attack matches target attack', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  ctx.bots[1].attack = 12;
  const c = ctx.bots[0].getContext();
  assert.strictEqual(c['nearest_enemy.attack'], 12);
});

test('getContext: nearest_enemy.lives=999 when no enemies', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const c = ctx.bots[0].getContext();
  assert.strictEqual(c['nearest_enemy.lives'], 999);
});

// ---- combat_advantage --------------------------------------------

test('getContext: combat_advantage > 0 for stronger bot', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const a = ctx.bots[0], b = ctx.bots[1];
  a.attack = 10; a.defence = 10; a.lives = 10;
  b.attack = 2; b.defence = 2; b.lives = 2;
  const c = a.getContext();
  assert.ok(c['combat_advantage'] > 0);
});

test('getContext: combat_advantage=0 when no enemies', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const c = ctx.bots[0].getContext();
  assert.strictEqual(c['combat_advantage'], 0);
});

// ---- nearby_enemy_count ------------------------------------------

test('getContext: nearby_enemy_count matches countNearbyEnemies', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 150; ctx.bots[1].y = 150;  // within 200
  ctx.bots[2].x = 250; ctx.bots[2].y = 100;  // within 200
  ctx.bots[3].x = 1000; ctx.bots[3].y = 1000; // out
  const c = bot.getContext();
  assert.strictEqual(c['nearby_enemy_count'], 2);
});

// ---- weakest/strongest enemy -------------------------------------

test('getContext: weakest_enemy.lives returns lowest', () => {
  const ctx = createTestContext({ botCount: 4, dotCount: 0 });
  ctx.bots[1].lives = 5;
  ctx.bots[2].lives = 1; // weakest
  ctx.bots[3].lives = 7;
  const c = ctx.bots[0].getContext();
  assert.strictEqual(c['weakest_enemy.lives'], 1);
});

test('getContext: weakest_enemy.distance = Infinity when self is weakest', () => {
  // When the bot itself has the lowest total, globalWeakest === this,
  // so weakestEnemy is null → distance stays Infinity.
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.speed = 0.1; bot.attack = 0.1; bot.defence = 0.1; bot.lives = 0.1;
  const c = bot.getContext();
  assert.strictEqual(c['weakest_enemy.lives'], Infinity);
  assert.strictEqual(c['weakest_enemy.distance'], Infinity);
});

// ---- nearest_dot.distance ----------------------------------------

test('getContext: nearest_dot.distance matches findNearestDot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 2 });
  const bot = ctx.bots[0];
  bot.x = 100; bot.y = 100;
  ctx.yellowDots[0].x = 200; ctx.yellowDots[0].y = 100; // dist 100
  ctx.yellowDots[1].x = 500; ctx.yellowDots[1].y = 100; // dist 400
  const c = bot.getContext();
  assertApprox(c['nearest_dot.distance'], 100, 1e-9);
});

// ---- dot_count_in_radius -----------------------------------------

test('getContext: dot_count_in_radius counts dots within 200u', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.x = 1000; bot.y = 1000;
  // 3 within 200, 2 outside
  [[1100, 1000], [1000, 1100], [950, 1050],
   [1300, 1000], [1000, 1300]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });
  const c = bot.getContext();
  assert.strictEqual(c['dot_count_in_radius'], 3);
});

// ---- safe_dot_count + nearest_safe_dot ---------------------------

test('getContext: safe_dot_count counts dots far from all bots', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const me = ctx.bots[0];
  const other = ctx.bots[1];
  me.x = 0; me.y = 0;
  other.x = 1000; other.y = 1000;

  // Add a dot far from both bots → safe
  const safe = new ctx.YellowDot();
  safe.x = 500; safe.y = 0;
  ctx.yellowDots.push(safe);
  // Add a dot right next to other bot → unsafe
  const unsafe = new ctx.YellowDot();
  unsafe.x = 1050; unsafe.y = 1000;
  ctx.yellowDots.push(unsafe);

  const c = me.getContext();
  // Note: the "safe" computation excludes dots near ANY bot, including self
  // So the 500,0 dot (500u from us) is safe since safetyRadius default is 150
  assert.ok(c['safe_dot_count'] >= 1);
});

// ---- best_cluster.* ----------------------------------------------

test('getContext: best_cluster.size reflects largest cluster', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  // Put 4 dots close together to form a cluster
  [[500, 500], [510, 500], [500, 510], [510, 510]].forEach(([x, y]) => {
    const d = new ctx.YellowDot(); d.x = x; d.y = y;
    ctx.yellowDots.push(d);
  });
  const c = bot.getContext();
  assert.strictEqual(c['best_cluster.size'], 4);
});

test('getContext: best_cluster.size=0 with no dots', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const c = ctx.bots[0].getContext();
  assert.strictEqual(c['best_cluster.size'], 0);
});

// ---- damage flags ------------------------------------------------

test('getContext: just_took_damage toggles with flag', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.justTookDamage = false;
  assert.strictEqual(bot.getContext()['just_took_damage'], 0);
  bot.justTookDamage = true;
  assert.strictEqual(bot.getContext()['just_took_damage'], 1);
});

test('getContext: just_dealt_damage toggles with flag', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.justDealtDamage = false;
  assert.strictEqual(bot.getContext()['just_dealt_damage'], 0);
  bot.justDealtDamage = true;
  assert.strictEqual(bot.getContext()['just_dealt_damage'], 1);
});

test('getContext: frames_since_damage_taken counts from frameLastTookDamage', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.frameLastTookDamage = 100;
  ctx.frameCount = 150;
  const c = bot.getContext();
  assert.strictEqual(c['frames_since_damage_taken'], 50);
});

test('getContext: frames_since_damage_taken=999 when never damaged', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.frameLastTookDamage = 0;
  const c = bot.getContext();
  assert.strictEqual(c['frames_since_damage_taken'], 999);
});

// ---- last_attacker.distance --------------------------------------

test('getContext: last_attacker.distance=999 when no attacker', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  bot.lastAttacker = null;
  assert.strictEqual(bot.getContext()['last_attacker.distance'], 999);
});

test('getContext: last_attacker.distance = actual distance to attacker', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  const bot = ctx.bots[0];
  const attacker = ctx.bots[1];
  bot.x = 0; bot.y = 0;
  attacker.x = 300; attacker.y = 400;
  bot.lastAttacker = attacker;
  const c = bot.getContext();
  assertApprox(c['last_attacker.distance'], 500, 1e-9);
});

// ---- Internal refs (for executeAction) ---------------------------

test('getContext: _nearestDot is the nearest YellowDot', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 2 });
  const bot = ctx.bots[0];
  bot.x = 0; bot.y = 0;
  ctx.yellowDots[0].x = 100; ctx.yellowDots[0].y = 0;
  ctx.yellowDots[1].x = 500; ctx.yellowDots[1].y = 0;
  const c = bot.getContext();
  assert.strictEqual(c._nearestDot, ctx.yellowDots[0]);
});

test('getContext: _nearestEnemy is the nearest other Bot', () => {
  const ctx = createTestContext({ botCount: 3, dotCount: 0 });
  const me = ctx.bots[0];
  me.x = 0; me.y = 0;
  ctx.bots[1].x = 100; ctx.bots[1].y = 0; // closer
  ctx.bots[2].x = 500; ctx.bots[2].y = 0;
  const c = me.getContext();
  assert.strictEqual(c._nearestEnemy, ctx.bots[1]);
});

// ---- evaluateCondition -------------------------------------------

test('evaluateCondition: < operator', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const cond = { subject: 'my.lives', operator: '<', value: 5 };
  assert.strictEqual(
    bot.evaluateCondition(cond, { 'my.lives': 3 }),
    true
  );
  assert.strictEqual(
    bot.evaluateCondition(cond, { 'my.lives': 5 }),
    false
  );
});

test('evaluateCondition: >= operator', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const cond = { subject: 'my.lives', operator: '>=', value: 5 };
  assert.strictEqual(
    bot.evaluateCondition(cond, { 'my.lives': 5 }),
    true
  );
  assert.strictEqual(
    bot.evaluateCondition(cond, { 'my.lives': 4 }),
    false
  );
});

test('evaluateCondition: = operator with equal value', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const cond = { subject: 'my.zone', operator: '=', value: 5 };
  assert.strictEqual(
    bot.evaluateCondition(cond, { 'my.zone': 5 }),
    true
  );
});

test('evaluateCondition: != operator', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const cond = { subject: 'my.zone', operator: '!=', value: 5 };
  assert.strictEqual(
    bot.evaluateCondition(cond, { 'my.zone': 3 }),
    true
  );
});

test('evaluateCondition: undefined subject returns false', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 0 });
  const bot = ctx.bots[0];
  const cond = { subject: 'nonexistent.thing', operator: '>', value: 0 };
  assert.strictEqual(
    bot.evaluateCondition(cond, {}),
    false
  );
});
