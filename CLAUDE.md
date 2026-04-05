# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based bot simulation game called "Bots in a Field". Autonomous bot agents spawn in a bounded field, hunt for food (yellow dots), and engage in combat with each other. Bots have evolving stats (speed, attack, defence, lives) that increase through consumption and combat victories.

## Architecture

Six self-contained HTML files with embedded CSS and JavaScript (no build system, no dependencies):

- **bots.html** - Original top-down view with static 800x600 canvas (15 bots, 20 dots)
- **bots-3rd-person.html** - Third-person camera that follows a selected bot in a larger 2000x2000 world (20 bots, 50 dots)
- **bots-custom.html** - Pre-game setup screen for customizing player bot stats before starting, then follows the player's bot
- **bots-strategy.html** - Extended version with AI strategy configuration (presets: Tactician, Hunter, Gatherer, Survivor) plus risk/cluster sensitivity sliders
- **bots-strategy-v2.html** - Three-mode strategy system: Simple (behavior blending with weights), Advanced (ordered rule lists), Expert (visual finite state machine editor)
- **bots-strategy-v3.html** - Full implementation of STRATEGY-DESIGN.md phases 2-5: extended context variables (35+), configurable behavior parameters, rule templates, import/export, state entry/exit actions, transition priorities, and debug overlay

### Core Classes

- `YellowDot` - Food items that respawn when consumed
- `Bot` - Autonomous agents with AI targeting, movement, combat, and stat progression

### Bot AI System

**Simple AI** (non-player bots): Uses `pickNewTargetSimple()` - probability-based targeting where lower lives increases chance to seek dots.

**Strategy AI** (player bot in bots-strategy.html): Uses `pickNewTargetSmart()` with configurable behavior:
- `evaluateCombatAdvantage()` - Compares survivability between bots
- `findDotClusters()` - Groups nearby dots and scores clusters by density/distance
- When targeting clusters, bot seeks nearest dot within cluster (not cluster center), with clockwise-from-left tiebreaker for equidistant dots

**Three-Mode Strategy System** (v2/v3):
- **Simple Mode**: Behavior blending - enable behaviors (Gatherer, Hunter, Survivor, etc.) with weight sliders; bot randomly selects weighted behavior each decision cycle
- **Advanced Mode**: Rule lists (production system) - ordered IF-THEN rules evaluated top-to-bottom; first matching rule fires
- **Expert Mode**: Visual state machine editor - drag states, create transitions with conditions, define behavioral modes

**v3 Enhancements**:
- Extended context with 35+ variables (zones, relative power, enemy clusters, combat history)
- Configurable behavior parameters (expandable settings per behavior)
- Rule templates (Aggressive Hunter, Safe Gatherer, Balanced, Glass Cannon)
- Import/export JSON configurations
- State entry/exit actions and transition priorities
- Debug overlay with target line indicator and real-time context values

### Game Loop

All versions use `requestAnimationFrame` at 60 FPS: draw field → draw dots → process collisions → sort bots by Y (painter's algorithm) → update/draw bots

### Stat System

- **speed** - Movement rate (base 0.5 + speed × 0.2)
- **attack** - Damage dealt in combat
- **defence** - Damage reduction in combat
- **lives** - Health points; bot respawns with reset stats when depleted

Combat damage formula: `damage = opponent.attack / max(self.defence, 0.1)` (ensures bots always hurt each other)

Stat gains: Dots give +0.1 to random stat; combat victories give +1 to random stat (player bots have 50% chance to boost preferred stat instead).

## Running

Open any HTML file directly in a browser. No server or build step required.

### Controls (3rd-person views)

- **TAB** - Switch to next bot
- **SPACE** - Toggle auto-follow camera
- **D** - Toggle debug overlay (v3 only)
