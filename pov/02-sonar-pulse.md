# 02 — Sonar Pulse

> Full-screen radar display — the world as the bot perceives it

## Visual Identity

**Mood:** Submarine warfare, deep tension, minimalist information scarcity
**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Background | `#050a05` | Near-black green (CRT feel) |
| Grid lines | `#0a2a0a` | Very faint green grid |
| Distance rings | `#0d3d0d` | Concentric range circles |
| Sweep line | `#00ff41` at 80% opacity | Rotating scan line |
| Sweep afterglow | `#00ff41` → `#000` | Fading trail behind sweep |
| Player blip | `#00ff41` | Bright green, center |
| Bot blips | `#ff3333` | Red triangles |
| Food blips | `#ffcc00` | Amber circles |
| Pack blips | `#33ff33` | Green (allied) |
| Ghost trails | `#00ff41` at 20% | Smeared afterimages |
| HUD text | `#00cc33` | Monospace readouts |
| Alert text | `#ff3333` | Warnings |
| Scanline noise | `#00ff41` at 5% | Horizontal CRT lines |

## Screen Layout

```
┌──────────────────────────────────────────────┐
│                                              │
│    BEARING ─── 000° ─── HEADING: NE          │
│                                              │
│         ╭────── 300u ──────╮                 │
│       ╱  ╭──── 200u ────╮   ╲               │
│      │  ╱  ╭── 100u ──╮  ╲   │              │
│      │ │  │     ●      │   │  │              │
│      │ │  │   (YOU)    │   │  │              │
│      │  ╲  ╰───────────╯  ╱   │              │
│       ╲  ╰───────────────╯   ╱               │
│         ╰────────────────────╯               │
│                                              │
│   ╱ sweep                                    │
│                                              │
├──────────┬───────────────────┬───────────────┤
│ SPD 3.2  │  CONTACTS: 4     │ PING ████░░░  │
│ ATK 2.1  │  FOOD: 7         │ next in 1.2s  │
│ DEF 4.0  │  THREATS: 2      │               │
│ LIV 5    │  KILLS: 3        │ [ACTIVE SCAN] │
└──────────┴───────────────────┴───────────────┘
```

## Radar Display — Primary Canvas (80% of screen)

### Coordinate System

The radar is **heading-up**: the player bot's current movement direction always points to 12 o'clock. The world rotates around the player. This creates a natural "forward is up" orientation.

```javascript
// Transform world coordinates to radar-relative
function worldToRadar(entityX, entityY, playerX, playerY, playerHeading) {
    const dx = entityX - playerX;
    const dy = entityY - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) - playerHeading + Math.PI / 2;
    return {
        x: centerX + Math.cos(angle) * (dist / maxRange) * radarRadius,
        y: centerY + Math.sin(angle) * (dist / maxRange) * radarRadius,
        dist: dist
    };
}
```

### Distance Rings

Three concentric circles at 100u, 200u, 300u intervals:
- Drawn as 1px stroked circles in the grid color
- Small distance label at the 12 o'clock position on each ring: `100`, `200`, `300`
- Rings subtly pulse when a blip crosses them

### Bearing Markers

Cardinal and ordinal bearings around the outer ring:
```
           000°
    315°          045°
270°       ●        090°
    225°          135°
           180°
```
- Current heading always at 000° (top)
- Absolute compass bearing shown in HUD text at top: "HEADING: NE (047°)"

### Sweep Mechanism

A single line rotates clockwise from the center to the outer ring:

- **Rotation speed:** One full revolution every 3 seconds (120° per second)
- **Sweep line:** Bright green, 2px, with a slight glow (shadow blur)
- **Afterglow:** Behind the sweep line, a 30° wedge of fading green (canvas arc filled with angular gradient from bright to transparent)
- **Reveal timing:** Entities are only "painted" when the sweep line passes over their bearing angle

```javascript
// Sweep rendering
const sweepAngle = (frameCount * SWEEP_SPEED) % (Math.PI * 2);
const afterglowSpan = Math.PI / 6; // 30°

// Afterglow wedge
ctx.beginPath();
ctx.moveTo(cx, cy);
ctx.arc(cx, cy, radarRadius, sweepAngle - afterglowSpan, sweepAngle);
const grad = ctx.createConicGradient(sweepAngle - afterglowSpan, cx, cy);
// ... angular gradient from transparent to green
ctx.fill();

// Sweep line
ctx.beginPath();
ctx.moveTo(cx, cy);
ctx.lineTo(
    cx + Math.cos(sweepAngle) * radarRadius,
    cy + Math.sin(sweepAngle) * radarRadius
);
ctx.strokeStyle = SWEEP_COLOR;
ctx.lineWidth = 2;
ctx.stroke();
```

### Blip System

Entities appear as blips when the sweep passes them. Blips then **fade over the next full revolution** (3 seconds).

#### Blip Types

| Entity | Shape | Size | Color | Behavior |
|--------|-------|------|-------|----------|
| Player | Filled circle | 6px | Bright green | Always visible (no fade) |
| Enemy bot | Triangle (▲) | 5–10px (scales with stats) | Red | Fades to 10% between sweeps |
| Pack member | Triangle (▲) | 5–10px | Green | Fades to 20% |
| Food | Circle (●) | 3px | Amber | Fades to 15% |
| Field boundary | Dashed arc | — | Dim green | Shown where boundary intersects radar range |

#### Blip Fading

Each blip tracks its last-painted frame. Opacity decays linearly:

```javascript
const age = frameCount - blip.lastPaintedFrame;
const sweepFrames = 180; // 3 seconds at 60fps
const opacity = Math.max(0.1, 1.0 - (age / sweepFrames));
```

Between sweeps, blips show where entities **were**, not where they **are**. Fast-moving bots will have visibly displaced blips when the sweep refreshes — this is a feature, not a bug. The player learns to anticipate movement.

#### Ghost Trails

For bots that have been swept multiple times, keep the last 3 blip positions. Draw them as progressively fainter dots connected by a thin line — a motion trail showing the bot's trajectory across sweeps.

```javascript
// Ghost trail rendering
for (let i = 0; i < blip.history.length - 1; i++) {
    const alpha = 0.15 * (i + 1) / blip.history.length;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(blip.history[i].x, blip.history[i].y, 2, 0, Math.PI * 2);
    ctx.fill();
    // Connecting line
    ctx.beginPath();
    ctx.moveTo(blip.history[i].x, blip.history[i].y);
    ctx.lineTo(blip.history[i + 1].x, blip.history[i + 1].y);
    ctx.stroke();
}
```

### CRT Effects

Layered post-processing for the radar-screen aesthetic:

1. **Scanlines:** Horizontal lines every 2px at 5% opacity (drawn once to an offscreen canvas, composited over)
2. **Vignette:** Radial gradient darkening outside the radar circle (also masks the square canvas into a circle)
3. **Glow:** Apply `ctx.shadowBlur = 8` and `ctx.shadowColor = '#00ff41'` on all green elements
4. **Noise:** Random pixels at 1% opacity, refreshed every 10 frames
5. **Slight barrel distortion (optional):** CSS `border-radius: 50%` on the canvas + slight `scale(1.02)` gives a CRT bulge feel without actual distortion math

### Ping Mechanic (Active Scan)

In addition to the passive sweep, the player bot can emit an **active ping** (automatic, not player-triggered — tied to the bot's AI decision cycle):

- **Ping frequency:** Every 3 seconds (synced with sweep, or offset by 1.5s for interleaving)
- **Visual:** A bright green ring expands from center to edge over 0.5 seconds, then fades
- **Effect:** All entities within range are briefly revealed at full brightness regardless of sweep position
- **Range:** 300u base, scales with speed stat: `250 + speed × 10`
- **Tactical tradeoff:** Active pings could theoretically alert enemies (visual only — a faint pulse visible on their radar if they were also in sonar mode)

```javascript
function renderPing(ctx, cx, cy, pingAge, maxAge) {
    const progress = pingAge / maxAge;
    const radius = progress * radarRadius;
    const opacity = 1.0 - progress;
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 255, 65, ${opacity * 0.6})`;
    ctx.lineWidth = 3 - progress * 2;
    ctx.stroke();
}
```

## HUD Strip — Bottom 20%

Three columns with monospace green text on dark background:

### Left Column: Stats
```
SPD  3.2  ████████░░
ATK  2.1  █████░░░░░
DEF  4.0  ██████████
LIV  5    █████░░░░░
```
Bar fills are green, using block characters or thin canvas bars.

### Center Column: Contacts
```
CONTACTS: 4  ▲▲▲▲
FOOD:     7  ●●●●●●●
THREATS:  2  ▲▲ (!)
KILLS:    3
```
- "THREATS" = bots within 150u with higher combat advantage. Shown with `(!)` warning.
- Contact count only includes entities painted in the last sweep (stale blips excluded).

### Right Column: Ping Status
```
PING  ████████░░░  next: 1.2s
MODE: [ACTIVE SCAN]
RANGE: 310u
```
- Ping cooldown bar fills from left to right
- Mode toggle: `ACTIVE SCAN` (periodic pings) or `PASSIVE` (sweep only, wider range)

## Combat Visualization

### Approach (target within 200u)
- Target blip starts **pulsing** (opacity oscillates 0.5–1.0)
- A dashed line connects player center to target blip
- Distance readout appears along the line: `"142u ▼"` (▼ = closing)

### Engagement (within combat range)
- Target blip becomes a **solid bright red** circle (no fading)
- Rapid ping bursts: 3 pings in 0.5s (concentric rings)
- Impact: white flash at target blip position, brief static noise on the sweep
- Damage readout in HUD: `"HIT -2.3"` or `"BLOCKED"`

### Kill
- Target blip **explodes**: expands to 3× size then fades with particle scatter (small dots flying outward)
- Kill text in center: `"CONTACT LOST — Bot #7 DESTROYED"` — fades after 2 seconds
- Ghost trail for that bot dims and disappears

### Player Death
- All blips flash white
- Sweep stops, then restarts from a new position
- Brief static across entire display
- `"SIGNAL LOST — RESPAWNING"` text in center

## Interaction & Controls

| Key | Action |
|-----|--------|
| **P** | Toggle active/passive scan mode |
| **TAB** | Cycle tracked target (highlighted with bracket) |
| **+/−** | Zoom radar range (200u / 300u / 500u) |
| **H** | Toggle heading-up vs north-up orientation |
| **SPACE** | Pause (sweep stops, blips freeze) |

## Performance Notes

- **Sweep rendering:** Single conic gradient per frame — lightweight
- **Blip tracking:** Array of {x, y, type, lastPainted, history[3]} — max ~70 entries (20 bots + 50 food)
- **CRT effects:** Pre-rendered to offscreen canvas, composited once per frame
- **Ghost trails:** Max 3 history points per blip — minimal memory

## What Makes This Unique

Sonar Pulse is the **information-scarcity** concept. You never see the world in real time — only snapshots revealed by the sweep. Between sweeps, you're operating on memory and prediction. Fast bots are harder to track. The CRT aesthetic makes it feel like a completely different genre — more submarine sim than bot game. It's the most atmospheric of all the POV concepts.

## Map Integration

**Has both POV and overview?** No — the radar IS the map. It shows the full field (at max zoom) but through the lens of the sweep mechanic. There's no separate top-down view.

**Potential enhancement:** Add a `TAB`-toggle secondary display mode: a brief (2-second) flash of a full top-down map overlay in night-vision green, like "checking the tactical display" — then it fades back to radar. Limited uses per game (3 charges) to keep it scarce.
