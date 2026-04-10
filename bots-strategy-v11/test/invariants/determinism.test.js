// Invariant: same seed → identical simulation trace.
// The foundation of reproducible tests and regression detection.

const { test } = require('node:test');
const assert = require('node:assert');
const {
  createTestContext, runSimulation, snapshotState, findSnapshotMismatch,
} = require('../helpers');

// Local alias — uses the shared deep-equality walker in helpers.js.
// (The old inline findMismatch did shallow !== comparison, which
// produced false negatives for array fields like childIds.)
const findMismatch = findSnapshotMismatch;

// ---- Basic determinism ----------------------------------

test('determinism: identical seeds produce identical state after 500 frames', () => {
  const ctx1 = createTestContext({ seed: 42, botCount: 10, dotCount: 30 });
  const ctx2 = createTestContext({ seed: 42, botCount: 10, dotCount: 30 });
  runSimulation(ctx1, 500);
  runSimulation(ctx2, 500);
  const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
  assert.strictEqual(mismatch, null, `mismatch found: ${mismatch}`);
});

test('determinism: different seeds produce different state', () => {
  const ctx1 = createTestContext({ seed: 1, botCount: 10, dotCount: 30 });
  const ctx2 = createTestContext({ seed: 2, botCount: 10, dotCount: 30 });
  runSimulation(ctx1, 500);
  runSimulation(ctx2, 500);
  const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
  assert.notStrictEqual(mismatch, null,
    'different seeds should produce different state');
});

// ---- Determinism across scale --------------------------

test('determinism: 20-bot 1000-frame sim is reproducible', () => {
  const ctx1 = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  const ctx2 = createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  runSimulation(ctx1, 1000);
  runSimulation(ctx2, 1000);
  const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
  assert.strictEqual(mismatch, null, `mismatch: ${mismatch}`);
});

// ---- Determinism under lifecycle features --------------

test('determinism: holds with invincibility + starvation enabled', () => {
  const make = () => {
    const ctx = createTestContext({ seed: 42, botCount: 10, dotCount: 20 });
    ctx.lifecycleSettings.respawnInvincibility.enabled = true;
    ctx.lifecycleSettings.starvation.enabled = true;
    return ctx;
  };
  const ctx1 = make();
  const ctx2 = make();
  runSimulation(ctx1, 500);
  runSimulation(ctx2, 500);
  const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
  assert.strictEqual(mismatch, null, `mismatch: ${mismatch}`);
});

test('determinism: holds with reproduction enabled', () => {
  const make = () => {
    const ctx = createTestContext({ seed: 42, botCount: 5, dotCount: 20 });
    ctx.lifecycleSettings.reproduction.asexual.enabled = true;
    ctx.lifecycleSettings.reproduction.asexual.maturityThreshold = 100;
    return ctx;
  };
  const ctx1 = make();
  const ctx2 = make();
  runSimulation(ctx1, 400);
  runSimulation(ctx2, 400);
  const s1 = snapshotState(ctx1);
  const s2 = snapshotState(ctx2);
  // Just compare bot counts + first few bots (the simulation grows
  // unbounded with reproduction, but it should grow identically)
  assert.strictEqual(s1.bots.length, s2.bots.length, 'population sizes differ');
  for (let i = 0; i < Math.min(5, s1.bots.length); i++) {
    assert.strictEqual(s1.bots[i].x, s2.bots[i].x, `bot[${i}].x differs`);
    assert.strictEqual(s1.bots[i].y, s2.bots[i].y, `bot[${i}].y differs`);
  }
});

// ---- Determinism under strategy modes ------------------

test('determinism: advanced mode with custom rules', () => {
  const make = () => {
    const ctx = createTestContext({ seed: 42, botCount: 5, dotCount: 20 });
    ctx.strategyMode = 'advanced';
    ctx.rules.length = 0;
    ctx.rules.push(
      { conditions: [{ subject: 'my.lives', operator: '<=', value: 2 }], action: 'flee' },
      { conditions: [], action: 'gather' }
    );
    ctx.globalSettings.randomnessNoise = 0;
    return ctx;
  };
  const ctx1 = make();
  const ctx2 = make();
  runSimulation(ctx1, 300);
  runSimulation(ctx2, 300);
  const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
  assert.strictEqual(mismatch, null, `mismatch: ${mismatch}`);
});

// ---- Same sim → reproducible kill trace ----------------

test('determinism: kill counts match across independent runs', () => {
  const make = () => createTestContext({ seed: 42, botCount: 15, dotCount: 20 });
  const ctx1 = make();
  const ctx2 = make();
  runSimulation(ctx1, 500);
  runSimulation(ctx2, 500);
  const kills1 = ctx1.bots.map(b => b.killCount);
  const kills2 = ctx2.bots.map(b => b.killCount);
  assert.deepStrictEqual(kills1, kills2);
});
