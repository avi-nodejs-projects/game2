# 02 — Orbital

> The field wraps onto a small planet — orbit freely, see the whole world

## Visual Identity

**Mood:** Cosmic god-game, expansive, serene yet dramatic
**Reference:** Planetary scenes in Spore, The Universim, Google Earth, Katamari Damacy

**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Planet surface | `#3a7a2a` → `#2a5a1a` | Green terrain with biome variation |
| Planet poles | `#6a9a5a` | Lighter, cooler green at high latitudes |
| Atmosphere rim | `#88ccff` at 30% | Fresnel glow at planet edge |
| Atmosphere haze | `#aaddff` at 10% | Subtle blue haze on distant surface |
| Ocean (oob) | `#1a4a8a` | Deep blue where field "ends" (poles) |
| Terrain rock | `#6a6a5a` | Mountain/ridge detail |
| Bot bodies | Per-bot HSL | Bright against green surface |
| Food | `#ffcc00` emissive | Glowing flora on surface |
| Sun | `#fff8e0` | Directional light source |
| Stars | `#ffffff` various sizes | Background particle field |
| Night side | `#0a0a15` | Unlit hemisphere |
| Shadow | `rgba(0,0,0,0.4)` | Directional from sun |

## Core Concept

The flat 2000×2000 game field is **mapped onto the surface of a sphere**. Bots crawl around the planet like creatures on a globe. The camera orbits freely — spin the planet to find bots, zoom in to watch individuals, zoom out for the full-world view.

This eliminates the "edge of the world" problem — bots can wrap around the planet. It also gives complete spatial awareness: at any zoom level, you can see a significant portion of the field.

## Planet Geometry

### Sphere Construction

```javascript
const PLANET_RADIUS = 100; // scene units
const SEGMENTS = 128;      // enough for smooth surface + terrain

const planetGeo = new THREE.SphereGeometry(PLANET_RADIUS, SEGMENTS, SEGMENTS);
```

### Coordinate Mapping

The 2000×2000 flat field maps onto the sphere surface using **equirectangular projection** (like a world map wrapping onto a globe):

```javascript
function fieldToSphere(fieldX, fieldY) {
    // Map field coordinates to longitude/latitude
    const lon = (fieldX / FIELD_WIDTH) * Math.PI * 2 - Math.PI;   // -π to π
    const lat = (fieldY / FIELD_HEIGHT) * Math.PI - Math.PI / 2;   // -π/2 to π/2
    
    // Convert to 3D position on sphere surface
    const x = PLANET_RADIUS * Math.cos(lat) * Math.cos(lon);
    const y = PLANET_RADIUS * Math.sin(lat);
    const z = PLANET_RADIUS * Math.cos(lat) * Math.sin(lon);
    
    return new THREE.Vector3(x, y, z);
}

function sphereToField(position) {
    const lat = Math.asin(position.y / PLANET_RADIUS);
    const lon = Math.atan2(position.z, position.x);
    
    const fieldX = ((lon + Math.PI) / (Math.PI * 2)) * FIELD_WIDTH;
    const fieldY = ((lat + Math.PI / 2) / Math.PI) * FIELD_HEIGHT;
    
    return { x: fieldX, y: fieldY };
}
```

### Terrain Detail

The sphere isn't perfectly smooth — it has subtle **terrain displacement**:

```javascript
function displaceTerrainVertex(position, normal) {
    // Sample multiple noise octaves for natural terrain
    const noiseScale = 0.02;
    const displacement = 
        noise3D(position.x * noiseScale, position.y * noiseScale, position.z * noiseScale) * 2.0 +
        noise3D(position.x * 0.05, position.y * 0.05, position.z * 0.05) * 0.8;
    
    // Apply along normal (push vertices outward/inward)
    const maxHeight = PLANET_RADIUS * 0.03; // 3% of radius
    position.addScaledVector(normal, displacement * maxHeight);
}
```

- **Mountains/ridges:** Perlin noise displacement pushing vertices outward
- **Valleys:** Slight inward displacement
- **Max displacement:** ±3% of planet radius (subtle, not dramatic)
- The displacement is generated once at startup and baked into the geometry

### Surface Material

```javascript
const planetMat = new THREE.MeshStandardMaterial({
    vertexColors: true,     // per-vertex biome coloring
    roughness: 0.85,
    metalness: 0.0,
    flatShading: false,     // smooth normals for organic feel
});
```

**Vertex coloring for biome variation:**
- **Lowlands:** Rich green (fertile areas where food spawns more)
- **Highlands:** Lighter green / tan (rocky, less food)
- **"Poles" (top/bottom):** Cooler desaturated green → fading to ocean blue at extremes
- **Ridges:** Gray-brown rock exposed on steep slopes (calculate from vertex normal: steep = rock, flat = grass)

### Atmosphere

A larger translucent sphere surrounding the planet:

```javascript
const atmosphereGeo = new THREE.SphereGeometry(PLANET_RADIUS * 1.04, 64, 64);
const atmosphereMat = new THREE.ShaderMaterial({
    vertexShader: atmosphereVert,
    fragmentShader: atmosphereFrag,
    transparent: true,
    side: THREE.BackSide,   // only visible from outside
    uniforms: {
        sunDirection: { value: new THREE.Vector3(1, 0.5, 0.3).normalize() },
        atmosphereColor: { value: new THREE.Color(0x88ccff) },
    }
});
```

**Fresnel rim effect:** The atmosphere glows brighter at the planet's edge (where viewing angle is tangential). This creates the "thin blue line" effect that makes planets look real.

```glsl
// Fragment shader (simplified)
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
    gl_FragColor = vec4(atmosphereColor, fresnel * 0.4);
}
```

## Bot Rendering

### Surface-Locked Movement

Bots exist ON the planet surface. Each bot's position is a 3D point on the sphere, and the bot is oriented tangent to the surface:

```javascript
function updateBotTransform(botMesh, bot) {
    const pos = fieldToSphere(bot.x, bot.y);
    botMesh.position.copy(pos);
    
    // Orient bot to stand on surface (up = outward from center)
    const up = pos.clone().normalize();
    const forward = getHeadingTangent(bot, up);
    
    const matrix = new THREE.Matrix4();
    matrix.lookAt(
        pos,
        pos.clone().add(forward),
        up
    );
    botMesh.setRotationFromMatrix(matrix);
    
    // Offset slightly above surface (half body height)
    botMesh.position.addScaledVector(up, botMesh.bodyRadius * 0.5);
}

function getHeadingTangent(bot, surfaceNormal) {
    // Project heading direction onto tangent plane
    const headingDir = new THREE.Vector3(
        Math.cos(bot.heading),
        0,
        Math.sin(bot.heading)
    );
    // Remove component along surface normal
    headingDir.addScaledVector(surfaceNormal, -headingDir.dot(surfaceNormal));
    headingDir.normalize();
    return headingDir;
}
```

### Bot Shape

Simple but readable 3D shapes — visible from orbit distance:

- **Body:** Hemisphere (flat bottom on surface, rounded top) — like a ladybug
- **Color:** Bright, saturated HSL matching their game color
- **Size:** Scales with total stats (radius 1.5 → 3.0 scene units)
- **Eyes:** Two small white dots on the front face (visible when zoomed in)
- **Direction:** Small triangular "nose" or antenna pointing forward

```javascript
function createBotMesh(bot) {
    // Hemisphere body
    const geo = new THREE.SphereGeometry(2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
        color: bot.color,
        roughness: 0.5,
        metalness: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    
    // Small direction indicator (cone on front)
    const noseGeo = new THREE.ConeGeometry(0.5, 1.5, 6);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: bot.color, emissiveIntensity: 0.3 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.5, 2);
    mesh.add(nose);
    
    return mesh;
}
```

### Stat Visualization

| Stat | Visual |
|------|--------|
| **Speed** | Movement trail — a fading line on the planet surface behind the bot (like a contrail). Faster = longer trail. |
| **Attack** | Body emissive glow intensity. High attack bots visibly glow. |
| **Defence** | Body roughness decreases → becomes shinier / more metallic at high defence. Armored look. |
| **Lives** | Opacity. Low lives = slightly transparent. Full lives = solid. |

## Food Rendering

Food dots become **bioluminescent flora** on the planet surface:

```javascript
function createFoodMesh() {
    // Small glowing sphere sitting on surface
    const geo = new THREE.SphereGeometry(0.8, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.6,
        roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    
    // Add small point light for local illumination
    const light = new THREE.PointLight(0xffcc00, 0.3, 8);
    mesh.add(light);
    
    return mesh;
}
```

- Surface-locked like bots (sits on terrain)
- Emissive glow makes them visible from orbit distance
- Subtle pulse animation (emissive intensity oscillates)
- When consumed: quick shrink + particle burst
- When spawning: grow from point + soft flash

**Food clusters** are visible from orbit as bright yellow patches on the green surface — natural "hotspots" that draw the eye.

## Camera System

### Orbital Camera

Free orbit around the planet using Three.js OrbitControls:

```javascript
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);         // always orbiting planet center
controls.enablePan = false;            // no panning off-center
controls.minDistance = PLANET_RADIUS * 1.3;  // just above atmosphere
controls.maxDistance = PLANET_RADIUS * 5;    // far enough to see full planet
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.6;
controls.autoRotate = false;           // togglable
controls.autoRotateSpeed = 0.5;
```

### Zoom Levels

| Distance | What You See | Detail Level |
|----------|-------------|--------------|
| 5× radius | Full planet, atmosphere glow, bot clusters as colored dots | Minimal — just dots and colors |
| 3× radius | Half the planet, individual bots visible as shapes | Bot shapes, food patches |
| 2× radius | Quarter of planet, bot details readable | Eyes, direction, trails |
| 1.3× radius | Close orbit, terrain detail visible | Full detail — legs, horns, terrain bumps |

### Auto-Follow Mode

Toggle with `F`: camera smoothly orbits to keep the player bot centered in view:

```javascript
let followTarget = null;

function updateFollow() {
    if (!followTarget) return;
    
    const targetPos = fieldToSphere(followTarget.x, followTarget.y);
    const desiredCamPos = targetPos.clone()
        .normalize()
        .multiplyScalar(controls.getDistance()); // maintain current zoom
    
    camera.position.lerp(desiredCamPos, 0.03); // slow, smooth follow
    controls.target.set(0, 0, 0); // always look at planet center
}
```

### Night/Day

The sun (directional light) creates a natural **day/night terminator** across the planet:

- The lit hemisphere is clearly visible
- The dark hemisphere is dim (ambient light only) — bots and food still faintly visible due to emissive properties
- Bots on the night side: their food targets glow brighter against the dark surface (food emissive is more prominent)
- Optional: slow sun rotation (1 revolution per 10 minutes) for dynamic day/night cycle

## Combat Visualization

### Approach
- Both bots' trails glow brighter (emissive boost)
- A faint arc of light connects them on the planet surface (great circle arc, thin line)

### Contact
- **Collision burst:** Small flash of white light at contact point (PointLight flash: intensity 2 → 0 over 0.3s)
- **Surface ripple:** A ring of displacement expands on the terrain mesh from the impact point (vertex displacement wave, 0.5 unit height, expanding and fading)
- **Bot animation:** Both bots squash on impact, bounce back

### Kill
- **Winner:** Glow surge, size pulse (1.2× then settle)
- **Loser:** Color drains (desaturate to gray), bot shrinks to a point and disappears
- **Crater:** A small dark circle remains on the planet surface at the death location — a permanent scar. Over time, the planet accumulates battle damage history.
- **Particle burst:** Small colored particles (the bot's color) fly off the surface and slowly fall back (arc trajectory in 3D space, affected by "gravity" toward planet center)

### Player Bot Kill
- Golden particles form a brief halo around the winner
- A tiny golden flag appears at the kill site (sticks out from the planet surface like a pin)

## HUD / Overlay

### Minimal Screen-Space UI

```
┌─────────────────────────────────────────────┐
│ ★ Player Bot │ SPD 3.2 ATK 2.1 DEF 4.0 LIV 5 │
│ Population: 15/20 │ K:3 │ ⏱ 2:34              │
└─────────────────────────────────────────────┘
```

- Top bar, semi-transparent, auto-hides after 3 seconds of no events
- Reappears on stat change, kill, or mouse hover

### Bot Markers (3D World Space)

- At wide zoom (>3× radius): colored circles on the planet surface with thin leader lines to small name labels that face the camera (billboard sprites)
- The player bot's marker is a ★ instead of a circle
- Pack members share a colored ring tint

### Planet Info Overlay

When zoomed out fully, show:
- Total bot count per hemisphere
- "Hot zones" — semi-transparent red overlay on areas with recent combat (heat map on planet surface)
- Optional: toggle with `H`

## Interaction & Controls

| Input | Action |
|-------|--------|
| **Click-drag** | Orbit camera around planet |
| **Scroll** | Zoom in/out |
| **Click bot** | Select (info popup) |
| **TAB** | Cycle selected bot |
| **F** | Toggle auto-follow on selected bot |
| **A** | Toggle auto-rotate (slow spin) |
| **N** | Toggle night/day cycle |
| **SPACE** | Pause |
| **ESC** | Reset camera to default |

## Performance Budget

| Element | Draw Calls | Triangles | Notes |
|---------|-----------|-----------|-------|
| Planet sphere | 1 | ~33,000 | 128×128 segments |
| Atmosphere | 1 | ~8,000 | 64×64 segments, shader |
| Bots (20) | 20 | ~5,000 | Hemisphere + nose + eyes |
| Food (50) | 1 | ~1,600 | InstancedMesh |
| Bot trails | 20 | ~2,000 | Line segments on surface |
| Starfield | 1 | ~2,000 | Points / particle system |
| Craters/markers | 1 | ~500 | InstancedMesh, accumulated |
| **Total** | ~46 | ~52,000 | Comfortable for 60fps |

**Key optimization:** The planet geometry is static — compute displacement once. Only bot positions and food states change per frame. Atmosphere shader is a single full-screen pass. Starfield is a static particle system (no updates).

**LOD:** At far zoom, replace bot meshes with simple colored dots (PointsMaterial) — switch threshold at 3× radius.

## What Makes This Unique

Orbital is the **totality** concept. You can see the entire world by simply rotating the camera. There are no hidden areas, no fog of war, no off-screen surprises. The spherical field creates a beautiful, unified world that feels complete. The day/night terminator and atmospheric glow add cosmic drama to a simple bot simulation.

The sphere wrapping also changes gameplay subtly: bots near the "edges" of the original flat field now wrap around naturally. A bot running "off the map" simply appears on the other side. The field boundaries become invisible — the world feels infinite despite being finite.

The permanent craters and kill markers create a visual history on the planet surface. After a long game, the planet is scarred with tiny battle sites — a record of the simulation's violence written on the landscape.
