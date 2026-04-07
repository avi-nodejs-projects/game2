# 03 — The Colosseum

> Sports-broadcast camera system in a gladiatorial arena — designed for spectating

## Visual Identity

**Mood:** Esports spectacle, gladiatorial drama, cinematic broadcast
**Reference:** Fighting game arenas, football stadiums, Roman Colosseum, sports TV coverage

**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Arena sand | `#c4a870` → `#a89060` | Textured sand floor |
| Arena wall | `#8a7a6a` → `#5a4a3a` | Weathered stone tiers |
| Crowd | `#666` → `#888` various | Low-detail silhouettes |
| Crowd excitement | Per-team colors | Colored banners, glowing sections |
| Torch fire | `#ff8800` emissive | Point lights at columns |
| Pillar stone | `#7a6a5a` | Support columns |
| Sky dome | `#1a2a4a` → `#0a1020` | Dusk/night sky |
| Bot bodies | Per-bot HSL, saturated | Need to pop against sand |
| Food | `#ffcc00` | Glowing orbs on the sand |
| Scoreboard | `rgba(0, 15, 30, 0.85)` | Dark glass panel |
| Scoreboard text | `#ffffff` + accent colors | Clean, readable |
| Kill flash | `#ffffff` | Brief flare on kill |
| Blood dust | `#cc8855` | Sand particles on combat |

## Arena Structure

### Layout

```
            ╭─── upper tier (crowd) ───╮
          ╱    ╭── lower tier ──╮        ╲
        ╱     ╱                  ╲        ╲
       │     │    SAND ARENA     │        │
       │     │   ● ● · · ● ●    │        │
       │     │   · ● · ● · ●    │        │
       │     │   ● · ● · ● ·    │        │
        ╲     ╲                  ╱        ╱
          ╲    ╰── columns ────╯        ╱
            ╰─── torch pillars ───╯

    [CAM 1: Aerial]  [CAM 2: Sideline]  [CAM 3: Action]
```

### Three.js Scene Graph

```
Scene
├── ArenaGroup
│   ├── SandFloor (circular plane, sand texture)
│   ├── WallRing (cylindrical inner wall, stone texture)
│   ├── LowerTier (tiered geometry, crowd instances)
│   ├── UpperTier (higher tiered geometry, crowd instances)
│   ├── Columns (instanced cylinders around wall top)
│   └── TorchPillars (geometry + PointLights)
├── GameEntities
│   ├── BotGroup (individual 3D bots)
│   └── FoodGroup (instanced glowing orbs)
├── SkyDome (large inverted sphere, gradient material)
├── Lighting
│   ├── Torches (8-12 PointLights, warm, flickering)
│   ├── AmbientLight (cool fill)
│   └── DirectionalLight (moonlight, subtle shadows)
├── CameraRig (multiple camera positions)
└── HUD (screen-space overlay)
```

### Arena Floor

A circular arena (radius = field equivalent, scaled to scene units):

```javascript
const ARENA_RADIUS = 120; // scene units

// Sand floor
const floorGeo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
const floorMat = new THREE.MeshStandardMaterial({
    color: 0xc4a870,
    roughness: 0.95,
    metalness: 0,
    // Sand normal map for texture detail
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
```

**Sand details:**
- Normal map or displacement for grainy texture
- **Footprint trails:** Bots leave subtle darkened tracks on the sand (render to a canvas texture that accumulates dark marks along bot paths, fade at 0.995/frame)
- **Combat scuff marks:** Larger dark patches where fights occurred
- **Rake pattern:** Faint radial lines from center outward (like a zen garden or groomed arena sand)

### Arena Walls and Seating

Concentric tiers rising from the arena floor:

```javascript
function createTieredSeating(innerRadius, tiers, tierHeight, tierDepth) {
    const group = new THREE.Group();
    
    for (let i = 0; i < tiers; i++) {
        const radius = innerRadius + i * tierDepth;
        const y = i * tierHeight;
        
        // Each tier is a ring (annular cylinder section)
        const geo = new THREE.CylinderGeometry(
            radius + tierDepth,  // top radius
            radius + tierDepth,  // bottom radius
            tierHeight,
            48,                  // segments
            1,
            true                 // open ended
        );
        const mat = new THREE.MeshStandardMaterial({
            color: 0x8a7a6a,
            roughness: 0.9,
        });
        const tier = new THREE.Mesh(geo, mat);
        tier.position.y = y;
        group.add(tier);
        
        // Flat top surface for this tier (where crowd sits)
        const topGeo = new THREE.RingGeometry(radius, radius + tierDepth, 48);
        const topMat = new THREE.MeshStandardMaterial({ color: 0x7a6a5a });
        const top = new THREE.Mesh(topGeo, topMat);
        top.rotation.x = -Math.PI / 2;
        top.position.y = y + tierHeight / 2;
        group.add(top);
    }
    
    return group;
}

const seating = createTieredSeating(ARENA_RADIUS + 5, 6, 3, 4);
```

### Crowd

The crowd is NOT individually modeled — it's a **particle system** or instanced simple shapes:

```javascript
function createCrowd(seatingGroup, density) {
    const positions = [];
    const colors = [];
    
    // Scatter points across seating surfaces
    for (let tier = 0; tier < 6; tier++) {
        const radius = ARENA_RADIUS + 5 + tier * 4;
        const count = Math.floor(density * radius);
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.1;
            const r = radius + Math.random() * 3;
            positions.push(
                Math.cos(angle) * r,
                tier * 3 + 1.5 + Math.random() * 1.5, // slight height variation
                Math.sin(angle) * r
            );
            // Random crowd colors (muted clothing)
            colors.push(0.3 + Math.random() * 0.4, 0.3 + Math.random() * 0.3, 0.3 + Math.random() * 0.3);
        }
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const mat = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        sizeAttenuation: true,
    });
    
    return new THREE.Points(geo, mat);
}
```

### Crowd Reactions

The crowd responds to game events by changing their particle positions (standing up) and colors:

| Event | Crowd Reaction |
|-------|----------------|
| **Combat starts** | Nearby section leans forward (Y offset +0.5) |
| **Kill** | All crowd points briefly jump up (Y += 2 for 15 frames), section near combat changes to winner's color |
| **Player bot kill** | Larger jump, gold color flash across all sections |
| **Near-death escape** | Mexican wave — a color ripple travels around the arena (sequential Y offset wave) |
| **Idle (no combat for 10s)** | Crowd settles, slight random fidgeting (position noise) |
| **Multi-kill streak** | Crowd particles glow brighter, persistent excited state |

```javascript
function crowdReact(event, position) {
    const crowdPositions = crowd.geometry.attributes.position;
    
    switch (event) {
        case 'kill':
            // All points jump
            for (let i = 0; i < crowdPositions.count; i++) {
                crowdJumpOffset[i] = 2.0; // will decay per frame
            }
            break;
            
        case 'combat':
            // Nearby section leans in
            for (let i = 0; i < crowdPositions.count; i++) {
                const px = crowdPositions.getX(i);
                const pz = crowdPositions.getZ(i);
                const dist = Math.sqrt((px - position.x) ** 2 + (pz - position.z) ** 2);
                if (dist < 30) {
                    crowdJumpOffset[i] = 0.5;
                }
            }
            break;
    }
    
    crowdPositions.needsUpdate = true;
}

// In animation loop: decay jump offsets
for (let i = 0; i < crowdJumpOffset.length; i++) {
    crowdJumpOffset[i] *= 0.92; // smooth settle
    // Apply to Y position...
}
```

### Torches and Columns

8-12 stone columns around the arena wall, each topped with a fire torch:

```javascript
function createTorch(angle) {
    const x = Math.cos(angle) * (ARENA_RADIUS + 6);
    const z = Math.sin(angle) * (ARENA_RADIUS + 6);
    
    // Stone column
    const columnGeo = new THREE.CylinderGeometry(0.8, 1.0, 20, 8);
    const columnMat = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.9 });
    const column = new THREE.Mesh(columnGeo, columnMat);
    column.position.set(x, 10, z);
    
    // Fire light (flickering point light)
    const light = new THREE.PointLight(0xff8800, 1.5, 50);
    light.position.set(x, 21, z);
    light.castShadow = true;
    light.shadow.mapSize.set(256, 256); // small shadow maps per torch
    
    return { column, light };
}

// Flicker animation in render loop
torchLights.forEach(light => {
    light.intensity = 1.2 + Math.random() * 0.6; // random flicker
});
```

The flickering torchlight creates dynamic, shifting shadows on the arena floor — this is the primary source of visual drama.

## Bot Rendering

### Gladiator Forms

Bots are stylized 3D fighters — slightly more angular than the Terrarium's friendly pills:

```javascript
function createGladiatorBot(bot) {
    const group = new THREE.Group();
    
    // Body: slightly tapered cylinder (broader at top = shoulders)
    const bodyGeo = new THREE.CylinderGeometry(
        2.0 + bot.attack * 0.1,  // top radius (wider for high attack)
        1.5,                      // bottom radius
        4 + bot.totalStats * 0.05, // height grows with stats
        8
    );
    const bodyMat = new THREE.MeshStandardMaterial({
        color: bot.color,
        roughness: 0.5,
        metalness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);
    
    // Head: sphere on top
    const headGeo = new THREE.SphereGeometry(1.2, 12, 8);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 3.5;
    group.add(head);
    
    // Eyes: two small emissive dots
    const eyeGeo = new THREE.SphereGeometry(0.25, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
    });
    [-0.4, 0.4].forEach(xOff => {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(xOff, 3.7, 1.0);
        group.add(eye);
    });
    
    return group;
}
```

### Stat Visualization

| Stat | Visual |
|------|--------|
| **Speed** | Afterimage trail — 2-3 ghost copies behind the bot at decreasing opacity when moving fast |
| **Attack** | Shoulder width increases. At high attack (>5), small spikes appear on shoulders. Body emissive glow intensifies red. |
| **Defence** | Shell/shield panel on front — a flat disc mesh in front of the body, metallic sheen. Gets larger/shinier with stat. |
| **Lives** | Height. Low lives = shorter (crouch). Full lives = tall (standing). Dying bot visibly shrinks. |
| **Total stats** | Shadow size on arena floor. Stronger bots cast bigger shadows — visible from aerial cam. |

### Movement

- Walking: body bobs up-down with step cycle (sine, 0.3 unit amplitude)
- Running: faster bob, slight forward lean (pitch)
- Turning: smooth rotation, body faces heading
- Idle: slow left-right sway, head turns to look around

## Food Rendering

Glowing energy orbs floating just above the sand:

```javascript
const foodGeo = new THREE.SphereGeometry(1.0, 12, 12);
const foodMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8,
    roughness: 0.2,
});
```

- Float 1 unit above sand surface
- Gentle hover animation (sine wave Y offset)
- Soft point light per food (intensity 0.3, range 10) — casts small pool of warm light on sand
- Consumption: orb shrinks to point, a ring of sand particles bursts upward, golden trail arcs from food position to bot

## Camera System — AI Director

The signature feature: an **AI-directed broadcast camera** that automatically selects the best angle for what's happening.

### Camera Types

```javascript
const CAMERAS = {
    aerial: {
        name: 'Aerial',
        position: () => new THREE.Vector3(0, ARENA_RADIUS * 1.8, 0),
        lookAt: () => new THREE.Vector3(0, 0, 0),
        fov: 50,
        description: 'Classic overhead — full arena view'
    },
    sideline: {
        name: 'Sideline',
        position: (focus) => {
            const angle = Math.atan2(focus.z, focus.x) + Math.PI; // opposite side
            const r = ARENA_RADIUS + 8;
            return new THREE.Vector3(Math.cos(angle) * r, 6, Math.sin(angle) * r);
        },
        lookAt: (focus) => focus.clone(),
        fov: 40,
        description: 'Low wall camera — dramatic perspective'
    },
    action: {
        name: 'Action Cam',
        position: (focus) => {
            const offset = new THREE.Vector3(15, 8, 15);
            return focus.clone().add(offset);
        },
        lookAt: (focus) => focus.clone(),
        fov: 35,
        description: 'Close follow — tight on action'
    },
    dramatic: {
        name: 'Dramatic',
        position: (focus, time) => {
            const angle = time * 0.02; // slow orbit
            return new THREE.Vector3(
                focus.x + Math.cos(angle) * 20,
                12,
                focus.z + Math.sin(angle) * 20
            );
        },
        lookAt: (focus) => focus.clone().add(new THREE.Vector3(0, 3, 0)),
        fov: 30,
        description: 'Slow orbit — replay feel'
    },
    sweeping: {
        name: 'Crane',
        position: (focus, time) => {
            const progress = (time % 300) / 300; // 5-second sweep
            const angle = progress * Math.PI;
            return new THREE.Vector3(
                Math.cos(angle) * ARENA_RADIUS * 0.8,
                ARENA_RADIUS * 0.3 + Math.sin(progress * Math.PI) * ARENA_RADIUS * 0.5,
                Math.sin(angle) * ARENA_RADIUS * 0.8
            );
        },
        lookAt: () => new THREE.Vector3(0, 0, 0),
        fov: 45,
        description: 'Wide crane — establishing shot'
    }
};
```

### Director Logic

The director evaluates the current game state every 60 frames (1 second) and scores each potential camera:

```javascript
function evaluateShot(cameraType, gameState) {
    let score = 0;
    
    // Active combat is highest priority
    const combats = gameState.activeCombats;
    if (combats.length > 0) {
        if (cameraType === 'action') score += 100;
        if (cameraType === 'sideline') score += 80;
        if (cameraType === 'dramatic') score += 60;
    }
    
    // Player bot in danger
    if (gameState.playerInDanger) {
        if (cameraType === 'action') score += 90;
    }
    
    // Recent kill (last 3 seconds)
    if (gameState.recentKill) {
        if (cameraType === 'dramatic') score += 110; // post-kill orbit
    }
    
    // No action — establishing shot
    if (!combats.length && !gameState.recentKill) {
        if (cameraType === 'aerial') score += 50;
        if (cameraType === 'sweeping') score += 70;
    }
    
    // Variety bonus: prefer camera types not used recently
    const timeSinceUsed = frameCount - lastUsed[cameraType];
    score += Math.min(timeSinceUsed * 0.1, 20);
    
    // Minimum shot duration: don't switch too fast
    const timeSinceSwitch = frameCount - lastSwitchFrame;
    if (timeSinceSwitch < 120) score -= 200; // penalize switching within 2 seconds
    
    return score;
}
```

### Camera Transitions

When switching cameras, use a smooth **lerp transition** over 30 frames (0.5 seconds):

```javascript
function transitionCamera(fromPos, toPos, fromLookAt, toLookAt, progress) {
    // Ease-in-out curve
    const t = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    camera.position.lerpVectors(fromPos, toPos, t);
    
    const lookTarget = new THREE.Vector3().lerpVectors(fromLookAt, toLookAt, t);
    camera.lookAt(lookTarget);
    
    // Interpolate FOV
    camera.fov = fromFOV + (toFOV - fromFOV) * t;
    camera.updateProjectionMatrix();
}
```

### Manual Camera Override

The player can override the director at any time:

| Input | Action |
|-------|--------|
| **1** | Lock to Aerial cam |
| **2** | Lock to Sideline cam |
| **3** | Lock to Action cam (follows selected bot) |
| **4** | Lock to Dramatic cam |
| **5** | Lock to Crane sweep |
| **0** | Return to AI Director mode |
| **Click-drag** | Free camera (orbit controls, director pauses) |
| **ESC** | Reset to director |

## Combat Visualization

### Approach (bots converging)
- Director switches to sideline or action cam
- Crowd nearby section leans in
- Torches nearest to combat flicker faster
- Subtle camera zoom-in (FOV narrows by 5°)

### Engagement
- **Dust cloud:** Sand particle system at combat point (20-30 tan particles, rising and spreading)
- **Impact flash:** Small white flash (emissive plane facing camera, 3 frames)
- **Screen shake:** Camera position offset ±0.5 units for 8 frames
- **Shadow dance:** The torchlight flicker intensifies during combat, making shadows jump dramatically
- **Damage numbers:** 3D text sprites floating up from each bot (red "-2.3", green "BLOCKED") — billboard text that faces camera

### Kill
- **Freeze moment:** Director pauses game for 4 frames (the "beat")
- **Camera:** Switches to dramatic slow-orbit around the kill site
- **Winner:** Stands tall (Y scale 1.3×), arms-up pose (if animated) or emissive burst
- **Crowd:** Full arena jump, wave of the winner's color sweeps the crowd
- **Loser:** Collapses (Y scale shrinks), body dissolves into sand-colored particles that settle on the ground
- **Sand mark:** A dark circular scorch on the arena floor where the bot died
- **Scoreboard update:** Kill counter animates with a flash

### Player Kill
- All of the above PLUS:
- **Golden confetti:** Particle system raining gold from above for 2 seconds
- **Crowd chant:** Crowd particles rapidly oscillate Y (simulating rhythmic standing/sitting)
- **Banner flash:** The scoreboard highlights with a gold border for 3 seconds

### Player Death
- Crowd goes quiet (all particles settle to minimum Y, colors darken)
- Camera: slow zoom-in on the death site
- 2-second hold
- Camera: cut to respawn location
- Crowd gradually re-energizes

## Scoreboard

A screen-space HUD panel styled as a stadium scoreboard:

```
╔══════════════════════════════════════════════════╗
║  BOTS IN A FIELD                    ROUND: 1    ║
╠══════════════════════════════════════════════════╣
║  ★ Player Bot  │ SPD 3.2 │ ATK 2.1 │ K:3 D:1   ║
║  Population: 15/20 │ Strongest: Bot#3 (42 pts)  ║
╠──────────────────────────────────────────────────╣
║  KILL FEED                                       ║
║  ⚔ Bot#5 → Bot#12        0:34 ago              ║
║  ⚔ ★Player → Bot#7       1:12 ago              ║
║  ⚔ Bot#3 → Bot#9         2:45 ago              ║
╚══════════════════════════════════════════════════╝
```

- Fixed in top-right corner
- Dark translucent background
- Kill feed: last 5 kills with timestamps
- Collapsible (toggle with `S`)
- Player entries highlighted in gold

### Camera Label

Small text in bottom-left showing current camera:
```
[AUTO] Sideline — tracking combat
```
or
```
[MANUAL] Free Camera
```

## Interaction & Controls

| Input | Action |
|-------|--------|
| **1-5** | Lock specific camera |
| **0** | Return to AI Director |
| **Click-drag** | Free camera orbit |
| **Scroll** | Zoom in/out |
| **Click bot** | Select (scoreboard shows details) |
| **TAB** | Cycle selected bot |
| **S** | Toggle scoreboard |
| **SPACE** | Pause (director holds current shot) |
| **ESC** | Reset to director default |

## Performance Budget

| Element | Draw Calls | Triangles | Notes |
|---------|-----------|-----------|-------|
| Arena floor | 1 | ~4,000 | Circle geometry |
| Walls + tiers | 7 | ~15,000 | Cylinder sections |
| Columns (12) | 1 | ~1,000 | InstancedMesh |
| Crowd | 1 | ~3,000 | Points (not mesh) |
| Bots (20) | 20 | ~8,000 | Cylinder + sphere + details |
| Food (50) | 1 | ~3,000 | InstancedMesh |
| Torches | 12 | ~500 | Simple geometry |
| Shadows | — | — | 12 × 256² shadow maps (torches) + 1 × 1024² (moon) |
| Sky dome | 1 | ~2,000 | Inverted sphere |
| Particles (dust) | 1 | ~500 | On-demand |
| **Total** | ~46 | ~37,000 | Comfortable for 60fps |

**Key optimizations:**
- Crowd as Points, not meshes — single draw call for hundreds of "spectators"
- Torch shadow maps are small (256×256) — flickering shadows don't need high resolution
- InstancedMesh for columns, food, repeated elements
- Director camera transitions use no extra rendering — just moving the existing camera
- Dust particles pooled and recycled

## What Makes This Unique

The Colosseum is the **spectacle** concept. It's the only design built from the ground up for the spectator experience. The AI director ensures you always see the best angle for what's happening — no manual camera fiddling, no missing the action. The crowd reactions make events feel significant — a kill isn't just a score counter, it's a stadium eruption.

The multi-camera system also adds rewatch value: the same simulation looks different depending on which camera catches the action. The dramatic slow-orbit after a kill, the low sideline angle during a chase, the sweeping crane establishing shot — these create genuine cinematic moments from autonomous bot behavior.

This concept directly embraces what the game IS: a spectator simulation. Instead of pretending the player is a participant (pilot, navigator, commander), it makes them the best kind of spectator — one with a world-class broadcast team.
