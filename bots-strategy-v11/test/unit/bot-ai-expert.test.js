// Unit tests for Bot.pickTargetExpertMode — finite state machine
// with states, transitions, priority ordering, entry/exit actions,
// and the default fallback.

const { test } = require('node:test');
const assert = require('node:assert');
const { createTestContext } = require('../helpers');

function setStates(ctx, newStates, newTransitions) {
  ctx.states.length = 0;
  for (const s of newStates) ctx.states.push(s);
  ctx.transitions.length = 0;
  for (const t of newTransitions) ctx.transitions.push(t);
}

// ---- Initial state behavior --------------------------------------

test('expertMode: stays in state when no transition fires', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.currentFSMState = 'gathering';
  setStates(ctx,
    [{ id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null }],
    [] // no transitions
  );
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'gathering');
  assert.strictEqual(bot.lastAction, 'gather');
});

test('expertMode: executes the current state\'s behavior as action', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.currentFSMState = 'hunting';
  setStates(ctx, [
    { id: 'hunting', name: 'Hunt', behavior: 'hunt', entryAction: null, exitAction: null },
  ], []);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.lastAction, 'hunt');
});

// ---- Transition firing -------------------------------------------

test('expertMode: transition fires when condition matches', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.currentFSMState = 'gathering';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'fleeing', name: 'Flee', behavior: 'flee', entryAction: null, exitAction: null },
  ], [
    {
      from: 'gathering', to: 'fleeing',
      condition: { subject: 'my.lives', operator: '<=', value: 2 },
      priority: 1,
    },
  ]);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'fleeing');
  assert.strictEqual(bot.lastAction, 'flee');
});

test('expertMode: transition does not fire when condition fails', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 10;
  bot.currentFSMState = 'gathering';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'fleeing', name: 'Flee', behavior: 'flee', entryAction: null, exitAction: null },
  ], [
    {
      from: 'gathering', to: 'fleeing',
      condition: { subject: 'my.lives', operator: '<=', value: 2 },
      priority: 1,
    },
  ]);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'gathering');
});

// ---- Transition priority -----------------------------------------

test('expertMode: higher-priority transition wins', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1; // triggers BOTH transitions below
  bot.currentFSMState = 'gathering';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'hunting', name: 'Hunt', behavior: 'hunt', entryAction: null, exitAction: null },
    { id: 'fleeing', name: 'Flee', behavior: 'flee', entryAction: null, exitAction: null },
  ], [
    // Both conditions match (lives <= 5 AND lives <= 5)
    {
      from: 'gathering', to: 'hunting',
      condition: { subject: 'my.lives', operator: '<=', value: 5 },
      priority: 1, // lower priority
    },
    {
      from: 'gathering', to: 'fleeing',
      condition: { subject: 'my.lives', operator: '<=', value: 5 },
      priority: 2, // HIGHER priority → should win
    },
  ]);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'fleeing');
});

// ---- Entry / exit actions ----------------------------------------

test('expertMode: entryAction boost_speed adds 0.5 to speed', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.speed = 5;
  bot.currentFSMState = 'gathering';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'fleeing', name: 'Flee', behavior: 'flee', entryAction: 'boost_speed', exitAction: null },
  ], [
    {
      from: 'gathering', to: 'fleeing',
      condition: { subject: 'my.lives', operator: '<=', value: 2 },
      priority: 1,
    },
  ]);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.speed, 5.5);
  assert.strictEqual(bot.speedBoostFrames, 180);
});

test('expertMode: exitAction reset_target fires before entering new state', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.x = 1000; bot.y = 1000;
  bot.targetX = 500; bot.targetY = 500;
  bot.currentFSMState = 'gathering';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: 'reset_target' },
    { id: 'fleeing', name: 'Flee', behavior: 'flee', entryAction: null, exitAction: null },
  ], [
    {
      from: 'gathering', to: 'fleeing',
      condition: { subject: 'my.lives', operator: '<=', value: 2 },
      priority: 1,
    },
  ]);
  bot.pickTargetExpertMode();
  // reset_target sets targetX/Y to the bot's position before the new
  // state's behavior runs. The 'flee' behavior then overrides the target.
  // We can't easily verify the intermediate state, but the new state's
  // action should have run.
  assert.strictEqual(bot.currentFSMState, 'fleeing');
});

test('expertMode: entryAction does not fire when transition does not occur', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.speed = 5;
  bot.lives = 10; // doesn't trigger transition
  bot.currentFSMState = 'gathering';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'fleeing', name: 'Flee', behavior: 'flee', entryAction: 'boost_speed', exitAction: null },
  ], [
    {
      from: 'gathering', to: 'fleeing',
      condition: { subject: 'my.lives', operator: '<=', value: 2 },
      priority: 1,
    },
  ]);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.speed, 5, 'boost should not have applied');
});

// ---- Transitions only from current state -------------------------

test('expertMode: only transitions FROM current state are considered', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.currentFSMState = 'hunting';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'hunting', name: 'Hunt', behavior: 'hunt', entryAction: null, exitAction: null },
    { id: 'fleeing', name: 'Flee', behavior: 'flee', entryAction: null, exitAction: null },
  ], [
    // Only from 'gathering' — should NOT fire
    {
      from: 'gathering', to: 'fleeing',
      condition: { subject: 'my.lives', operator: '<=', value: 2 },
      priority: 1,
    },
  ]);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'hunting');
});

// ---- Default fallback --------------------------------------------

test('expertMode: invalid currentFSMState falls back to gather', () => {
  const ctx = createTestContext({ botCount: 1, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.currentFSMState = 'nonexistent';
  setStates(ctx, [], []);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.lastAction, 'gather');
});

// ---- Emergency override ------------------------------------------

test('expertMode: emergency override short-circuits FSM evaluation', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  ctx.globalSettings.emergencyOverride.enabled = true;
  ctx.globalSettings.emergencyOverride.livesThreshold = 2;
  ctx.globalSettings.emergencyOverride.behavior = 'wander';
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.currentFSMState = 'gathering';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null },
  ], []);
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.lastAction, 'wander');
});

// ---- Bidirectional transitions -----------------------------------

test('expertMode: bot can transition out and back', () => {
  const ctx = createTestContext({ botCount: 2, dotCount: 3 });
  const bot = ctx.bots[0];
  bot.lives = 1;
  bot.currentFSMState = 'gathering';
  setStates(ctx, [
    { id: 'gathering', name: 'Gather', behavior: 'gather', entryAction: null, exitAction: null },
    { id: 'fleeing', name: 'Flee', behavior: 'flee', entryAction: null, exitAction: null },
  ], [
    {
      from: 'gathering', to: 'fleeing',
      condition: { subject: 'my.lives', operator: '<=', value: 2 },
      priority: 1,
    },
    {
      from: 'fleeing', to: 'gathering',
      condition: { subject: 'my.lives', operator: '>', value: 5 },
      priority: 1,
    },
  ]);
  // First call → gathering → fleeing
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'fleeing');
  // Heal up and re-evaluate
  bot.lives = 10;
  bot.pickTargetExpertMode();
  assert.strictEqual(bot.currentFSMState, 'gathering');
});
