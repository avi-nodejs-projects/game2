# v11.1 — "The Petri Dish" Design Document

## Vision
Reimagine the game board as a microscope slide and bots as bioluminescent microorganisms. The biological metaphor matches the game's mechanics (reproduction, aging, starvation, packs, cannibalism) — this view makes the invisible visible.

## Color Palette & Atmosphere

### Background
- **Base**: Deep blue-black (`#050510`) — like looking through a darkfield microscope
- **Grid**: Faint cyan grid lines at 100-unit intervals, opacity 0.03 — hemocytometer reference lines
- **Vignette**: Circular darkening at canvas edges — simulates microscope field of view
- **Ambient particles**: Tiny floating specks drifting slowly (Brownian motion), very low opacity — adds life to empty space

### Lighting Model
- No external light source — all light comes FROM the organisms
- Bots emit their own glow (radial gradient outward)
- Food dots pulse with soft light
- The "brighter" the area of the canvas, the more activity is there

## Bot Rendering — "Organisms"

### Body Structure (replaces current ellipse)
Each bot is rendered as a layered cell:

1. **Outer glow** (largest): Radial gradient from bot color at 0% to transparent at 100%. Radius = `size * 3`. Represents bioluminescent emission. Opacity scales with total stats (stronger = brighter).

2. **Membrane** (middle ring): Stroked circle, radius = `size * 1.3`. Color = bot hue at 40% lightness. Stroke width = 2px.
   - Healthy: Smooth, consistent opacity 0.6
   - Starving: Membrane flickers (opacity oscillates 0.2–0.6 using sin wave)
   - Aging: Membrane becomes irregular — draw as a slightly randomized polygon (8–12 vertices with noise) instead of a circle. Noise amplitude increases with age.
   - Invincible: Membrane pulses gold

3. **Cytoplasm** (body fill): Filled circle, radius = `size`. Radial gradient from light center to darker edge. Color = bot hue.

4. **Nucleus** (inner): Smaller filled circle, radius = `size * 0.35`, positioned slightly off-center (toward movement direction). Brighter than cytoplasm. Represents "brain" — the AI core.

5. **Stat organelles**: 4 tiny dots arranged in a diamond pattern inside the cell body:
   - Top: Speed (cyan dot, brightness proportional to stat)
   - Right: Attack (red dot)
   - Bottom: Defence (indigo dot)
   - Left: Lives (green dot)
   - These are subtle (3px radius, low opacity) but visible on zoom

### Size Scaling
- Bot visual size scales with total stats: `baseSize + totalStats * 0.3`
- This makes powerful bots visibly larger organisms — predator/prey relationship becomes obvious at a glance

### Color Coding
- Player bot: Cyan-white glow (distinctive, brightest organism on the field)
- NPC bots: Colored by strategy template (Gatherer=green, Hunter=red, Survivor=blue, Opportunist=yellow, Aggressive=magenta)
- If no strategy template: random hue as current

### Direction Indicator
- Replace the current arrow with a pseudopod — an elongated membrane extension in the movement direction
- Draw as a teardrop/tendril shape extending from the membrane toward the target
- Length proportional to speed stat

## Food Rendering — "Nutrients"

### Appearance
- Each dot is a cluster of 3–5 tiny bright particles (not a single circle)
- Particles jitter slightly each frame (Brownian motion)
- Soft radial glow around the cluster, color: warm yellow-green (#c8e640)
- Pulsing opacity animation (sin wave, ~2 second cycle)

### Attraction Field
- When a bot is within 150 units of a food dot and targeting it: draw a faint gradient line from the nutrient to the bot, opacity decreasing with distance
- This shows "which food is being pursued" without the debug panel
- Color: same as the food glow

### Consumption Animation
- On collection: particles scatter outward in a burst (8–12 particles, fading over 20 frames)
- Brief flash at the collection point
- The bot's membrane briefly expands (10%) then contracts — "swallowing" effect

## Movement Trails — "Bioluminescent Trails"

### Implementation
- Each bot stores a trail buffer: array of last 120 positions (2 seconds at 60fps)
- Draw trail as a series of circles with decreasing opacity and size
- Trail color matches bot hue at low saturation
- Oldest points: opacity 0.02, size 1px
- Newest points: opacity 0.15, size 3px

### Trail Accumulation Layer
- Maintain a separate offscreen canvas ("trail map")
- Every N frames, stamp current bot positions onto it with very low opacity
- This canvas slowly builds up showing frequently-traveled paths
- Gradually fade the entire trail map each frame (multiply by 0.999)
- Result: popular routes glow brighter over time — you see foraging highways, hunting grounds, flee corridors

## Combat Visualization — "Cell Interaction"

### Approach Phase (bots within 80 units)
- Both bots' membranes extend pseudopods toward each other
- Faint tension line drawn between them (dashed, pulsing)
- Membrane color intensifies

### Contact Phase (collision)
- Burst of particles at the contact point (mix of both bots' colors)
- Both membranes deform toward each other (flatten at the contact surface)
- Rapid energy exchange animation: small particles flowing from the one taking more damage toward the attacker

### Kill
- Loser's membrane ruptures: draw an expanding ring of particles in the bot's color
- The cell "pops" — body dissolves into 20–30 fading particles that drift outward
- Winner briefly absorbs some particles (they drift toward the winner)
- Winner's glow intensifies for ~60 frames (power surge)
- Screen effect: very subtle flash at the kill location (white circle, 80% transparent, expanding and fading over 10 frames)

### Stalemate (both take damage, neither dies)
- Smaller particle burst
- Both bots pushed apart slightly
- Brief red flash on both membranes

## Corpse Rendering — "Cell Remnant"

- Corpse is a fading, desaturated version of the original cell
- Membrane is broken (draw as disconnected arcs instead of full circle)
- No nucleus visible
- Slowly shrinking
- Dim residual glow that fades over the corpse duration
- When consumed: remaining particles absorbed by the consuming bot

## Reproduction Animation — "Cell Division"

### Asexual
1. Parent cell elongates (stretch the circle to an ellipse over 30 frames)
2. A constriction appears in the middle (pinch)
3. The cell splits into two — parent and offspring separate
4. Brief connecting filament between them that fades over 60 frames

### Sexual
1. Two parent cells approach and their membranes touch
2. Membranes merge briefly at the contact point (shared membrane section)
3. A new small cell buds off from the merged section
4. Parents separate, offspring drifts away
5. Connecting filaments to both parents, fading

## Pack Visualization — "Colony"

### Filaments
- Pack members connected by visible filaments (thin lines with slight wave/wobble)
- Filament color: pack hue at low opacity (0.15)
- Filament thickness: 1px, with a glow effect (draw twice — once thick and transparent, once thin and opaque)
- Filaments stretch and thin when members are far apart, thicken when close

### Colony Membrane
- If pack territory is enabled: draw a convex hull around all pack members
- Render as a translucent membrane (the pack's hue, opacity 0.05 fill, 0.2 stroke)
- Membrane wobbles slightly (vertex noise each frame)

### Leader Indicator
- Pack leader has a slightly larger nucleus with a brighter glow
- A subtle "crown" of small particles orbiting the leader

## Field Rendering — "Microscope Slide"

### Background Layers (back to front)
1. Solid deep blue-black
2. Subtle noise texture (very fine, low opacity — simulates slide imperfections)
3. Grid lines (hemocytometer reference)
4. Trail accumulation map (offscreen canvas, composited)
5. Ambient floating particles (50–100 tiny specs with random drift)
6. Vignette overlay (dark circular gradient at edges)

### World Boundary
- Instead of red lines: a faint circular or rounded-rectangle boundary with a gradient fade
- Represents the edge of the microscope's field of view
- Bots approaching the edge have their glow partially clipped/faded

### "Depth of Field" Effect
- Bots closer to the camera (center of view) are slightly sharper
- Bots near the edges of the view are slightly more blurred (increase glow, decrease detail)
- Simulates microscope depth of field

## Minimap Redesign

- Dark circular minimap (not square) — like a microscope eyepiece
- Bots as glowing dots (same colors as main view)
- Trails visible as dim streaks
- Pack territories as colored regions
- Circular border with subtle lens effect

## HUD Adjustments

- Keep v11 glassmorphism HUD but adjust accent colors to match the petri dish palette
- Primary accent: bioluminescent cyan (#00e5ff)
- Bot stats shown as "cell health readout" — keep the bar format but add a subtle organic curve to bars
- Event notifications use softer, more organic language: "Organism #5 consumed Organism #12" instead of "eliminated"

## Performance Considerations

- Trail buffer: Fixed-size ring buffer (120 entries per bot, ~20 bots = 2400 points) — trivial memory
- Trail accumulation canvas: Draw every 5th frame, not every frame
- Ambient particles: Use a pre-calculated array of positions, just offset each frame
- Glow effects: Use `globalCompositeOperation = 'lighter'` for additive blending — single pass, no extra canvases needed for individual glows
- Membrane noise: Pre-generate noise table, index by frame count
- Particle systems (combat, consumption): Pool and reuse particle objects, max 200 active particles

## Files That Change (from v11 base)

| File | Changes |
|------|---------|
| `styles.css` | Adjust HUD accent colors to bioluminescent cyan, darken surface-0 further |
| `js/bot-render.js` | **Complete rewrite** — new organism rendering with membrane, nucleus, organelles, glow |
| `js/main.js` | New `drawField()` (dark slide bg, grid, vignette), new trail system, particle system, combat/consumption animations, updated minimap |
| `js/game.js` | Add trail buffer to Bot class, particle emission hooks on stat gain/combat |
| `js/config.js` | Add petri dish visual config constants (trail length, glow intensity, particle counts) |
| `index.html` | Add offscreen canvas for trail accumulation |
| Other JS files | Untouched (game logic identical) |
