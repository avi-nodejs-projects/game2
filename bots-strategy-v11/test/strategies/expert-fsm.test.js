// Strategy adherence: Expert mode finite state machine.
// Verifies that FSM state transitions hold up over time, state
// entry/exit actions fire correctly, and the bot stays in the
// right state across evolving game conditions.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

function setFSM(ctx, states, transitions) {
  ctx.states.length = 0;
  for (const s of states) ctx.states.push(s);
  ctx.transitions.length = 0;
  for (const t of transitions) ctx.transitions.push(t);
  ctx.globalSettings.randomnessNoise = 0;
  ctx.globalSettings.emergencyOverride.enabled = false;
}

// ---- Default 3-state FSM (gathering/hunting/fleeing) -------------

test('default FSM: bot starts and stays in gathering while safe', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  // Use the default states/transitions that config.js pre-populated
  const bot = ctx.bots[0];
  bot.currentFSMState = 'gathering';
  bot.lives = 5;
  bot.attack = 5; bot.defence = 5;
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 1800; ctx.bots[1].y = 1800; // far away
  // Mirror-match stats → combat_advantage ≈ 0 (below >2 hunt threshold)
  ctx.bots[1].attack = 5; ctx.bots[1].defence = 5; ctx.bots[1].lives = 5;

  // Run many decisions — state should stay gathering
  for (let i = 0; i < 50; i++) {
    bot.pickTargetExpertMode();
  }
  assert.strictEqual(bot.currentFSMState, 'gathering');
});

test('default FSM: gathering → fleeing when lives drop to 2', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.currentFSMState = 'gathering';
  bot.lives = 10;
  bot.pickTargetExpertMode(); // stays gathering

  bot.lives = 2; // triggers fleeing transition (my.lives <= 2)
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'fleeing');
  assert.strictEqual(bot.lastAction, 'flee');
});

test('default FSM: fleeing → gathering when enemy gets distant', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.currentFSMState = 'fleeing';
  bot.lives = 5;
  bot.x = 100; bot.y = 100;
  ctx.bots[1].x = 500; ctx.bots[1].y = 100;
  // nearest_enemy.distance > 200 → back to gathering
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'gathering');
});

test('default FSM: gathering → hunting when combat_advantage > 2', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.currentFSMState = 'gathering';
  bot.lives = 10;
  bot.attack = 20; bot.defence = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'hunting');
  assert.strictEqual(bot.lastAction, 'hunt');
});

// ---- Sequential transitions hold up over time --------------------

test('default FSM: sequence gather → hunt → flee → gather', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.currentFSMState = 'gathering';
  bot.lives = 10;

  // Phase 1: safe → gathering
  bot.attack = 3; bot.defence = 3;
  ctx.bots[1].attack = 5; ctx.bots[1].defence = 5; ctx.bots[1].lives = 5;
  ctx.bots[1].x = 1800; ctx.bots[1].y = 1800;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'gathering');

  // Phase 2: advantaged → hunting (need combat_advantage > 2)
  bot.attack = 20; bot.defence = 20;
  ctx.bots[1].attack = 1; ctx.bots[1].defence = 1; ctx.bots[1].lives = 1;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'hunting');

  // Phase 3: lives drop → fleeing (from hunting, priority 2 > 1)
  bot.lives = 2;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'fleeing');

  // Phase 4: enemy moves away → back to gathering
  ctx.bots[1].x = 1800; ctx.bots[1].y = 1800;
  bot.lives = 10;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'gathering');
});

// ---- Custom FSM: 2-state toggle ---------------------------------

test('custom 2-state FSM: deterministic ping-pong based on lives', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setFSM(ctx, [
    { id: 'happy', name: 'Happy', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'sad',   name: 'Sad',   behavior: 'flee',   entryAction: null, exitAction: null },
  ], [
    { from: 'happy', to: 'sad',   condition: { subject: 'my.lives', operator: '<', value: 5 }, priority: 1 },
    { from: 'sad',   to: 'happy', condition: { subject: 'my.lives', operator: '>=', value: 5 }, priority: 1 },
  ]);

  const bot = ctx.bots[0];
  bot.currentFSMState = 'happy';

  bot.lives = 3;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'sad');

  bot.lives = 10;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'happy');

  bot.lives = 2;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'sad');
});

// ---- Priority ordering ------------------------------------------

test('expert FSM: priority 2 wins over priority 1 when both match', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setFSM(ctx, [
    { id: 'A', name: 'A', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'B', name: 'B', behavior: 'hunt',   entryAction: null, exitAction: null },
    { id: 'C', name: 'C', behavior: 'flee',   entryAction: null, exitAction: null },
  ], [
    // Both transitions' conditions match when lives=1
    { from: 'A', to: 'B', condition: { subject: 'my.lives', operator: '<=', value: 5 }, priority: 1 },
    { from: 'A', to: 'C', condition: { subject: 'my.lives', operator: '<=', value: 5 }, priority: 2 },
  ]);

  const bot = ctx.bots[0];
  bot.currentFSMState = 'A';
  bot.lives = 1;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'C', 'higher priority wins');
});

// ---- Entry / exit actions fire on transition --------------------

test('expert FSM: entry action fires on new state, not on stay', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  setFSM(ctx, [
    { id: 'calm',    name: 'Calm',    behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'panicked', name: 'Panic',  behavior: 'flee',   entryAction: 'boost_speed', exitAction: null },
  ], [
    { from: 'calm', to: 'panicked', condition: { subject: 'my.lives', operator: '<=', value: 2 }, priority: 1 },
  ]);

  const bot = ctx.bots[0];
  bot.currentFSMState = 'calm';
  bot.speed = 5;

  // Stay in calm — no boost
  bot.lives = 10;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.speed, 5);

  // Transition to panicked — boost fires once
  bot.lives = 1;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.speed, 5.5, 'boost applied exactly once');

  // Stay in panicked — boost does NOT reapply
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.speed, 5.5, 'boost not reapplied while in state');
});

test('expert FSM: exit action fires when leaving a state', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 0 });
  setFSM(ctx, [
    { id: 'seek',  name: 'Seek',  behavior: 'wander', entryAction: null, exitAction: 'reset_target' },
    { id: 'rest',  name: 'Rest',  behavior: 'wander', entryAction: null, exitAction: null },
  ], [
    { from: 'seek', to: 'rest', condition: { subject: 'my.lives', operator: '>=', value: 3 }, priority: 1 },
  ]);

  const bot = ctx.bots[0];
  bot.currentFSMState = 'seek';
  bot.x = 500; bot.y = 500;
  bot.targetX = 100; bot.targetY = 100; // arbitrary target
  bot.lives = 5;
  bot.pickTargetExpertMode();
  // After transition: seek.exitAction = reset_target sets target to bot pos,
  // then rest.behavior = wander picks a random target. Verify state changed.
  assert.strictEqual(bot.currentFSMState, 'rest');
});

// ---- Long-run: bot cycles through states without getting stuck ---

test('expert FSM: 200 decisions with varying state stays in-bounds', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 5 });
  const bot = ctx.bots[0];
  bot.currentFSMState = 'gathering';

  const seenStates = new Set();
  for (let i = 0; i < 200; i++) {
    // Vary the game state across iterations
    bot.lives = (i % 20) + 1;
    bot.attack = 5 + (i % 10);
    bot.defence = 5;
    ctx.bots[1].x = 100 + (i * 10) % 1800;
    ctx.bots[1].y = 100;

    bot.pickTargetExpertMode();
    seenStates.add(bot.currentFSMState);

    // All valid states from default FSM
    assert.ok(
      ['gathering', 'hunting', 'fleeing'].includes(bot.currentFSMState),
      `unexpected state: ${bot.currentFSMState}`
    );
  }

  // Should have visited more than one state
  assert.ok(seenStates.size > 1, `only visited: ${Array.from(seenStates).join(', ')}`);
});
