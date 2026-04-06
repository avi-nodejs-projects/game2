# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

v11.3 "The Arena" — a cinematic spectacle visual variant for "Bots in a Field". Built on v11 (same game logic), this version adds dramatic visual effects: procedural terrain with wear maps and scorch marks, dynamic day/night sky cycle, power auras, equipment effects (speed trails, attack wisps, defence shimmer), expressive bot eyes, breathing animations, combat particle effects (sparks, shatter, damage numbers), screen shake, freeze frames on kills, kill banners, director camera mode (C key), tension lines between approaching bots, off-screen danger indicators, and a kill feed. Tactical console design theme (cyan/amber accents), glassmorphism cards.

## Architecture

Unlike previous versions (single HTML files), v9 splits code into separate modules:

```
bots-strategy-v9/
├── index.html          # HTML structure, tabs, setup UI
├── styles.css          # All styling
├── js/
│   ├── config.js       # Constants, state, behavior/rule definitions, lifecycleSettings, billboardSettings
│   ├── log.js          # Simulation logging and output
│   ├── billboards.js   # Billboard system (ads near dot clusters)
│   ├── game.js         # YellowDot and Bot classes, AI logic
│   ├── ui.js           # Setup UI, tab navigation, strategy editors
│   ├── debug.js        # Debug panel and target line overlay
│   ├── main.js         # Game loop, camera, collision, initialization
│   ├── lifecycle.js    # Lifecycle logic (starvation, age, invincibility)
│   ├── reproduction.js # Reproduction logic (asexual/sexual, offspring)
│   ├── relationships.js # Parent/child tracking, protection system
│   ├── packs.js        # Pack formation, management, territory
│   └── corpse.js       # Corpse class and management
└── log-analysis/       # Exported simulation logs and parsed decision files
```

### Module Responsibilities

**config.js** - All game configuration and shared state:
- World/bot/dot constants
- Player stats and global settings
- Behavior definitions (Gatherer, Cluster Farmer, Hunter, Opportunist, Survivor, Avenger)
- Rule system definitions (SUBJECTS, OPERATORS, ACTIONS)
- Rule templates and condition presets
- State machine definitions and transitions
- NPC settings (random stats, death penalty, evolution, random strategy)
- NPC strategy templates (gatherer, hunter, survivor, opportunist, aggressive)
- Lifecycle settings (respawn invincibility, starvation, age, reproduction, packs)
- Billboard settings (spawn rate, duration, dimensions, cluster proximity)

**billboards.js** - Advertisement billboard system:
- `Billboard` class - temporary visual elements near dot clusters
- Brand logos (BotCola, iDot, McBots, BotBucks, Amazbot, BotFlix, Googbot, NikBot, BotKing, RedBot)
- Billboard spawning near dot clusters with configurable proximity
- Fade in/out animations and depth-sorted rendering

**game.js** - Core game entities:
- `YellowDot` class - food items with respawn
- `Bot` class - AI agents with all targeting strategies:
  - `pickNewTargetSimple()` - non-player AI (NPCs can also use strategy templates when enabled)
  - `pickTargetSimpleMode()` - weighted behavior blending
  - `pickTargetAdvancedMode()` - production rule system
  - `pickTargetExpertMode()` - finite state machine
  - `getContext()` - generates 35+ context variables for rule evaluation
  - NPC stat management: `generateRandomStats()`, `assignRandomStrategy()`

**ui.js** - Strategy configuration interfaces:
- Stats allocation UI
- Simple mode: behavior toggles and weight sliders with expandable params
- Advanced mode: drag-drop rule list with condition editor
- Expert mode: visual FSM canvas with state/transition editing
- Import/export configuration

**debug.js** - Runtime debugging:
- Debug panel showing current state, last decision, context values
- Target line visualization (color-coded by action type)

**main.js** - Game runtime:
- Canvas setup and camera system (auto-follow player bot)
- World-to-screen coordinate conversion with perspective scaling
- Collision detection and combat resolution
- Game loop via requestAnimationFrame
- Minimap rendering

**lifecycle.js** - Lifecycle mechanics:
- Respawn invincibility (configurable duration, visual pulse, breaks on combat initiation)
- Starvation system (inactivity tracking, life/stat decay, reset on food/combat)
- Age tracking (frame-based aging, visual decay, death behavior)

**reproduction.js** - Bot reproduction:
- Asexual reproduction (maturity threshold, life cost, offspring spawning)
- Sexual reproduction (proximity detection, compatibility, dual inheritance)
- Strategy inheritance (blend, randomParent, dominant methods with noise/mutation)

**relationships.js** - Family and protection:
- Parent/child relationship tracking
- Offspring protection (configurable duration, generations, bidirectional)
- Lineage tracking for player bot descendants

**packs.js** - Pack mechanics:
- Pack formation (strategy similarity, proximity detection)
- Pack management (max size, leadership, disband conditions)
- Territory system (claiming, defense modes, positioning preferences)
- Cannibalism (trigger conditions, target selection)

**corpse.js** - Corpse entities:
- `Corpse` class - inert food objects from dead bots
- Corpse management (creation, expiration, consumption)
- Nutrition value and pack interaction rules

### Three Strategy Modes

1. **Simple Mode**: Enable behaviors with weight sliders. Each decision cycle, bot randomly picks a behavior weighted by slider values. Each behavior has configurable parameters.

2. **Advanced Mode**: Ordered IF-THEN rules evaluated top-to-bottom. First rule with all conditions satisfied fires. Supports condition presets and templates.

3. **Expert Mode**: Visual state machine editor. States have behaviors plus entry/exit actions. Transitions have conditions and priorities.

### Lifecycle System

The lifecycle system adds biological mechanics to bot behavior (all features configurable, disabled by default):

**Respawn Invincibility**
- Newly respawned bots are untouchable for configurable frames (default 180 = 3 seconds)
- Cannot deal damage while invincible
- Invincibility breaks if bot initiates combat
- Visual: pulsing white/golden outline

**Starvation**
- Bots that don't eat dots or win battles for a period lose lives over time
- Resets on: eating a dot, dealing damage in combat, or getting a kill
- Scaling: larger bots (more total stats) starve faster
- Stat decay: reduces random stat while starving
- Starving bots leave their pack at 50% threshold

**Age**
- Frame-based aging (default max: 36000 frames = 10 minutes)
- Visual decay starts at 80% of max age (gradual desaturation)
- Death behavior: bot becomes a corpse (stationary food source)
- Corpse: 20% saturation, 70% opacity, provides 2.0 stat points when eaten

**Reproduction - Asexual**
- Mature bots (default: 1800 frames = 30 seconds) can spawn offspring
- Parent loses 50% of lives to offspring
- Offspring spawns near parent with invincibility protection
- Stats inherited with ±10% noise
- 15-second cooldown between reproductions

**Reproduction - Sexual**
- Two compatible bots in proximity (60 units) for 3 seconds can reproduce
- Compatibility based on strategy similarity (threshold 0.5)
- Pack members 2x more likely to reproduce
- Stats averaged from both parents with noise
- 20-second cooldown

**Offspring Protection**
- 5 seconds of mutual non-aggression between parent and offspring
- Configurable generation depth (default 1 = parent/child only)
- Bidirectional protection

**Packs**
- Formed when bots with similar Simple mode strategies stay near each other
- Advanced/Expert bots treated as "loners" (cannot form packs)
- Visual: colored ring around pack members (unique hue per pack)
- Max size: 5 (configurable)
- Optional leadership (strongest/oldest/founder)
- Disband on member respawn or starvation

**Territory**
- Packs can claim territory and defend against outsiders
- Defense modes: 'always', 'whenSettled' (after 2 seconds), 'whenStationary'
- Positioning prefers dot clusters, avoids enemy clusters

**Cannibalism**
- Starving pack members may attack their own pack
- Targets weakest member by default
- Configurable triggers and target selection

**Player Bot Offspring Indicators**
- Player bot: ★ (solid gold star)
- Generation 1 child: ☆ (gold outline)
- Generation 2: ☆ (silver outline)
- Generation 3+: ☆ (bronze outline)

### Key Formulas

- Movement speed: `0.5 + speed * 0.2`
- Combat damage (two-tier system):
  - **Primary**: `damage = opponent.attack - self.defence` (high defence can fully block weak attacks)
  - **Stalemate breaker**: If both bots would take no damage (both have defence ≥ opponent's attack), use `damage = opponent.attack / max(self.defence, 0.1)` and respawn both bots at random positions
- Combat advantage: `ourSurvivability - theirSurvivability` where survivability = `lives / (incomingDamage + 0.1)`

## Running

Open `index.html` directly in a browser. No build step required.

## Controls (during simulation)

- **TAB** - Cycle through bots
- **SPACE** - Toggle auto-follow camera
- **D** - Toggle debug panel
- **L** - Toggle log panel
- **P** - Pause/resume simulation

## Simulation Logging

The logging system captures machine-parseable output for algorithm verification:

### Log Output Format

```
LOG_VERSION:4.0
TIMESTAMP:<ISO timestamp>
MODE:<simple|advanced|expert>
MAX_DECISIONS:<number>
---CONFIG_START---
<JSON config object>
---CONFIG_END---
---STRATEGY_START---
<JSON strategy object>
---STRATEGY_END---
---INITIAL_STATE_START---
<JSON initial state with all bot/dot positions>
---INITIAL_STATE_END---
---DECISIONS_START---
D:<JSON decision object per line>
---DECISIONS_END---
---EVENTS_START---
E:<JSON event object per line>
---EVENTS_END---
---FINAL_STATE_START---
<JSON final state>
---FINAL_STATE_END---
```

### Decision Object Structure

Each decision logged includes:
- `decisionNum`: Sequential decision number
- `frame`: Frame when decision was made
- `botIndex`: Bot making the decision
- `isPlayer`: Whether this is the player's bot
- `position`: {x, y} of bot
- `action`: Action taken (gather, hunt, flee, etc.)
- `reason`: Why this action was chosen (RULE:0, BEHAVIOR:gatherer, FSM_STATE:gathering, etc.)
- `target`: {x, y} target position
- `context`: Relevant context values at decision time
- `worldState`: Snapshot of all bot/dot positions

### Lifecycle Event Types

The logging system captures lifecycle-related events:
- `INVINCIBILITY_START/END` - Respawn protection
- `STARVATION_TICK/RESET` - Starvation damage and recovery
- `AGE_DEATH`, `CORPSE_CONSUMED`, `CORPSE_EXPIRED` - Age and corpse events
- `REPRODUCTION_ASEXUAL/SEXUAL` - Offspring creation
- `PROTECTION_STARTED/ENDED` - Family protection
- `PACK_FORMED/JOINED/LEFT/DISBANDED` - Pack membership
- `PACK_TERRITORY_CLAIMED`, `PACK_INTRUDER_DETECTED` - Territory events
- `CANNIBALISM` - Intra-pack predation

### Settings

In Settings tab > Simulation Logging:
- **Max Decisions**: Stop simulation after N decisions (0 = unlimited)
- **Enable Logging**: Toggle logging on/off
- **Log All Bots**: Log decisions from all bots (not just player)
- **Pause on Complete**: Auto-pause when max decisions reached

### NPC Configuration

NPCs can be configured with several optional systems (disabled by default):
- **Random Stats**: Distribute total points randomly across stats with minimums
- **Death Penalty**: Lose stats on death instead of full reset
- **Evolution**: Inherit stats from killer when respawning
- **Random Strategy**: NPCs use pre-defined strategy templates (gatherer, hunter, survivor, opportunist, aggressive)

### Billboard Configuration

In Settings tab > Billboards:
- **Enable Billboards**: Toggle billboard system on/off
- **Max Billboards**: Maximum number of billboards on screen (1-20)
- **Spawn Chance**: Probability per frame to spawn new billboard (0.001-0.020)
- **Min/Max Duration**: How long billboards stay visible (in frames, 300=5s, 900=15s)
- **Cluster Proximity Radius**: How close billboards spawn to dot clusters
- **Min Cluster Size**: Minimum dots needed in cluster to place billboard
- **Board Width/Height**: Billboard panel dimensions
- **Pole Height**: Height of billboard support pole

Billboards are purely decorative and spawn near dot clusters to add visual interest.

## UI Structure

Tab layout: `[Stats] [Strategy] [Lifecycle] [Settings]`

The **Strategy tab** has three mode sub-tabs: Simple, Advanced, Expert.

The **Lifecycle tab** has collapsible sections for each feature:
1. Respawn Invincibility - duration, visual effect, combat behavior
2. Starvation - threshold, damage, reset conditions, scaling, stat decay
3. Age - max age, visual decay, death behavior, corpse settings
4. Reproduction - asexual and sexual sub-sections with all parameters
5. Packs - formation, size, bonds, leadership, territory, cannibalism
6. Player Overrides - per-feature overrides for player bot

The **Settings tab** contains:
1. Global AI Settings - re-evaluation rate, behavior switch cooldown, randomness noise
2. Emergency Override - low-health behavior override
3. NPC Bot Settings - random stats, death penalty, evolution, random strategies
4. Import/Export Configuration - save/load strategy configs as JSON
5. Simulation Logging - decision logging for algorithm verification
6. Billboards - visual advertisement system configuration

## Codebase Map

A machine-readable map of the codebase is available in `codebase-map.json`. It contains:
- File purposes and exports
- Task patterns (which files to modify for common operations)
- File dependencies

### Instructions for Claude

**Before exploring the codebase**, read `codebase-map.json` first to:
1. Look up which files handle the feature being modified (check `taskPatterns`)
2. Identify function/class names to search for (check `files[].exports`)
3. Understand impact of changes (check `dependencies`)

**When implementing a task:**
1. Check if a matching `taskPattern` exists - if so, follow its file list
2. Use `exports` to jump directly to relevant functions instead of grepping
3. Check `dependencies.importedBy` to find files that may need updates

**After significant changes:**
- If you added a new file, add it to the map
- If you added new exports to a file, update that file's entry
- If you created a new common task pattern, add it to `taskPatterns`

**Do NOT:**
- Blindly trust line numbers (they go stale) - the map intentionally omits them
- Skip reading the map to "explore" - the map exists to reduce token usage

### Code Map Prompts

Use these prompts when working with the codebase map:

**Discovery & Navigation**
- `"List code map prompts"` - Show this list of available prompts
- `"What files handle [feature]?"` - Find files related to a feature (e.g., "combat", "reproduction")
- `"Show dependencies for [file]"` - Show what imports/is imported by a file
- `"What exports does [file] have?"` - List functions/classes in a file

**Task Planning**
- `"How do I add a new behavior?"` - Get the task pattern for adding behaviors
- `"How do I add a lifecycle feature?"` - Get the task pattern for lifecycle additions
- `"What's the task pattern for [task]?"` - Look up any task pattern from the map
- `"Plan implementation for [feature]"` - Get file list and approach for a feature

**Map Maintenance**
- `"Update the codebase map"` - Regenerate the entire map from current source
- `"Add [file] to the codebase map"` - Add a new file's exports to the map
- `"Add task pattern for [task]"` - Define a new task pattern
- `"Verify codebase map accuracy"` - Check if map matches actual file contents

**Analysis**
- `"Which files would change if I modify [file]?"` - Impact analysis using dependencies
- `"What's the most connected file?"` - Find central files in the codebase
- `"Show all task patterns"` - List all predefined task patterns
