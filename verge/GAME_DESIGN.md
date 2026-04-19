# Tic-Tac-Toe Perception Game — Design Document

## Concept

A reaction/perception game where spinning tic-tac-toe boards orbit on screen. The player must identify when a highlighted board is one step from victory and click in time. The game lies to the player — false accusations, deceptive score notifications, and adaptive difficulty that exploits the player's weakness patterns. At game end, the true score is revealed.

The philosophy: **stick to your plan regardless of headwind**.

---

## Core Mechanics

### The Screen

- Dark background, full-page HTML5 canvas
- Tic-tac-toe boards float on screen:
  - Each board **rotates around its own center** (self-spin)
  - Each board **orbits along a shared circular path** (orbital movement)
- A **highlight circle** jumps between boards, staying on each for a random duration (configurable, default 3–5 seconds)
- Colors are drawn from randomly selected pleasant palettes

### Board States

- Each board displays a tic-tac-toe game state
- Some boards are **one step from victory** (X or O can win with one move) — these are "valid"
- Some boards are **not** one step from victory — these are "invalid"
- The ratio of valid/invalid boards varies; it's possible for all, none, or some to be valid at any moment
- Board states **reshuffle periodically** (configurable, default every 4–8 seconds per board)

### Player Action

- **Click anywhere on screen** when the currently highlighted board is valid (one step from victory)
- **Do not click** when the highlighted board is invalid

### What Counts as Right/Wrong

| Situation | Player Action | Result |
|-----------|--------------|--------|
| Highlighted board IS valid | Click | **Correct** — points awarded |
| Highlighted board IS valid | No click (circle leaves) | **Miss** — mistake recorded |
| Highlighted board is NOT valid | Click | **Misclick** — mistake recorded |
| Highlighted board is NOT valid | No click | Correct (no reward, no penalty) |
| No board highlighted | Click | **Misclick** — mistake recorded |

- No grace period: if the circle leaves a valid board without a click, it's a miss immediately

---

## Scoring

### Points

- Points scale with level — higher levels award more points
- **80% chance** the player receives the correct point value for their level
- **20% chance** the player receives the point value of the level below (minimum: level 1 points)

### Score Display

- The player does **NOT** see a running total score
- On each correct click or mistake, a floating notification shows points earned/lost
- **5% chance** any notification is a lie:
  - A correct action may show a "WRONG" notification with penalty
  - The game tilts and shows the red smiley even though nothing bad happened
- The **true score** is tracked internally and revealed only at game end

### Deceptive Notifications

- False "wrong" notifications: tilt + red smiley + fake penalty display
- These do NOT affect the true score
- These do NOT count as real mistakes toward game-over

---

## Level Progression

### Advancement

- After a **random number of correct clicks** (configurable, default 3–5), the player advances one level
- The win-count-to-advance is re-rolled each time

### Demotion

- On each real mistake, **80% chance** (configurable) the player is demoted one level (minimum: level 1)

### Level Definitions

| Level | Change |
|-------|--------|
| 1 | 1 board. Circle appears/disappears on it |
| 2 | 2 boards |
| 3 | 3 boards |
| 4 | 4 boards |
| 5 | Speed increase (rotation + orbit) |
| 6 | 5 boards |
| 7 | 6 boards |
| 8 | Speed increase |
| 9 | 7 boards |
| 10 | 8 boards |
| 11 | Speed increase |
| 12 | Rotation direction switches every 8–10 seconds (all boards) |
| 13 | Mixed rotation: some boards clockwise, others counter-clockwise |
| 14 | Orbit direction switches every 7–9 seconds |
| 15 | Two boards highlighted simultaneously — click if at least one is valid |

After level 15, difficulty continues escalating (faster speeds, shorter highlight durations, etc.)

---

## Adaptive Difficulty (Bias System)

The game tracks mistake types:
- **Misclicks** (clicking when shouldn't)
- **Misses** (not clicking when should)

Based on the player's weakness:
- If more **misclicks**: the game biases toward highlighting more **invalid** boards (tempting bad clicks)
- If more **misses**: the game biases toward highlighting more **valid** boards with shorter durations (tempting missed opportunities)
- This bias is **subtle** — not heavy-handed (configurable weight, default ~60/40 split toward exploiting weakness vs. random)

---

## Game Over

- After a configurable random number of **real mistakes** (default 6–8), the game ends
- The mistake count is re-rolled at game start
- Game over screen shows:
  - **True score** (unaffected by false notifications)
  - Total correct clicks
  - Total misclicks
  - Total misses
  - Highest level reached
  - Number of false accusations that occurred

---

## Visual Effects

### Mistake Feedback (Real or False)

- Screen **tilts slightly** (CSS transform rotate, ~2–5 degrees)
- A **red smiley face** appears briefly (~0.5 seconds)
- Both effects triggered on real mistakes AND false accusations (5% chance)

### Color Palettes

- Multiple curated palettes (synthwave, ocean, forest, sunset, neon, etc.)
- One palette selected randomly at game start
- Palette drives: background accents, board lines, X/O colors, highlight circle, notifications

### Boards

- Drawn on canvas with clean lines
- X and O are clearly distinguishable even while spinning
- The highlight circle is a glowing ring around the board

---

## Audio

### Sound Effects

- Correct click: pleasant chime
- Mistake (real or false): error buzz / negative tone
- Level up: ascending arpeggio
- Level down: descending tone
- Circle jump (highlight moves): subtle tick
- Game over: distinctive end sound

### Music

- Synthwave-style ambient music
- Calm but rhythmic
- Generated procedurally with Web Audio API
- Plays throughout the game at lower volume
- Arpeggiated synth pads, steady bass, light percussion

---

## Configuration

All hard-coded numbers are exposed in a config object:

```javascript
const CONFIG = {
  // Level progression
  winsToAdvance: [3, 5],           // random range
  demotionChance: 0.80,
  
  // Mistakes & game over
  mistakesToGameOver: [6, 8],      // random range
  falseAccusationChance: 0.05,
  
  // Scoring
  correctPointsChance: 0.80,       // chance of getting level-appropriate points
  basePoints: 100,                  // level 1 points
  pointsPerLevel: 50,              // additional points per level
  
  // Highlight timing
  highlightDuration: [3, 5],       // seconds, random range
  
  // Board state reshuffling
  boardReshuffleInterval: [4, 8],  // seconds, random range
  
  // Speed
  baseSelfRotationSpeed: 0.5,      // radians per second
  baseOrbitSpeed: 0.3,             // radians per second
  speedMultiplierPerIncrease: 1.3, // multiplier each speed-increase level
  
  // Direction switches
  rotationSwitchInterval: [8, 10], // seconds
  orbitSwitchInterval: [7, 9],     // seconds
  
  // Adaptive difficulty
  adaptiveBiasWeight: 0.6,         // how much to exploit weakness (0.5 = no bias)
  
  // Visual
  tiltAngle: [2, 5],              // degrees
  mistakeFeedbackDuration: 0.5,   // seconds
  orbitRadius: 250,               // pixels (responsive)
  boardSize: 80,                  // pixels (responsive)
  
  // Level 1 specific
  level1CircleAppearInterval: [2, 4], // seconds circle is visible
  level1CircleHideInterval: [1, 3],   // seconds circle is hidden
  
  // Level definitions (which levels trigger which changes)
  levelBoardCounts: {1:1, 2:2, 3:3, 4:4, 6:5, 9:7, 10:8},
  speedIncreaseLevels: [5, 8, 11],
  directionSwitchLevel: 12,
  mixedRotationLevel: 13,
  orbitSwitchLevel: 14,
  dualHighlightLevel: 15,
};
```

---

## Technical Stack

- Single HTML file with embedded CSS and JavaScript
- HTML5 Canvas for rendering
- Web Audio API for sound effects and procedural music
- No external dependencies
- Responsive (works on various screen sizes)
