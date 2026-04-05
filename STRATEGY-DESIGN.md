# Bot Strategy System Design Document

This document outlines the complete strategy system design for "Bots in a Field", including the implemented features in `bots-strategy-v2.html` and future enhancements.

---

## Overview

The strategy system allows users to customize bot AI behavior at three complexity levels:

| Mode | Target User | Description |
|------|-------------|-------------|
| **Simple** | Casual players | Blend preset behaviors with weight sliders |
| **Advanced** | Power users | Build ordered rule lists with conditions |
| **Expert** | AI enthusiasts | Visual finite state machine editor |

---

## Implemented Features (v2)

### Simple Mode: Behavior Blending

Users enable/disable atomic behaviors and assign weights. Each decision cycle, the bot randomly selects a behavior weighted by the assigned percentages.

**Available Behaviors:**

| Behavior | Description | Default |
|----------|-------------|---------|
| Gatherer | Seeks nearest food dot | Enabled, 50% |
| Cluster Farmer | Seeks dense clusters of dots | Enabled, 30% |
| Hunter | Seeks combat with enemies | Disabled, 20% |
| Opportunist | Seeks safe dots (far from enemies) | Disabled, 40% |
| Survivor | Avoids danger when health is low | Disabled, 60% |
| Avenger | Pursues enemies that recently attacked | Disabled, 30% |

### Advanced Mode: Rule List (Production System)

An ordered list of IF-THEN rules. Rules are evaluated top-to-bottom; the first matching rule fires.

**Available Subjects (Conditions):**

| Subject | Description |
|---------|-------------|
| `my.lives` | Bot's current lives |
| `my.attack` | Bot's attack stat |
| `my.defence` | Bot's defence stat |
| `my.speed` | Bot's speed stat |
| `my.health_percent` | Current health as percentage of initial |
| `nearest_enemy.distance` | Distance to closest enemy |
| `nearest_enemy.lives` | Lives of closest enemy |
| `nearest_enemy.attack` | Attack stat of closest enemy |
| `combat_advantage` | Calculated advantage vs nearest enemy |
| `nearest_dot.distance` | Distance to closest dot |
| `safe_dot_count` | Number of dots far from enemies |
| `best_cluster.size` | Dots in the best cluster |
| `best_cluster.distance` | Distance to best cluster |
| `just_took_damage` | 1 if damaged recently, 0 otherwise |
| `nearby_enemy_count` | Enemies within 200px |

**Available Operators:** `<`, `<=`, `>`, `>=`, `=`, `!=`

**Available Actions:**

| Action | Description |
|--------|-------------|
| `flee` | Move away from nearest enemy |
| `hunt` | Move toward nearest enemy |
| `hunt_weak` | Move toward weakest enemy |
| `gather` | Move toward nearest dot |
| `gather_safe` | Move toward safest dot |
| `cluster` | Move toward best dot cluster |
| `wander` | Move to random location |

### Expert Mode: Visual State Machine

A visual editor for creating finite state machines. States represent behavioral modes; transitions define when to switch between them.

**Features:**
- Drag states to reposition
- Click to select and edit state properties
- Create transitions by selecting "Add Transition" tool and clicking two states
- Each state has an assigned behavior
- Transitions have conditions (same as rule conditions)

---

## Future Enhancements

### Additional Parameters to Implement

#### Target Evaluation Factors

```javascript
// Distance from yellow dots
'nearest_dot.distance'        // Already implemented
'dot_count_in_radius'         // Count of dots within configurable radius

// Distance from dot clusters
'best_cluster.size'           // Already implemented
'best_cluster.distance'       // Already implemented
'best_cluster.density'        // Dots per unit area
'best_cluster.radius'         // Spread of the cluster

// Distance from enemies
'nearest_enemy.distance'      // Already implemented
'weakest_enemy.distance'      // Distance to enemy with lowest lives
'strongest_enemy.distance'    // Distance to enemy with highest stats

// Distance from enemy clusters
'enemy_cluster.size'          // Number of enemies grouped together
'enemy_cluster.distance'      // Distance to nearest enemy group
'nearby_enemy_count'          // Already implemented
```

#### Safe Dot Evaluation

```javascript
// Configurable safety parameters
'safe_dot_count'              // Already implemented
'nearest_safe_dot.distance'   // Distance to nearest safe dot
'safety_radius'               // Configurable: min distance from enemies (default 150)
'dot_safety_score'            // Weighted score: distance from me vs distance from enemies
```

#### Map Position / Zones

```javascript
// 9-zone grid (3x3)
'my.zone'                     // Current zone (1-9, top-left to bottom-right)
'target.zone'                 // Zone of current target
'zone_dot_count[n]'           // Dots in zone n
'zone_enemy_count[n]'         // Enemies in zone n
'zone_safety[n]'              // Safety score for zone n
```

#### Combat History

```javascript
// Recent damage tracking
'just_took_damage'            // Already implemented
'just_dealt_damage'           // Did I damage an enemy last combat?
'frames_since_damage_taken'   // Time since last hit received
'frames_since_damage_dealt'   // Time since last hit dealt
'last_attacker.distance'      // Distance to bot that last hit me
'last_victim.distance'        // Distance to bot I last hit
'last_victim.lives'           // Lives of bot I last hit
```

#### Relative Stats

```javascript
'my.total_stats'              // Sum of all stats
'avg_bot_stats'               // Average total stats of all bots
'my.relative_power'           // my.total_stats / avg_bot_stats
'am_strongest'                // 1 if highest total stats, 0 otherwise
'am_weakest'                  // 1 if lowest total stats, 0 otherwise
```

---

### Advanced Behavior Settings

Each behavior could expose configurable parameters when expanded:

#### Gatherer
```javascript
{
  maxTargetDistance: Infinity,  // Ignore dots beyond this range
  recalculateFrequency: 30,     // Re-pick target every N frames
  tiebreaker: 'clockwise'       // 'random', 'clockwise', 'toward_center', 'away_from_enemy'
}
```

#### Cluster Farmer
```javascript
{
  clusterRadius: 150,           // Max distance between dots in cluster
  minClusterSize: 2,            // Minimum dots to qualify
  scoringFormula: 'density',    // 'density', 'total', 'density_over_distance'
  targetInCluster: 'nearest',   // 'nearest', 'center', 'safest'
  abandonThreshold: 1           // Leave when fewer than N dots remain
}
```

#### Hunter
```javascript
{
  minAdvantage: 0,              // Only engage if advantage >= N
  preferWounded: true,          // Prioritize low-health enemies
  woundedThreshold: 3,          // "Wounded" means lives <= N
  chaseDuration: 180,           // Max frames to pursue
  disengageThreshold: -2        // Flee if advantage drops below N
}
```

#### Opportunist
```javascript
{
  safetyRadius: 150,            // Min distance dot must be from enemies
  enemyThreatWeight: 1.0,       // Multiplier for stronger enemies
  fallbackBehavior: 'flee',     // If no safe dots: 'wait', 'nearest', 'flee', 'hunt'
  dynamicSafetyCheck: true      // Re-evaluate safety while moving
}
```

#### Survivor
```javascript
{
  activationThreshold: 3,       // Activate when lives <= N
  fleeDistance: 300,            // How far to run
  threatRadius: 200,            // Distance to consider enemy a threat
  threatCalculation: 'nearest', // 'nearest', 'strongest', 'weighted_sum'
  safeZoneSeeking: true,        // Move toward areas with fewer enemies
  corneredBehavior: 'fight'     // 'fight_weakest', 'fight_nearest', 'erratic'
}
```

#### Territorial
```javascript
{
  preferredZones: [5],          // Zone numbers (1-9) to favor
  zoneStickiness: 0.7,          // How strongly to stay (0-1)
  boundaryBehavior: 'soft',     // 'hard_stop', 'soft_preference', 'high_value_only'
  dynamicZones: true,           // Shift preference based on conditions
  homeBase: null                // { x, y } or null
}
```

#### Pack Hunter
```javascript
{
  clusterRadius: 200,           // Max distance between enemies in group
  minGroupSize: 2,              // Minimum enemies to qualify as pack
  engagementRule: 'weakest',    // 'weakest', 'nearest', 'most_isolated'
  requiredAdvantage: 1,         // Advantage needed vs weakest
  retreatTrigger: 4             // Disengage if group grows to N
}
```

#### Avenger
```javascript
{
  triggerConditions: ['took_damage'], // Array of triggers
  pursuitDuration: 180,         // Frames to maintain vendetta
  vengencePriority: 0.8,        // Weight vs other opportunities
  memorySlots: 3,               // Enemies to remember
  finishThreshold: 2,           // Only pursue if target has <= N lives
  abandonConditions: ['healed', 'fled'] // When to give up
}
```

---

### Global Advanced Settings

Apply across all behaviors:

```javascript
{
  reEvaluationRate: 30,         // Frames between target reconsideration
  behaviorSwitchCooldown: 15,   // Min frames before changing behaviors
  randomnessNoise: 0.1,         // 0-1, adds unpredictability
  lookahead: false,             // Predict target positions
  emergencyOverride: {
    enabled: true,
    livesThreshold: 2,
    forcedBehavior: 'survivor'
  },
  statScaling: {
    enabled: true,
    aggressionMultiplier: 1.0   // Scale with relative power
  }
}
```

---

### UI Enhancements

#### Behavior Card System (Simple Mode)

```
+--------------------------------------------------+
| [x] Cluster Farmer                    [====70%==] |
|     v Advanced                                    |
|     +------------------------------------------+  |
|     | Cluster radius:     [====150====]        |  |
|     | Min cluster size:   [==3==]              |  |
|     | Scoring: [Density / distance      v]     |  |
|     | Target:  [Nearest dot in cluster  v]     |  |
|     | Abandon when < [2] dots remain           |  |
|     +------------------------------------------+  |
+--------------------------------------------------+
| [x] Survivor                          [====30%==] |
|     > Advanced                                    |
+--------------------------------------------------+
| [+ Add Behavior]                                  |
+--------------------------------------------------+
```

#### Rule List Enhancements (Advanced Mode)

- **Rule Groups**: Group related rules with shared conditions
- **Rule Templates**: Pre-built rule sets users can import
- **Condition Presets**: Common condition combinations
- **Rule Testing**: Preview which rule would fire given current game state
- **Import/Export**: Save and share rule configurations as JSON

#### State Machine Enhancements (Expert Mode)

- **Hierarchical States**: Nested state machines
- **Parallel States**: Multiple simultaneous state layers
- **State Entry/Exit Actions**: Execute behavior on state changes
- **Transition Priorities**: Handle conflicting transitions
- **Visual Debugging**: Highlight active state during gameplay
- **Blackboard System**: Shared memory for complex decisions

---

### Data Structures

#### Rule Configuration
```javascript
const rule = {
  id: 'rule_1',
  name: 'Emergency Flee',
  enabled: true,
  conditions: [
    { subject: 'my.lives', operator: '<=', value: 2 },
    { subject: 'nearest_enemy.distance', operator: '<', value: 150 }
  ],
  conditionLogic: 'AND', // 'AND' or 'OR'
  action: 'flee',
  actionParams: {
    fleeDistance: 300
  },
  cooldown: 60,
  priority: 1
};
```

#### State Configuration
```javascript
const state = {
  id: 'gathering',
  name: 'Gathering',
  x: 150,  // UI position
  y: 150,
  behavior: 'cluster',
  behaviorParams: {
    minClusterSize: 3
  },
  entryAction: null,
  exitAction: null,
  isDefault: true
};
```

#### Transition Configuration
```javascript
const transition = {
  id: 'trans_1',
  from: 'gathering',
  to: 'fleeing',
  condition: {
    subject: 'my.lives',
    operator: '<=',
    value: 2
  },
  priority: 1,
  cooldown: 30
};
```

---

### Serialization Format

For saving/loading configurations:

```javascript
const strategyConfig = {
  version: '2.0',
  mode: 'advanced', // 'simple', 'advanced', 'expert'

  // Simple mode
  behaviors: {
    gatherer: { enabled: true, weight: 50, params: {} },
    hunter: { enabled: false, weight: 20, params: {} }
    // ...
  },

  // Advanced mode
  rules: [
    { conditions: [...], action: 'flee' },
    // ...
  ],

  // Expert mode
  stateMachine: {
    states: [...],
    transitions: [...],
    initialState: 'gathering'
  },

  // Global settings
  globalSettings: {
    reEvaluationRate: 30,
    emergencyOverride: { enabled: true, livesThreshold: 2 }
  }
};
```

---

### Implementation Priority

1. **Phase 1** (Current): Basic three-mode system
2. **Phase 2**: Advanced behavior parameters
3. **Phase 3**: Rule templates and import/export
4. **Phase 4**: Hierarchical state machines
5. **Phase 5**: AI debugging/visualization tools

---

## Technical Notes

### Performance Considerations

- Cache computed values (clusters, distances) per frame
- Limit rule evaluation to once per N frames
- Use spatial hashing for proximity queries in large worlds

### Testing Strategy

- Unit tests for condition evaluation
- Integration tests for complete decision cycles
- Visual debugging overlay showing bot decision-making

---

## References

- [Utility AI](https://www.gdcvault.com/play/1012410/Improving-AI-Decision-Modeling-Through) - GDC talk on utility-based AI
- [Behavior Trees](https://www.gamedeveloper.com/programming/behavior-trees-for-ai-how-they-work) - Classic game AI pattern
- [Finite State Machines in Games](https://gameprogrammingpatterns.com/state.html) - State pattern reference
