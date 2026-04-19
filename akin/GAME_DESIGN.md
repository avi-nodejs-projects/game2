# Akin — Game Design Document

## Concept

A perception game where shapes (triangles and stars) orbit a large circle. Each shape contains an inner thing with three characteristics: color, inner shape, and fill type. An arrow connects a triangle and a star; the player must click if their contents share at least two of the three characteristics, otherwise do nothing.

Memory comes into play at higher levels, where one or more shapes have their contents hidden and the player must remember what was there.

---

## Core Loop

1. Shapes orbit the big central circle
2. An arrow appears between one star and one triangle
3. Player has **5 seconds** to decide:
   - **Click** if contents share ≥2 of {color, inner shape, fill type}
   - **Ignore** if contents share <2
4. After 5 seconds OR a click, a new arrow pair is chosen
5. Every correct decision → level up
6. 3 consecutive mistakes → level down (minimum level 1)
7. 6 consecutive mistakes → game over
8. 120-second hard cap on total game time

---

## Shape Attributes

Each shape on the circle has:

**Outer container** (1 of 2):
- Triangle
- Star

**Inner shape** (1 of 4):
- Circle
- Square
- Diamond
- Hexagon

**Color** (1 of 5):
- Five palette-driven colors

**Fill type** (1 of 4):
- Solid
- Dots (pattern of dots in the color on background)
- Stripes (diagonal stripes in the color on background)
- White (inner shape filled white regardless of color)

Total unique contents: 4 × 5 × 4 = 80.

The **outer container** (triangle vs star) is NOT a matching characteristic — the arrow always points between one of each, and we only compare inner content.

---

## Arrow & Pair Selection

- Arrow is drawn as a straight line between one triangle and one star, with arrowheads at both ends (or a directed arrow — directionless is fine since we compare both sides)
- Each round, the system picks one random triangle and one random star
- The pair has a 5-second window for the decision

### Click Condition

Click **if and only if** the two contents share **≥2** of:
1. Same color
2. Same inner shape
3. Same fill type

Sharing all 3 still counts as a valid click (is a superset of sharing 2).

---

## Level Progression

| Level | Shapes | Hidden | New mechanic |
|-------|--------|--------|--------------|
| 1 | 4 | 0 | base orbit |
| 2 | 5 | 0 | — |
| 3 | 6 | 0 | **orbit direction flips on every click** |
| 4 | 7 | 0 | — |
| 5 | 8 | 0 | — |
| 6 | 9 | 1 | **one shape becomes hidden** |
| 7 | 10 | 2 | one more hidden |
| 8 | 11 | 3 | **individual orbit rotation** (per-shape direction) |
| 9 | 12 | 4 | one more hidden |
| 10 | 12 | 5 | one more hidden |
| 11 | 12 | 6 | one more hidden (cap) |
| 12+ | 12 | 6 | continues at max difficulty |

- Shape count grows from 4 at L1 to 12 at L9, then caps
- Hidden count starts at L6 and grows by 1 per level, capped at 6
- At L3+, the global orbit direction flips on every click (correct or wrong)
- At L8+, each shape has its own orbit direction that flips on a 3–5s random timer, with a 50% chance per flip that the shape keeps its current direction

---

## Hidden Shapes

At L6 and beyond:

- When the player levels up to a new hidden-enabling level, one random visible shape gets the **blink-hide** treatment: a blinking frame draws attention to it for ~0.8s, then its content is hidden (drawn as the outer container only, with a `?` or blank inside)
- The shape remains hidden indefinitely until:
  - **Demotion** (hidden count decreases): one random hidden shape is revealed
  - **Relevant mistake**: if the player misses a click when a hidden shape was in the pair and it should have been clicked, the hidden content is revealed for **1 second** as feedback, then re-hidden
- When the player levels up again and a new hidden slot appears, another visible shape gets hidden (without revealing the previous ones)

---

## Swap Events

Every **10 seconds**, a random swap event fires. Each event is one of two types (chosen 50/50):

1. **Position swap**: Two random shapes exchange their orbit positions
2. **Type flip**: Two random shapes flip outer container (triangle ↔ star); their inner content stays with them

Both types preserve inner content → the player's memory of hidden shapes still applies, even if the shape's visual position or outer type changes.

---

## Level 3+ Direction Flip

At L3 and beyond, on every click (correct or wrong, but not on missed-ignore), the global orbit direction is multiplied by -1. At L8+ where individual rotation kicks in, every shape's individual direction flips on a click.

---

## Level 8+ Individual Rotation

At L8 and beyond, each shape has:
- Its own rotation direction (±1)
- A per-shape countdown timer (re-rolled to 3–5s each time)
- When the timer expires, the shape has a 50% chance to flip its direction, and the timer re-rolls

The base group orbit speed still applies; the individual direction overrides the group direction.

---

## Scoring & Game End

- Correct click / correct ignore: level up, counter resets
- Wrong click / missed click: mistake
- **3 consecutive mistakes** → demote 1 level (min 1)
- **6 consecutive mistakes** → game over
- **120 seconds total** → game over
- Game over screen: total correct, total mistakes, highest level reached, time played

---

## Configuration

All numbers exposed in CONFIG:

```javascript
const CONFIG = {
  // Core timing
  roundDuration: 5,               // seconds per arrow decision
  totalGameTime: 120,             // seconds
  swapInterval: 10,               // seconds between swap events

  // Shape counts
  startingShapes: 4,
  maxShapes: 12,

  // Hidden content
  hiddenStartLevel: 6,
  maxHidden: 6,
  revealFeedbackDuration: 1.0,    // seconds hidden content flashes on miss
  blinkHideDuration: 0.8,         // blink-frame time before hiding

  // Level mechanics
  directionFlipOnClickLevel: 3,
  individualRotationLevel: 8,

  // Individual rotation (L8+)
  individualRotationTimer: [3, 5],
  individualFlipProbability: 0.5,  // chance to actually flip when timer expires (0.5 = 50% keep)

  // Scoring
  consecutiveMistakesToDemote: 3,
  consecutiveMistakesToGameOver: 6,

  // Rotation speeds
  baseOrbitSpeed: 0.35,            // radians/second

  // Shape rendering
  circleRadiusFraction: 0.32,      // of min(width, height)
  shapeSize: 58,                   // outer shape diameter

  // Arrow
  arrowLineWidth: 4,
  arrowHeadSize: 14,

  // Difficulty buttons
  difficulties: [
    { label: 'EASY',   startLevel: 1 },
    { label: 'MEDIUM', startLevel: 4 },
    { label: 'HARD',   startLevel: 7 },
  ],

  // Feedback / VFX (matches Stack/Verge conventions)
  tiltAngle: [2, 4],
  mistakeFeedbackDuration: 0.4,
  notificationDuration: 1.5,
  smileySize: 38,
};
```

---

## Visual Style

- Dark background
- Large central circle drawn as a faint outline (visual anchor for the orbit)
- Shapes rendered as outlined polygons (triangle, star) with inner content
- Arrow as straight line with arrowhead, drawn in the palette's highlight color
- HUD: level (top-left), game time bar (top), round timer
- Pause / restart / help / music / sfx toolbar at top (same as Stack)
- Random palette per game (~6 options, same as previous games)

---

## Audio

- Same synthwave engine as Verge/Stack (110 BPM, bass + arpeggio + pad + hi-hat + kick)
- SFX for: correct, wrong, level up, level down, swap event, game over
