# Stack — Game Design Document

## Concept

A mental arithmetic + perception game. Several 3-digit addition and subtraction exercises are displayed in a grid that rearranges itself every few seconds. The player must spot whether any pair of same-operation exercises (within a frame) has a higher row whose result exceeds a lower row's result. Click if such a pair exists; do nothing if not.

The game challenges quick mental arithmetic and visual scanning under time pressure.

---

## Core Loop

1. A grid of 3-digit arithmetic exercises is displayed
2. Player has 6 seconds to decide:
   - **Click** if at least one valid pair exists
   - **Ignore** (do nothing) if no valid pair exists
3. After 6 seconds OR after a click, brief feedback is shown
4. 0.5s pause, then exercises swap positions
5. At the moment of arrival, each exercise has a 60% chance of having its values regenerated
6. New 6-second countdown begins

---

## Valid Pair Definition

A pair `(A, B)` is valid when **all** of:
- `A` and `B` use the **same operation** (both `+` or both `−`)
- `A` and `B` are inside the **same frame** (see Levels)
- `A` is in a row strictly above `B` in the grid (rows 1 vs 2, 1 vs 3, and 2 vs 3 are all checkable)
- `result(A) > result(B)` (strict)

If at least one such pair exists in the current grid, the player **should click**. Otherwise, the player **should ignore**.

---

## Display

- 3-digit operands (100–999)
- For subtraction, ensure operand A ≥ operand B so the result is non-negative
- Show only the question (e.g., `237 + 451`), **not** the result
- Each cell is a fixed-size box at a known grid position
- Operations are mixed across cells (some `+`, some `−`)

---

## Levels

| Level | Rows × Cols | Exercises | Frame Layout |
|-------|-------------|-----------|--------------|
| 1 | 2 × 2 | 4 | one frame around entire grid |
| 2 | 2 × 3 | 6 | one frame around entire grid |
| 3 | 2 × 4 | 8 | one frame around entire grid |
| 4 | 3 × 2 | 6 | one frame around entire grid |
| 5 | 3 × 3 | 9 | one frame around entire grid |
| 6 | 3 × 3 | 9 | one frame **per column** (3 frames) |
| 7 | 3 × 4 | 12 | one frame **per column** (4 frames) |

The frame is a colored border around its enclosed cells. Pairs only count when both cells are inside the same frame.

After level 7, difficulty escalates by reducing the round duration by 0.3s per level (floor at 2s).

---

## Scoring & Progression

### Per-action outcomes

| Outcome | Effect |
|---------|--------|
| **Correct click** (valid pair existed) | +1 advancement-point, +N points |
| **Correct ignore** (no valid pair) | +0.5 advancement-point, +N/2 points |
| **Wrong click** (no valid pair existed) | mistake recorded |
| **Missed** (didn't click when valid pair existed) | mistake recorded |

Where N scales with level (`basePoints + (level-1) × pointsPerLevel`).

### Level changes

- **Advance**: 2.0 advancement-points → next level
- **Demote**: 3 mistakes → previous level (minimum: level 1)
- Advancement-point counter resets on level change
- Mistake counter (the local "3 mistakes to demote" counter) resets **only when reaching a level for the first time** in this game. Re-advancing to a previously-seen level keeps the existing counter.

### Game over

- Total mistakes across the game vs. an allowed budget
- Budget formula: `4 + highestLevelReached × 2`
  - Level 1: 6 total mistakes
  - Level 4: 12 total mistakes
  - Level 7: 18 total mistakes
- Budget grows monotonically as the player reaches new highest levels — never shrinks
- When `realMistakes >= allowedMistakes`, game over → show stats

---

## Movement / Reshuffle

After 6 seconds expire OR a click is registered:

1. **Feedback display** (0.5s): floating notification + tilt + sound for the outcome
2. **Swap animation** (0.5s): exercises animate to new grid positions (random permutation)
3. **Value regeneration** (instant, at end of swap): each cell has a 60% chance of having its values regenerated; otherwise the same exercise moves to a new spot
4. **Countdown begins** (6s)

Operation type can also re-roll on regeneration (since values are re-rolled).

---

## Feedback System

Each player decision triggers immediate feedback:

| Outcome | Notification text | Color | Sound |
|---------|-------------------|-------|-------|
| Correct click | `+N CORRECT!` | green | success chime |
| Wrong click | `WRONG!` | red | error buzz |
| Correct ignore | `+N/2 GOOD` | green | soft chime |
| Missed | `MISSED!` | red | error buzz |

Notifications are floating text near the center of the screen, fading out over ~1.5s.

Mistakes also trigger a brief screen tilt + a sad-face indicator (visual feedback consistent with Verge).

---

## Difficulty Selection (Menu)

Three buttons at start:
- **EASY** — start at level 1
- **MEDIUM** — start at level 4
- **HARD** — start at level 6

When starting past level 1, the highest-level-reached is seeded so the mistake budget is appropriate.

---

## Visual Style

- Dark background
- 6 curated palettes (synthwave, ocean, sunset, neon, forest, midnight) — randomly selected per game
- Frame color uses the palette's accent / highlight
- Exercise text in a clear monospace font
- Floating notifications with palette-driven colors

---

## Audio

- Procedural synthwave background music (110 BPM, bass + arpeggio + pad + hi-hat + kick) — same engine as Verge
- SFX for: correct click, wrong click, correct ignore, missed, level up, level down, swap (subtle whoosh), game over
- Music starts on first user interaction (autoplay-policy compliant)

---

## CONFIG (all hard-coded numbers)

```javascript
const CONFIG = {
  // Round timing
  roundDuration: 6,                // seconds
  postClickPause: 0.5,             // seconds before swap starts
  swapAnimationDuration: 0.5,      // seconds
  postLevel7DurationReduction: 0.3, // seconds per level beyond 7
  minRoundDuration: 2,             // floor

  // Value regeneration on swap
  regenerationChance: 0.6,

  // Number generation
  minOperand: 100,
  maxOperand: 999,
  // For subtraction: operandA >= operandB so result >= 0
  // Operation per cell: 50/50 + or -
  operationMix: 0.5,

  // Scoring
  basePoints: 100,
  pointsPerLevel: 50,
  ignorePointsFraction: 0.5,
  correctClickAdvancement: 1.0,
  correctIgnoreAdvancement: 0.5,
  pointsToAdvance: 2.0,
  mistakesToDemote: 3,

  // Game over
  baseMistakeBudget: 4,
  mistakeBudgetPerLevel: 2,

  // Difficulty
  difficulties: [
    { label: 'EASY',   startLevel: 1 },
    { label: 'MEDIUM', startLevel: 4 },
    { label: 'HARD',   startLevel: 6 },
  ],

  // Level definitions
  levels: [
    { rows: 2, cols: 2, framing: 'grid' },     // 1: 4 ex
    { rows: 2, cols: 3, framing: 'grid' },     // 2: 6 ex
    { rows: 2, cols: 4, framing: 'grid' },     // 3: 8 ex
    { rows: 3, cols: 2, framing: 'grid' },     // 4: 6 ex
    { rows: 3, cols: 3, framing: 'grid' },     // 5: 9 ex
    { rows: 3, cols: 3, framing: 'columns' },  // 6: 9 ex
    { rows: 3, cols: 4, framing: 'columns' },  // 7: 12 ex
  ],

  // Visual
  cellWidthFraction: 0.18,
  cellHeightFraction: 0.10,
  cellGapFraction: 0.02,
  framePadding: 12,
  tiltAngle: [2, 4],
  mistakeFeedbackDuration: 0.4,
  notificationDuration: 1.5,
};
```

---

## Technical Stack

- Single HTML file with embedded CSS and JavaScript
- HTML5 Canvas for rendering
- Web Audio API for SFX and procedural music
- No external dependencies
- Responsive (works on various screen sizes)
