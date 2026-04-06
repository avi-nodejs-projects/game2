# v11.2 — "The War Room" Design Document

## Vision
Transform the single-camera observer experience into a multi-panel strategic command center. Four synchronized views show the simulation from different analytical perspectives — tactical field, relationship web, population timeline, and auto-directed battle camera.

## Layout

```
┌──────────────────────────────┬────────────────────┐
│                              │                    │
│      MAIN TACTICAL VIEW      │  RELATIONSHIP WEB  │
│          (60% width)         │    (40% width)     │
│          (55% height)        │    (55% height)    │
│                              │                    │
├──────────────────────────────┼────────────────────┤
│     POPULATION TIMELINE      │    BATTLE CAM      │
│          (60% width)         │    (40% width)     │
│          (45% height)        │    (45% height)    │
└──────────────────────────────┴────────────────────┘
```

Each panel is a separate `<canvas>` element within a CSS grid layout. All share the same game state but render different visualizations.

### Panel Chrome
- Each panel has a title bar: dark glass background, panel name in small caps, minimize/maximize toggle
- Active panel (last clicked) has a brighter border (cyan accent)
- Panels are resizable via drag handles at borders (CSS resize + JS)
- Double-click a panel title to full-screen that panel (the others hide)
- Press `ESC` or double-click again to return to quad view

## Panel 1: Main Tactical View (Top-Left)

### Enhanced Field Rendering
Base: Same green field as v11, but with overlay layers:

#### Heat Map Layer (toggle with `H` key)
- Subdivide the world into a 20x20 grid (100x100 unit cells)
- Track events per cell: combat count, dot consumption count, bot deaths
- Render as a semi-transparent color overlay:
  - Combat heat: red channel, opacity proportional to combat density
  - Resource heat: green channel, opacity proportional to food consumption
  - Death zones: purple tint where bots frequently die
- Heat map decays over time (multiply by 0.98 per second) — shows recent activity, not historical

#### Threat Ranges (toggle with `T` key)
- Show each bot's "awareness radius" as a faint circle
- Color coded: red for hostile intent (hunting), green for gathering, yellow for fleeing
- Only shown for bots near the camera's view center (performance)

#### Pack Territories (always on when packs enabled)
- Convex hull around pack members, filled with pack color at 10% opacity
- Territory radius shown as a dashed circle around the pack center
- Contested zones (overlapping territories) highlighted in red

#### Bot Enhancement
- Health bar above each bot (thin, color-coded: green > yellow > red)
- Small strategy icon badge (G/H/S/O/A) below bot for NPC strategy type
- Player bot has a pulsing selection ring
- Targeted bot (by player) has a crosshair indicator

#### Interaction
- Click a bot in this view to:
  1. Follow it with the camera
  2. Highlight it in the relationship web (Panel 2)
  3. Show its stats in an inline tooltip
- Right-click the field to set a camera waypoint (camera smoothly pans there)
- Mouse wheel zooms in/out (adjust camera scale factor)
- Click food dot to see which bots are targeting it

### Minimap
- Stays in this panel's top-right corner
- Enhanced: shows heat map overlay at minimap scale
- Click minimap to jump camera

## Panel 2: Relationship Web (Top-Right)

### Force-Directed Graph
A real-time force-directed graph where:
- **Nodes** = living bots
- **Edges** = relationships (pack membership, parent-child, recent combat)

#### Node Rendering
- Circle size proportional to total stats (min 8px, max 30px)
- Fill color = strategy type (Gatherer green, Hunter red, etc.)
- Border color = pack color (white if no pack)
- Opacity = health (low lives = more transparent)
- Player bot: gold border, star symbol inside
- Dead bots: node shrinks and fades over 60 frames, then removed

#### Node Labels
- On hover: show bot index, strategy, key stats
- Always show: small index number inside node

#### Edge Types (visual encoding)
- **Pack bond**: Solid line, pack hue color, thickness 2px
- **Parent-child**: Dashed line, gold color, thickness 1px
- **Recent combat**: Dotted red line, fades over 5 seconds after combat
- **Mating proximity**: Thin pink line, only while in proximity

#### Force Simulation (runs each frame)
- Repulsion: All nodes repel each other (prevent overlap), force = 1/distance²
- Attraction: Connected nodes attract (pack members pulled together)
- Center gravity: Gentle pull toward canvas center (prevent drift)
- Damping: 0.9 per frame (prevents oscillation)
- Node positions updated each frame, edges redrawn

#### Interactions
- Drag nodes to reposition them
- Click a node to:
  1. Highlight that bot in the main tactical view
  2. Show detailed stats popup
  3. Flash all its connections

#### Events Animation
- New bot born: Node appears with a "pop" scale animation
- Bot dies: Node pulses red, shrinks, disappears
- Pack formed: New edges animate in with a glow effect
- Pack disbanded: Edges flash and dissolve
- Combat: Brief red pulse on both involved nodes

## Panel 3: Population Timeline (Bottom-Left)

### Live Scrolling Chart
A real-time chart that scrolls left as time progresses, showing the simulation's history.

#### X-Axis
- Time (in frames), labeled in seconds
- Visible window: last 600 frames (10 seconds) by default
- Scroll wheel on this panel zooms the time window (300 frames to 3600 frames)
- Can click-drag to scroll back in history (pauses auto-scroll, click "Live" button to resume)

#### Y-Axis (Primary): Population
- Stacked area chart of bot population by strategy type
- Colors match the strategy colors used in the relationship web
- Total population shown as a line on top

#### Y-Axis (Secondary): Average Stats
- Overlaid line charts for average speed, attack, defence, lives across all bots
- Use stat colors (cyan, red, indigo, green) with dashed lines
- Toggle each stat line on/off with legend clicks

#### Event Markers
- Vertical dashed lines at significant events:
  - Red: Bot death
  - Green: Bot birth (reproduction)
  - Blue: Pack formed/disbanded
  - Gold: Player bot event (kill, death, level up)
- Hover a marker to see event details in a tooltip

#### Data Tracking (new state in config.js)
```javascript
const timelineData = {
  frames: [],          // ring buffer of frame snapshots
  maxFrames: 3600,     // 1 minute of history
  snapshotInterval: 10 // record every 10 frames
};

// Each snapshot:
{
  frame: number,
  population: { total, gatherer, hunter, survivor, opportunist, aggressive, untyped },
  avgStats: { speed, attack, defence, lives },
  events: [{ type, description }]
}
```

#### Rendering
- Use a dedicated offscreen canvas for the chart
- Redraw only when new data arrives (every 10 frames, not every frame)
- Use anti-aliased line rendering for smooth curves
- Stacked areas rendered with semi-transparent fills

## Panel 4: Battle Cam (Bottom-Right)

### Auto-Director AI
An automated camera system that finds and shows the most interesting action.

#### Interest Scoring (evaluated every 30 frames)
Each potential "shot" gets a score:
- **Active combat**: 100 points (highest priority)
- **Imminent combat** (two bots approaching, distance < 100, closing): 70 points
- **Player bot in danger** (enemy approaching player, distance < 200): 90 points
- **Pack formation in progress** (proximity timer > 50%): 50 points
- **Reproduction in progress**: 60 points
- **Strongest bot activity**: 40 points
- **Most recent kill site**: 30 points (decays over 3 seconds)

The director picks the highest-scoring shot and smoothly transitions the camera to it.

#### Camera Behavior
- Independent camera state from Panel 1 (own x, y, zoom)
- Zoom level adjusts to frame the action:
  - Combat: Tight zoom (1.5x) — shows detail
  - Chase: Medium zoom (1.0x) — shows pursuer and prey
  - Wide: Default zoom (0.7x) — establishing shot
- Smooth camera transitions (lerp with 0.12 smoothing)
- When switching targets: brief ease-out/ease-in (don't hard cut)

#### Visual Enhancements (this panel only)
- **Vignette**: Dark edges to create a cinematic frame
- **Focus effect**: The featured bot(s) are rendered normally; background bots are slightly dimmed
- **Combat close-up**: During combat, slight slow-motion effect (skip rendering every other frame in this panel only — doesn't affect game logic)
- **Kill replay**: On kill, briefly flash back and replay the last 30 frames at 0.5x speed in this panel (while other panels continue normally). Show a "REPLAY" badge.

#### Info Overlay
- Bottom of panel: "Now watching: Bot #5 (Hunter) vs Bot #12 (Gatherer)"
- Shot type badge: "COMBAT" / "CHASE" / "TENSION" / "OVERVIEW"
- If nothing interesting: show "QUIET — Monitoring strongest bots" and slowly pan across the field

#### Fallback
- When no events score above 20: cycle between bots every 5 seconds with smooth transitions
- Prefer bots that haven't been featured recently (track last-featured frame per bot)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Full-screen Panel 1 (Tactical) |
| `2` | Full-screen Panel 2 (Relationship Web) |
| `3` | Full-screen Panel 3 (Timeline) |
| `4` | Full-screen Panel 4 (Battle Cam) |
| `ESC` | Return to quad view |
| `H` | Toggle heat map (Panel 1) |
| `T` | Toggle threat ranges (Panel 1) |
| `TAB` | Cycle followed bot (Panel 1) |
| `SPACE` | Toggle auto-follow (Panel 1) |
| `D` | Toggle debug panel |
| `L` | Toggle log panel |

## HUD Adjustments

- The v11 HUD panel is repositioned: it overlays Panel 1's bottom-left corner
- Sim controls bar spans the full width above all panels
- Event notifications appear in Panel 4 (the battle cam) instead of the main view
- Controls bar moves to below the grid

## Performance Considerations

- **4 canvases rendering simultaneously** is the main concern
- Panel 2 (force graph): Only recalculate forces every 3 frames. Only redraw nodes/edges that moved.
- Panel 3 (timeline): Only redraw every 10 frames (when new data arrives)
- Panel 4 (battle cam): Can share the same drawField/drawBot functions as Panel 1 but with different camera params
- Heat map: Calculate on a 20x20 grid (400 cells), update every 60 frames
- Force graph: O(n²) repulsion with 20 bots = 400 pair calculations per update — trivial
- Relationship web edges: Max ~60 edges (20 bots × 3 relationship types) — trivial
- Consider reducing bot count to 15 if frame rate drops below 30fps

## Files That Change (from v11 base)

| File | Changes |
|------|---------|
| `index.html` | Replace single `<canvas id="field">` with 4-panel grid layout, 4 canvas elements |
| `styles.css` | Grid layout for panels, panel chrome, panel title bars, resize handles |
| `js/main.js` | **Major rewrite** — 4 render loops (one per panel), new drawField/drawBots per panel, director AI, camera per panel |
| `js/config.js` | Add timeline data structures, heat map config, director scoring weights |
| `js/game.js` | Minor: add interest scoring hooks to Bot (combat proximity tracking) |
| `js/bot-render.js` | Minor: add health bar rendering, strategy badge, threat range circle |
| `js/debug.js` | Adjust positioning for panel layout |
| New: `js/panel-relationship.js` | Force-directed graph renderer |
| New: `js/panel-timeline.js` | Population timeline chart renderer |
| New: `js/panel-battlecam.js` | Auto-director AI and cinematic camera |
| Other JS files | Untouched (game logic identical) |
