# 01 — The Terrarium

> A glass-enclosed diorama on a desk — watch your bots like a living ant farm

## Visual Identity

**Mood:** Cozy, contained, miniature-world charm, tactile warmth
**Reference:** Ant farms, terrariums, snow globes, museum dioramas

**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Glass | `rgba(200, 230, 255, 0.08)` | Subtle blue tint on panels |
| Glass edge | `rgba(255, 255, 255, 0.3)` | Edge highlights / refraction |
| Base wood | `#5c3a1e` → `#3a2210` | Warm wood grain |
| Desk surface | `#4a3a2a` | Dark wood/leather beneath |
| Terrain grass | `#4a8c3a` → `#3a7a2a` | Ground surface gradient |
| Terrain dirt | `#6b5a3a` | Exposed earth, paths |
| Terrain rock | `#7a7a7a` | Small stones, pebbles |
| Bot bodies | Per-bot HSL | Saturated, rounded shapes |
| Bot eyes | `#ffffff` + `#111111` | White sclera, dark pupil |
| Food | `#ffcc00` | Glowing seeds/berries |
| Lamp light | `#ffe8c0` | Warm directional key light |
| Ambient | `#6688aa` | Cool fill light from "room" |

## Scene Structure

### The Physical Setup

The game world exists as a **physical terrarium** sitting on a desk. The 3D scene renders the terrarium AND its surroundings — creating a frame that makes the miniature world feel real.

```
    ┌─── room background (blurred) ───┐
    │                                  │
    │         ╭─ glass lid ──╮         │
    │        ╱                ╲        │
    │       │   terrain        │       │
    │  lamp │  ● ● · ● · ●    │       │
    │   ◉   │   · ●  · ● ·    │       │
    │       │  ●  · ● ·  ●    │       │
    │        ╲   terrain      ╱        │
    │         ╰── glass base ─╯        │
    │       ┌─── wooden base ───┐      │
    │ ══════╧═══ desk surface ══╧════  │
    └──────────────────────────────────┘
```

### Three.js Scene Graph

```
Scene
├── DeskGroup
│   ├── DeskSurface (plane, wood texture)
│   ├── DeskLamp (geometry + point light)
│   └── DeskProps (pencil cup, notebook — optional atmosphere)
├── TerrariumGroup
│   ├── WoodenBase (box, wood material)
│   ├── GlassPanels (4 sides + lid, transparent material)
│   ├── TerrainMesh (heightmap geometry, grass material)
│   ├── TerrainDetails (rocks, grass tufts, tiny plants — instanced meshes)
│   ├── FoodGroup (berry/seed meshes — instanced)
│   └── BotGroup (individual bot meshes)
├── Lighting
│   ├── DeskLamp (SpotLight, warm)
│   ├── AmbientLight (cool fill)
│   └── Optional: soft shadows
└── Camera (PerspectiveCamera, fixed angle)
```

## Terrarium Construction

### Glass Enclosure

The glass walls are the defining visual element. They provide containment, reflections, and a sense of looking INTO a world.

**Material:**
```javascript
const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.08,
    roughness: 0.05,
    metalness: 0,
    transmission: 0.95,        // glass transparency
    thickness: 2,              // refraction depth
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.5,
    side: THREE.DoubleSide
});
```

**Geometry:**
- 4 vertical panels (sized to enclose the 2000×2000 field, scaled down to scene units)
- 1 top panel (lid) — can be slightly ajar for visual interest
- Each panel is a thin box (not a plane) — gives visible edge thickness
- **Edge highlights:** A brighter line along each glass edge where light refracts — achieved via an emissive edge mesh or a bright-edged wireframe overlay at 10% opacity

**Reflections:**
- Use a CubeCamera or environment map for subtle reflections on the glass
- The desk lamp should reflect as a soft bright spot on the nearest glass panel
- Keep reflections subtle (envMapIntensity 0.3–0.5) — they're atmosphere, not distraction

### Wooden Base

A rectangular box beneath the glass, slightly larger than the glass footprint (the glass sits IN the base):

```javascript
const baseGeometry = new THREE.BoxGeometry(fieldW + 4, 3, fieldD + 4);
const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x5c3a1e,
    roughness: 0.8,
    // Optional: wood grain normal map
});
```

- Chamfered edges (beveled box or rounded edge shader)
- Slightly darker on the bottom
- A small brass nameplate on the front edge: "BOTS IN A FIELD" in engraved text (optional: use a texture)

### Terrain

The ground inside the terrarium is NOT flat — it has gentle topography:

**Heightmap generation:**
```javascript
function generateTerrain(width, depth, segments) {
    const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        
        // Gentle rolling hills (max height: 15 units, ~0.75% of field size)
        const height = 
            Math.sin(x * 0.003) * Math.cos(z * 0.004) * 8 +
            Math.sin(x * 0.007 + 1) * Math.cos(z * 0.005 + 2) * 5 +
            Math.sin(x * 0.015) * Math.sin(z * 0.012) * 2; // detail noise
        
        positions.setY(i, Math.max(0, height)); // no negative heights
    }
    
    geometry.computeVertexNormals();
    return geometry;
}
```

**Material:** Grass-textured with vertex coloring for variation:
- Higher areas: lighter green (sun-exposed)
- Lower areas: darker green (shadowed)
- Edges near glass: slight brown tint (dirt against walls)
- Small bare patches: earth-colored circles where bots have worn paths (optional: accumulate over time)

**Terrain Details (Instanced Meshes):**
- **Grass tufts:** 200-400 small cone clusters, scattered randomly, slight wind sway animation
- **Rocks:** 30-50 small irregular polyhedra in gray/brown, placed on terrain
- **Tiny plants:** 20-30 small branching structures near food spawn areas
- All use InstancedMesh for performance — single draw call per type

## Bot Rendering

### Body Shape

Bots are **pill-shaped 3D creatures** — a capsule (cylinder with hemisphere caps) with a friendly, organic feel:

```javascript
function createBotMesh(bot) {
    const bodyRadius = 4 + bot.totalStats * 0.15; // grows with stats
    const bodyLength = bodyRadius * 1.4;
    
    // Capsule body (cylinder + 2 sphere halves)
    const bodyGeo = new THREE.CapsuleGeometry(bodyRadius, bodyLength, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: bot.color,
        roughness: 0.6,
        metalness: 0.1,
    });
    
    const mesh = new THREE.Mesh(bodyGeo, bodyMat);
    mesh.castShadow = true;
    mesh.rotation.x = Math.PI / 2; // lay flat (capsule long axis = forward)
    
    return mesh;
}
```

### Eyes

The signature feature — **googly eyes** that give personality:

```javascript
function createEyes(botMesh, bodyRadius) {
    const eyeRadius = bodyRadius * 0.25;
    const eyeGeo = new THREE.SphereGeometry(eyeRadius, 12, 12);
    
    // White sclera
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(eyeGeo, scleraMat);
    const rightEye = new THREE.Mesh(eyeGeo, scleraMat);
    
    // Position on front of body, spread apart
    const eyeSpread = bodyRadius * 0.5;
    const eyeForward = bodyRadius * 0.85;
    const eyeUp = bodyRadius * 0.3;
    
    leftEye.position.set(-eyeSpread, eyeUp, eyeForward);
    rightEye.position.set(eyeSpread, eyeUp, eyeForward);
    
    // Black pupils (smaller spheres, offset forward)
    const pupilRadius = eyeRadius * 0.5;
    const pupilGeo = new THREE.SphereGeometry(pupilRadius, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0, 0, eyeRadius * 0.5);
    rightPupil.position.set(0, 0, eyeRadius * 0.5);
    
    leftEye.add(leftPupil);
    rightEye.add(rightPupil);
    botMesh.add(leftEye, rightEye);
    
    return { leftEye, rightEye, leftPupil, rightPupil };
}
```

**Pupil behavior:**
- Pupils track the bot's current target: rotate toward it
- When idle: pupils drift randomly (slow sine oscillation)
- When scared (low health + nearby threat): pupils widen (scale up pupils)
- When hunting: pupils narrow (scale down to slits — flatten Y scale)

### Stat Visualization on Body

Stats are reflected in the bot's physical appearance — no numbers needed:

| Stat | Visual Effect |
|------|--------------|
| **Speed** | Small legs/nubs underneath — more legs appear as speed grows (2 → 4 → 6). Legs animate faster at high speed. |
| **Attack** | Small horn or spike on the front of the capsule. Grows longer with attack stat. |
| **Defence** | Shell texture / armored plates on the back. More plates = higher defence. Slight sheen. |
| **Lives** | Body opacity/solidity. Low lives = slightly translucent. Full lives = fully opaque with a subtle inner glow. |

### Movement Animation

- **Walking:** Body tilts slightly in movement direction (pitch forward 10°). Subtle bobbing up-down (sine wave, 0.5 unit amplitude).
- **Fast movement:** More pronounced bob, slight squash-and-stretch on the body.
- **Turning:** Body rotates smoothly toward new heading (slerp, factor 0.1).
- **Idle:** Gentle "breathing" — body scale oscillates ±3% on Y axis with a 3-second sine cycle.

### Shadows

Each bot casts a soft shadow on the terrain:
- Use Three.js shadow maps (PCFSoftShadowMap)
- Shadow camera follows the desk lamp position
- Shadow radius: soft (radius 3-5)
- This is one of the most important visual elements — shadows ground the bots on the terrain

## Food Rendering

Food dots become **small 3D berries or seeds**:

```javascript
function createFoodMesh() {
    // Small sphere with slight irregularity
    const geo = new THREE.SphereGeometry(2, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.3,
        roughness: 0.4,
    });
    return new THREE.Mesh(geo, mat);
}
```

- Sit on the terrain surface (raycast down to find terrain height)
- Subtle glow (emissive + optional point light at very low intensity)
- When consumed: shrink animation (scale to 0 over 10 frames) + small particle burst (5-8 tiny spheres flying up and fading)
- When spawning: grow animation (scale from 0 to 1 over 20 frames) + a tiny "pop" of particles

## Camera System

### Primary Camera

Fixed perspective camera at 45° above the terrarium:

```javascript
const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);

// Initial position: above and in front of the terrarium
camera.position.set(0, fieldH * 1.2, fieldD * 0.8);
camera.lookAt(0, 0, 0); // center of terrarium
```

### Camera Controls

Limited orbit — the player can look around the terrarium but can't go inside:

```javascript
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enablePan = false;            // no panning (stay centered on terrarium)
controls.minDistance = fieldW * 0.5;   // can't zoom inside the glass
controls.maxDistance = fieldW * 2.5;   // can't zoom too far out
controls.minPolarAngle = Math.PI * 0.15; // can't go directly overhead
controls.maxPolarAngle = Math.PI * 0.45; // can't go below desk level
controls.minAzimuthAngle = -Math.PI * 0.4; // limit horizontal orbit
controls.maxAzimuthAngle = Math.PI * 0.4;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.5;
```

### Zoom Behavior

- **Zoomed out:** See the entire terrarium, desk, lamp. Full ecosystem overview.
- **Zoomed in:** Glass panels become more prominent (closer = more refraction/reflection visible). Individual bots and their eyes become readable. Can see leg animations, horn growth, shell detail.
- **Maximum zoom:** Glass fills the frame — you're pressing your face against the glass, watching a specific bot. Depth of field blurs distant bots.

## Lighting

### Desk Lamp (Key Light)

```javascript
const lamp = new THREE.SpotLight(0xffe8c0, 1.5);
lamp.position.set(-fieldW * 0.6, fieldH * 2, fieldD * 0.3);
lamp.angle = Math.PI * 0.3;
lamp.penumbra = 0.5;
lamp.castShadow = true;
lamp.shadow.mapSize.set(1024, 1024);
lamp.shadow.camera.near = 10;
lamp.shadow.camera.far = fieldW * 3;
lamp.shadow.radius = 4; // soft shadows
```

- Warm, directional — creates visible shadows inside the terrarium
- The lamp geometry (a simple angled arm + shade) is visible at wide zoom
- Light spills onto the desk surface around the terrarium base

### Ambient Fill

```javascript
const ambient = new THREE.AmbientLight(0x6688aa, 0.4);
// Cool blue-ish fill simulating room ambient light
```

### Optional: Interior Glow

A faint hemisphere light from below the terrain (simulating light bouncing off the wooden base):
```javascript
const hemi = new THREE.HemisphereLight(0xf0e8d0, 0x3a2210, 0.2);
// Sky color: warm cream, ground color: dark wood
```

## Combat Visualization

### Approach

- Both bots turn to face each other (slerp heading)
- Eyes narrow (pupils flatten)
- Horns (if present) glow slightly brighter
- Small dust particles kick up around feet

### Contact

- **Bump animation:** Both bots physically collide — squash on impact (scale X compress, Y expand), then bounce back. Like two rubber balls hitting.
- **Impact particles:** Small dust cloud at contact point (10-15 tiny tan spheres, rising and fading)
- **Camera:** If zoomed close enough, slight camera shake (±0.5 units, 6 frames)
- **Glass rattle:** The nearest glass panel vibrates subtly (mesh position oscillates ±0.2 units for 4 frames) — reinforces the physical containment

### Kill

- **Winner:** Brief glow surge (emissive increases for 0.5s), eyes go wide, body puffs up (scale × 1.15) then settles
- **Loser:** Body goes limp (flattens vertically), color desaturates, then dissolves into small particles that sink into the terrain
- **Terrain mark:** A tiny flattened circle of darker earth remains where the bot died — accumulates over the game, creating a "history" of the terrarium floor
- **Respawn:** New bot pops into existence with a small "poof" of particles (like appearing from nowhere), starts at minimum size, grows to base size over 1 second

### Player Bot Kill

When the player's bot gets a kill:
- Brief golden particle burst from the winner
- A small golden berry appears at the kill site (visible stat gain)

## HUD / Overlay

The HUD is minimal — the terrarium IS the display. Overlay information as unobtrusive screen-space elements:

### Top Bar (Screen Space, Not 3D)

```
Bot: Player ★ │ SPD 3.2 │ ATK 2.1 │ DEF 4.0 │ LIV 5 │ K:3 │ Strategy: Gatherer │ ⏱ 2:34
```

- Semi-transparent dark bar, small text
- Only shows when mouse is near the top, or always-on (toggle)

### Bot Labels (3D World Space)

- Small text sprites above each bot: "Bot #7" in the bot's color
- Only visible when zoomed in past a threshold (camera distance < fieldW * 0.8)
- Player bot always labeled with ★

### Tooltip on Hover

Hover over a bot (raycast from mouse) to see a floating info card:
```
┌─────────────┐
│ Bot #7       │
│ ★ Player Bot │
│ SPD: 3.2     │
│ ATK: 2.1     │
│ DEF: 4.0     │
│ LIV: 5/5     │
│ Strategy:     │
│  Gatherer     │
└─────────────┘
```

Rendered as HTML overlay positioned via CSS transform to match 3D world position.

## Interaction & Controls

| Input | Action |
|-------|--------|
| **Click-drag** | Orbit camera around terrarium |
| **Scroll** | Zoom in/out |
| **Click bot** | Select bot (highlight ring, show info) |
| **TAB** | Cycle selected bot |
| **Double-click** | Focus camera on clicked bot (smooth zoom) |
| **ESC** | Reset camera to default position |
| **SPACE** | Pause simulation |
| **H** | Toggle HUD visibility |

## Performance Budget

| Element | Draw Calls | Triangles | Notes |
|---------|-----------|-----------|-------|
| Terrain | 1 | ~10,000 | Single mesh, 100×100 segments |
| Terrain details | 3 | ~5,000 | InstancedMesh: grass, rocks, plants |
| Glass panels | 5 | ~60 | Simple boxes |
| Wooden base | 1 | ~12 | Box with bevels |
| Bots (20) | 20 | ~6,000 | Capsule + eyes + details each |
| Food (50) | 1 | ~2,000 | InstancedMesh |
| Desk + lamp | 3 | ~500 | Simple geometry |
| Shadows | — | — | 1024×1024 shadow map |
| **Total** | ~34 | ~24,000 | Well within budget for 60fps |

**Optimizations:**
- InstancedMesh for all repeated elements (grass, rocks, food)
- LOD: at wide zoom, bots switch to simple spheres (no eyes/legs)
- Shadow map updates every 2nd frame (shadows don't change fast)
- Terrain is static — generate once, never update geometry

## What Makes This Unique

The Terrarium is the **containment** concept. Unlike every other design that tries to be immersive (inside the world), this puts you *outside* looking *in*. The glass walls, desk, and lamp create a physical frame — the bots aren't abstract dots on a field, they're tiny living things in a box on your desk. This transforms the spectator experience from "watching a simulation" to "tending a pet ecosystem."

The contained scale also solves a practical problem: the entire field is visible at once from the default camera, so you never miss events. Zoom in for detail, zoom out for overview — no minimap needed, no fog of war, no information restriction.
