# Two-Player Mode Implementation Plan

## Overview

Add a two-player mode where both players configure their bots side-by-side, then watch them compete in a split-screen simulation. Both bots exist in the same 2000x2000 world.

---

## Phase 1: Configuration State & Data Model

**Goal:** Extend config.js to support two independent player configurations.

### Changes to `js/config.js`

1. **Player Mode Toggle**
   ```javascript
   let gameMode = 'single'; // 'single' | 'two-player'
   ```

2. **Duplicate Player State**
   Create a `players` array or `player1`/`player2` objects containing:
   - `playerStats` (speed, attack, defence, lives)
   - `preferredBonusStat`
   - `strategyMode` ('simple', 'advanced', 'expert')
   - `behaviorWeights` (for simple mode)
   - `rules` (for advanced mode)
   - `states`, `transitions`, `currentStateId` (for expert mode)
   - `lifecycleOverrides` (if player overrides enabled)

   Suggested structure:
   ```javascript
   const playerConfigs = [
     {
       id: 1,
       name: 'Player 1',
       color: '#FFD700', // Gold
       stats: { speed: 5, attack: 5, defence: 5, lives: 3 },
       preferredBonusStat: 'speed',
       strategyMode: 'simple',
       behaviorWeights: { /* ... */ },
       rules: [ /* ... */ ],
       states: [ /* ... */ ],
       transitions: [ /* ... */ ],
       currentStateId: 'gathering'
     },
     {
       id: 2,
       name: 'Player 2',
       color: '#00CED1', // Turquoise
       stats: { speed: 5, attack: 5, defence: 5, lives: 3 },
       preferredBonusStat: 'speed',
       strategyMode: 'simple',
       behaviorWeights: { /* ... */ },
       rules: [ /* ... */ ],
       states: [ /* ... */ ],
       transitions: [ /* ... */ ],
       currentStateId: 'gathering'
     }
   ];
   ```

3. **Active Player Context**
   ```javascript
   let activePlayerConfig = 0; // Which player's config is being edited (for shared UI)
   ```

### Deliverables
- [ ] Add `gameMode` toggle state
- [ ] Create `playerConfigs` array with full structure
- [ ] Add `DEFAULT_PLAYER_CONFIG` template
- [ ] Add helper functions: `getPlayerConfig(index)`, `setPlayerConfig(index, config)`
- [ ] Ensure backwards compatibility (single-player still uses `playerStats` etc.)

---

## Phase 2: Side-by-Side Configuration UI

**Goal:** Split the setup screen into two columns, one per player.

### Changes to `index.html`

1. **Mode Selection Header**
   ```html
   <div class="mode-selector">
     <button class="mode-btn active" data-mode="single">1 Player</button>
     <button class="mode-btn" data-mode="two-player">2 Players</button>
   </div>
   ```

2. **Split Container Structure**
   ```html
   <div id="setup-container" class="single-player">
     <div id="player1-setup" class="player-setup">
       <h2>Player 1 <span class="player-color p1"></span></h2>
       <!-- Full tab structure: Stats, Strategy, Lifecycle -->
     </div>
     <div id="player2-setup" class="player-setup" style="display:none;">
       <h2>Player 2 <span class="player-color p2"></span></h2>
       <!-- Duplicate tab structure -->
     </div>
   </div>
   ```

3. **Shared Settings Tab**
   Keep Settings tab (NPC, logging, billboards) as a single shared section below the player columns, since these settings apply globally.

### Changes to `styles.css`

1. **Two-Column Layout**
   ```css
   #setup-container.two-player {
     display: grid;
     grid-template-columns: 1fr 1fr;
     gap: 20px;
   }

   .player-setup {
     border: 2px solid #333;
     border-radius: 8px;
     padding: 15px;
   }

   #player1-setup { border-color: #FFD700; }
   #player2-setup { border-color: #00CED1; }
   ```

2. **Compact Stats/Strategy Panels**
   Reduce padding and font sizes slightly to fit two columns.

3. **Responsive Behavior**
   Stack vertically on narrow screens.

### Changes to `js/ui.js`

1. **Duplicate UI Initialization**
   - `initStatsUI(playerIndex)` - binds to `#player{N}-stats-tab`
   - `renderBehaviorList(playerIndex)` - targets `#player{N}-behavior-list`
   - `renderRuleList(playerIndex)` - targets `#player{N}-rule-list`
   - `renderStateMachine(playerIndex)` - targets `#player{N}-state-canvas`

2. **Mode Toggle Handler**
   ```javascript
   function setGameMode(mode) {
     gameMode = mode;
     if (mode === 'two-player') {
       document.getElementById('player2-setup').style.display = 'block';
       document.getElementById('setup-container').classList.add('two-player');
     } else {
       document.getElementById('player2-setup').style.display = 'none';
       document.getElementById('setup-container').classList.remove('two-player');
     }
   }
   ```

3. **State Binding**
   All UI callbacks update `playerConfigs[playerIndex]` instead of global state.

### Deliverables
- [ ] Add mode selector buttons to HTML
- [ ] Create duplicate setup panels for P1/P2
- [ ] Add two-column CSS layout
- [ ] Refactor `initStatsUI`, `renderBehaviorList`, `renderRuleList`, `renderStateMachine` to accept `playerIndex`
- [ ] Wire mode toggle to show/hide P2 setup
- [ ] Move Settings tab outside player columns (shared)

---

## Phase 3: Game State for Two Players

**Goal:** Track and manage two player bots during simulation.

### Changes to `js/main.js`

1. **Dual Player Bot References**
   ```javascript
   let playerBots = [null, null]; // [player1Bot, player2Bot]
   ```

2. **Modified `startGame()`**
   ```javascript
   function startGame() {
     // ...existing setup...

     if (gameMode === 'two-player') {
       playerBots[0] = new Bot(0, true, 0); // playerIndex = 0
       playerBots[1] = new Bot(1, true, 1); // playerIndex = 1
       bots.push(playerBots[0], playerBots[1]);

       for (let i = 2; i < BOT_COUNT; i++) {
         bots.push(new Bot(i, false));
       }
     } else {
       playerBot = new Bot(0, true, 0);
       playerBots[0] = playerBot;
       bots.push(playerBot);
       // ...rest of NPCs...
     }
   }
   ```

### Changes to `js/game.js`

1. **Bot Constructor Enhancement**
   ```javascript
   class Bot {
     constructor(index, isPlayer, playerIndex = null) {
       this.isPlayer = isPlayer;
       this.playerIndex = playerIndex; // 0 or 1 for player bots, null for NPCs

       if (isPlayer && playerIndex !== null) {
         const config = playerConfigs[playerIndex];
         this.speed = config.stats.speed;
         // ...use config.strategyMode, config.behaviorWeights, etc.
       }
     }
   }
   ```

2. **Strategy Execution**
   Modify `pickTargetSimpleMode`, `pickTargetAdvancedMode`, `pickTargetExpertMode` to read from the bot's `playerIndex` configuration.

### Changes to `js/config.js`

1. **Helper to Get Bot's Config**
   ```javascript
   function getBotConfig(bot) {
     if (bot.isPlayer && bot.playerIndex !== null) {
       return playerConfigs[bot.playerIndex];
     }
     return null; // NPC
   }
   ```

### Deliverables
- [ ] Add `playerBots` array to main.js
- [ ] Modify Bot constructor to accept `playerIndex`
- [ ] Update all player-specific logic to use `getBotConfig(bot)`
- [ ] Ensure NPCs still work (playerIndex = null)
- [ ] Handle two player spawns at different positions

---

## Phase 4: Split-Screen Rendering

**Goal:** Display two viewports, each following a different player bot.

### Approach: Two Canvas Elements

Using two separate `<canvas>` elements is simpler than viewport clipping and allows independent WebGL contexts if needed later.

### Changes to `index.html`

```html
<div id="game-container">
  <canvas id="field1" class="game-canvas"></canvas>
  <canvas id="field2" class="game-canvas" style="display:none;"></canvas>
</div>
```

### Changes to `styles.css`

```css
#game-container {
  display: flex;
  width: 100%;
}

#game-container.two-player {
  gap: 4px;
}

#game-container.two-player .game-canvas {
  width: 50%;
}

.game-canvas {
  width: 100%;
}
```

### Changes to `js/main.js`

1. **Dual Canvas Setup**
   ```javascript
   let canvases = [null, null];
   let contexts = [null, null];
   let cameras = [
     { x: 0, y: 0, followBot: null, ... },
     { x: 0, y: 0, followBot: null, ... }
   ];
   ```

2. **Modified Init**
   ```javascript
   function init() {
     canvases[0] = document.getElementById('field1');
     canvases[1] = document.getElementById('field2');
     contexts[0] = canvases[0].getContext('2d');
     contexts[1] = canvases[1].getContext('2d');
     // ...
   }
   ```

3. **Modified Animation Loop**
   ```javascript
   function animate() {
     // Run game update once (shared world)
     runGameUpdate();

     if (gameMode === 'two-player') {
       // Render to both canvases
       renderViewport(0);
       renderViewport(1);
     } else {
       renderViewport(0);
     }

     requestAnimationFrame(animate);
   }

   function renderViewport(viewportIndex) {
     const canvas = canvases[viewportIndex];
     const ctx = contexts[viewportIndex];
     const camera = cameras[viewportIndex];

     updateCamera(camera);
     drawField(ctx, camera);
     drawBillboards(ctx, camera);
     // ...all drawing functions take ctx and camera as params
   }
   ```

4. **Drawing Functions Accept Context**
   Refactor all draw functions to accept `ctx` and `camera` parameters instead of using globals:
   - `drawField(ctx, camera)`
   - `drawMinimap(ctx, camera, highlightBotIndex)`
   - `drawWorldBoundary(ctx, camera)`
   - `YellowDot.draw(ctx, camera)`
   - `Bot.draw(ctx, camera, isFollowed)`

### Changes to `js/game.js`

1. **Drawing Methods Accept Parameters**
   ```javascript
   class Bot {
     draw(ctx, camera, isFollowed) {
       // Use passed ctx and camera instead of globals
     }
   }
   ```

### Deliverables
- [ ] Add second canvas to HTML
- [ ] Create `cameras` array with two camera objects
- [ ] Refactor all draw functions to accept `ctx` and `camera` parameters
- [ ] Create `renderViewport(index)` function
- [ ] Update animate loop for dual rendering
- [ ] Add player indicator on each viewport (P1/P2 label)

---

## Phase 5: Controls & HUD for Two Players

**Goal:** Separate controls and UI elements for each player viewport.

### Controls

| Key | Single Player | Two Player |
|-----|--------------|------------|
| TAB | Cycle all bots | P1: Cycle bots in left viewport |
| SHIFT+TAB | - | P2: Cycle bots in right viewport |
| SPACE | Toggle auto-follow | P1 viewport |
| SHIFT+SPACE | - | P2 viewport |
| D | Toggle debug | Shows debug for focused viewport |
| 1/2 | - | Focus P1/P2 viewport for keyboard |

### Changes to `js/main.js`

1. **Active Viewport Tracking**
   ```javascript
   let activeViewport = 0; // Which viewport has keyboard focus
   ```

2. **Keyboard Handler Updates**
   ```javascript
   if (e.key === 'Tab') {
     if (e.shiftKey && gameMode === 'two-player') {
       // P2 cycle
       cameras[1].followIndex = (cameras[1].followIndex + 1) % bots.length;
       cameras[1].followBot = bots[cameras[1].followIndex];
     } else {
       // P1 cycle
       cameras[0].followIndex = (cameras[0].followIndex + 1) % bots.length;
       cameras[0].followBot = bots[cameras[0].followIndex];
     }
   }
   ```

### HUD Elements Per Viewport

Each viewport gets:
- Stats display (top-left)
- Minimap (top-right) with own player highlighted
- Player label ("P1" / "P2") in corner

### Changes to `index.html`

```html
<div id="ui1" class="viewport-ui">
  <div class="player-label">P1</div>
  <div id="stats1"></div>
</div>
<div id="ui2" class="viewport-ui" style="display:none;">
  <div class="player-label">P2</div>
  <div id="stats2"></div>
</div>
```

### Deliverables
- [ ] Add `activeViewport` state
- [ ] Update keyboard handlers for two-player controls
- [ ] Duplicate UI elements for each viewport
- [ ] Add player labels (P1/P2) to viewports
- [ ] Per-viewport minimap with correct highlighting

---

## Phase 6: Debug & Logging for Two Players

**Goal:** Debug panel and logging work correctly with two players.

### Debug Panel

- Option to show debug for P1, P2, or both
- Toggle between viewports with 1/2 keys when debug is open

```html
<div id="debug-panel">
  <div class="debug-player-tabs">
    <button class="active" data-player="0">P1</button>
    <button data-player="1">P2</button>
  </div>
  <!-- ...existing debug content... -->
</div>
```

### Logging

- Log decisions for both player bots
- Tag each decision with `playerIndex`
- Separate logs or combined with player tag

```javascript
{
  playerIndex: 0, // or 1
  decisionNum: 42,
  // ...rest of decision data
}
```

### Deliverables
- [ ] Add player tabs to debug panel
- [ ] `updateDebugPanel(playerIndex)` function
- [ ] Logging includes `playerIndex` for player bot decisions
- [ ] Log panel shows which decisions are P1 vs P2

---

## Phase 7: Polish & Edge Cases

**Goal:** Handle all edge cases and add polish.

### Visual Differentiation

- **Player Markers**: P1 = ★ (gold), P2 = ◆ (turquoise)
- **Minimap**: Both players shown with distinct colors
- **Target Lines**: Color-coded per player

### Edge Cases

1. **Player Death/Respawn**
   - Camera continues following respawned player
   - Stats reset correctly per player config

2. **Player vs Player Combat**
   - Works like any bot-bot combat
   - Both players can kill each other

3. **One Player Eliminated**
   - If age/starvation removes a player permanently, that viewport shows "ELIMINATED" overlay
   - Other player continues

4. **Copy Strongest Bot**
   - Choose which player config to copy to
   - Modal: "Copy to P1 / P2 / Both"

### Import/Export

- Export includes both player configs
- Import can target P1, P2, or both
- Format:
  ```json
  {
    "version": "10.1",
    "gameMode": "two-player",
    "players": [
      { /* P1 config */ },
      { /* P2 config */ }
    ],
    "sharedSettings": { /* NPC, lifecycle, etc. */ }
  }
  ```

### Deliverables
- [ ] Distinct player markers (star vs diamond)
- [ ] Both players on minimap
- [ ] Handle player death gracefully
- [ ] P1 vs P2 combat works
- [ ] Updated import/export format
- [ ] "Copy to P1/P2" dialog

---

## File Change Summary

| File | Phase | Changes |
|------|-------|---------|
| `js/config.js` | 1, 3 | `gameMode`, `playerConfigs[]`, helper functions |
| `index.html` | 2, 4, 5 | Mode selector, dual setup panels, dual canvases, dual UIs |
| `styles.css` | 2, 4, 5 | Two-column layout, split-screen, viewport UIs |
| `js/ui.js` | 2 | Refactor for `playerIndex`, mode toggle handler |
| `js/game.js` | 3, 4 | Bot accepts `playerIndex`, draw methods accept ctx/camera |
| `js/main.js` | 3, 4, 5 | `playerBots[]`, dual cameras, dual render, keyboard updates |
| `js/debug.js` | 6 | Player tabs, per-player debug |
| `js/log.js` | 6 | `playerIndex` in decisions |

---

## Implementation Order

1. **Phase 1** (config state) - Foundation, no visible changes
2. **Phase 2** (setup UI) - Can test configuration UX
3. **Phase 3** (game state) - Two bots spawn, single view still works
4. **Phase 4** (split-screen) - Core visual feature
5. **Phase 5** (controls/HUD) - Playable two-player mode
6. **Phase 6** (debug/logging) - Developer experience
7. **Phase 7** (polish) - Edge cases and final touches

Each phase is independently testable. Phases 1-4 are the minimum viable two-player mode.

---

## Testing Checklist

### Phase 1
- [ ] Single-player mode still works unchanged
- [ ] `playerConfigs[0]` reflects P1 settings
- [ ] Defaults work correctly

### Phase 2
- [ ] Mode toggle shows/hides P2 column
- [ ] Both players can configure independently
- [ ] Stats allocation works for both
- [ ] All three strategy modes work for both

### Phase 3
- [ ] Two player bots spawn in two-player mode
- [ ] Each uses their own strategy configuration
- [ ] NPCs still work normally

### Phase 4
- [ ] Split-screen renders correctly
- [ ] Each camera follows its player
- [ ] Dots/bots render on both sides
- [ ] No z-fighting or rendering glitches

### Phase 5
- [ ] TAB cycles P1 view, SHIFT+TAB cycles P2 view
- [ ] SPACE toggles P1 auto-follow, SHIFT+SPACE for P2
- [ ] Stats display correct for each viewport

### Phase 6
- [ ] Debug shows correct player's state
- [ ] Logs identify which player made decisions

### Phase 7
- [ ] P1 vs P2 combat works
- [ ] Player death handled gracefully
- [ ] Import/export includes both players
- [ ] Visual markers are distinct

---

## Estimated Complexity

| Phase | Complexity | Key Risk |
|-------|------------|----------|
| 1 | Low | Breaking existing single-player |
| 2 | Medium | HTML structure gets complex |
| 3 | Medium | Bot constructor changes |
| 4 | High | Drawing function refactoring |
| 5 | Medium | Keyboard handling edge cases |
| 6 | Low | Straightforward extension |
| 7 | Medium | Many small edge cases |

**Total**: Significant refactoring, but each phase is incremental and testable.
