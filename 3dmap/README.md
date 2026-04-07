# 3D Map Design Concepts

> Six 3D reimaginings of "Bots in a Field" — all spectator-focused, no POV.

All concepts use Three.js/WebGL for rendering. All share the same game logic, strategy system, and bot AI from v11. The visual presentation and camera model change completely.

## Concepts at a Glance

| # | Name | One-liner | Camera Model | Vibe |
|---|------|-----------|-------------|------|
| 01 | [The Terrarium](01-the-terrarium.md) | Glass box on a desk — watch bots like an ant farm | Fixed diorama, limited orbit | Cozy, miniature, contained |
| 02 | [Orbital](02-orbital.md) | Field wraps onto a small planet you orbit freely | Free orbital | Cosmic, expansive, god-game |
| 03 | [The Colosseum](03-the-colosseum.md) | Gladiatorial arena with AI-directed broadcast cameras | Multi-angle auto-director | Cinematic, spectacle, esports |
| 04 | [Neon Grid](04-neon-grid.md) | Tron-style glowing grid with geometric light constructs | Elevated tracking + free orbit | Synthwave, stylish, vibrant |
| 05 | [The Garden](05-the-garden.md) | Lush nature scene — bots are creatures with morphing bodies | Documentary auto-camera | Organic, emotional, alive |
| 06 | [War Table](06-war-table.md) | Holographic projection above a command table | Fixed seated angle | Military, strategic, precise |

## Comparison Matrix

### Visual & Emotional

| Concept | Visual Density | Emotional Register | Spectator Alignment |
|---------|---------------|-------------------|---------------------|
| Terrarium | Medium — terrain + glass + creatures | Warm, cozy, pet-keeping | High — you're watching a habitat |
| Orbital | Medium — planet + atmosphere | Grand, serene, cosmic | High — god-view of entire world |
| Colosseum | High — arena + crowd + effects | Dramatic, exciting, eventful | Highest — built for spectating |
| Neon Grid | Medium — grid + trails + bloom | Cool, stylish, hypnotic | Medium — visual absorption |
| Garden | High — terrain + vegetation + creatures | Warm, emotional, nature-doc | High — documentary framing |
| War Table | Low-Medium — clean geometric figures | Focused, authoritative, precise | High — commander reviewing forces |

### Bot Representation

| Concept | Bot Shape | Stats Shown As | Death Effect |
|---------|-----------|---------------|--------------|
| Terrarium | Pill creatures, googly eyes | Body features (legs, horn, shell, opacity) | Dissolve into terrain particles |
| Orbital | Hemispheres with nose/antenna | Trail, glow, sheen, opacity | Crater scar on planet surface |
| Colosseum | Cylinder gladiators with heads | Width, spikes, shield, height | Collapse into sand dust |
| Neon Grid | Faceted icosahedra | Spin speed, glow, wireframe shell, face opacity | Shatter into geometric fragments |
| Garden | Insect creatures with legs/mandibles/shell | Full body morphology changes | Curl up, dissolve, flowers grow |
| War Table | Holographic chess pieces (shape = strategy) | HEIGHT = total stats | Derez (horizontal slice dissolution) |

### Camera & Information

| Concept | Full Field Visible? | Camera Freedom | Info Without HUD |
|---------|-------------------|----------------|-----------------|
| Terrarium | Yes (at default zoom) | Limited orbit (±30°), zoom | Stats visible as body features |
| Orbital | ~40% at once, rotate for rest | Full free orbit | Colored dots, glow = attack |
| Colosseum | Yes (aerial cam) or partial (other cams) | 5 preset + free orbit | Shadow size = strength, crowd = excitement |
| Neon Grid | Partial (follow cam) or full (overhead) | 4 modes, free orbit | Light trails = history, glow = attack |
| Garden | Partial (documentary framing) | Auto-director + free override | Full body morphology tells the story |
| War Table | Yes (always) | Limited orbit (seated) | Height = stats, shape = strategy |

### Technical

| Concept | Polygon Budget | Shader Complexity | Key Dependency | Unique Tech Challenge |
|---------|---------------|-------------------|----------------|----------------------|
| Terrarium | ~24K | Low (standard materials) | MeshPhysicalMaterial for glass | Glass transparency + reflections |
| Orbital | ~52K | Medium (atmosphere Fresnel, terrain noise) | Custom atmosphere shader | Equirectangular → sphere mapping |
| Colosseum | ~37K | Low-Medium | Standard materials | AI director logic, crowd particles |
| Neon Grid | ~20K | High (grid shader, bloom post-processing) | UnrealBloomPass | Point light count management |
| Garden | ~90K | Medium-High (grass wind, water, DOF) | BokehPass, Water module | Grass instance count, DOF perf |
| War Table | ~11K | Medium (hologram scan lines, flicker) | Custom hologram shader | Transparency sorting, draw call count |

## Design Axes

```
    REALISM
    ▲
    │  Garden ●
    │
    │           ● Terrarium
    │                          ● Colosseum
    │
    │                 ● Orbital
    │
    │                                    ● War Table
    │
    │                          ● Neon Grid
    └──────────────────────────────────────► ABSTRACTION


    CONTAINED                          EXPANSIVE
    ◄──────────────────────────────────────────►
    War Table   Terrarium   Colosseum   Neon Grid   Garden   Orbital
```

## Decision Criteria

1. **Spectator experience:** All six are designed for watching, not controlling. But they differ in how much agency the camera gives:
   - Maximum control: Orbital, Neon Grid (free orbit)
   - Guided experience: Colosseum, Garden (AI director)
   - Constrained viewing: Terrarium, War Table (fixed angle)

2. **Strategy system visibility:** The game has deep strategy configuration. Which concepts let you see its effects?
   - Best: War Table (shape = strategy type), Garden (body morphology reflects decisions)
   - Good: Colosseum (scoreboard, action cam shows targeting), Terrarium (body features)
   - Abstract: Neon Grid (trails show movement patterns), Orbital (mostly color/glow)

3. **Emotional connection:** Players watch autonomous bots for extended periods. Which concepts make that engaging?
   - Strongest: Garden (creatures feel alive), Terrarium (pet-keeping attachment)
   - Action-driven: Colosseum (constant spectacle)
   - Aesthetic: Neon Grid (visual beauty), War Table (strategic satisfaction)
   - Cerebral: Orbital (cosmic perspective)

4. **Technical risk:**
   - Safest: Terrarium, Colosseum (standard Three.js, no custom shaders required)
   - Moderate: War Table, Orbital (simple custom shaders)
   - Higher: Neon Grid (bloom tuning, point light limits), Garden (grass performance, DOF tuning, water reflections)

5. **Distinctiveness from v11:** How different does the game feel?
   - Most different: Orbital (spherical world), Garden (creatures, not bots), Neon Grid (pure style shift)
   - Moderate: Colosseum (arena framing), War Table (holographic treatment)
   - Least different: Terrarium (still top-down-ish, just in 3D)

## Hybrid Possibilities

| Hybrid | Description |
|--------|-------------|
| **Colosseum + War Table** | Arena setting with holographic scoreboard/analysis overlays during replays |
| **Garden + Terrarium** | Nature creatures inside a glass vivarium — combines organic life with contained watching |
| **Neon Grid + War Table** | Holographic Tron grid as the projection surface, geometric bots with light trails |
| **Orbital + Garden** | Planet surface covered in vegetation, creature-style bots crawling on a living world |
| **Colosseum + Neon Grid** | Neon arena with geometric gladiators, synthwave crowd, light trail combat |

## Next Steps

1. Review each design document in detail
2. Evaluate against the spectator experience goals
3. Prune to 2–3 finalists
4. Optionally hybridize elements
5. Build a Three.js prototype of the selected design(s)
