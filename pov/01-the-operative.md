# 01 — The Operative

> Tactical stealth POV with forward vision cone and fog of war

## Visual Identity

**Mood:** Covert ops, stealth-action, tense situational awareness
**Palette:**

| Role | Color | Usage |
|------|-------|-------|
| Background (fog) | `#0a0f0a` | Unexplored / out-of-cone areas |
| Vision cone fill | `#1a2e1a` → `#0a0f0a` | Radial gradient from bot outward |
| Player bot | `#00e676` | Bright green, always visible |
| Friendly/neutral bots | `#66bb6a` → `#1b5e20` | Fade to silhouette at cone edge |
| Hostile bots | `#ff1744` | Red heat signature |
| Food | `#ffd740` | Warm glow through fog |
| HUD chrome | `#263238` | Dark gunmetal panels |
| HUD text | `#b0bec5` | Muted silver |
| Alert text | `#ff5252` | Danger indicators |

## Screen Layout

```
┌─────────────────────────────────────────────┐
│                                             │
│              VISION CONE (65%)              │
│                                             │
│         ╱ · · · · · · · · · · ╲             │
│        ╱   [food glow]         ╲            │
│       ╱        [heat sig?]      ╲           │
│      ╱              ● YOU        ╲          │
│     ╱    ░░ fog ░░░░░░░░░ fog ░░  ╲         │
│    ╱░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╲        │
│                                             │
├──────────┬──────────────┬───────────────────┤
│ MINIMAP  │  STAT BARS   │   THREAT FEED     │
│  (20%)   │   (40%)      │     (40%)         │
│          │              │                   │
│  ◎ · · · │ SPD ████░░░  │ ▲ Bot#7 NE 120u  │
│  · ● · · │ ATK ██░░░░░  │ ▲ Bot#3 SW 200u  │
│  · · · · │ DEF █████░░  │ ● Food×3 N 80u   │
│          │ LIV ███░░░░  │                   │
├──────────┴──────────────┴───────────────────┤
│ [STEALTH]  Kills: 3  |  Gen: 1  |  ⏱ 2:34  │
└─────────────────────────────────────────────┘
```

**Total layout:** Vision cone area (top 65%) + Tactical strip (bottom 35%)

### Vision Cone Area — Primary Canvas

The main view is rendered from the **player bot's position**, with the bot centered at the bottom-center of the canvas. The world is rotated so the bot's **heading is always "up"** on screen.

#### Field of View

- **Cone angle:** 120° (60° each side of heading)
- **Cone range:** 300 units (adjustable — scales with speed stat: `250 + speed × 10`)
- **Rendering:** Only entities within the cone are drawn. Everything outside is the fog color.

#### Fog of War

Three visibility zones, rendered as concentric regions within the cone:

| Zone | Range | Rendering |
|------|-------|-----------|
| **Clear** | 0–120u | Full color, full detail, sharp edges |
| **Hazy** | 120–220u | Desaturated 40%, slight blur (drawn at 70% opacity over fog) |
| **Edge** | 220–300u | Silhouettes only — shape visible, no color/detail |

Implementation: Draw the full scene, then overlay fog as a shaped mask. The mask is the canvas minus the cone shape, filled with the fog color. The cone interior uses a radial gradient for the zone transitions.

```javascript
// Cone mask approach
ctx.save();
ctx.fillStyle = FOG_COLOR;
ctx.fillRect(0, 0, W, H);

// Cut out the cone
ctx.globalCompositeOperation = 'destination-out';
ctx.beginPath();
ctx.moveTo(playerScreenX, playerScreenY);
ctx.arc(playerScreenX, playerScreenY, coneRange, 
        heading - HALF_CONE, heading + HALF_CONE);
ctx.closePath();

// Gradient fill for zone falloff
const grad = ctx.createRadialGradient(
    playerScreenX, playerScreenY, 0,
    playerScreenX, playerScreenY, coneRange
);
grad.addColorStop(0, 'rgba(0,0,0,1)');      // clear zone: fully cut out
grad.addColorStop(0.4, 'rgba(0,0,0,0.85)'); // hazy zone begins
grad.addColorStop(0.73, 'rgba(0,0,0,0.4)'); // edge zone begins
grad.addColorStop(1.0, 'rgba(0,0,0,0)');    // fade to nothing at edge
ctx.fillStyle = grad;
ctx.fill();
ctx.restore();
```

#### Entity Rendering Within Cone

**Player bot (always visible):**
- Centered at bottom-center of the vision canvas
- Drawn as the standard v11 ellipse with eyes
- Directional arrow replaced by the cone itself
- Subtle green glow beneath (radial gradient, radius 30px)

**Other bots — detection stages:**

| Stage | Trigger | Visual |
|-------|---------|--------|
| **Unknown** | Outside cone | Not rendered at all |
| **Edge contact** | In edge zone (220–300u) | Dark silhouette shape, no color. Faint outline pulse. Label: "?" |
| **Detected** | In hazy zone (120–220u) | Shape visible with tinted color (desaturated). Heat-signature overlay: inner glow in orange-red, stronger for higher attack. Label: "Bot #N" |
| **Identified** | In clear zone (0–120u) | Full v11 rendering. Stat comparison badge appears (▲ stronger / ▼ weaker / = even). Combat advantage shown as small arc meter |

**Food dots:**
- In clear zone: standard yellow dot with soft glow
- In hazy zone: faint warm pulse (visible through mild fog)
- In edge zone: barely visible amber flicker
- Outside cone: invisible — but if within 50u of cone edge, a faint "peripheral glow" bleeds into the fog (player can sense nearby food just outside their view)

#### Heading Indicator

A subtle compass heading at the top of the vision canvas:
```
         N
    NW       NE
         ▼ (current heading marker)
```
Rendered as faint text with only the current heading direction highlighted.

### Tactical Strip — Bottom 35%

Three panels in a horizontal bar, separated by 1px gunmetal dividers.

#### Panel 1: Minimap (20% width)

- Circular minimap (like a radar scope), 120px diameter
- Dark background with faint grid
- Player bot: bright green dot at center
- Other bots: colored dots (red = hostile, blue = neutral)
- Only shows bots that have been **detected** in the current or recent frames (memory decay: bot stays on minimap for 3 seconds after leaving cone, then fades)
- Food: tiny yellow dots (always visible on minimap — represents general awareness)
- Vision cone: drawn as a translucent green wedge from center
- Field boundary: faint circle/rectangle outline

#### Panel 2: Stat Bars (40% width)

- Vertical stack of 4 stat bars (Speed, Attack, Defence, Lives)
- Each bar: label | filled portion | numeric value
- Colors match v11 stat colors (cyan, red, indigo, green)
- Stat changes animate: bar fills smoothly, "+0.1" floats up briefly
- Below stats: current strategy label in a pill badge

#### Panel 3: Threat Feed (40% width)

A scrolling log of detected events, newest at top, max 6 visible:

```
▲ Bot#7 「Hunter」 NE 120u — STRONGER
▲ Bot#3 「Gatherer」 SW 200u — weaker  
● Food ×3 cluster N 80u
▼ Bot#7 lost — left cone 2s ago
✦ Bot#12 eliminated by Bot#3 (heard)
```

- `▲` = threat (bot detected, hostile)
- `●` = resource (food)
- `▼` = lost contact
- `✦` = event (combat sounds — when combat occurs within 400u but outside cone, player "hears" it)

Each entry fades after 8 seconds.

### Status Bar — Bottom Edge

Single-line bar with:
- Current strategy mode pill: `[STEALTH]` / `[HUNTING]` / `[GATHERING]`
- Kill count
- Generation
- Elapsed time
- If in danger (enemy in clear zone + stronger): bar pulses red

## Interaction & Controls

| Key | Action |
|-----|--------|
| **TAB** | Cycle player bot (if multiple player-controlled bots via offspring) |
| **M** | Toggle minimap between circular and rectangular |
| **F** | Expand/collapse threat feed |
| **C** | Toggle cone visualization (show exact cone lines or soft blend) |
| **1–3** | Zoom: 1=tight (200u range), 2=standard (300u), 3=wide (400u, cone detail drops) |
| **SPACE** | Pause game with full-screen freeze overlay |

## Combat Visualization

When an enemy enters the clear zone and combat begins:

1. **Lock-on:** Red brackets snap around the enemy. A thin red line connects player to target. Stat comparison panel appears between them.

2. **Engagement:** 
   - Cone narrows to 80° (tunnel vision during combat)
   - Screen edges get a subtle red vignette
   - Impact flashes at contact point
   - Damage numbers float from both bots

3. **Kill (player wins):**
   - Enemy silhouette collapses (shrinks to point)
   - Brief green flash
   - "+1 ATK" or similar floats up
   - Cone returns to 120°

4. **Kill (player dies):**
   - Vision cone rapidly shrinks to 0° (closing eyes)
   - Screen goes to fog color
   - "RESPAWNING..." text fades in
   - Cone reopens at new spawn location

## Audio Cues (Visual Substitute)

Since there's no audio, off-screen events are conveyed visually:

- **Off-screen combat (within 400u):** A faint ripple/pulse expands from the direction of combat on the fog boundary. The threat feed logs it.
- **Off-screen death:** Brief flicker in the fog in that direction.
- **Food spawn nearby (within 200u but outside cone):** Subtle warm glow bleeds from that direction.

## Performance Notes

- **Fog mask:** Single composite operation per frame, not per-pixel — use canvas compositing modes
- **Entity culling:** Only calculate rendering for entities within cone range + 50u buffer
- **Minimap:** Render every 3rd frame (20fps is fine for minimap)
- **Threat feed:** DOM elements with CSS transitions, not canvas-rendered

## What Makes This Unique

The Operative is the **information-restriction** concept. Unlike top-down views where you see everything, here you must physically turn to look. The tension comes from blind spots — you *know* bots are out there, but you can't see them. The minimap offers a safety net but with limited fidelity. The result is a stealth-game feeling applied to the bot simulation.

## Map Integration

**Has both POV and overview?** Yes — the minimap provides a compressed full-field view while the main canvas is pure POV. The minimap intentionally has reduced information (no stat details, delayed updates) to prevent it from replacing the main view.

**Potential enhancement:** Add a toggle (key `O`) for a full-screen semi-transparent overview overlay — pauses the game and shows a top-down map with all detected entities marked, like an "intel briefing" screen.
