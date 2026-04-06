# 04 — Echo Chamber

> Perception-pulse world — see only what your bot can sense

## Visual Identity

**Mood:** Echolocation, alien beauty, skill-rewarding minimalism
**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Void | `#020208` | The default state — pure darkness |
| Pulse ring | `#4488ff` at 60% → 0% | Expanding perception wave |
| Player bot | `#6ec6ff` | Cool blue, softly glowing |
| Revealed bots | Bot's own color, briefly | Flash of color on pulse contact |
| Bot echo | `#334466` | Fading afterimage |
| Revealed food | `#ffe066` → `#665500` | Warm glow that lingers slightly longer |
| Food hum | `#443300` at 15% | Persistent faint glow (always-on) |
| Pulse reflection | Entity's color at 40% | Ring that bounces back from entities |
| Terrain echo | `#1a1a2e` | Faint field boundary revealed by pulse |
| HUD text | `#6688aa` | Muted blue-gray |
| Awareness circle | `#223344` | The bot's perception radius boundary |

## Core Concept: Perception Pulses

The entire world is **pitch black** by default. The player bot periodically emits an omnidirectional perception pulse — a ring of energy that expands outward. When the ring contacts an entity, that entity is briefly **illuminated**, then fades back into darkness. Between pulses, you navigate by memory and the fading echoes of what you last saw.

### Pulse Mechanics

```
Frame 0:    Pulse emitted — bright ring at radius 0
Frame 10:   Ring at radius 100u — hits nearby food (flash!)
Frame 20:   Ring at radius 200u — hits enemy bot (flash!)
Frame 30:   Ring at radius 300u — reaches max range, dissipates
Frame 31-150: Echoes fade, darkness returns
Frame 150:  Next pulse emitted
```

**Pulse frequency:** Every 2.5 seconds (150 frames)
**Pulse speed:** 200 units/second (expanding ring)
**Max range:** 350 units
**Pulse width:** 3px line, with 20px glow trail behind it

## Screen Layout

```
┌──────────────────────────────────────────────┐
│                                              │
│                 · (darkness) ·               │
│                                              │
│           ╭ ─ ─ ─ ─ ─ ─ ─ ╮                 │
│          (   awareness    )                  │
│         ( ╭───╮            )                 │
│         ( │echo│  ← fading )                 │
│          (╰───╯    ● YOU  )                  │
│           ╰ ─ ─ ─ ─ ─ ─ ╯                   │
│                                              │
│                ~~ pulse ring expanding ~~     │
│                                              │
│       ░ food hum ░           ░ food hum ░    │
│                                              │
├──────────────────────────────────────────────┤
│ PULSE ████░░░ 1.8s │ SENSE: 3 │ SPD 3.2 ... │
└──────────────────────────────────────────────┘
```

**Layout:** Full-screen main canvas (90%) + thin HUD bar (10%)

The camera is **centered on the player bot** with a 1.5× zoom. The player bot is always visible (self-illuminated glow). Everything else is dark unless recently pulsed.

## Rendering Pipeline

### Layer 1: The Void (Base)

Every frame starts with a **near-black fill** — but not fully opaque. Instead of clearing to solid black, fill with `rgba(2, 2, 8, 0.08)`. This creates a natural **fade trail** — bright things leave afterimages that slowly dissolve into darkness. This single technique handles most of the "echo fading" effect.

```javascript
// Instead of ctx.clearRect():
ctx.fillStyle = 'rgba(2, 2, 8, 0.08)';
ctx.fillRect(0, 0, W, H);
```

**Fade rate:** 0.08 alpha means full brightness fades to invisible in ~2.5 seconds (matching pulse frequency). Objects pulsed at max brightness will just barely vanish before the next pulse arrives.

### Layer 2: Food Hum (Persistent Glow)

Food dots emit a **constant low hum** — a faint warm glow that's always visible regardless of pulses. This gives the player something to navigate toward even in total darkness.

- Rendered as a radial gradient: `#ffe066` at center (radius 3px), fading to transparent at radius 25px
- Opacity: 15% (barely visible but detectable)
- Subtle oscillation: opacity varies ±5% with a 2-second sine wave (each dot has a random phase offset)

```javascript
function drawFoodHum(ctx, food) {
    const hum = 0.12 + 0.05 * Math.sin(frameCount * 0.05 + food.phase);
    const grad = ctx.createRadialGradient(food.sx, food.sy, 0, food.sx, food.sy, 25);
    grad.addColorStop(0, `rgba(255, 224, 102, ${hum})`);
    grad.addColorStop(1, 'rgba(255, 224, 102, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(food.sx, food.sy, 25, 0, Math.PI * 2);
    ctx.fill();
}
```

### Layer 3: Perception Pulse

The expanding ring is the star of the show:

```javascript
function drawPulse(ctx, cx, cy, pulseAge) {
    const speed = 200; // units per second
    const radius = (pulseAge / 60) * speed * ZOOM;
    const maxRadius = 350 * ZOOM;
    
    if (radius > maxRadius) return;
    
    const progress = radius / maxRadius;
    const opacity = 0.6 * (1 - progress); // fades as it expands
    
    // Main ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(68, 136, 255, ${opacity})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Glow trail (wider, fainter ring behind)
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, radius - 15), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(68, 136, 255, ${opacity * 0.3})`;
    ctx.lineWidth = 20;
    ctx.stroke();
    
    // Inner fill (very faint illumination of area already scanned)
    const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    innerGrad.addColorStop(0, `rgba(68, 136, 255, ${opacity * 0.03})`);
    innerGrad.addColorStop(0.8, `rgba(68, 136, 255, ${opacity * 0.01})`);
    innerGrad.addColorStop(1, 'rgba(68, 136, 255, 0)');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
}
```

### Layer 4: Entity Revelation

When the pulse ring passes through an entity's position (ring radius ≈ entity distance ± tolerance), the entity is **illuminated**:

#### Bot Revelation

```
Pulse contacts bot → 
  Frame 0-5:   Full brightness flash (white → bot color)
  Frame 5-15:  Bot rendered in full color with glow
  Frame 15-60: Bot becomes an "echo" — monochrome silhouette, slowly fading
  Frame 60+:   Gone (handled by the void fade trail)
```

**Revelation rendering:**
1. **Flash:** Draw a white circle (radius 20px) expanding briefly, then contracting to the bot's shape
2. **Full render:** For ~10 frames, draw the bot in full v11 style with bright glow
3. **Echo:** Switch to a simplified silhouette (solid color, no detail) with decreasing opacity

```javascript
function drawRevealedBot(ctx, bot, revealAge) {
    if (revealAge < 5) {
        // Flash
        const flashRadius = 20 * (1 - revealAge / 5);
        ctx.beginPath();
        ctx.arc(bot.sx, bot.sy, flashRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - revealAge / 5)})`;
        ctx.fill();
    }
    
    if (revealAge < 15) {
        // Full render with glow
        ctx.shadowColor = bot.color;
        ctx.shadowBlur = 15 - revealAge;
        drawBotFull(ctx, bot); // standard v11 bot rendering
        ctx.shadowBlur = 0;
    } else if (revealAge < 60) {
        // Echo - simplified silhouette
        const echoAlpha = 0.5 * (1 - (revealAge - 15) / 45);
        ctx.globalAlpha = echoAlpha;
        ctx.fillStyle = '#334466';
        ctx.beginPath();
        ctx.ellipse(bot.sx, bot.sy, bot.size, bot.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    // After 60 frames: void fade handles the rest
}
```

**Reflection pulse:** When the main pulse hits a bot, a smaller **echo ring** bounces back toward the player — a faint colored ring (the bot's color at 30% opacity) that contracts from the entity position back toward the player. This gives a sonar-like "bounce" feel.

```javascript
function drawReflection(ctx, entitySX, entitySY, playerSX, playerSY, reflectAge) {
    const maxAge = 30;
    if (reflectAge > maxAge) return;
    const progress = reflectAge / maxAge;
    const radius = (1 - progress) * distance(entitySX, entitySY, playerSX, playerSY);
    const opacity = 0.3 * (1 - progress);
    
    ctx.beginPath();
    ctx.arc(entitySX, entitySY, radius * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(100, 150, 200, ${opacity})`;
    ctx.lineWidth = 2;
    ctx.stroke();
}
```

#### Food Revelation

Food reacts differently — brighter, warmer, lingers longer:

1. **Flash:** Golden burst (brighter than bot flash)
2. **Full render:** Yellow dot with warm radial glow, lasts ~20 frames
3. **Fade:** The food hum takes over seamlessly (the always-on glow means food never fully disappears)

#### Boundary Revelation

When the pulse hits the field boundary, a **brief line segment** of the boundary illuminates in cool blue, then fades. This helps the player understand where the world edges are.

### Layer 5: Player Bot (Always Visible)

The player bot has its own **self-illumination** — a persistent soft glow:

- Inner glow: player color, radius 30px, 30% opacity
- The bot is always fully rendered (v11 style)
- A faint **awareness circle** around the player (radius = 60u, dashed, 10% opacity) shows the bot's immediate sensing range (things this close are always dimly visible even without a pulse)

### Layer 6: Movement State Interaction

The bot's movement state affects perception:

| State | Pulse Range | Pulse Frequency | Resolution |
|-------|-------------|-----------------|------------|
| **Stationary** | 250u | Every 2.0s | High (echoes last longer, +50% fade time) |
| **Walking** (speed < 3) | 350u | Every 2.5s | Normal |
| **Running** (speed ≥ 3) | 400u | Every 3.0s | Low (echoes fade faster, −30% fade time) |

The tradeoff: moving fast covers more ground but your perception becomes more fleeting. Standing still gives you a clearer but narrower picture.

## HUD Bar — Bottom 10%

Minimal, unobtrusive:

```
PULSE ████████░░░░ 1.8s │ SENSED: 3 bots, 5 food │ SPD 3.2 ATK 2.1 DEF 4.0 LIV 5 │ K:2
```

- **Pulse timer:** Bar fills as next pulse charges. Ambient glow increases as pulse nears.
- **Sensed count:** How many entities were revealed in the last pulse (helps gauge surroundings)
- **Stats:** Compact numeric display
- **Kill count**

## Combat Visualization

### Approach (enemy echo visible, closing)

- The enemy's echo **pulses** faster as they approach (even between main pulses)
- A faint **tension line** appears between player and the echo's last-known position: dashed, warm red, oscillating opacity
- The player's self-illumination glow grows slightly (heightened awareness)

### Contact (combat begins)

- **Continuous illumination:** Both bots are fully visible for the duration of combat — no more fading. The fight creates its own light.
- **Impact bursts:** Each hit produces a bright flash that briefly illuminates a 100u radius — nearby entities get a free reveal
- **Damage sparks:** White-hot particles scatter from impact, acting as tiny temporary light sources (illuminate what they pass near)
- **Sound waves:** Each hit sends out a smaller pulse ring (80u range) that reveals nearby entities — combat is noisy

```javascript
function combatImpact(ctx, x, y) {
    // Bright flash (illuminates surroundings)
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 100);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(0.3, 'rgba(255, 200, 100, 0.2)');
    grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 100, 0, Math.PI * 2);
    ctx.fill();
    
    // Mini pulse ring (reveals nearby entities)
    spawnPulse(x, y, 80, 'combat');
}
```

### Kill

- **Death flash:** The killed bot emits one final bright burst — a "death scream" pulse that illuminates everything within 200u for 0.5 seconds. This is the brightest moment in the game.
- **Particle dissolution:** The bot breaks into glowing particles that scatter and fade, each acting as a tiny light source
- **Winner absorption:** Golden particles flow from the death point to the winner, briefly making the winner glow brighter
- **Silence:** After the flash fades, darkness returns. The killed bot's echo lingers for an extra 2 seconds as a dim ghost.

### Player Death

- **All light extinguished:** Screen goes fully black for 1 second (the most dramatic moment)
- **Reboot sequence:** A single dim pulse slowly expands from the new spawn point, fading up to normal brightness over 3 seconds. The player is "coming to" in a new body.

## Interaction & Controls

| Key | Action |
|-----|--------|
| **P** | Force an early pulse (costs: next pulse is delayed by 1s extra — prevents spam) |
| **+/−** | Adjust perception range (trade range for frequency) |
| **S** | Toggle movement-state effects on/off (uniform perception) |
| **TAB** | Cycle highlighted target (last-known echo positions) |
| **SPACE** | Pause (freeze current echo state) |

## Advanced: Sound Propagation

Off-screen events create **distant ripples** that reach the player:

- **Combat (within 600u):** A faint rumble — a very dim, wide pulse ring that barely registers but gives directional awareness
- **Death (within 800u):** A brief flicker from that direction on the void boundary
- **Food consumption (within 200u):** The food's hum goes silent — the player notices the absence

These create an experience of a living world beyond what you can directly perceive.

## Performance Notes

- **Void fade:** The `rgba(2,2,8,0.08)` fill-over-previous approach is essentially free — one fillRect per frame
- **Pulse ring:** One arc stroke per frame — negligible
- **Entity reveals:** Only process entities within pulse range — culled early
- **Reflections:** Max 20 reflection rings (one per entity in range) — each is one arc stroke
- **Food hum:** Pre-render hum glow to an offscreen canvas; stamp it per food dot
- **Combat illumination:** Only during active combat — rare, brief

## What Makes This Unique

Echo Chamber is the **sensation** concept. It doesn't just restrict information (like The Operative) or display it differently (like Sonar) — it makes you **feel** the act of perception. Each pulse is a moment of revelation, and the darkness between pulses is genuinely tense. Combat becomes a light show in a dark world. The speed-vs-awareness tradeoff adds a strategic layer unique to this mode. It's the most emotionally engaging concept.

## Map Integration

**Has both POV and overview?** No — you see only what you can sense. No map, no minimap, no overview. This is by design — the entire concept rests on limited awareness.

**Potential enhancement:** A very constrained minimap that only shows the **echo history** — a dark map with faint marks where entities were last sensed. The marks fade over time. This gives a sense of the broader field without breaking the perception mechanic. Toggle with `M`.
