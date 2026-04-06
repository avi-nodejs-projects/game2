# 03 — The Cockpit

> HUD-heavy chase camera with targeting systems and instrument panels

## Visual Identity

**Mood:** Arcade flight sim, fast-paced action, information-rich empowerment
**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Field background | Standard v11 green | Normal field, just zoomed in |
| HUD chrome | `rgba(0, 20, 40, 0.75)` | Dark translucent panels |
| HUD borders | `#00bcd4` | Cyan accent lines |
| Targeting brackets | `#ff1744` (hostile) / `#ffd740` (food) | Lock-on indicators |
| Threat arrows | `#ff5252` | Edge-of-screen danger markers |
| Gauge fills | Per-stat colors from v11 | Cyan/red/indigo/green |
| Speed lines | `rgba(255, 255, 255, 0.15)` | Motion blur effect |
| Reticle | `#00e676` | Center crosshair |
| Kill text | `#ffd740` | Gold announcement |
| Damage numbers | `#ff1744` (damage) / `#00e676` (blocked) | Floating combat text |

## Screen Layout

```
┌─ REAR-VIEW MIRROR ──────────────────────────────────┐
│  ◄ · ▲bot · · · ▲bot · · · · ●food · · · · · · ►   │
├──────────────────────────────────────────────────────┤
│ ┌────┐                                     ┌────┐   │
│ │SPD │         ┌───────────┐               │ATK │   │
│ │    │         │  ┌─ ─ ─┐  │               │    │   │
│ │ ◔  │         │  │TARG │  │               │ ◔  │   │
│ │dial│         │  └─ ─ ─┘  │               │dial│   │
│ │    │    ←▲   │    ● YOU   │   ▲→          │    │   │
│ ├────┤         │           │               ├────┤   │
│ │DEF │         │           │               │LIV │   │
│ │    │         └───────────┘               │    │   │
│ │ ◔  │              ↓▲                     │ ◔  │   │
│ │dial│                                     │dial│   │
│ │    │                                     │    │   │
│ └────┘                                     └────┘   │
├──────────────────────────────────────────────────────┤
│ TGT: Bot#7 142u NE │ ADV: ▲+23% │ KILLS: 3 │ ⏱2:34 │
└──────────────────────────────────────────────────────┘
```

## Camera System

### Chase Camera

The camera follows the player bot with a **2× zoom** (showing approximately 500×375 units of the 2000×2000 world). The player bot is positioned at the **center-bottom third** of the screen (golden ratio: 61.8% down from top), giving more forward visibility.

```javascript
const CAM_ZOOM = 2.0;
const PLAYER_SCREEN_Y = canvas.height * 0.618;
const PLAYER_SCREEN_X = canvas.width / 2;

function updateCamera(playerBot) {
    // Smooth follow with slight lag (cinematic feel)
    const lerpFactor = 0.08;
    camX += (playerBot.x - camX) * lerpFactor;
    camY += (playerBot.y - camY) * lerpFactor;
}

function worldToScreen(wx, wy) {
    return {
        x: PLAYER_SCREEN_X + (wx - camX) * CAM_ZOOM,
        y: PLAYER_SCREEN_Y + (wy - camY) * CAM_ZOOM
    };
}
```

### Camera Lead

When the bot is moving, the camera slightly **leads** in the direction of movement, showing more of where the bot is heading:

```javascript
const LEAD_AMOUNT = 40; // pixels of camera lead
const leadX = Math.cos(playerBot.heading) * LEAD_AMOUNT;
const leadY = Math.sin(playerBot.heading) * LEAD_AMOUNT;
// Add to target position before lerp
```

### Speed Lines

When the player bot is moving fast (speed > 3), draw **motion blur lines** that streak past:

```javascript
if (playerBot.speed > 3) {
    const intensity = Math.min((playerBot.speed - 3) / 5, 1);
    const lineCount = Math.floor(intensity * 12);
    for (let i = 0; i < lineCount; i++) {
        // Random position in outer 30% of screen
        // Lines angle from center outward (radial motion blur)
        // Length scales with speed, opacity 0.1-0.2
    }
}
```

## HUD Elements

### Rear-View Mirror (Top Strip)

A **40px-tall horizontal strip** across the full width showing a compressed, horizontally-flipped view of what's behind the player bot (180° opposite heading):

- **View:** 160° arc behind the bot, compressed to fit the strip
- **Rendering:** Entities in the rear arc are drawn as small icons (triangles for bots, circles for food) positioned horizontally based on their bearing relative to "directly behind"
- **Background:** Darker shade of the field, slightly desaturated
- **Border:** Thin cyan line at bottom, slight mirror reflection effect (gradient fade at top)
- **Range:** Only shows entities within 300u behind

```javascript
function drawRearView(ctx, stripY, stripH) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, stripY, canvas.width, stripH);
    ctx.clip();
    
    // Dim background
    ctx.fillStyle = 'rgba(0, 10, 0, 0.6)';
    ctx.fillRect(0, stripY, canvas.width, stripH);
    
    // For each entity behind the player:
    const behindAngle = playerBot.heading + Math.PI;
    entities.forEach(e => {
        const angle = Math.atan2(e.y - playerBot.y, e.x - playerBot.x);
        const relAngle = normalizeAngle(angle - behindAngle);
        if (Math.abs(relAngle) < Math.PI * 0.44) { // 160° arc
            const screenX = canvas.width / 2 + (relAngle / (Math.PI * 0.44)) * (canvas.width / 2 - 20);
            const dist = distance(e, playerBot);
            const size = Math.max(2, 8 - dist / 50);
            // Draw small icon at (screenX, stripY + stripH/2)
        }
    });
    ctx.restore();
}
```

### Instrument Gauges (Side Panels)

Four **circular analog gauges**, two on each side, each 80×100px:

| Position | Stat | Gauge Style |
|----------|------|-------------|
| Top-left | Speed | Cyan, speedometer needle |
| Bottom-left | Defence | Indigo, shield meter |
| Top-right | Attack | Red, power meter |
| Bottom-right | Lives | Green, segmented arc (one segment per life) |

Each gauge:
- Circular arc from 7 o'clock to 5 o'clock (270° range)
- Tick marks at regular intervals
- Needle pointing to current value
- Digital readout below: `"3.2"` in monospace
- Background: dark translucent panel with 1px cyan border
- **Animation:** Needle smoothly interpolates to new values (spring physics: overshoot + settle)
- **Alert state:** When value changes, gauge briefly glows brighter. Lives gauge pulses red when at 1.

```javascript
function drawGauge(ctx, x, y, w, h, value, maxValue, color, label) {
    const cx = x + w / 2;
    const cy = y + h * 0.45;
    const radius = Math.min(w, h) * 0.35;
    
    // Background panel
    roundedRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = 'rgba(0, 20, 40, 0.75)';
    ctx.fill();
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Arc track
    const startAngle = Math.PI * 0.75;  // 7 o'clock
    const endAngle = Math.PI * 2.25;    // 5 o'clock
    const valueAngle = startAngle + (value / maxValue) * (endAngle - startAngle);
    
    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Value arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, valueAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Needle
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
        cx + Math.cos(valueAngle) * (radius - 5),
        cy + Math.sin(valueAngle) * (radius - 5)
    );
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Label and value
    ctx.fillStyle = '#b0bec5';
    ctx.font = '10px monospace';
    ctx.fillText(label, cx, y + h - 20);
    ctx.fillStyle = color;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(value.toFixed(1), cx, y + h - 6);
}
```

### Targeting System (Center of Main View)

#### Center Reticle
A subtle crosshair at screen center (where the player bot sits):
- Four 8px lines (top/bottom/left/right) with a 6px gap from center
- Faint green, 40% opacity when no target
- Brightens to 100% during target lock

#### Target Brackets

When the bot has a target, brackets appear around the target entity:

**Enemy target:**
```
    ┌─          ─┐
    │   ▲ Bot#7  │
    │   ATK:5.2  │
    └─          ─┘
```
- Red corner brackets, animated: corners rotate inward slightly when locking on
- Size scales inversely with distance (larger brackets when closer)
- Small info readout: name + dominant stat
- **Lock-on animation:** Brackets start at 2× size and converge to fit over 0.3 seconds

**Food target:**
```
    ╭─    ─╮
    │  ●   │
    ╰─    ─╯
```
- Amber rounded brackets, softer feel
- No info readout (just the bracket)

#### Threat Arrows

For off-screen enemies within 400u, draw **chevron arrows** at the screen edge pointing toward them:

```
         ▼ (enemy above/behind in rear view)
    
◄ 120u                              ► 85u
    
```

- Arrow color: red opacity scales with proximity (closer = more opaque)
- Distance label in small text
- Max 4 visible (closest threats only)
- Arrow position: clamped to screen edge at the correct bearing angle

```javascript
function drawThreatArrow(ctx, screenEdgeX, screenEdgeY, dist, bearing) {
    const alpha = Math.max(0.3, 1.0 - dist / 400);
    ctx.save();
    ctx.translate(screenEdgeX, screenEdgeY);
    ctx.rotate(bearing);
    ctx.fillStyle = `rgba(255, 23, 68, ${alpha})`;
    // Draw chevron triangle
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 4);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();
    // Distance text
    ctx.fillStyle = `rgba(255, 82, 82, ${alpha})`;
    ctx.font = '10px monospace';
    ctx.fillText(`${Math.round(dist)}u`, 10, 4);
    ctx.restore();
}
```

### Combat Advantage Meter

When a target is locked, a small **advantage bar** appears below the targeting brackets:

```
    ◄═══════●════►
    -50%    0   +50%
       YOU WIN →
```

- Horizontal bar centered on 0%
- Filled left (red, enemy advantage) or right (green, player advantage)
- Based on `evaluateCombatAdvantage()` result
- Animated: bar slides when switching targets

### Status Bar (Bottom)

Single-line HUD bar:
```
TGT: Bot#7 「Hunter」 142u NE │ ADV: ▲+23% │ STR: Gatherer │ K:3 D:1 │ ⏱ 2:34
```
- Target info, advantage, current strategy, K/D ratio, time
- Dark translucent background
- Cyan border top

## Combat Visualization

### Approach Phase (target visible on screen)
1. Brackets pulse at increasing rate as distance closes
2. Advantage meter appears
3. Speed lines intensify (both bots rushing)
4. Camera zoom tightens slightly: 2.0× → 2.3×

### Engagement (contact)
1. **Screen shake:** ±4px for 6 frames on each hit
2. **Impact flash:** White burst at collision point, 3 frames
3. **Damage numbers:** Float up from the hit bot
   - Red: `"-2.3"` (damage dealt)
   - Green: `"BLOCKED"` (if defence negates most damage)
   - Gold: `"+1 ATK"` (stat gain on kill)
4. **Spark particles:** 6-8 white dots burst from impact, decelerate and fade
5. **Gauge animation:** Relevant gauges (lives, attack) animate with spring overshoot

### Kill (Player Wins)
1. Target brackets flash white and expand rapidly
2. Enemy shatters (v11.3 death effect)
3. `"ELIMINATED"` text fades in at target position in gold
4. Camera zooms back to 2.0× smoothly
5. Kill counter increments with brief pulse

### Kill (Player Dies)
1. All gauges drop to zero with needle spin
2. Screen cracks effect: 3-4 white lines radiate from impact point, fade over 1 second
3. Red vignette pulses
4. `"SYSTEMS OFFLINE — REBOOTING"` text
5. Camera holds 1.5 seconds, then snaps to new spawn with gauges resetting

## Interaction & Controls

| Key | Action |
|-----|--------|
| **TAB** | Cycle target lock (next nearest enemy) |
| **T** | Toggle target lock on/off |
| **Z** | Zoom: cycle through 1.5×, 2.0×, 2.5× |
| **R** | Toggle rear-view mirror |
| **G** | Toggle gauge style (analog dials vs. digital bars) |
| **SPACE** | Pause |

## Performance Notes

- **Rear view:** Only scans entities in 180° rear arc, max 300u — culled early
- **Gauges:** Pre-render gauge backgrounds to offscreen canvas; only redraw needles per frame
- **Threat arrows:** Calculate for max 20 bots, draw top 4 — minimal overhead
- **Target brackets:** Simple rect path drawing — negligible
- **Speed lines:** Max 12 lines, each is 2 draw calls — negligible

## What Makes This Unique

The Cockpit is the **empowerment** concept. Where The Operative restricts information to create tension, The Cockpit **floods** you with tactical data and makes you feel like a fighter pilot. The analog gauges, targeting system, and threat arrows create a sense of mastery over the battlefield. It's the most action-game feeling of all the POV concepts — you're not just watching bots, you're piloting one.

## Map Integration

**Has both POV and overview?** Partially — the rear-view mirror provides rear coverage, but there's no full map. The threat arrows give 360° awareness without a map.

**Potential enhancement:** Replace the rear-view mirror with a toggleable **tactical minimap** (key `M`): a small circular overview in the top-center showing the full field, with the main view below. When minimap is visible, rear-view is hidden and vice versa.
