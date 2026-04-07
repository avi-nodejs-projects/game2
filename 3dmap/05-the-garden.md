# 05 — The Garden

> A lush 3D nature scene — bots are creatures in a living ecosystem

## Visual Identity

**Mood:** Peaceful, organic, nature-documentary immersion, warm and alive
**Reference:** Pikmin, BBC Planet Earth, flower gardens, macro nature photography

**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Grass | `#4a8c3a` → `#2a6a1a` | Terrain surface, rich greens |
| Dirt paths | `#8a7a5a` | Worn tracks between areas |
| Water | `#3a7aaa` with caustics | Pond/stream |
| Sky | `#88bbee` → `#cceeff` | Clear day gradient |
| Clouds | `#ffffff` at 80% | Soft billowy shapes |
| Sunset sky | `#ff8844` → `#cc4488` → `#4a2a6a` | Evening palette |
| Night sky | `#0a0a20` | Deep dark blue |
| Trees | `#2a5a1a` | Border canopy |
| Flowers | Various bright | Food representations |
| Bot bodies | Earth tones + accent | Creature colors |
| Fireflies | `#ffee66` | Dusk/night ambient particles |
| Moonlight | `#aabbdd` | Night directional |
| Sunlight | `#fff8e0` | Day directional |

## Scene Structure

### The Garden Environment

The field becomes a **lush garden clearing** — a flat-ish meadow surrounded by trees and bushes, with a small body of water, flowers, rocks, and natural terrain variation. It feels like a spot in a national park viewed through a macro lens.

```
Scene
├── Terrain
│   ├── GroundMesh (heightmap, grass material)
│   ├── DirtPaths (darkened texture channels on ground)
│   └── WaterBody (reflective plane with caustic shader)
├── Vegetation
│   ├── GrassBlades (instanced, wind animation)
│   ├── Flowers (instanced, food locations)
│   ├── Bushes (border vegetation, instanced)
│   ├── Trees (border, low-poly with leaf canopy)
│   └── Rocks (scattered, instanced)
├── Creatures (Bots)
│   └── CreatureGroup (individual rigged meshes)
├── Food (interchangeable with Flowers)
├── Atmosphere
│   ├── SkyBox (gradient + clouds)
│   ├── Sun/Moon (directional light)
│   ├── AmbientParticles (dust/fireflies)
│   └── Fog (distance-based, subtle)
├── Camera (documentary auto-director)
└── HUD (minimal overlay)
```

### Terrain

Rolling meadow with gentle elevation:

```javascript
function createGardenTerrain() {
    const size = 200; // scene units
    const segments = 128;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getY(i); // PlaneGeometry Y becomes world Z
        
        // Gentle rolling terrain
        let height = 0;
        height += Math.sin(x * 0.02) * Math.cos(z * 0.03) * 4;
        height += Math.sin(x * 0.05 + 1.5) * Math.cos(z * 0.04 + 0.5) * 2;
        height += Math.sin(x * 0.1) * Math.sin(z * 0.08) * 1; // fine detail
        
        // Depression for pond (centered at offset position)
        const pondX = 30, pondZ = -20, pondRadius = 18;
        const pondDist = Math.sqrt((x - pondX) ** 2 + (z - pondZ) ** 2);
        if (pondDist < pondRadius) {
            height -= (1 - pondDist / pondRadius) * 3;
        }
        
        positions.setZ(i, Math.max(-2, height)); // Z is up for rotated plane
    }
    
    geo.computeVertexNormals();
    geo.rotateX(-Math.PI / 2);
    
    const mat = new THREE.MeshStandardMaterial({
        color: 0x4a8c3a,
        roughness: 0.9,
        metalness: 0,
        // Vertex colors for biome variation (greener lowlands, browner hills)
    });
    
    return new THREE.Mesh(geo, mat);
}
```

### Water Body

A small pond with reflective, animated water:

```javascript
const waterGeo = new THREE.CircleGeometry(18, 32);
const water = new THREE.Water(waterGeo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: waterNormalsTexture, // animated ripple normal map
    sunDirection: sunLight.position.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: 0x3a7aaa,
    distortionScale: 1.5,
    fog: true,
});
water.rotation.x = -Math.PI / 2;
water.position.set(30, -0.5, -20);
```

- Gentle ripple animation (normal map scrolling)
- Reflections of nearby bots and vegetation
- Bots avoid the water (treated as obstacle in pathfinding)
- Optional: lily pads (small flat discs floating on surface)

### Grass Blades

Individual grass blades rendered with instanced mesh, swaying in wind:

```javascript
const GRASS_COUNT = 5000;
const bladeGeo = new THREE.PlaneGeometry(0.15, 1.2, 1, 3); // 3 segments for bending

// Vertex shader handles wind sway
const grassMat = new THREE.ShaderMaterial({
    vertexShader: grassVert,
    fragmentShader: grassFrag,
    side: THREE.DoubleSide,
    uniforms: {
        time: { value: 0 },
        windStrength: { value: 0.3 },
        windDirection: { value: new THREE.Vector2(1, 0.5) },
        grassColor: { value: new THREE.Color(0x4a8c3a) },
        grassTipColor: { value: new THREE.Color(0x6aac5a) },
    }
});
```

```glsl
// Grass vertex shader (simplified)
varying float vHeight;
uniform float time;
uniform float windStrength;
uniform vec2 windDirection;

void main() {
    vec3 pos = position;
    vHeight = pos.y; // height along blade
    
    // Wind sway (stronger at tip, using height as weight)
    float windPhase = dot(instancePosition.xz, windDirection) * 0.1 + time;
    float sway = sin(windPhase) * windStrength * pos.y * pos.y;
    pos.x += sway * windDirection.x;
    pos.z += sway * windDirection.y;
    
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
}
```

- Grass blades are lighter at the tip (gradient from base green to yellow-green)
- Wind direction changes slowly over time (sine-based drift)
- Grass is shorter near paths and the water edge
- Bots push grass aside as they walk through (optional: nearby blades bend away from bot position)

### Border Vegetation

Trees and bushes ring the field edges — creating a natural "wall":

- **Trees:** Low-poly trunks (brown cylinders) with simple leaf canopies (clusters of green spheres or billboard sprites). 10-15 trees at irregular spacing. They cast shadows into the arena.
- **Bushes:** Rounded green shapes (spheres with noise displacement) filling gaps between trees. Dense enough to feel like a hedge row.
- **Rocks:** 15-20 irregular polyhedra scattered near the borders and in clusters on the terrain.

## Bot Rendering — Creatures

### Creature Design

Bots become stylized **insect-like creatures** — not realistic insects, but cute/expressive creatures with recognizable body language:

```javascript
function createCreature(bot) {
    const group = new THREE.Group();
    const baseSize = 1.5 + bot.totalStats * 0.04;
    
    // Body: elongated sphere (thorax)
    const bodyGeo = new THREE.SphereGeometry(baseSize, 12, 8);
    bodyGeo.scale(1, 0.7, 1.3); // flatten, elongate
    const bodyMat = new THREE.MeshStandardMaterial({
        color: bot.color,
        roughness: 0.6,
        metalness: 0.05,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = baseSize * 0.7;
    body.castShadow = true;
    group.add(body);
    
    // Head: smaller sphere at front
    const headSize = baseSize * 0.55;
    const headGeo = new THREE.SphereGeometry(headSize, 10, 8);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, baseSize * 0.8, baseSize * 1.1);
    group.add(head);
    
    // Eyes: large, expressive (proportionally big — cute factor)
    createCreatureEyes(group, head, headSize, bot);
    
    // Antennae: two thin cones
    createAntennae(group, head, headSize);
    
    // Legs: created based on speed stat
    createLegs(group, body, baseSize, bot.speed);
    
    return group;
}
```

### Eyes (Expressive)

Large eyes relative to head — the primary source of personality:

```javascript
function createCreatureEyes(group, head, headSize, bot) {
    const eyeSize = headSize * 0.4;
    const eyeGeo = new THREE.SphereGeometry(eyeSize, 10, 10);
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    
    [-0.3, 0.3].forEach(side => {
        const eye = new THREE.Mesh(eyeGeo, scleraMat);
        eye.position.set(side * headSize, headSize * 0.2, headSize * 0.7);
        head.add(eye);
        
        // Pupil
        const pupilGeo = new THREE.SphereGeometry(eyeSize * 0.45, 8, 8);
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const pupil = new THREE.Mesh(pupilGeo, pupilMat);
        pupil.position.z = eyeSize * 0.55;
        eye.add(pupil);
    });
}
```

**Eye behavior (updated per frame):**

| State | Eyes |
|-------|------|
| **Gathering** (seeking food) | Wide, pupils look toward target food |
| **Hunting** | Narrow (squint — scale Y 0.7), pupils locked on target bot, slight head tilt forward |
| **Fleeing** | Wide open (scale Y 1.3), pupils look behind (rotate toward pursuer) |
| **Idle** | Relaxed, pupils drift slowly (random sine offset) |
| **Eating** | Close briefly (blink, scale Y → 0 → 1 over 5 frames), happy — slight squint after |
| **Combat** | Angry — pupils shrink, brow angle (head tilts forward) |
| **Near death** | Half-closed, drooping (head tilts down) |

### Stat-Driven Body Morphology

The creature's body visually reflects its stats — no numbers needed:

| Stat | Physical Change |
|------|----------------|
| **Speed** | **Legs multiply and lengthen.** 2 legs at base → 4 at speed 3 → 6 at speed 5+. Legs are longer at higher speed. Walking animation is faster. Body becomes sleeker (less Y scale). |
| **Attack** | **Mandibles grow.** Two curved cone shapes extending from the head, pointing forward. Larger mandibles = higher attack. At attack >5, mandibles gain a reddish tint. |
| **Defence** | **Shell develops.** The body gains a dorsal shell — a darker, shinier half-sphere on top that grows to cover more of the body. At high defence (>5), the shell gets subtle ridges (displacement). |
| **Lives** | **Vitality glow.** High lives: warm inner glow (subsurface scattering emulation via emissive). Low lives: color desaturates, body slightly transparent, movement animation slows. |

```javascript
function updateCreatureMorphology(creature, bot) {
    // Speed → legs
    const legCount = Math.min(6, 2 + Math.floor(bot.speed));
    updateLegs(creature, legCount, bot.speed);
    
    // Attack → mandibles
    const mandibleSize = 0.3 + bot.attack * 0.15;
    creature.mandibles.forEach(m => m.scale.set(1, 1, mandibleSize));
    
    // Defence → shell coverage
    const shellCoverage = Math.min(1, bot.defence * 0.1);
    creature.shell.scale.set(1, shellCoverage, 1);
    creature.shell.material.opacity = 0.3 + shellCoverage * 0.7;
    
    // Lives → vitality
    const vitality = bot.lives / bot.maxLives;
    creature.body.material.emissiveIntensity = vitality * 0.15;
    creature.body.material.opacity = 0.7 + vitality * 0.3;
}
```

### Movement Animation

- **Walking:** Procedural leg animation — legs alternate (left-right gait cycle). Body bobs up-down and sways left-right. Antennae bounce.
- **Running:** Faster gait, more pronounced bob, antennae swept back.
- **Turning:** Body rotates smoothly; head turns slightly ahead of body (anticipation).
- **Eating:** Body leans down (pitch forward), mandibles animate (open-close cycle), small particles fly from food to mouth.
- **Idle:** Antenna twitch, slow look-around (head rotation), occasional scratch (leg lifts to body).

## Food Rendering — Flowers

Food dots become **wildflowers** growing from the terrain:

```javascript
function createFlower(food) {
    const group = new THREE.Group();
    
    // Stem: thin cylinder
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.08, 1.5, 4);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.75;
    group.add(stem);
    
    // Flower head: ring of petals around center
    const petalCount = 5 + Math.floor(Math.random() * 3);
    const petalGeo = new THREE.SphereGeometry(0.3, 6, 4);
    petalGeo.scale(1, 0.3, 1.5); // flatten and elongate
    
    const flowerColors = [0xff6688, 0xffaa44, 0xff44aa, 0xaa66ff, 0xffff44];
    const petalMat = new THREE.MeshStandardMaterial({
        color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
        roughness: 0.7,
    });
    
    for (let i = 0; i < petalCount; i++) {
        const petal = new THREE.Mesh(petalGeo, petalMat);
        const angle = (i / petalCount) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.3, 1.5, Math.sin(angle) * 0.3);
        petal.rotation.y = angle;
        petal.rotation.x = 0.3; // tilt outward
        group.add(petal);
    }
    
    // Center: small yellow sphere
    const centerGeo = new THREE.SphereGeometry(0.15, 6, 6);
    const centerMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.3 });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.y = 1.5;
    group.add(center);
    
    return group;
}
```

**Flower behavior:**
- Gentle sway in wind (sync with grass blades)
- When consumed: petals scatter (each petal flies off with random velocity, tumbling), stem wilts (bends and shrinks)
- When respawning: stem grows from ground, then petals unfold one by one (blooming animation over 60 frames)

**Death gardens:** Where a bot dies, 3-5 flowers grow (smaller, with the dead bot's color tint). Over time, the battlefield is decorated with memorial gardens at death sites.

## Day/Night Cycle

A 10-minute full cycle (configurable):

```javascript
const DAY_LENGTH = 36000; // frames (10 minutes at 60fps)

function updateDayNight(frameCount) {
    const phase = (frameCount % DAY_LENGTH) / DAY_LENGTH; // 0.0 → 1.0
    
    // Sun position (circular path)
    const sunAngle = phase * Math.PI * 2 - Math.PI / 2; // starts at dawn
    sunLight.position.set(
        Math.cos(sunAngle) * 200,
        Math.sin(sunAngle) * 200,
        50
    );
    
    // Sky color interpolation
    if (phase < 0.25) {
        // Dawn: warm orange → blue
        skyColor = lerpColor(DAWN_COLOR, DAY_COLOR, phase / 0.25);
    } else if (phase < 0.5) {
        // Day: bright blue
        skyColor = DAY_COLOR;
    } else if (phase < 0.75) {
        // Dusk: blue → purple → orange
        skyColor = lerpColor(DAY_COLOR, DUSK_COLOR, (phase - 0.5) / 0.25);
    } else {
        // Night: dark
        skyColor = lerpColor(DUSK_COLOR, NIGHT_COLOR, (phase - 0.75) / 0.25);
    }
    
    // Sun intensity
    sunLight.intensity = Math.max(0, Math.sin(sunAngle)) * 1.5;
    
    // Moon (opposite of sun)
    moonLight.intensity = Math.max(0, -Math.sin(sunAngle)) * 0.4;
    
    // Ambient adjusts
    ambientLight.intensity = 0.2 + Math.max(0, Math.sin(sunAngle)) * 0.3;
}
```

| Phase | Visual |
|-------|--------|
| **Dawn** (0-15%) | Orange-pink sky, long shadows pointing west, warm light on dewey grass |
| **Day** (15-50%) | Blue sky, bright sun, short shadows, full color saturation |
| **Dusk** (50-75%) | Purple-orange sky, long shadows pointing east, fireflies appear, golden hour lighting |
| **Night** (75-100%) | Dark blue sky, stars visible, moonlight (cool blue), fireflies active, creature eyes faintly glow |

### Fireflies (Night Particles)

```javascript
function createFireflies(count) {
    // Only active during dusk/night
    const positions = []; // random positions in the scene volume
    const mat = new THREE.PointsMaterial({
        color: 0xffee66,
        size: 0.4,
        transparent: true,
        blending: THREE.AdditiveBlending,
    });
    // ... standard particle system
}

// In update loop:
fireflies.forEach(ff => {
    // Random walk movement
    ff.x += (Math.random() - 0.5) * 0.1;
    ff.y += (Math.random() - 0.5) * 0.05;
    ff.z += (Math.random() - 0.5) * 0.1;
    
    // Blink: sine wave opacity
    ff.opacity = Math.max(0, Math.sin(frameCount * 0.05 + ff.phase));
});
```

## Camera System — Documentary Director

### Camera Behavior

The camera behaves like a nature documentary crew — slow, deliberate, always finding the most interesting subject:

```javascript
const SHOT_TYPES = {
    establishing: {
        // Wide shot of the entire garden
        distance: 80,
        height: 50,
        fov: 55,
        minDuration: 300, // 5 seconds
        priority: (state) => state.noEventTimer > 600 ? 40 : 10
    },
    follow: {
        // Medium shot following a specific creature
        distance: 15,
        height: 8,
        fov: 40,
        minDuration: 180, // 3 seconds
        priority: (state) => state.playerBot ? 30 : 20
    },
    closeup: {
        // Tight shot on a creature's face
        distance: 5,
        height: 3,
        fov: 30,
        minDuration: 120, // 2 seconds
        priority: (state) => state.interestingBehavior ? 50 : 5
    },
    encounter: {
        // Two-shot framing two creatures about to interact
        distance: 12,
        height: 5,
        fov: 35,
        minDuration: 180,
        priority: (state) => state.combatImminent ? 80 : 0
    },
    panoramic: {
        // Slow pan across the garden
        distance: 40,
        height: 20,
        fov: 50,
        minDuration: 360, // 6 seconds
        priority: (state) => 15 // filler shot
    }
};
```

### Depth of Field

The most important cinematic effect — **background blur** when focused on a subject:

```javascript
// Using Three.js BokehPass
const bokehPass = new THREE.BokehPass(scene, camera, {
    focus: 15,         // distance to focus subject
    aperture: 0.002,   // blur amount (small = more blur)
    maxblur: 0.01,
});
composer.addPass(bokehPass);

// Update focus distance to match selected subject
function updateDOF(subjectPosition) {
    const dist = camera.position.distanceTo(subjectPosition);
    bokehPass.uniforms.focus.value = dist;
}
```

- Close-up shots: shallow DOF, subject sharp, background beautifully blurred
- Establishing shots: deep DOF, everything in focus
- The DOF smoothly transitions as the camera changes position

### "Interesting Behavior" Detection

The camera director watches for compelling moments:

| Trigger | Camera Response |
|---------|----------------|
| Two creatures approaching each other | Switch to encounter two-shot |
| Creature eating (consuming food) | Close-up on the creature's face |
| Combat begins | Pull back slightly to frame both combatants |
| Kill | Hold on winner for 2 seconds (close-up), then slow pan to overview |
| Player creature does anything | Bias toward following/close-up |
| Creature morphology changes (new legs, bigger mandibles) | Brief close-up on the changed body part |
| Nothing happening for 10 seconds | Establishing shot or panoramic pan |

### Manual Camera Override

| Input | Action |
|-------|--------|
| **Click-drag** | Free orbit (director pauses) |
| **Scroll** | Zoom |
| **Click creature** | Focus camera on this creature |
| **TAB** | Cycle creature focus |
| **D** | Toggle documentary director on/off |
| **ESC** | Return to auto-director |

## Combat Visualization

### Approach
- Both creatures face each other
- Mandibles open (if present)
- Eyes narrow to hunting expression
- Movement slows (both bots enter a cautious approach animation)
- Camera: switches to encounter two-shot

### Engagement
- **Physical scuffle:** Creatures bump into each other — body contact with squash-and-stretch deformation
- **Mandible clash:** If both have mandibles, they interlock briefly (meshes interpenetrate)
- **Dust kick:** Small dirt particles at their feet
- **Impact sound visualization:** A small ring of grass blades bends outward from the impact point
- **Damage:** Losing creature flinches (recoil animation — body jerks back, eyes squeeze shut)

### Kill
- **Winner:** Puffs up (scale 1.2×), eyes go wide with excitement, brief happy wiggle
- **Loser:** Stops moving, body curls inward (legs fold under), color fades to gray
- **Dissolution:** The body slowly dissolves into small particles that float down into the soil
- **Memorial garden:** Over the next 60 frames, 3-5 small flowers grow at the death site in the dead creature's color
- **Nutrient absorption:** Small colored particles float from the death site to the winner (stat gain visualization)

### Player Creature Kill
- Golden pollen burst from the kill site
- Camera: dramatic close-up on player creature's face (satisfied expression — slight squint, mandibles click)
- Longer hold before camera moves on

### Player Death
- Camera: slow zoom on the curling creature
- Background audio cue substitute: all wind animation stops for 2 seconds (eerie stillness)
- Gradual desaturation of the entire scene (returns to normal as the new creature spawns)
- New creature spawns with a small burst of pollen/petals at the spawn point

## HUD / Overlay

Extremely minimal — the nature experience shouldn't be interrupted:

### Bottom Bar (Auto-Hide)

```
★ Player Creature │ SPD 3.2 ATK 2.1 DEF 4.0 LIV 5 │ K:3 │ ⏱ 2:34 │ ☀ Day
```

- Appears on hover or stat change
- Fades after 3 seconds
- Soft white text with subtle drop shadow
- No background (text directly over the scene)

### Creature Info (On Click)

A small nature-documentary-style info card:

```
┌──────────────────┐
│  Creature #7     │
│  "The Predator"  │  ← auto-generated title based on dominant stat
│                  │
│  🦵 6 legs       │  ← speed indicator
│  ⚔ Large mandibles│  ← attack indicator  
│  🛡 Armored shell │  ← defence indicator
│  ♥ 5 lives       │
│                  │
│  Strategy:       │
│  Hunter          │
└──────────────────┘
```

Titles are auto-generated: "The Predator" (high attack), "The Sprinter" (high speed), "The Tank" (high defence), "The Survivor" (high lives), "The Balanced" (even stats).

## Performance Budget

| Element | Draw Calls | Triangles | Notes |
|---------|-----------|-----------|-------|
| Terrain | 1 | ~33,000 | 128×128 heightmap |
| Water | 1 | ~2,000 | Reflective plane (adds reflection render pass) |
| Grass blades | 1 | ~30,000 | InstancedMesh, 5000 instances × 6 tris |
| Flowers (50) | 1 | ~5,000 | InstancedMesh |
| Trees (15) | 1 | ~3,000 | InstancedMesh |
| Bushes (20) | 1 | ~2,000 | InstancedMesh |
| Rocks (20) | 1 | ~1,000 | InstancedMesh |
| Creatures (20) | 20 | ~12,000 | Body + head + eyes + legs + mandibles + shell |
| Shadows | — | — | 1 directional shadow map (1024×1024) |
| Sky | 1 | ~2,000 | Dome with gradient |
| Particles | 1 | ~300 | Fireflies/dust |
| Post-processing | 2 | — | Render + DOF |
| **Total** | ~30 | ~90,000 | Moderate — grass and DOF are most expensive |

**Key optimizations:**
- **Grass:** InstancedMesh with shader-based animation (no CPU per-blade updates). Frustum cull aggressively. Reduce count on lower-end hardware.
- **DOF:** Half-resolution bokeh pass (render DOF at 50%, upscale). Only enable during close-up shots.
- **Water reflections:** Render reflection every 3rd frame. Limit reflection camera to nearby objects only.
- **LOD:** At wide zoom, disable grass blades entirely and use a textured ground plane. Creatures switch to simple spheres.
- **Shadows:** Single directional light shadow. No point light shadows. Shadow map updates every frame (sun moves).

## What Makes This Unique

The Garden is the **life** concept. It transforms abstract bot behavior into a living ecosystem you can watch and care about. The creature morphology — legs multiplying with speed, mandibles growing with attack, shells developing with defence — makes stat growth visible and tangible. You don't need numbers to see that your creature is getting stronger; you can see it growing mandibles.

The day/night cycle, wind-blown grass, water reflections, and fireflies create a world that feels alive independent of the bots. The documentary camera finds beauty in ordinary moments — a creature eating, two creatures circling each other, a flower blooming at a death site.

This is the most emotionally engaging concept. Players will name their creatures. They'll feel genuine satisfaction watching mandibles grow and genuine loss when their creature dies and dissolves into flowers.
