# Codebase Map Discussion

## Problem

When Claude Code works on tasks, it spends tokens exploring the codebase:
- Globbing to find files
- Grepping to find symbols
- Reading file headers to understand purpose

A pre-built map could reduce this overhead significantly.

## Proposed Solution: `codebase-map.json`

A single JSON file that captures file purposes, key exports, line ranges, and common task patterns.

### Example Structure

```json
{
  "version": "1.0",
  "lastUpdated": "2025-12-17",
  "files": {
    "js/config.js": {
      "purpose": "All game constants, settings, and shared state",
      "exports": {
        "constants": ["WORLD_WIDTH", "WORLD_HEIGHT", "BOT_COUNT", "DOT_COUNT"],
        "state": ["playerStats", "strategyMode", "debugMode"],
        "settings": ["globalSettings", "npcSettings", "simulationSettings", "lifecycleSettings"]
      },
      "lineRanges": {
        "GAME_CONSTANTS": [3, 17],
        "PLAYER_STATS": [19, 28],
        "NPC_SETTINGS": [61, 88],
        "BEHAVIOR_DEFINITIONS": [150, 250]
      }
    },
    "js/game.js": {
      "purpose": "Core game entities - YellowDot and Bot classes",
      "classes": {
        "YellowDot": { "line": 4, "methods": ["respawn", "draw"] },
        "Bot": { "line": 41, "methods": ["initializeStats", "pickNewTargetSimple", "pickTargetSimpleMode", "pickTargetAdvancedMode", "pickTargetExpertMode", "getContext", "update", "draw"] }
      }
    }
  },
  "taskPatterns": {
    "add_new_behavior": ["js/config.js:BEHAVIOR_DEFINITIONS", "js/game.js:pickTargetSimpleMode", "js/ui.js:renderSimpleMode"],
    "modify_combat": ["js/game.js:update", "js/main.js:handleCollisions"],
    "add_lifecycle_feature": ["js/config.js:lifecycleSettings", "js/lifecycle.js"],
    "change_ui": ["js/ui.js", "styles.css", "index.html"]
  }
}
```

## Benefits

| Without Map | With Map |
|-------------|----------|
| Glob to find files | Direct lookup |
| Grep for symbols | Line number jumps |
| Read file headers to understand purpose | Instant context |
| ~500-1000 tokens exploring | ~100 tokens reading map |

## Trade-offs

### Maintenance Burden

The map needs updating when code changes significantly. Options:

1. **Manual** - Update after major refactors
2. **Semi-automated** - Claude can regenerate sections on request
3. **Automated** - A script that extracts class/function names (simple AST parsing)

### Granularity

- Too detailed = large file, stale quickly
- Too sparse = not useful
- For ~12 file codebase: file-level + key symbols is the sweet spot

## Next Steps (Choose One)

1. **Generate a full `codebase-map.json`** for this project
2. **Create a script** that can regenerate parts of it automatically
3. **Discuss the structure further** before committing to a format

## Open Questions

- Should line numbers be included? (Useful but can go stale)
- Should the map include dependencies between files?
- Should task patterns be expanded with more common operations?
- Would multiple smaller maps (per-module) work better than one large file?
