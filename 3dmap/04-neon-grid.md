# 04 — Neon Grid

> Synthwave Tron world — geometric light constructs on a glowing grid

## Visual Identity

**Mood:** Synthwave, Tron, cyberpunk minimalism, retro-futuristic
**Reference:** Tron Legacy, Geometry Wars, synthwave album art, Beat Saber, Rez

**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Grid background | `#050510` | Near-black void |
| Grid lines (major) | `#00ffff` at 40% | Cyan primary grid |
| Grid lines (minor) | `#00ffff` at 15% | Fainter subdivisions |
| Grid pulse | `#00ffff` at 60% | Wave traveling outward from center |
| Horizon glow | `#ff00aa` → `#ff6600` → `#ffcc00` | Synthwave sunset gradient |
| Bot bodies | Per-bot neon HSL | Emissive, glowing |
| Bot trails | Per-bot color at 50% | Light ribbons on grid |
| Food prisms | `#ffcc00` emissive | Spinning energy crystals |
| Food beam | `#ffcc00` at 30% | Vertical light column from food |
| Combat arc | `#ff0044` | Lightning between fighting bots |
| Kill shatter | Bot color | Fragments scattering |
| Bloom | All emissive | Post-processing glow |
| Particles | Various neon | Ambient floating motes |

## Scene Structure

### The Grid Plane

The field is a **flat infinite-feeling grid** stretching to a vanishing-point horizon. No walls, no boundaries visible — just grid lines receding into a gradient glow.

```javascript
// Grid plane
const gridSize = 300; // scene units (much larger than field to reach horizon)
const gridGeo = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
const gridMat = new THREE.ShaderMaterial({
    vertexShader: gridVert,
    fragmentShader: gridFrag,
    transparent: true,
    uniforms: {
        fieldSize: { value: new THREE.Vector2(FIELD_W, FIELD_D) },
        gridSpacing: { value: 10.0 },     // major grid lines
        subGridSpacing: { value: 2.0 },    // minor grid lines
        lineColor: { value: new THREE.Color(0x00ffff) },
        lineWidth: { value: 0.03 },
        pulseTime: { value: 0.0 },
        cameraPos: { value: new THREE.Vector3() },
    }
});
```

**Grid shader (fragment):**
```glsl
varying vec2 vWorldPos;
uniform float gridSpacing;
uniform float subGridSpacing;
uniform vec3 lineColor;
uniform float lineWidth;
uniform float pulseTime;

void main() {
    // Major grid lines
    vec2 majorGrid = abs(fract(vWorldPos / gridSpacing - 0.5) - 0.5) / fwidth(vWorldPos / gridSpacing);
    float majorLine = min(majorGrid.x, majorGrid.y);
    float majorAlpha = 1.0 - min(majorLine, 1.0);
    
    // Minor grid lines (fainter)
    vec2 minorGrid = abs(fract(vWorldPos / subGridSpacing - 0.5) - 0.5) / fwidth(vWorldPos / subGridSpacing);
    float minorLine = min(minorGrid.x, minorGrid.y);
    float minorAlpha = (1.0 - min(minorLine, 1.0)) * 0.3;
    
    // Combine
    float alpha = max(majorAlpha * 0.4, minorAlpha);
    
    // Distance fade (grid fades toward horizon)
    float dist = length(vWorldPos - cameraPos.xz);
    alpha *= smoothstep(200.0, 50.0, dist);
    
    // Pulse wave (expanding ring from center)
    float pulseRadius = mod(pulseTime * 30.0, 200.0);
    float pulseDist = abs(length(vWorldPos) - pulseRadius);
    float pulse = smoothstep(3.0, 0.0, pulseDist) * 0.3;
    alpha += pulse;
    
    gl_FragColor = vec4(lineColor, alpha);
}
```

### Horizon

The edge of the world is a **synthwave sunset gradient** — not a physical object, just a gradient backdrop:

```javascript
// Sky / horizon
const skyGeo = new THREE.SphereGeometry(500, 32, 32);
const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    uniforms: {
        topColor: { value: new THREE.Color(0x050510) },     // deep void
        horizonColor1: { value: new THREE.Color(0xff00aa) }, // hot pink
        horizonColor2: { value: new THREE.Color(0xff6600) }, // orange
        horizonColor3: { value: new THREE.Color(0xffcc00) }, // gold
    }
});
```

The horizon glows from below — deep purple at the top of the sky, transitioning through hot pink → orange → gold at the horizon line. A synthwave sun (large circle or half-circle) sits at the horizon, rendered as a bright emissive disc with horizontal scan lines through it.

```glsl
// Synthwave sun in sky shader
float sunDist = length(vDirection.xz - vec2(0.0, -1.0)); // sun position
float sun = smoothstep(0.15, 0.1, sunDist);
// Scan lines across the sun
float scanline = step(0.5, fract(vDirection.y * 40.0));
sun *= mix(1.0, 0.6, scanline);
```

### Ambient Particles

Floating motes of light drift through the scene — tiny glowing points that add depth and atmosphere:

```javascript
const particleCount = 200;
const particleGeo = new THREE.BufferGeometry();
// ... scatter positions in a volume above the grid
const particleMat = new THREE.PointsMaterial({
    color: 0x00ffff,
    size: 0.3,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
});
```

- Drift slowly upward (Y += 0.01/frame)
- Reset to bottom when they pass a Y threshold
- Random X/Z drift for organic movement
- Color varies: mostly cyan, occasional pink or gold motes

## Bot Rendering

### Geometric Light Constructs

Bots are **faceted polyhedra** — crystalline geometric forms that hover above the grid, emitting light:

```javascript
function createNeonBot(bot) {
    const group = new THREE.Group();
    
    // Body: icosahedron (20 faces — geometric, crystalline)
    const bodyRadius = 1.5 + bot.totalStats * 0.05;
    const bodyGeo = new THREE.IcosahedronGeometry(bodyRadius, 0); // 0 = no subdivision, faceted
    const bodyMat = new THREE.MeshStandardMaterial({
        color: bot.color,
        emissive: bot.color,
        emissiveIntensity: 0.6,
        roughness: 0.1,
        metalness: 0.8,
        flatShading: true,    // keep faceted look
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = false;  // no shadows in neon world
    group.add(body);
    
    // Inner core glow (smaller, brighter)
    const coreGeo = new THREE.IcosahedronGeometry(bodyRadius * 0.5, 1);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);
    
    // Point light (each bot illuminates the grid beneath it)
    const light = new THREE.PointLight(bot.color, 0.5, 15);
    light.position.y = -1;
    group.add(light);
    
    // Direction indicator: small cone pointing forward
    const dirGeo = new THREE.ConeGeometry(0.4, 1.5, 4);
    const dirMat = new THREE.MeshBasicMaterial({ color: bot.color });
    const dir = new THREE.Mesh(dirGeo, dirMat);
    dir.rotation.x = Math.PI / 2;
    dir.position.z = bodyRadius + 1;
    group.add(dir);
    
    return group;
}
```

**Bot animation:**
- Hover 2 units above grid surface
- Slow rotation on Y axis (each bot rotates at slightly different speed — organic variety)
- Gentle hover bob (sine wave Y offset, ±0.3 units, 2-second period)
- Point light creates a colored pool of light on the grid beneath each bot

### Stat Visualization

| Stat | Visual |
|------|--------|
| **Speed** | Rotation speed increases. Fast bots spin noticeably faster. Trail length also increases. |
| **Attack** | Emissive intensity increases. High attack bots glow brighter and illuminate more grid area. Body gains additional extruded spikes (extra vertices pushed outward). |
| **Defence** | Additional outer shell — a slightly larger wireframe icosahedron surrounding the body at 20% opacity. Higher defence = more opaque shell. |
| **Lives** | Number of visible facets. At low lives, faces become transparent (dissolving). At full lives, all faces solid. |

### Light Trails

The signature visual feature — each bot leaves a **glowing ribbon** on the grid surface:

```javascript
class LightTrail {
    constructor(bot, maxPoints = 120) { // 2 seconds at 60fps
        this.maxPoints = maxPoints;
        this.points = [];
        this.color = bot.color;
        
        // Trail geometry: a strip of quads on the grid surface
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(maxPoints * 2 * 3); // 2 verts per point, 3 components
        this.alphas = new Float32Array(maxPoints * 2);
        
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
        
        this.material = new THREE.ShaderMaterial({
            vertexShader: trailVert,
            fragmentShader: trailFrag,
            transparent: true,
            blending: THREE.AdditiveBlending,
            uniforms: {
                color: { value: new THREE.Color(bot.color) },
            }
        });
        
        this.mesh = new THREE.Mesh(this.geometry, this.material);
    }
    
    update(position, heading) {
        // Add new point
        this.points.push({
            x: position.x,
            z: position.z,
            heading: heading,
            age: 0
        });
        
        // Remove old points
        while (this.points.length > this.maxPoints) {
            this.points.shift();
        }
        
        // Age all points
        this.points.forEach(p => p.age++);
        
        // Rebuild geometry
        this.rebuildGeometry();
    }
    
    rebuildGeometry() {
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            const width = 0.5; // trail width
            const perpX = Math.sin(p.heading) * width;
            const perpZ = -Math.cos(p.heading) * width;
            
            const alpha = 1.0 - (p.age / this.maxPoints);
            
            // Left vertex
            this.positions[i * 6] = p.x - perpX;
            this.positions[i * 6 + 1] = 0.05; // just above grid
            this.positions[i * 6 + 2] = p.z - perpZ;
            this.alphas[i * 2] = alpha;
            
            // Right vertex
            this.positions[i * 6 + 3] = p.x + perpX;
            this.positions[i * 6 + 4] = 0.05;
            this.positions[i * 6 + 5] = p.z + perpZ;
            this.alphas[i * 2 + 1] = alpha;
        }
        
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
    }
}
```

**Trail properties:**
- Width: 0.5 scene units (thin ribbon)
- Length: 120 frames (2 seconds) — configurable
- Color: matches the bot's color
- Blending: additive (trails glow, overlapping trails get brighter)
- The trail creates a **movement history map** — after a minute of play, the grid is covered in fading colored paths showing where every bot has been

### Grid Illumination

Each bot's point light illuminates the grid lines beneath it, creating a **colored pool of light**:

- Cyan bot → cyan-tinted grid lines in a 15-unit radius
- Red bot → red-tinted grid lines
- Where two bots' lights overlap, colors blend additively (cyan + red = white-ish)

This means the grid itself becomes an information display — you can see bot positions by where the grid glows, even before you see the bot itself.

## Food Rendering

Food dots are **spinning energy prisms** with vertical light beams:

```javascript
function createFoodPrism() {
    const group = new THREE.Group();
    
    // Crystal: octahedron (diamond shape)
    const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 1.0,
        flatShading: true,
        metalness: 0.5,
        roughness: 0.1,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 1.5;
    group.add(crystal);
    
    // Vertical light beam
    const beamGeo = new THREE.CylinderGeometry(0.1, 0.3, 8, 6);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 4;
    group.add(beam);
    
    // Point light
    const light = new THREE.PointLight(0xffcc00, 0.4, 12);
    light.position.y = 1.5;
    group.add(light);
    
    return group;
}
```

**Food animation:**
- Crystal slowly rotates on Y axis
- Crystal bobs up-down (sine, ±0.3 units)
- Light beam pulses opacity (sine, 0.1–0.2)
- When consumed: crystal shatters into 6-8 flat triangular fragments (one per face) that fly outward and dissolve. Beam flickers and fades.
- When spawning: beam appears first (growing from ground up), then crystal materializes at the top with a flash

## Camera System

### Default Camera

Elevated 30° angle, tracking the player bot:

```javascript
const camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.1, 1000);

// Default position: behind and above player bot
function updateCamera(playerBot) {
    const targetPos = fieldToScene(playerBot.x, playerBot.y);
    const offset = new THREE.Vector3(0, 30, 40); // behind and above
    
    const desiredPos = targetPos.clone().add(offset);
    camera.position.lerp(desiredPos, 0.04);
    
    const lookTarget = targetPos.clone().add(new THREE.Vector3(0, 2, 0));
    // Smooth look-at
    currentLookAt.lerp(lookTarget, 0.06);
    camera.lookAt(currentLookAt);
}
```

### Camera Modes

| Mode | Description |
|------|-------------|
| **Follow** (default) | Behind and above player bot, smooth tracking |
| **Overhead** | Top-down, full field visible, no perspective distortion |
| **Orbit** | Free orbit controls, centered on field |
| **Ground level** | Camera at grid height, dramatic low-angle view looking across the surface |

### Ground-Level View

The most visually striking camera position — at grid height looking across:

- Grid lines converge to the horizon (extreme perspective)
- Bots are silhouetted against the synthwave sky
- Trails are at eye level — a maze of colored light ribbons
- Food beams are dramatic vertical pillars of light

## Post-Processing

The key to the neon aesthetic: **bloom post-processing**.

```javascript
// Using Three.js EffectComposer
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));

// Bloom
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.8,    // strength
    0.5,    // radius
    0.3     // threshold (only bright things bloom)
);
composer.addPass(bloomPass);

// Optional: chromatic aberration (slight color fringing at edges)
// Optional: vignette (darken corners)
```

**Bloom is essential** — without it, the emissive materials look flat. With bloom, everything glows naturally: bot bodies bleed light, trails shimmer, food beams haze. The bloom threshold (0.3) means only emissive objects bloom — the dark grid stays sharp.

## Combat Visualization

### Approach
- Both bots' emissive intensity increases (glow brighter)
- Their grid pools of light expand (point light range increases)
- A thin line of sparks appears between them (particle system along the line connecting them)

### Engagement
- **Arc lightning:** A jagged electric arc connects the two bots during each hit. Rendered as a zigzag line (segment chain with random perpendicular offsets), emissive white-blue, lasting 3-5 frames per hit.

```javascript
function createArcLightning(from, to) {
    const points = [];
    const segments = 8;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pos = from.clone().lerp(to, t);
        // Random perpendicular offset (diminishing at endpoints)
        const offset = (Math.random() - 0.5) * 3 * Math.sin(t * Math.PI);
        pos.y += offset;
        pos.x += (Math.random() - 0.5) * 2 * Math.sin(t * Math.PI);
        points.push(pos);
    }
    
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2, // Note: linewidth >1 not supported in WebGL; use MeshLine library
        blending: THREE.AdditiveBlending,
    });
    return new THREE.Line(geo, mat);
}
```

- **Grid distortion:** The grid lines near combat bend/warp outward (achieved by shader uniform passing combat positions — grid shader offsets UVs near those positions)
- **Point light flash:** Each hit triggers a bright white flash from a temporary point light (intensity 5, range 20, decays over 5 frames)

### Kill
- **Shatter:** The loser's icosahedron breaks into individual faces. Each face becomes a separate mesh that flies outward with rotation, glowing in the bot's color, then fading to black.

```javascript
function shatterBot(botMesh) {
    const geo = botMesh.geometry;
    const fragments = [];
    
    // For each face of the icosahedron
    for (let i = 0; i < geo.index.count; i += 3) {
        const faceGeo = new THREE.BufferGeometry();
        // Extract 3 vertices for this face
        // Create a small triangle mesh
        // Give it velocity (outward from center + random)
        // Give it spin (random rotation)
        fragments.push({
            mesh: new THREE.Mesh(faceGeo, fragMat),
            velocity: new THREE.Vector3(/*...*/),
            spin: new THREE.Vector3(/*...*/),
            life: 60, // frames until fade
        });
    }
    
    return fragments;
}
```

- **Grid shockwave:** A bright ring expands outward on the grid surface from the kill point (similar to the ambient grid pulse but brighter, faster, single-shot)
- **Trail burn:** The dead bot's trail briefly flashes white then rapidly fades to nothing
- **Winner boost:** Winner's emissive intensity surges, rotation speeds up momentarily, a burst of small particles orbits the winner for 1 second

### Player Kill
- Above effects + screen-wide bloom intensity spike (0.8 → 1.5 for 0.5 seconds then decay)
- Grid pulse emanates from kill point in player bot's color (not cyan)

## HUD / Overlay

Minimal, neon-styled:

```
┌─────────────────────────────────────────────────┐
│  ◈ PLAYER  │ SPD 3.2  ATK 2.1  DEF 4.0  LIV 5 │
│  KILLS: 3  │ POPULATION: 15/20  │  ⏱ 2:34      │
└─────────────────────────────────────────────────┘
```

- Bottom of screen, cyan text on transparent dark background
- Font: monospace, thin (Fira Code, Source Code Pro, or similar)
- Text has subtle glow (CSS text-shadow in cyan)
- Kill events flash in the center of screen: `"◈ ELIMINATED Bot#7"` in the bot's death color, fading over 2 seconds

## Interaction & Controls

| Input | Action |
|-------|--------|
| **Click-drag** | Orbit camera |
| **Scroll** | Zoom |
| **1** | Follow cam (default) |
| **2** | Overhead cam |
| **3** | Free orbit |
| **4** | Ground-level cam |
| **TAB** | Cycle selected bot |
| **F** | Toggle follow target |
| **B** | Toggle bloom intensity (subtle / strong / off) |
| **T** | Toggle trail length (short / medium / long / off) |
| **SPACE** | Pause (all animations freeze, grid pulse stops) |

## Performance Budget

| Element | Draw Calls | Triangles | Notes |
|---------|-----------|-----------|-------|
| Grid plane | 1 | 2 | Shader does all the work |
| Sky dome | 1 | ~2,000 | Gradient shader |
| Bots (20) | 20 | ~4,000 | Icosahedron + core + cone each |
| Bot lights (20) | — | — | 20 point lights (expensive for shadows, but NO shadows in this concept) |
| Food (50) | 1 | ~2,500 | InstancedMesh (crystals only) |
| Food beams (50) | 1 | ~1,500 | InstancedMesh |
| Food lights (50) | — | — | 50 point lights (limit: use only nearest 20) |
| Trails (20) | 20 | ~9,600 | 240 verts each, updated per frame |
| Ambient particles | 1 | ~200 | Points |
| Post-processing | 3 passes | — | Render + bloom (2 passes) |
| **Total** | ~49 | ~20,000 | Light count is the bottleneck |

**Key optimization: Point lights.** 70 point lights (20 bots + 50 food) is too many. Solutions:
- Limit food lights to the nearest 15-20 to the camera
- Use a deferred rendering approach (if Three.js supports it via addons)
- Or: remove individual food lights and instead bake food positions into the grid shader as glow spots (uniform array of food positions, grid shader adds brightness near each)

**Bloom performance:** UnrealBloomPass does two extra full-screen passes. At 1080p this is fine; at 4K it might need half-resolution bloom (render bloom at 50% then upscale).

## What Makes This Unique

Neon Grid is the **style** concept. It doesn't try to simulate reality — it creates a purely aesthetic world that looks like nothing else. The light trails are both beautiful and informative (showing movement history). The grid-as-information-display (glowing where bots are) is unique. The synthwave horizon is immediately striking.

It's also the most visually flexible: the color palette and bloom intensity can be adjusted to create wildly different moods (icy blue, hot pink, golden warmth) without changing any geometry. A "theme" system could let players pick their preferred neon palette.

The flat grid geometry makes this one of the cheapest concepts to render — the visual complexity comes from materials, lighting, and post-processing, not polygon count.
