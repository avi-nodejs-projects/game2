# 05 — The Navigator

> Nautical chart POV with fog of war, compass, and ship's log narration

## Visual Identity

**Mood:** Age of Sail exploration, cartographic elegance, narrative immersion
**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Parchment (explored) | `#f4e4c1` | Warm yellowed paper |
| Parchment dark | `#d4c4a1` | Slightly aged areas |
| Ink (entities) | `#2c1810` | Dark brown-black |
| Ink (lines) | `#4a3728` | Medium brown for grid/borders |
| Ink accent | `#8b0000` | Dark red for danger/combat |
| Fog (unexplored) | `#c8b896` with hatching | Cross-hatched unknown territory |
| Sea (out of bounds) | `#a8c8d8` | Pale blue at field edges |
| Player vessel | `#1a0a00` | Bold dark ink |
| Enemy vessels | `#8b0000` | Red-brown ink |
| Resource deposits | `#b8860b` | Dark goldenrod |
| Compass rose | `#2c1810` + `#8b0000` | Traditional two-color |
| Log text | `#2c1810` | Handwriting-style |
| Log paper | `#f0e0c0` | Slightly different parchment shade |
| Rank insignia | `#b8860b` | Gold for rank markers |

**Typography:**
- Chart labels: serif font (Georgia or similar), small caps
- Ship's log: italic serif ("handwritten" feel)
- Stats/HUD: small caps serif
- Compass points: bold serif

## Screen Layout

```
┌──────────────────────────────────────┬──────────────┐
│                                      │              │
│           NAUTICAL CHART             │  COMPASS     │
│         (main canvas, 75%)           │  ROSE        │
│                                      │  (12%)       │
│      ░░░░ fog ░░░░░░░░░              │              │
│      ░░╱─────────────╲░░             │     N        │
│      ░╱  explored     ╲░░            │  W ✦ E      │
│      ░│   ▽ enemy      │░            │     S        │
│      ░│      ⊕ YOU     │░            │              │
│      ░│  ◆ resources   │░            ├──────────────┤
│      ░╲               ╱░░            │  VESSEL      │
│      ░░╲─────────────╱░░░            │  STATUS      │
│      ░░░░░░░░░░░░░░░░░░░             │  (13%)       │
│                                      │  SPD: ███    │
│                                      │  ATK: ██     │
│                                      │  DEF: ████   │
│                                      │  LIV: ███    │
├──────────────────────────────────────┴──────────────┤
│                    SHIP'S LOG (20%)                  │
│                                                     │
│  ⏱ 2:34  Contact bearing 315, range 80. Hostile.   │
│  ⏱ 2:31  Resource deposit sighted, bearing 045.     │
│  ⏱ 2:28  Enemy vessel destroyed. Stores replenished.│
│  ⏱ 2:20  Entered uncharted waters. Proceeding NNE.  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Chart Canvas — Main View (75%)

### Coordinate System

The chart is centered on the player bot with a 1.5× zoom. The chart does **not** rotate with heading (north is always up) — this is a map, not a HUD. The player's heading is shown by the compass rose and the vessel's bow direction.

### Parchment Background

The entire canvas is filled with a **parchment texture** — not a flat color, but a procedurally generated paper feel:

```javascript
function drawParchment(ctx, w, h) {
    // Base color
    ctx.fillStyle = '#f4e4c1';
    ctx.fillRect(0, 0, w, h);
    
    // Noise overlay for paper texture
    // Pre-render this to an offscreen canvas once
    const noiseCanvas = createNoiseTexture(w, h, {
        baseColor: [244, 228, 193],
        variation: 15,       // color variation range
        grainSize: 2,        // pixel size of grain
        stainCount: 8,       // random darker splotches
        stainRadius: [30, 80]
    });
    ctx.drawImage(noiseCanvas, 0, 0);
}
```

The parchment texture is generated once and cached. Stains (darker splotches) are placed randomly but deterministically (seeded from game start time).

### Fog of War

Unexplored areas are covered with **cross-hatching** — the traditional cartographic technique for unknown regions:

```
    ╱╲╱╲╱╲╱╲╱╲
    ╲╱╲╱╲╱╲╱╲╱
    ╱╲╱╲╱╲╱╲╱╲  "Here be Monsters"
    ╲╱╲╱╲╱╲╱╲╱
```

Implementation:
- Maintain an **exploration map**: a 2D grid (cell size 40u) tracking which cells the player has visited
- A cell is "explored" when the player bot passes within 120u of it
- Explored cells: clear parchment (base texture visible)
- Unexplored cells: overlay with diagonal line pattern at 45° and 135°, in medium-brown ink
- **Fog edge:** The boundary between explored and unexplored is **feathered** — a 20px gradient blend, not a hard line

```javascript
// Exploration mask
const CELL_SIZE = 40;
const explorationGrid = []; // 2D array of booleans

function updateExploration(playerX, playerY) {
    const range = 120; // exploration radius
    const cx = Math.floor(playerX / CELL_SIZE);
    const cy = Math.floor(playerY / CELL_SIZE);
    const cellRange = Math.ceil(range / CELL_SIZE);
    
    for (let dx = -cellRange; dx <= cellRange; dx++) {
        for (let dy = -cellRange; dy <= cellRange; dy++) {
            const gx = cx + dx, gy = cy + dy;
            if (inBounds(gx, gy)) {
                const dist = Math.sqrt(dx*dx + dy*dy) * CELL_SIZE;
                if (dist <= range) explorationGrid[gy][gx] = true;
            }
        }
    }
}

// Hatching pattern (pre-rendered to offscreen canvas)
function createHatchPattern(ctx) {
    const pat = document.createElement('canvas');
    pat.width = pat.height = 16;
    const pc = pat.getContext('2d');
    pc.strokeStyle = '#4a3728';
    pc.lineWidth = 1;
    pc.globalAlpha = 0.4;
    // Diagonal lines at 45°
    pc.beginPath();
    pc.moveTo(0, 16); pc.lineTo(16, 0);
    pc.moveTo(-4, 12); pc.lineTo(12, -4);
    pc.moveTo(4, 20); pc.lineTo(20, 4);
    pc.stroke();
    // Cross-hatch at 135°
    pc.beginPath();
    pc.moveTo(0, 0); pc.lineTo(16, 16);
    pc.moveTo(-4, 4); pc.lineTo(12, 20);
    pc.moveTo(4, -4); pc.lineTo(20, 12);
    pc.stroke();
    return ctx.createPattern(pat, 'repeat');
}
```

### Entity Rendering — Cartographic Style

All entities are drawn as **ink illustrations** on the parchment — hand-drawn feel, single-color, with chart-style annotations.

#### Player Vessel (⊕)

A small ship icon drawn with ink strokes:
```
       ▲ (bow — points in heading direction)
      ╱│╲
     ╱ │ ╲
    ╱  │  ╲
    ───┼───  (hull)
       │
```

- Rendered as a simple triangle-hull shape, 20px tall
- Rotates with heading
- Bold dark ink (`#1a0a00`)
- Surrounded by a small circle (traditional chart symbol for "own ship")
- **Wake:** A thin forked line trailing behind when moving (2 diverging lines behind the hull, fading with distance)

```javascript
function drawPlayerVessel(ctx, x, y, heading) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading - Math.PI / 2);
    
    ctx.strokeStyle = '#1a0a00';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#1a0a00';
    
    // Hull
    ctx.beginPath();
    ctx.moveTo(0, -12);   // bow
    ctx.lineTo(8, 8);     // starboard stern
    ctx.lineTo(0, 5);     // keel
    ctx.lineTo(-8, 8);    // port stern
    ctx.closePath();
    ctx.fill();
    
    // Position circle
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
}
```

#### Enemy Vessels (▽)

Inverted triangles in red-brown ink:
- Size scales with total stats (12–20px)
- Heading arrow: thin line extending from bow
- **Annotation:** Small text label nearby: `"Bot #7"` in italic
- **Threat level:** Nearby asterisks: `*` = weaker, `**` = even, `***` = stronger
- Only drawn in explored areas; vessels in fog are invisible

#### Resource Deposits (◆)

Small diamond shapes in goldenrod ink:
- Single food: small diamond (6px)
- Food cluster: cluster of diamonds with a dashed circle around them, labeled `"×3"` or `"×5"`
- **Chart annotation:** If the player has visited this area before, a small `"R"` (resources) label remains even after food is consumed and respawns — marking it as a known resource area

#### Field Boundary

Drawn as a **coastline** — the edge of the playable area is rendered as an irregular shore:
- Inside the boundary: parchment (land)
- Outside: pale blue wash (sea)
- The boundary line itself: a slightly wavy ink line with small `v v v` tick marks (cartographic convention for coastline)
- Corner annotations: latitude/longitude-style numbers (actually the pixel coordinates divided by 100)

### Chart Grid

Faint ink grid lines at 200u intervals:
- 1px, very low opacity (10-15%)
- Labeled at edges with coordinate numbers
- Creates the look of a proper navigation chart

### Chart Decorations

Static decorative elements that enhance the nautical feel:

- **Title cartouche:** Top-left corner, ornate frame: `"BOTS IN A FIELD — Survey Chart"`
- **Scale bar:** Bottom-left: `"├── 100u ──┤"`
- **"Here be Monsters":** Text in the fog area (appears once, in an unexplored region, in archaic italic)
- **Dotted trail:** The player's path is drawn as a **dotted line** on the chart — breadcrumb trail of everywhere they've been. Older segments fade to lighter ink.

```javascript
// Player trail
const trail = []; // Array of {x, y, frame}
const TRAIL_INTERVAL = 30; // Record every 0.5 seconds

function updateTrail(playerX, playerY) {
    if (frameCount % TRAIL_INTERVAL === 0) {
        trail.push({ x: playerX, y: playerY, frame: frameCount });
        if (trail.length > 200) trail.shift(); // Max 200 points (100 seconds)
    }
}

function drawTrail(ctx) {
    for (let i = 1; i < trail.length; i++) {
        const age = (frameCount - trail[i].frame) / (200 * TRAIL_INTERVAL);
        const alpha = Math.max(0.1, 0.6 * (1 - age));
        
        ctx.beginPath();
        const p1 = worldToScreen(trail[i-1].x, trail[i-1].y);
        const p2 = worldToScreen(trail[i].x, trail[i].y);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(74, 55, 40, ${alpha})`;
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
```

## Compass Rose — Right Panel (12%)

A traditional **16-point compass rose** drawn in ink:

- Centered in its panel
- North point decorated with fleur-de-lis
- Cardinal points (N/S/E/W) in bold, labeled
- Ordinal points (NE/NW/SE/SW) with lines
- Inter-cardinal points as smaller marks
- **Heading indicator:** The current heading is shown by a bold red arrow from center, overlaid on the rose
- Rose does NOT rotate — the arrow rotates

```javascript
function drawCompassRose(ctx, cx, cy, radius, heading) {
    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f0e0c0';
    ctx.fill();
    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 16-point star
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const len = i % 4 === 0 ? radius : i % 2 === 0 ? radius * 0.7 : radius * 0.4;
        const width = i % 4 === 0 ? 3 : 1;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.strokeStyle = i % 4 === 0 ? '#2c1810' : '#4a3728';
        ctx.lineWidth = width;
        ctx.stroke();
    }
    
    // Cardinal labels
    const labels = ['N', 'E', 'S', 'W'];
    labels.forEach((l, i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const tx = cx + Math.cos(angle) * (radius + 15);
        const ty = cy + Math.sin(angle) * (radius + 15);
        ctx.fillStyle = '#2c1810';
        ctx.font = 'bold 14px Georgia';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(l, tx, ty);
    });
    
    // Heading arrow (red)
    const hAngle = heading - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hAngle) * (radius - 5), cy + Math.sin(hAngle) * (radius - 5));
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Arrow tip
    // ...
}
```

## Vessel Status — Right Panel (13%)

Compact stat display with nautical terminology:

```
┌─ VESSEL STATUS ─────┐
│                      │
│ SPEED    ████░░  3.2 │
│ ARMS     ██░░░░  2.1 │  (attack → "arms")
│ ARMOUR   █████░  4.0 │  (defence → "armour")
│ CREW     ███░░░  5   │  (lives → "crew")
│                      │
│ RANK: Lieutenant     │
│ KILLS: 3  GEN: 1     │
│ STRATEGY: Gatherer   │
└──────────────────────┘
```

**Rank system** (purely cosmetic, based on kills):

| Kills | Rank |
|-------|------|
| 0 | Midshipman |
| 1 | Ensign |
| 3 | Lieutenant |
| 5 | Commander |
| 8 | Captain |
| 12 | Commodore |
| 18 | Admiral |

Rank changes trigger a log entry and a brief gold flash on the rank label.

## Ship's Log — Bottom Panel (20%)

The most distinctive element: a **scrolling narrative log** that describes game events in nautical prose.

### Log Entry Format
```
⏱ 2:34  Contact bearing 315°, range 80u. Hostile — armed and dangerous.
⏱ 2:31  Resource deposit sighted bearing 045°, range 120u. Three caches spotted.
⏱ 2:28  Enemy vessel Bot #12 destroyed. Arms improved. A fine victory.
⏱ 2:20  Entered uncharted waters. Proceeding NNE through unknown territory.
⏱ 2:15  Hostile Bot #3 closing from the south. Evasive action recommended.
```

### Event → Log Translation Table

| Game Event | Log Entry |
|------------|-----------|
| Enemy enters 300u range | `"Contact bearing {B}°, range {R}u. {threat_assessment}."` |
| Enemy enters 150u | `"Enemy closing, bearing {B}°. {combat_comparison}."` |
| Enemy leaves range | `"Contact lost. Last bearing {B}°, heading {H}."` |
| Combat hit (player deals) | `"Engaged Bot #{N}. Hit confirmed, {damage} damage dealt."` |
| Combat hit (player takes) | `"Taking fire from Bot #{N}. Hull integrity holding."` or `"Damage sustained!"` |
| Player kills enemy | `"Enemy vessel Bot #{N} destroyed. {stat_gained}. A fine victory."` |
| Player dies | `"Hull breach! All hands — ABANDON SHIP. ... Recommissioned at {coords}."` |
| Food consumed | `"Stores replenished. {stat_name} improved."` |
| Food cluster found | `"Resource deposit sighted bearing {B}°. {count} caches spotted."` |
| Enter unexplored area | `"Entered uncharted waters. Proceeding {heading_name}."` |
| Low health (lives=1) | `"Critical damage sustained. Crew morale failing. Seek provisions."` |
| Stat milestone (any stat ≥ 5) | `"Ship refit complete. {stat_name} capability now formidable."` |
| Rank promotion | `"Promotion earned: now holds rank of {rank}. God save the King."` |
| Off-screen combat heard | `"Cannon fire heard to the {direction}. Distance uncertain."` |

### Log Rendering

```javascript
const logEntries = []; // Array of {time, text, priority}
const MAX_LOG = 50;

function addLogEntry(text, priority = 'normal') {
    const time = formatGameTime(frameCount);
    logEntries.unshift({ time, text, priority, frame: frameCount });
    if (logEntries.length > MAX_LOG) logEntries.pop();
}

function drawLog(ctx, x, y, w, h) {
    // Parchment background (slightly different shade)
    ctx.fillStyle = '#f0e0c0';
    ctx.fillRect(x, y, w, h);
    
    // Border (double line, cartographic style)
    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    
    // Title
    ctx.font = 'small-caps bold 13px Georgia';
    ctx.fillStyle = '#2c1810';
    ctx.fillText("Ship's Log", x + 15, y + 20);
    
    // Entries
    ctx.font = 'italic 12px Georgia';
    const lineHeight = 18;
    const maxVisible = Math.floor((h - 35) / lineHeight);
    
    for (let i = 0; i < Math.min(logEntries.length, maxVisible); i++) {
        const entry = logEntries[i];
        const ey = y + 35 + i * lineHeight;
        const age = frameCount - entry.frame;
        const alpha = Math.max(0.4, 1.0 - age / (60 * 30)); // fade over 30 seconds
        
        ctx.fillStyle = entry.priority === 'danger' 
            ? `rgba(139, 0, 0, ${alpha})`
            : `rgba(44, 24, 16, ${alpha})`;
        
        ctx.fillText(`⏱ ${entry.time}  ${entry.text}`, x + 15, ey);
    }
}
```

### Threat Assessment Phrases

The log uses varied language for combat comparisons:

| Advantage | Phrases (random selection) |
|-----------|---------------------------|
| Player much stronger | "A merchantman. Easy prey." / "Lightly armed. No threat." |
| Player stronger | "Outgunned but spirited." / "We have the advantage." |
| Even | "An even match. Proceed with caution." / "Evenly matched adversary." |
| Player weaker | "Well-armed. Engagement inadvisable." / "Superior armament. Recommend evasion." |
| Player much weaker | "A man-o'-war! All hands, evasive action!" / "Vastly superior force. Flee immediately." |

## Combat Visualization (Chart Style)

Combat is shown through chart annotations rather than flashy effects:

### Approach
- A **dashed line** connects player vessel to the enemy, with bearing and range label
- The enemy vessel icon gains an `!` annotation
- Log: threat assessment entry

### Engagement
- **Crossed swords symbol** (⚔) appears between the two vessels
- Small ink splash marks at the contact point
- Damage shown as small numbers in red ink floating briefly
- The parchment around the combat zone gets slightly **darker** (an ink stain spreading)

### Kill
- Enemy vessel icon replaced by a small `×` (sunk marker)
- The `×` remains on the chart permanently as a **historical marker** — "Bot #7 sunk here"
- A tiny skull-and-crossbones (`☠`) at the position, in faded ink
- Log: victory entry

### Player Death
- Red ink splatter on the chart at death location
- Log: "ABANDON SHIP" entry in red
- Brief sepia vignette over entire screen
- Chart re-centers on new spawn point
- Previous death location marked with `☠`

## Interaction & Controls

| Key | Action |
|-----|--------|
| **TAB** | Cycle target (highlighted with dashed ring on chart) |
| **L** | Toggle log size (compact: 3 lines / expanded: 8 lines / hidden) |
| **+/−** | Zoom chart (1.0×, 1.5×, 2.5×) |
| **G** | Toggle grid lines |
| **T** | Toggle trail visibility |
| **SPACE** | Pause ("time stands still on the chart") |

## Performance Notes

- **Parchment texture:** Generated once, cached as offscreen canvas
- **Fog hatching:** Pattern fill — one operation, not per-pixel
- **Exploration grid:** 50×50 cells for 2000×2000 field — 2500 booleans, trivial
- **Trail:** Max 200 points, one path stroke — negligible
- **Log:** DOM elements with CSS, not canvas-rendered — clean scrolling
- **Compass rose:** Pre-rendered to offscreen canvas, only heading arrow redrawn per frame
- **Historical markers (death/sink):** Accumulated array, max ~50 entries per game

## What Makes This Unique

The Navigator is the **narrative** concept. While other POV modes focus on visual spectacle or sensory restriction, The Navigator tells a story. The ship's log transforms autonomous bot behavior into a nautical adventure you can read. The chart accumulation — explored areas, death markers, dotted trails — creates a visual history of your bot's life. After a long game, the chart itself becomes a beautiful artifact covered in routes, annotations, and battle sites. It's the only concept where the passage of time is visually recorded.

## Map Integration

**Has both POV and overview?** The chart IS the overview — but centered on the player and limited by fog of war. It's inherently a map-based POV. As you explore, the map grows. This is the only concept where POV and map are the same thing.

**Full overview toggle:** Press `O` to briefly zoom out to show the entire field (0.5× zoom) with explored areas clear and fog intact. This "strategic view" lasts until key release (hold to view).
