# 06 — War Table

> Holographic tactical display projected above a physical table in a dark room

## Visual Identity

**Mood:** Military command center, strategic authority, holographic precision
**Reference:** Star Wars holochess/war room, Iron Man's holograms, Ender's Game command screen, tabletop wargames

**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Room | `#0a0a12` → `#1a1a25` | Dark walls, barely visible |
| Table surface | `#1a1a20` | Dark metal/wood |
| Table edge | `#2a2a35` | Subtle lighter rim |
| Hologram base | `#0044aa` at 15% | Blue ground plane glow |
| Hologram grid | `#0066cc` at 30% | Grid lines on projection |
| Bot holograms | Per-bot color, emissive | Translucent glowing figures |
| Food holograms | `#ffcc00` emissive | Small rotating diamonds |
| Scan lines | `#ffffff` at 5% | Horizontal interference |
| Glitch artifacts | `#ffffff` | Brief displacement flickers |
| Data readouts | `#00ccff` | Cyan monospace text |
| Alert | `#ff3344` | Red flash for combat/danger |
| Height glow | Per-bot color at 40% | Vertical beam from bot to base |
| Table controls | `#334455` | Panel surfaces |
| Control lights | `#00aaff` | Button/indicator LEDs |

## Core Concept

The game world is a **holographic projection** floating above a physical table in a dark room. You're looking down at a 3D military planning table. The bots are translucent holographic figures standing on the projection surface. Their height represents their total stats — stronger bots literally tower over weaker ones.

The table and room are rendered as part of the 3D scene, providing a grounding physical context. The hologram has characteristic visual artifacts: scan lines, flicker, slight transparency, color fringing.

## Scene Structure

```
Scene
├── Room
│   ├── Floor (dark plane, barely visible)
│   ├── BackWall (dark, subtle edge lighting)
│   └── AmbientLight (very dim, room fill)
├── Table
│   ├── TableSurface (box, dark material)
│   ├── TableEdge (beveled frame, lighter)
│   ├── ControlPanel (left side, buttons/readouts)
│   └── TableLegs (4 cylinders, dark)
├── Hologram (projected above table)
│   ├── ProjectionBase (flat plane with grid shader, glowing)
│   ├── FieldBoundary (wireframe rectangle, glowing edges)
│   ├── BotHolograms (individual figure meshes)
│   ├── FoodHolograms (instanced diamonds)
│   ├── HeightBeams (vertical lines from bots to base)
│   ├── DataLabels (billboard text sprites)
│   └── HoloEffects (scan lines, flicker, particles)
├── ProjectorLight (cone of light from below table, aimed up)
├── Camera (above table, slight angle)
└── HUD (screen-space overlay)
```

## The Room

### Minimal Environment

The room exists to provide context — you're not in a void, you're in a dark command center. But it's barely visible:

```javascript
// Floor
const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a12,
    roughness: 0.95,
    metalness: 0.1,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -10;

// Back wall (optional — just enough to frame the scene)
const wallGeo = new THREE.PlaneGeometry(100, 40);
const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a15,
    roughness: 0.9,
});
const wall = new THREE.Mesh(wallGeo, wallMat);
wall.position.set(0, 10, -30);

// Ambient: extremely dim
const ambientLight = new THREE.AmbientLight(0x222233, 0.15);
```

The room is dark enough that the hologram is the brightest thing in the scene. The table and walls provide just enough depth cue to ground the experience.

## The Table

### Physical Table

A substantial rectangular surface:

```javascript
const TABLE_W = 60;
const TABLE_D = 40;
const TABLE_H = 2;

// Table top
const tableGeo = new THREE.BoxGeometry(TABLE_W, TABLE_H, TABLE_D);
const tableMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a20,
    roughness: 0.7,
    metalness: 0.3,
});
const table = new THREE.Mesh(tableGeo, tableMat);
table.position.y = 0;
table.receiveShadow = false; // hologram doesn't cast real shadows

// Table edge bevel (brighter frame)
const edgeGeo = new THREE.BoxGeometry(TABLE_W + 1, TABLE_H + 0.5, TABLE_D + 1);
const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a35,
    roughness: 0.6,
    metalness: 0.4,
});
// Use CSG or separate edge strips
```

### Control Panel

A physical-looking control section on one side of the table:

```javascript
// Panel surface
const panelGeo = new THREE.BoxGeometry(12, 0.5, TABLE_D * 0.6);
const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1a2030,
    roughness: 0.5,
    metalness: 0.5,
});
const panel = new THREE.Mesh(panelGeo, panelMat);
panel.position.set(-TABLE_W / 2 - 7, TABLE_H / 2 + 0.25, 0);
```

**Control panel elements** (non-interactive, atmospheric):
- Small LED indicators (emissive dots) that flicker with game events
- A miniature stat readout screen (emissive plane with rendered text)
- Buttons (small cylinders with colored tops) that glow when their function is active
- All rendered as geometry, not UI — part of the 3D scene

```javascript
// LED indicators (responding to game events)
function updatePanelLEDs(gameState) {
    ledCombat.material.emissive.set(gameState.activeCombat ? 0xff3344 : 0x331111);
    ledPlayer.material.emissive.set(0x00ff66); // always green (player alive)
    ledPop.material.emissive.set(
        gameState.population < 5 ? 0xff3344 : // danger
        gameState.population < 10 ? 0xffaa00 : // warning
        0x00ff66 // healthy
    );
}
```

### Projector Effect

A subtle cone of light from beneath the table surface, projecting upward through the hologram:

```javascript
const projector = new THREE.SpotLight(0x0044aa, 0.8);
projector.position.set(0, -5, 0);
projector.target.position.set(0, 20, 0);
projector.angle = Math.PI * 0.3;
projector.penumbra = 0.8;
projector.castShadow = false;
```

This creates a faint blue cone of light visible in the dark room, suggesting the projection source.

## The Hologram

### Projection Base

A flat plane on the table surface showing the field grid:

```javascript
const holoBaseGeo = new THREE.PlaneGeometry(TABLE_W - 4, TABLE_D - 4, 1, 1);
const holoBaseMat = new THREE.ShaderMaterial({
    vertexShader: holoBaseVert,
    fragmentShader: holoBaseFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
        gridSpacing: { value: 5.0 },
        gridColor: { value: new THREE.Color(0x0066cc) },
        baseGlow: { value: new THREE.Color(0x0044aa) },
        time: { value: 0 },
    }
});
```

```glsl
// Hologram base shader
varying vec2 vUv;
uniform float gridSpacing;
uniform vec3 gridColor;
uniform vec3 baseGlow;
uniform float time;

void main() {
    vec2 grid = abs(fract(vUv * gridSpacing) - 0.5) * 2.0;
    float line = 1.0 - min(min(grid.x, grid.y) * gridSpacing * 2.0, 1.0);
    
    // Base glow (subtle)
    float glow = 0.05;
    
    // Scan line (horizontal line sweeping across)
    float scanY = fract(time * 0.1);
    float scan = smoothstep(0.02, 0.0, abs(vUv.y - scanY)) * 0.15;
    
    float alpha = line * 0.25 + glow + scan;
    vec3 color = mix(baseGlow, gridColor, line);
    
    gl_FragColor = vec4(color, alpha);
}
```

### Field Boundary

A wireframe rectangle marking the playable area:

```javascript
const boundaryGeo = new THREE.BoxGeometry(fieldW, 0.1, fieldD);
const boundaryMat = new THREE.MeshBasicMaterial({
    color: 0x0066cc,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
});
```

Subtle glowing edges that mark where the field starts and ends.

## Bot Holograms

### Holographic Figures

Bots are rendered as **translucent holographic chess pieces** — simple geometric forms that glow:

```javascript
function createHologramBot(bot) {
    const group = new THREE.Group();
    
    // Determine shape based on dominant stat/strategy
    const shape = getHologramShape(bot);
    const height = 2 + bot.totalStats * 0.15; // HEIGHT = STATS
    
    let bodyGeo;
    switch (shape) {
        case 'hunter':
            // Pointed pyramid (aggressive)
            bodyGeo = new THREE.ConeGeometry(1.2, height, 4);
            break;
        case 'gatherer':
            // Rounded dome (peaceful)
            bodyGeo = new THREE.SphereGeometry(1.0, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            bodyGeo.scale(1, height / 2, 1);
            break;
        case 'balanced':
            // Cylinder (stable)
            bodyGeo = new THREE.CylinderGeometry(0.8, 1.0, height, 6);
            break;
        case 'survivor':
            // Octahedron (defensive)
            bodyGeo = new THREE.OctahedronGeometry(1.0, 0);
            bodyGeo.scale(1, height / 2.5, 1);
            break;
        default:
            bodyGeo = new THREE.CylinderGeometry(0.8, 1.0, height, 8);
    }
    
    // Holographic material
    const bodyMat = new THREE.MeshStandardMaterial({
        color: bot.color,
        emissive: bot.color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.6,
        roughness: 0.2,
        metalness: 0.3,
        side: THREE.DoubleSide,
    });
    
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2 + TABLE_H / 2;
    group.add(body);
    
    // Wireframe overlay (holographic edge effect)
    const wireMat = new THREE.MeshBasicMaterial({
        color: bot.color,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
    });
    const wire = new THREE.Mesh(bodyGeo.clone(), wireMat);
    wire.position.copy(body.position);
    group.add(wire);
    
    // Height beam (vertical line from base to figure)
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.05, height, 4);
    const beamMat = new THREE.MeshBasicMaterial({
        color: bot.color,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = height / 2 + TABLE_H / 2;
    group.add(beam);
    
    return group;
}

function getHologramShape(bot) {
    const dominant = Math.max(bot.attack, bot.defence, bot.speed);
    if (dominant === bot.attack) return 'hunter';
    if (dominant === bot.defence) return 'survivor';
    if (dominant === bot.speed) return 'gatherer';
    return 'balanced';
}
```

### Height = Stats

The defining visual mechanic — **taller figures are stronger**:

- A fresh bot (total stats ~4) is about 2 scene units tall
- A maxed bot (total stats ~20) is about 5 scene units tall
- The height difference is immediately readable — you can scan the table and instantly see who's dominant

```javascript
function updateHologramHeight(holoGroup, bot) {
    const newHeight = 2 + bot.totalStats * 0.15;
    const currentHeight = holoGroup.userData.height;
    
    // Smooth interpolation
    const lerpedHeight = currentHeight + (newHeight - currentHeight) * 0.05;
    holoGroup.userData.height = lerpedHeight;
    
    // Update body scale
    const body = holoGroup.children[0];
    body.scale.y = lerpedHeight / body.geometry.parameters.height;
    body.position.y = lerpedHeight / 2 + TABLE_H / 2;
    
    // Update beam
    const beam = holoGroup.children[2];
    beam.scale.y = lerpedHeight / beam.geometry.parameters.height;
    beam.position.y = lerpedHeight / 2 + TABLE_H / 2;
}
```

### Holographic Effects

Visual artifacts that make the holograms feel like projections, not solid objects:

#### Scan Lines
Horizontal lines scrolling upward through all holographic elements:

```javascript
// Applied via a shader on the hologram material (or as a post-processing effect)
// In fragment shader:
float scanline = sin(worldPos.y * 30.0 + time * 5.0) * 0.5 + 0.5;
scanline = pow(scanline, 8.0); // sharpen to thin lines
alpha *= 1.0 - scanline * 0.15; // subtle darkening at scan lines
```

#### Flicker
Random brightness variation:

```javascript
// Per frame:
hologramMaterials.forEach(mat => {
    // Global flicker (affects all holograms)
    const flicker = 0.9 + Math.random() * 0.2; // 0.9–1.1
    mat.emissiveIntensity = 0.5 * flicker;
    
    // Occasional glitch (rare, brief)
    if (Math.random() < 0.002) { // 0.2% chance per frame
        mat.emissiveIntensity = 1.5; // bright flash
        // Also offset position briefly
        hologram.position.x += (Math.random() - 0.5) * 0.3;
        setTimeout(() => hologram.position.x -= offset, 50);
    }
});
```

#### Color Fringing
Slight chromatic aberration on hologram edges (can be done as post-processing or per-material):

- At the edges of holographic objects, the color slightly splits into RGB components
- This is subtle — just enough to suggest the projection is imperfect

#### Base Ring
Each bot has a glowing circle on the projection base directly beneath it:

```javascript
const baseRingGeo = new THREE.RingGeometry(0.8, 1.2, 16);
const baseRingMat = new THREE.MeshBasicMaterial({
    color: bot.color,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
});
const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
baseRing.rotation.x = -Math.PI / 2;
baseRing.position.y = TABLE_H / 2 + 0.05;
```

## Food Holograms

Small rotating **diamond shapes** (octahedra) hovering above the base:

```javascript
const foodGeo = new THREE.OctahedronGeometry(0.4, 0);
const foodMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.7,
});
```

- Hover 1 unit above the projection base
- Slow spin on Y axis
- No height encoding (all food is the same)
- When consumed: diamond flickers rapidly, shrinks, and "derezzes" (wireframe visible as solid fades)
- When spawning: a brief upward beam of light, then diamond materializes from wireframe to solid

## Camera System

### Default Position

Looking down at the table from a seated angle:

```javascript
const camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.1, 500);
camera.position.set(0, 40, 30); // above and in front
camera.lookAt(0, TABLE_H / 2 + 3, 0); // look at hologram center (slightly above table)
```

### Camera Controls

Limited orbit — you're seated at the table:

```javascript
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, TABLE_H / 2 + 3, 0); // center of hologram
controls.enablePan = false;
controls.minDistance = 20;
controls.maxDistance = 80;
controls.minPolarAngle = Math.PI * 0.1;  // can't go directly overhead
controls.maxPolarAngle = Math.PI * 0.45; // can't go below table
controls.minAzimuthAngle = -Math.PI * 0.5;
controls.maxAzimuthAngle = Math.PI * 0.5;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
```

### Zoom Detail Levels

| Distance | View |
|----------|------|
| **80u** (max) | Full table visible including room context. Bots are small figures, height differences clear. |
| **40u** | Table fills the frame. Individual figures readable. Base rings visible. |
| **20u** (min) | Close to hologram. Wireframe details, scan lines, and flicker visible. Can read data labels. |

## Combat Visualization

### Approach
- Both holograms flicker faster
- A red connecting line appears between them on the projection base (dashed, pulsing)
- Their base rings pulse red
- Control panel combat LED lights up

### Engagement
- **Lightning connection:** A bright arc of light between the two figures (similar to Neon Grid but holographic — translucent blue-white)
- **Figure distortion:** Both holograms glitch during each hit — brief position offset, scan line intensification, opacity spike
- **Impact data:** Small floating numbers appear above the combatants ("−2.3" in red, holographic style)
- **Base disruption:** The grid lines near the combat warp briefly (shader distortion)
- **Table vibration:** The physical table mesh vibrates ±0.1 units (subtle rumble)

### Kill
- **Winner:** Height increases visibly (stat gain), color brightens, triumphant flicker
- **Loser:** 
  1. Hologram destabilizes (extreme flicker, color shifts randomly)
  2. Figure breaks into horizontal slices (each slice offsets horizontally — "derez" effect)
  3. Slices fade to nothing from top to bottom (dissolution)
  4. Base ring contracts to point and disappears
  5. A brief data burst at the death location: the bot's final stats displayed as fading text
- **Kill marker:** A small red `×` remains on the projection base (permanent, like pins on a war map)

### Player Kill
- All holograms briefly flash gold
- Control panel: all LEDs flash green in sequence (victory pattern)
- Winner's height beam brightens to gold for 2 seconds
- Kill marker is gold instead of red

### Player Death
- All holograms freeze for 1 second (projection stall)
- The entire hologram flickers off briefly (0.5s black) then restabilizes
- Control panel: LEDs flash red alarm pattern
- A holographic "RECONNECTING..." text appears over the base
- New figure materializes at respawn location (beam up → wireframe → solid)

## HUD / Overlay

### Screen-Space (Minimal)

```
★ Commander │ SPD 3.2 │ ATK 2.1 │ DEF 4.0 │ LIV 5 │ K:3 │ ⏱ 2:34
```

- Top bar, cyan monospace text on very dark transparent background
- Styled to match the hologram aesthetic (subtle scan line in the bar)

### In-World Data Labels

Holographic text floating above selected bots:

```javascript
function createDataLabel(bot) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, 0, 256, 64);
    
    ctx.font = '16px monospace';
    ctx.fillStyle = '#00ccff';
    ctx.fillText(`Bot #${bot.id}`, 10, 20);
    ctx.fillText(`S:${bot.speed.toFixed(1)} A:${bot.attack.toFixed(1)} D:${bot.defence.toFixed(1)} L:${bot.lives}`, 10, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(8, 2, 1);
    
    return sprite;
}
```

- Labels float above the figure, facing the camera (billboard)
- Only shown for selected bot + bots in combat
- All text is holographic cyan with slight flicker

### Kill Map Overlay

Toggle with `K`: shows accumulated kill markers on the projection base, with small connecting lines showing who killed whom (brief, fading). Creates a tactical analysis view of where violence concentrates.

## Interaction & Controls

| Input | Action |
|-------|--------|
| **Click-drag** | Orbit camera around table |
| **Scroll** | Zoom |
| **Click figure** | Select (shows data label) |
| **TAB** | Cycle selected bot |
| **K** | Toggle kill map overlay |
| **G** | Toggle grid intensity on projection base |
| **SPACE** | Pause (hologram freezes, scan lines continue — projection is still on) |
| **ESC** | Reset camera |

## Performance Budget

| Element | Draw Calls | Triangles | Notes |
|---------|-----------|-----------|-------|
| Room (floor, wall) | 2 | ~400 | Minimal geometry |
| Table + controls | 5 | ~1,000 | Boxes and cylinders |
| Projection base | 1 | 2 | Shader does the work |
| Bot holograms (20) | 40 | ~6,000 | Solid + wireframe per bot |
| Height beams (20) | 20 | ~320 | Thin cylinders |
| Base rings (20) | 20 | ~640 | Ring geometry |
| Food (50) | 1 | ~2,000 | InstancedMesh |
| Data labels | 3-5 | ~20 | Sprites, on-demand |
| Kill markers | 1 | ~200 | InstancedMesh, accumulated |
| Projector light | — | — | Single spotlight |
| **Total** | ~95 | ~11,000 | Very light — hologram shader is the main cost |

**Note:** High draw call count (due to per-bot wireframe + solid + beam + ring = 4 per bot). Could reduce by:
- Merging wireframe into the body shader (shader-based wireframe instead of separate mesh)
- Using InstancedMesh for beams and rings
- Target: <50 draw calls

**Hologram shader cost:** The scan line and flicker effects are simple arithmetic in the fragment shader — negligible. The main cost is transparency sorting (translucent objects with additive blending need back-to-front sorting).

## What Makes This Unique

War Table is the **authority** concept. You're a commander reviewing forces on a tactical display. The height-encoded stats give instant visual intelligence — scan the table and immediately know who's dominant. The holographic aesthetic creates a sense of technological power and control.

The physical table and room context is critical — it separates this from "just a top-down view with neon effects." The control panel LEDs responding to game events, the projector cone, the dark room — these create a sense of *place*. You're not watching a screen; you're standing at a command post.

The chess-piece shapes encoding strategy type (pyramids for hunters, domes for gatherers, etc.) let you read the battlefield at a glance. Combined with height for stats, you get a rich tactical picture from pure geometry — no HUD needed.

The holographic artifacts (scan lines, flicker, glitch, derez) add visual character while reinforcing the "this is a projection, not reality" frame. The kill markers accumulating on the projection base create a war-history map over time.
