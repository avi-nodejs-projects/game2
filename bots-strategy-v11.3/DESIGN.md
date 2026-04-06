# v11.3 — "The Arena" Design Document

## Vision
Make watching the simulation feel like watching a live esport or gladiatorial spectacle. Add cinematic camera work, dramatic visual effects for combat, environmental storytelling, and dynamic atmosphere that responds to the state of the game.

## Atmosphere & Environment

### Arena Ground (replaces flat green gradient)

#### Base Terrain
- Textured ground using procedural noise patterns drawn on canvas:
  - Base color: warm earth tone (#5a7a3a to #3d5a27 gradient)
  - Overlay: Perlin-like noise patches for grass variation (lighter/darker splotches)
  - Generated once at game start on an offscreen canvas, then stamped each frame

#### Wear Marks (dynamic)
- Maintain a "wear map" (offscreen canvas, same resolution as the trail map concept)
- Stamp bot positions onto it each frame with very low opacity dark brown
- Areas where bots frequently travel become visibly worn (darker, more "dirt-like")
- Wear map fades slowly (multiply by 0.9995 per frame) so old paths heal
- Result: Natural-looking paths emerge where bots commonly walk

#### Combat Scorch Marks
- On each kill: stamp a dark circular scorch mark (radius 30px, brown-black, opacity 0.3) at the kill location on the wear map
- These fade more slowly than normal wear (separate decay layer, 0.9998)
- Over time, you can see "dangerous zones" by the scorch marks

#### Vegetation Near Food
- Draw small grass tuft clusters (2-3 short green lines) around food dot positions
- When food is consumed: the tufts wilt (shorten and brown over 60 frames), then regrow when food respawns
- Purely decorative but creates the sense that food = fertile area

### Sky / Horizon
- Keep the sky gradient but make it more atmospheric:
  - Dawn colors at simulation start (warm orange-pink horizon)
  - Gradually shifts to midday (bright blue) over 5 minutes
  - Then to dusk (purple-orange) over the next 5 minutes
  - Then night (dark blue with faint stars) for 5 minutes
  - Cycles back to dawn
- The color shift is purely cosmetic — based on `frameCount % 54000` (15-minute cycle)

### Ambient Particles
- **Day**: Dust motes floating upward, very faint, 20-30 particles
- **Dusk/Dawn**: Firefly-like particles that glow and fade, warm colors
- **Night**: Fewer particles, cooler colors, occasional "shooting star" streak across the sky
- Particles are simple: position, velocity, opacity, size. Updated each frame. Drawn behind bots, in front of ground.

## Bot Rendering — "Arena Fighters"

### Body (enhanced current design)
Keep the ellipse-based body but add layers:

1. **Shadow**: Current shadow, but more pronounced. Scaled by "time of day" — long shadows at dawn/dusk, short at midday, dim at night.

2. **Body**: Current colored ellipse, but add a subtle inner gradient (lighter center to darker edge) for a 3D spherical look.

3. **Power Aura** (new): A radial glow around the bot that scales with total stats.
   - Total stats < 20: No aura
   - 20-30: Faint glow, radius = size * 1.5
   - 30-50: Medium glow, radius = size * 2.0
   - 50+: Strong glow with particle orbit, radius = size * 2.5
   - Aura color matches bot hue but lighter/more saturated

4. **Equipment Effects** (new visual indicators based on dominant stat):
   - **Speed dominant** (speed > attack and speed > defence): Motion blur trail — draw 3 ghost images behind the bot at previous positions, decreasing opacity
   - **Attack dominant**: Red energy wisps around the bot — 2-3 small red particles orbiting at size * 1.5 radius
   - **Defence dominant**: Shield shimmer — a semi-transparent arc in front of the bot (in movement direction), blue-white, subtle pulse

5. **Eyes** (enhanced): Current white eyes with pupils, but:
   - **Hunting**: Eyes narrow (draw as slits), slightly reddish
   - **Fleeing**: Eyes widen (larger radius), shift backward
   - **Gathering**: Normal, calm expression
   - **Idle**: Eyes look around (pupils shift randomly every 60 frames)

6. **Name Tag** (on hover or when selected):
   - Floating above the bot: "Bot #5" or "YOUR BOT"
   - Below: compact stat display "S:7 A:12 D:4 L:5"
   - Background: dark pill shape with bot's hue accent

### Bot Size
- Base size stays as current
- But add a "breathing" animation: size oscillates ±2% on a slow sin wave (3-second period, offset by bot index so they don't sync)
- Creates subtle organic movement even when bots are stationary

## Combat System — "Spectacle"

### Approach Phase (distance < 120 units, both moving toward each other)

#### Visual Cues
- Both bots' auras brighten by 50%
- A faint "tension line" drawn between them — dashed, red-orange, oscillating opacity
- Subtle screen vignette begins (only if player bot is involved or camera is nearby)
- Background music/atmosphere could darken (not implementing audio, but visually: slight desaturation of the background in a radius around the confrontation)

#### Camera Response (if auto-follow is on and player bot involved)
- Camera smoothly pulls back slightly (zoom out 10%) to show both combatants
- If the other bot is off-screen, camera pans to frame both

### Contact Phase (collision)

#### Impact Effect
1. **Screen shake**: Offset the entire canvas by random ±3px for 8 frames. Intensity scales with the damage dealt.
2. **Impact flash**: White circle at the contact point, radius 20px, opacity 0.6, expanding to 40px and fading over 10 frames.
3. **Spark particles**: 8-12 small bright particles burst from the contact point in random directions. Each particle: 2px, bright white/yellow, velocity 2-4px/frame, decelerate and fade over 20 frames.
4. **Damage numbers**: Float upward from the damaged bot. Format: "−2.3" in red, bold font. Rise 30px over 45 frames while fading.
   - Show for both bots simultaneously if both take damage.
   - Color: Red for damage, green for "BLOCKED" if defence >= attack (0 damage).

#### Sound-like Visual Pulse
- A ring expands from the impact point (like a sound wave visualization)
- Very faint, expands to radius 80px over 15 frames, fading

### Kill

#### Dramatic Pause
- **Freeze frame**: The entire simulation pauses for 4 frames (67ms) — just enough to register as a "beat"
- Only triggers if the kill is visible on screen

#### Death Animation (the killed bot)
1. Bot flashes white (2 frames)
2. Bot shatters into 20-30 particles:
   - Each particle is a small colored fragment (bot's hue)
   - Particles burst outward with random velocities (3-8 px/frame)
   - Particles decelerate (friction 0.95/frame) and fade (opacity -= 0.02/frame)
   - Gravity: particles drift downward slightly (+0.1 y velocity/frame)
3. A circular "shockwave" ring expands from the death point (radius 0→100px, 20 frames, fading)
4. The scorch mark is stamped on the ground

#### Victory Effect (the killer)
1. Bot's aura flares bright (2x intensity) for 30 frames
2. Brief golden particles spiral inward toward the bot (representing stat absorption)
3. Size pulses up 15% then back to normal over 30 frames

#### Player Bot Kill (extra effects)
- Larger screen shake
- Gold flash instead of white
- Achievement-style banner slides in from the top: "YOUR BOT eliminated Bot #12" with a kill icon
- Banner stays for 90 frames then slides out
- Kill counter increments with a satisfying number-flip animation

#### Player Bot Death (extra effects)
- Strong screen shake
- Red vignette pulse on the edges of the screen
- "RESPAWNING..." text fades in at the death location
- Camera briefly stays at the death location (2 seconds) before following the respawned bot

### Stalemate (both bots take damage, neither dies)
- Smaller spark burst (5 particles)
- Smaller screen shake (±1px, 4 frames)
- Both bots pushed apart visually (position offset for 10 frames, then snap back)
- Damage numbers for both

## Environmental Storytelling

### Territory Visualization
- Pack territory shown as a subtle colored region on the ground
- Not drawn as an overlay but as a ground tint (stamped onto the wear map canvas with pack color at very low opacity)
- Territory edges are soft (gaussian-like falloff, not hard lines)
- Contested territory between two packs: colors blend, creating a visual "front line"

### Food Cluster Landmarks
- Areas with 3+ food dots within 150 units get a visual enhancement:
  - Slightly brighter ground
  - More grass tufts
  - Faint golden glow at ground level
- These become recognizable "oases" that bots gravitate toward

### Death History
- The scorch marks accumulate, creating a visual map of the most dangerous areas
- Players will learn to read the terrain: "lots of scorch marks near that food cluster = contested resource"

## Camera System — "Director Mode"

### Standard Mode (default)
- Current follow-cam behavior (tracks selected bot)
- Smooth camera with current lerp settings
- Manual control with click/drag or keyboard

### Director Mode (toggle with `C` key)
Smart auto-camera that creates cinematic shots:

#### Shot Types
1. **Follow shot**: Close tracking of an active bot (gathering, hunting). Zoom 1.0x.
2. **Confrontation shot**: When two bots approach each other. Camera frames both with some lead space. Zoom 0.8x.
3. **Wide establishing shot**: No immediate action. Slow pan across the field showing the overall state. Zoom 0.6x.
4. **Kill close-up**: On kill, snap to a tight shot of the kill location. Zoom 1.5x. Hold for 60 frames.
5. **Player dramatic**: When player bot is in danger (enemy within 150, stronger opponent). Camera pulls to frame both. Zoom 0.9x.

#### Shot Selection
- Priority: Kill close-up > Player dramatic > Confrontation > Follow > Wide
- Minimum shot duration: 120 frames (2 seconds) to avoid jarring cuts
- Smooth transitions between shots (camera lerp to new position/zoom over 30 frames)
- Bias toward player bot (50% of follow shots feature player bot)

## HUD Enhancements

### Kill Feed (replaces generic event notifications)
- Top-right corner (below minimap)
- Each kill gets a line: "[killer icon] Bot #5 → Bot #12 [skull icon]"
- Color coded: red text for the eliminated bot, gold for the killer
- If player bot is involved: highlighted row
- Shows last 5 kills, each fades after 5 seconds
- Scrolls upward as new kills appear

### Stat Change Popups
- When the followed bot gains a stat: "+0.1 SPD" floats up from the HUD stat bar
- Color matches the stat color
- Small, unobtrusive, fades in 1 second

### Danger Indicator
- When an enemy is approaching the followed bot from off-screen:
  - A red arrow/chevron appears at the screen edge pointing toward the threat
  - Arrow opacity increases as the enemy gets closer
  - Distance number next to the arrow: "142"

### Bot Comparison (on hover)
- When hovering over a bot in the main view:
  - Split tooltip showing YOUR BOT stats vs THIS BOT stats side by side
  - Combat advantage prediction: "You win" (green) or "You lose" (red) with damage calculation

## Particle System Architecture

### Particle Pool
```javascript
const particlePool = {
  particles: [],    // pre-allocated array of 300 particle objects
  activeCount: 0,   // how many are currently alive
  
  emit(x, y, count, config) { /* activate particles from pool */ },
  update() { /* update all active particles */ },
  draw(ctx) { /* draw all active particles */ }
};

// Particle object:
{
  active: false,
  x, y,              // position
  vx, vy,            // velocity
  life: 0,           // frames remaining
  maxLife: 30,        // total lifetime
  size: 3,
  color: '#fff',
  decay: 0.95,        // velocity multiplier per frame
  gravity: 0,         // y acceleration per frame
  fadeRate: 0.03      // opacity decrease per frame
}
```

### Particle Types (pre-configured)
- `SPARK`: Small, fast, white/yellow, short life (15 frames), no gravity
- `SHATTER`: Medium, moderate speed, bot-colored, medium life (30 frames), slight gravity
- `ABSORB`: Small, moves toward a target point, gold, medium life
- `DUST`: Tiny, very slow, earth-colored, long life (60 frames), drifts upward
- `FIREFLY`: Tiny, slow random walk, warm color, long life, opacity oscillates

## Screen Effects

### Screen Shake
```javascript
let screenShake = { intensity: 0, duration: 0 };

function applyScreenShake() {
  if (screenShake.duration <= 0) return { x: 0, y: 0 };
  screenShake.duration--;
  const t = screenShake.duration / 10;
  return {
    x: (Math.random() - 0.5) * screenShake.intensity * t,
    y: (Math.random() - 0.5) * screenShake.intensity * t
  };
}

function triggerScreenShake(intensity, duration) {
  screenShake.intensity = Math.max(screenShake.intensity, intensity);
  screenShake.duration = Math.max(screenShake.duration, duration);
}
```

Apply shake offset to all draw calls in the render loop (offset ctx.translate before drawing, restore after).

### Vignette
- Always-on subtle dark vignette at screen edges (drawn last, on top of everything)
- Intensifies during combat (if followed bot is involved)
- Red tint when followed bot is low health
- Implementation: Pre-render a vignette image on an offscreen canvas at startup, composite over the main canvas each frame

### Freeze Frame
- On dramatic kills: set `freezeFrames = 4` counter
- In animate(): if `freezeFrames > 0`, decrement and skip game logic update but still render (so the pause is visible)
- Only affects game updates, not the rendering or particle system (particles still animate during freeze)

## Day/Night Cycle

### Implementation
```javascript
function getDayPhase(frame) {
  const cycle = 54000; // 15 minutes
  const t = (frame % cycle) / cycle; // 0.0 to 1.0
  
  if (t < 0.1) return { phase: 'dawn', blend: t / 0.1 };
  if (t < 0.4) return { phase: 'day', blend: (t - 0.1) / 0.3 };
  if (t < 0.5) return { phase: 'dusk', blend: (t - 0.4) / 0.1 };
  if (t < 0.9) return { phase: 'night', blend: (t - 0.5) / 0.4 };
  return { phase: 'predawn', blend: (t - 0.9) / 0.1 };
}
```

### Color Grading per Phase
- **Dawn**: Sky gradient warm (orange-pink → light blue). Field slightly warm-tinted. Long shadows.
- **Day**: Sky bright blue → white at horizon. Field normal green. Short shadows.
- **Dusk**: Sky purple-orange → dark blue. Field warm-tinted, desaturated slightly. Long shadows opposite direction.
- **Night**: Sky dark navy with dot stars. Field dark (multiply by 0.6). Shadows barely visible. Bot glows more prominent.
- **Pre-dawn**: Transition from night back to dawn. Sky lightening.

### Shadow Direction
- Shadows cast based on day phase:
  - Dawn: shadows point left (sun rising from right)
  - Midday: shadows point down (short)
  - Dusk: shadows point right (sun setting left)
  - Night: no directional shadow (just a centered dark blob)
- Shadow angle = `phase_progress * PI` (sweeps from right to left over the day)

## Kill Banner System

### Layout
```
┌──────────────────────────────────────┐
│  ⚔ YOUR BOT eliminated Bot #12  +1  │
│     ATK 12.0 vs DEF 4.0 = −8.0      │
└──────────────────────────────────────┘
```

### Animation
1. Slides down from top of screen (translateY: -60px → 0, 15 frames, ease-out)
2. Holds for 90 frames
3. Slides up and fades (translateY: 0 → -60px, opacity 1→0, 20 frames)

### Styling
- Dark glass background, bot hue accent border on left
- Player kills: gold accent, "⚔" icon
- Player deaths: red accent, "☠" icon
- Other kills: gray accent, no icon (smaller version)
- Only show "other" kills if they happen near the camera

## Off-Screen Danger Indicator

### Implementation
- For each enemy bot not currently visible on screen:
  - Calculate angle from screen center to enemy world position
  - If distance < 300 (potential threat): draw an arrow at the screen edge at that angle
  - Arrow size and opacity scale inversely with distance (closer = bigger/brighter)
  - Arrow color: red with a pulsing glow
  - Small distance label: "127" next to the arrow

### Rendering
- Draw as a triangle (chevron) pointing inward
- Position: clamp to screen edge with 30px padding
- Only show for bots that are actually targeting/approaching the followed bot (check movement angle)

## Performance Considerations

- **Wear map canvas**: Write every 3rd frame, draw (composite) every frame
- **Particle pool**: Pre-allocate 300 objects. Active particles iterated with early exit on inactive.
- **Screen shake**: Just a ctx.translate offset — zero cost
- **Freeze frame**: Skips game update entirely — actually saves performance during freeze
- **Day/night**: Pre-calculate sky gradient once per phase change (~every 900 frames), not every frame
- **Terrain texture**: Generated once, drawn as a single drawImage per frame
- **Ambient particles**: Cap at 30, simple update loop
- **Damage numbers**: Cap at 10 active, simple float + fade
- **Kill banners**: Cap at 3 active DOM elements (not canvas-drawn — use HTML overlay for crisp text)
- **Danger indicators**: At most ~20 calculations per frame (once per enemy bot), only draw the 3 closest

## Files That Change (from v11 base)

| File | Changes |
|------|---------|
| `index.html` | Add overlay div for kill banners, danger indicators container |
| `styles.css` | Kill banner styles, danger indicator styles, vignette overlay |
| `js/main.js` | **Major rewrite** — new drawField (terrain, wear map, vegetation, sky cycle), screen shake system, freeze frame, director camera mode, danger indicators, combat approach effects |
| `js/bot-render.js` | **Major rewrite** — power aura, equipment effects, eye expressions, name tags, breathing animation |
| `js/config.js` | Add arena visual config (particle settings, day cycle, shake intensity, director thresholds) |
| `js/game.js` | Add hooks: combat approach detection, kill event with position for scorch marks |
| New: `js/particles.js` | Particle pool system (emit, update, draw) with pre-configured types |
| New: `js/arena-effects.js` | Screen shake, vignette, freeze frame, kill banners, damage numbers, danger indicators |
| New: `js/arena-camera.js` | Director mode camera AI with shot types and smooth transitions |
| Other JS files | Untouched (game logic identical) |
