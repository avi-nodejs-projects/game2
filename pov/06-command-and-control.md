# 06 — Command & Control

> Dual-view: angled 3D tactical overview + first-person POV inset

## Visual Identity

**Mood:** Military command center, dual-perspective mastery, cinematic authority
**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Ground plane | `#2a4a2a` → `#1a3a1a` | Green gradient with grid |
| Grid lines | `rgba(255,255,255,0.06)` | Faint white on ground plane |
| Sky gradient | `#0a1628` → `#1a2a48` | Dark navy-blue horizon |
| Player bot | `#00e676` | Bright green with height shadow |
| Enemy bots | Standard bot colors | With projected shadows |
| Food | `#ffd740` | With ground glow |
| HUD chrome | `rgba(10, 20, 35, 0.85)` | Dark translucent panels |
| HUD accent | `#00bcd4` | Cyan highlights |
| POV border | `#00e676` | Green border on POV window |
| Shadow color | `rgba(0,0,0,0.3)` | Ground-projected shadows |
| Height indicator | `#ffffff` at 15% | Vertical lines from bot to shadow |

## Core Concept: Two Perspectives, One Battle

This design splits the screen into two synchronized views:

1. **Tactical Overview** — An angled bird's-eye view of the field, rendered in pseudo-3D (the camera looks down at ~55° from mid-height). This gives spatial awareness and strategic context.

2. **POV Inset** — A first-person-style view from the player bot's perspective, showing what's directly ahead. This gives immersive detail and targeting feel.

Both views show the same world in real-time. Actions in one are visible in the other.

## Screen Layout

### Default Layout: 70/30 Split

```
┌─────────────────────────────────────┬──────────────┐
│                                     │              │
│        TACTICAL OVERVIEW            │     POV      │
│     (angled 3D view, 70%)           │   INSET      │
│                                     │   (30%)      │
│         ╱──────────────╲            │              │
│        ╱   ▽    ●       ╲           │    ┌─ ─ ─┐   │
│       ╱  ●    ⊕YOU  ●    ╲          │    │ bot  │   │
│      ╱     ●        ▽     ╲         │    └─ ─ ─┘   │
│     ╱────────────────────── ╲        │  ● food     │
│    ╱  perspective ground     ╲       │              │
│   ╱───────────────────────────╲      │              │
│                                     │              │
├─────────────────────────────────┬───┴──────────────┤
│      STATUS BAR                 │   CONTROLS       │
│ SPD 3.2 │ ATK 2.1 │ DEF 4.0   │ [1]Tac [2]POV    │
│ LIV 5   │ K:3     │ ⏱ 2:34    │ [3]Split [4]PIP  │
└─────────────────────────────────┴──────────────────┘
```

### Alternative Layouts (Toggle with 1–4)

```
[1] Tactical Full    [2] POV Full       [3] 70/30 Split    [4] PIP (Overlay)
┌──────────────┐   ┌──────────────┐   ┌────────┬─────┐   ┌──────────────┐
│              │   │              │   │        │     │   │         ┌──┐ │
│   Tactical   │   │     POV      │   │  Tac   │ POV │   │  Tac   │PV│ │
│   (full)     │   │   (full)     │   │        │     │   │        └──┘ │
│              │   │              │   │        │     │   │              │
└──────────────┘   └──────────────┘   └────────┴─────┘   └──────────────┘
```

**PIP mode** places the POV as a smaller overlay window (25% size) in the top-right corner of the tactical view, with a colored border. The PIP window can be dragged to any corner.

## View 1: Tactical Overview (Angled 3D)

### 3D Projection — CSS Transform Approach

The simplest and most performant approach: render the field top-down to a canvas, then use CSS 3D transforms to angle it.

```css
#tactical-canvas {
    transform: perspective(800px) rotateX(55deg) rotateZ(0deg);
    transform-origin: center 70%;
    /* This tilts the flat canvas to look like a 3D ground plane */
}
```

**Advantages:** Zero rendering overhead — the canvas draws flat (normal 2D), CSS handles the perspective. Smooth, hardware-accelerated.

**Limitations:** Mouse coordinates need inverse-transform mapping. Text/UI on this canvas will be distorted (so overlay HUD elements in a separate non-transformed layer).

```javascript
// Inverse transform for mouse picking on the tilted canvas
function screenToWorld(mouseX, mouseY) {
    // Get the CSS transform matrix
    const matrix = new DOMMatrix(getComputedStyle(canvas).transform);
    const inverse = matrix.inverse();
    // Transform mouse coordinates through inverse
    const point = new DOMPoint(mouseX, mouseY);
    const transformed = inverse.transformPoint(point);
    return { x: transformed.x, y: transformed.y };
}
```

### Alternative: Canvas-Based Isometric Projection

For more control (and to avoid CSS distortion issues), render isometrically directly in the canvas:

```javascript
// Isometric transform
function worldToIso(wx, wy) {
    // Rotate 45° and compress Y by 50%
    const isoX = (wx - wy) * 0.707;    // cos(45°)
    const isoY = (wx + wy) * 0.354;    // sin(45°) × 0.5 (Y compression)
    return {
        x: canvasWidth / 2 + isoX,
        y: canvasHeight * 0.3 + isoY   // offset down from top
    };
}
```

This gives a classic **isometric** (SimCity/RTS style) view. Entities further "north" appear higher on screen, creating natural depth sorting.

### Recommended Approach: Hybrid

Use the **CSS transform** for the ground plane and basic entity positions (cheap, smooth), but render **UI overlays** (health bars, labels, selection rings) in a separate non-transformed overlay canvas. This gives the 3D feel without distorted text.

```html
<div id="tactical-container" style="position: relative;">
    <!-- Ground plane: CSS-transformed -->
    <canvas id="tactical-ground" style="transform: perspective(800px) rotateX(55deg);"></canvas>
    
    <!-- UI overlay: flat, positioned over the transformed canvas -->
    <canvas id="tactical-overlay" style="position: absolute; top:0; left:0;"></canvas>
</div>
```

### Ground Plane Rendering

On the transformed canvas:

#### Field Surface
- Green gradient base (darker at "far" edge, lighter at "near")
- Faint white grid lines at 100u intervals (become perspective-foreshortened by CSS)
- Optional: subtle noise texture for grass variation

#### Shadows
Every entity casts a **ground shadow** projected "downward" (in the angled view, shadows project away from the camera):

```javascript
function drawEntityWithShadow(ctx, entity, zoom) {
    const sx = worldToScreen(entity.x) * zoom;
    const sy = worldToScreen(entity.y) * zoom;
    
    // Shadow (projected south, flattened)
    const shadowOffsetY = 8; // pixels "below" the entity
    ctx.save();
    ctx.translate(sx, sy + shadowOffsetY);
    ctx.scale(1, 0.4); // flatten vertically
    ctx.beginPath();
    ctx.ellipse(0, 0, entity.size * 1.2, entity.size * 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.restore();
    
    // Entity (drawn at sx, sy)
    drawBot(ctx, sx, sy, entity);
}
```

#### Entity Rendering (on ground plane)
Bots are drawn as standard v11 ellipses but with:
- Ground shadow beneath
- **Height line:** A faint vertical line from shadow to entity (2px, white at 15%) suggesting the entity "floats" slightly above ground — enhances 3D feel
- **Size perspective:** Entities further from camera are drawn slightly smaller (CSS handles most of this, but add `± 10%` scaling for emphasis)

#### Player Highlight
- Selection ring: cyan dashed circle around player bot
- Strategy label: floating above in overlay canvas
- Vision range: faint translucent circle showing awareness radius

#### Camera Controls for Tactical View
The tactical camera can be adjusted:

| Key | Action |
|-----|--------|
| **Arrow keys** | Pan camera (with player as default center) |
| **Scroll wheel** | Zoom in/out (0.5× to 3×) |
| **F** | Re-center on player (snap back) |
| **R** | Rotate view 90° (rotateZ in CSS: 0°, 90°, 180°, 270°) |

```javascript
let camAngleX = 55;   // tilt
let camAngleZ = 0;    // rotation
let camZoom = 1.0;

function updateTacticalCSS() {
    const canvas = document.getElementById('tactical-ground');
    canvas.style.transform = `
        perspective(800px)
        rotateX(${camAngleX}deg)
        rotateZ(${camAngleZ}deg)
        scale(${camZoom})
    `;
}
```

## View 2: POV Inset (First-Person Style)

### Concept

A forward-facing view from the player bot's "eyes." Since the game is 2D, we simulate first-person by projecting the 2D world onto a perspective viewport.

### POV Projection

The POV shows a **120° forward cone** from the player's heading, projected onto a rectangular viewport with perspective:

```javascript
function drawPOV(povCtx, playerBot, entities) {
    const FOV = Math.PI * 2 / 3; // 120°
    const halfFOV = FOV / 2;
    const povW = povCanvas.width;
    const povH = povCanvas.height;
    
    // Sky (top half)
    const skyGrad = povCtx.createLinearGradient(0, 0, 0, povH * 0.45);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(1, '#1a2a48');
    povCtx.fillStyle = skyGrad;
    povCtx.fillRect(0, 0, povW, povH * 0.45);
    
    // Ground (bottom half)
    const groundGrad = povCtx.createLinearGradient(0, povH * 0.45, 0, povH);
    groundGrad.addColorStop(0, '#2a5a2a');
    groundGrad.addColorStop(1, '#1a3a1a');
    povCtx.fillStyle = groundGrad;
    povCtx.fillRect(0, povH * 0.45, povW, povH * 0.55);
    
    // Horizon line
    povCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    povCtx.beginPath();
    povCtx.moveTo(0, povH * 0.45);
    povCtx.lineTo(povW, povH * 0.45);
    povCtx.stroke();
    
    // Ground grid (perspective lines receding to horizon)
    drawPerspectiveGrid(povCtx, povW, povH);
    
    // Render entities sorted by distance (far to near)
    const visible = entities
        .map(e => {
            const dx = e.x - playerBot.x;
            const dy = e.y - playerBot.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx);
            const relAngle = normalizeAngle(angle - playerBot.heading);
            return { entity: e, dist, relAngle };
        })
        .filter(e => Math.abs(e.relAngle) < halfFOV && e.dist < 500)
        .sort((a, b) => b.dist - a.dist); // far first (painter's algorithm)
    
    visible.forEach(({ entity, dist, relAngle }) => {
        // Project to screen X based on angle within FOV
        const screenX = povW / 2 + (relAngle / halfFOV) * (povW / 2);
        
        // Project size based on distance (perspective)
        const apparentSize = Math.max(4, (entity.size * 400) / dist);
        
        // Y position: near horizon for far objects, lower for close ones
        const screenY = povH * 0.45 + (povH * 0.4) * (100 / dist);
        
        drawPOVEntity(povCtx, entity, screenX, screenY, apparentSize, dist);
    });
}
```

### POV Entity Rendering

Entities in the POV view are drawn as **billboard sprites** (always facing the camera):

**Bots:**
- Circle shape (face-on view of the ellipse)
- Size scales with distance (perspective)
- Color matches the bot's actual color
- Eyes visible on close bots (within 150u)
- **Distance fade:** Bots beyond 300u are partially transparent
- **Targeting bracket:** If this is the current target, red brackets surround it

**Food:**
- Yellow dot with glow
- Size scales with distance
- Cluster of food rendered as multiple dots

**Field boundary:**
- When visible, rendered as a dark wall/fence at the edge of the field
- Appears at the appropriate screen position based on distance and angle

### Perspective Grid on Ground

To enhance the 3D feel, draw perspective grid lines on the ground:

```javascript
function drawPerspectiveGrid(ctx, w, h) {
    const horizon = h * 0.45;
    const bottom = h;
    
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    
    // Vertical lines (converge at horizon center)
    const vanishX = w / 2;
    for (let i = -6; i <= 6; i++) {
        const bottomX = vanishX + i * 50;
        ctx.beginPath();
        ctx.moveTo(vanishX + i * 2, horizon); // converge
        ctx.lineTo(bottomX, bottom);
        ctx.stroke();
    }
    
    // Horizontal lines (get denser near horizon)
    for (let i = 1; i <= 8; i++) {
        const y = horizon + (bottom - horizon) * (i / 8) * (i / 8); // quadratic spacing
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
}
```

### POV HUD Overlay

Minimal HUD elements within the POV window:

- **Crosshair:** Small `+` at center, green, 50% opacity
- **Target info:** When a target is in view, distance label below its sprite: `"Bot #7 — 142u"`
- **Edge markers:** At the left/right edges of the POV, small arrows point toward off-FOV entities (like peripheral vision hints)

## Synchronization Between Views

Both views show the same world, so they must stay synchronized:

1. **Player position:** Same world coordinates, different projections
2. **Target highlight:** Selected target is highlighted in both views (selection ring in tactical, brackets in POV)
3. **Combat effects:** Explosions, particles, etc. appear in both views simultaneously
4. **Camera center:** Tactical view always includes the player bot's area (auto-recenters if panned too far)

### Click interaction:
- **Click on tactical view:** Select a bot (shows info, highlights in both views)
- **Click on POV view:** No direct interaction (it's a viewport, not interactive)

## Status Bar — Bottom

Compact bar shared across both views:

```
SPD 3.2 │ ATK 2.1 │ DEF 4.0 │ LIV 5 │ K:3 D:1 │ STR: Gatherer │ ⏱ 2:34 │ [3] SPLIT VIEW
```

Layout buttons `[1] [2] [3] [4]` indicate current mode and allow clicking to switch.

## Combat Visualization

### In Tactical View
Standard v11 combat rendering but enhanced by the 3D perspective:
- Impact flashes cast visible "light" on the ground plane (bright circle around combat)
- Bot shadows jump/distort during combat (emphasizing motion)
- Death: entity drops flat (shadow merges with entity — "falls to ground"), then fades

### In POV View
First-person combat is intense:
- **Approach:** Target grows larger as it approaches. Brackets tighten.
- **Impact:** Screen flash (white overlay, 3 frames). Shake (±3px).
- **Damage:** Red numbers float from the target. Your damage: screen edges pulse red.
- **Kill:** Target bursts (particles scatter outward from the POV perspective — some particles fly toward camera and past it). Brief green tint overlay.
- **Death:** POV goes red, tilts down (CSS rotateX increases to 90° over 1 second — "falling face-first"), then cuts to black. Respawn: reverse tilt-up animation.

```javascript
// Death tilt animation
function animatePOVDeath(age) {
    const progress = Math.min(age / 60, 1); // 1 second
    const tiltAngle = progress * 45; // tilt down 45°
    const opacity = 1 - progress;
    
    povCanvas.style.transform = `perspective(400px) rotateX(${tiltAngle}deg)`;
    povCanvas.style.opacity = opacity;
    
    // Red vignette increasing
    drawVignette(povCtx, `rgba(255, 0, 0, ${progress * 0.5})`);
}
```

## Advanced: Dynamic Camera Angle

The tactical view's angle can subtly shift based on game state:

| Situation | Camera Adjustment |
|-----------|-------------------|
| Normal gameplay | rotateX: 55° (standard) |
| Combat (any on screen) | rotateX: 50° (slight pull-back, wider view) |
| Player in danger (low health) | rotateX: 45° (more overhead, strategic feel) |
| Player death | rotateX: 70° (zooms in toward ground) |
| Player kill | rotateX: 52° + brief zoom pulse (triumphant) |

These transitions are smooth (lerped over 30 frames).

## WebGL Alternative (Optional Enhancement)

If true 3D is desired, replace the CSS-transformed canvas with a Three.js scene:

```javascript
// Three.js setup for tactical view
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, aspectRatio, 1, 3000);
camera.position.set(1000, 800, 1000); // mid-high angle
camera.lookAt(1000, 0, 1000); // looking at field center

// Ground plane
const groundGeo = new THREE.PlaneGeometry(2000, 2000);
const groundMat = new THREE.MeshStandardMaterial({ 
    color: 0x2a4a2a, 
    roughness: 0.9 
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Bots as sprites or cylinders
function addBotMesh(bot) {
    const geo = new THREE.CylinderGeometry(bot.size, bot.size, bot.size * 0.7, 16);
    const mat = new THREE.MeshStandardMaterial({ color: bot.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(bot.x, bot.size * 0.35, bot.y);
    scene.add(mesh);
    return mesh;
}
```

**Trade-offs:**
- **Pro:** True 3D lighting, shadows, particle effects, camera orbiting
- **Pro:** Smooth camera transitions, depth of field, ambient occlusion
- **Con:** Adds Three.js dependency (~150KB gzipped)
- **Con:** More complex entity rendering pipeline
- **Con:** Shader compilation on first load

**Recommendation:** Start with CSS transform (zero dependencies, instant results). Upgrade to Three.js later if the concept is selected and richer 3D is desired.

## Interaction & Controls

| Key | Action |
|-----|--------|
| **1** | Tactical full-screen |
| **2** | POV full-screen |
| **3** | 70/30 split (default) |
| **4** | PIP mode (POV overlay on tactical) |
| **Arrow keys** | Pan tactical camera |
| **Scroll** | Zoom tactical view |
| **R** | Rotate tactical view 90° |
| **F** | Re-center on player |
| **TAB** | Cycle target (highlighted in both views) |
| **SPACE** | Pause |

## Performance Notes

- **CSS transform:** Hardware-accelerated, near-zero CPU cost for the 3D effect
- **Two canvases:** The POV canvas is smaller (30% of screen) — fewer pixels to render
- **POV culling:** Only entities in the 120° forward cone are processed — typically 3–8 entities
- **Synchronization:** Both views read from the same game state — no data duplication
- **Layout switching:** Pure CSS, instant

If using Three.js:
- **Render budget:** Target 60fps. With <50 entities (20 bots + food), Three.js handles this easily
- **LOD:** Reduce geometry for bots far from camera (sphere → billboard sprite)
- **Shadow maps:** Only enable for the player bot and nearest 5 entities

## What Makes This Unique

Command & Control is the **dual-perspective** concept. It's the only design that gives you both strategic overview AND immersive POV simultaneously. The tactical view lets you plan and position; the POV view lets you feel the action. Switching between layouts lets the player choose their preferred balance. The 3D angle on the tactical view elevates the visual quality beyond flat top-down while keeping the rendering simple (CSS transform = free).

This concept directly addresses the question of combining an angled/3D overview with a POV — it's purpose-built for exactly that.

## Map Integration

**Has both POV and overview?** Yes — this is the primary design goal. The tactical overview IS the angled map, and the POV inset IS the first-person view. They coexist on screen in the split/PIP layouts.

**Flexibility:** The 4 layout modes let the player shift between full-tactical (pure strategy), full-POV (pure immersion), and split/PIP (balanced) at any time.
