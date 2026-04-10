// Long-run determinism: same seed → identical state after 10k+ frames.
// Verifies reproducibility survives long simulations.

const { test } = require('node:test');
const assert = require('node:assert');
const {
  createTestContext, runSimulation, snapshotState, findSnapshotMismatch,
} = require('../helpers');

const findMismatch = findSnapshotMismatch;

// ---- 10k-frame determinism at realistic scale ---------

test('determinism-long: 20-bot 10k-frame sim reproducible', () => {
  const mk = () => createTestContext({ seed: 42, botCount: 20, dotCount: 50 });
  const ctx1 = mk();
  const ctx2 = mk();
  runSimulation(ctx1, 10_000);
  runSimulation(ctx2, 10_000);
  const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
  assert.strictEqual(mismatch, null, `mismatch: ${mismatch}`);
});

// ---- Different seeds still diverge over 10k frames ----

test('determinism-long: different seeds diverge over 10k frames', () => {
  const ctx1 = createTestContext({ seed: 1, botCount: 20, dotCount: 50 });
  const ctx2 = createTestContext({ seed: 2, botCount: 20, dotCount: 50 });
  runSimulation(ctx1, 10_000);
  runSimulation(ctx2, 10_000);
  const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
  assert.notStrictEqual(mismatch, null, 'expected divergence');
});

// ---- Intermediate snapshots match ---------------------

test('determinism-long: intermediate snapshots match at multiple checkpoints', () => {
  const mk = () => createTestContext({ seed: 123, botCount: 10, dotCount: 30 });
  const ctx1 = mk();
  const ctx2 = mk();
  const checkpoints = [500, 1000, 2000, 5000];
  for (const cp of checkpoints) {
    const frames = cp - ctx1.frameCount;
    runSimulation(ctx1, frames);
    runSimulation(ctx2, frames);
    const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
    assert.strictEqual(mismatch, null, `at frame ${cp}: ${mismatch}`);
  }
});

// ---- 10k-frame determinism with full lifecycle --------

test('determinism-long: reproducible with lifecycle features', () => {
  const mk = () => {
    const ctx = createTestContext({ seed: 42, botCount: 15, dotCount: 40 });
    ctx.lifecycleSettings.respawnInvincibility.enabled = true;
    ctx.lifecycleSettings.starvation.enabled = true;
    ctx.lifecycleSettings.starvation.resetConditions.onDotEaten = true;
    return ctx;
  };
  const ctx1 = mk();
  const ctx2 = mk();
  runSimulation(ctx1, 10_000);
  runSimulation(ctx2, 10_000);
  const mismatch = findMismatch(snapshotState(ctx1), snapshotState(ctx2));
  assert.strictEqual(mismatch, null, `mismatch: ${mismatch}`);
});
