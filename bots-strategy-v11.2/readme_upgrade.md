# Bots Strategy v9 - Lifecycle Upgrade Design Document

This document captures all design decisions from the consultation for implementing lifecycle features: respawn invincibility, starvation, age, reproduction, and packs.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Implementation Phases](#implementation-phases)
3. [Configuration Schema](#configuration-schema)
4. [Design Decisions](#design-decisions)
5. [Visual Indicators](#visual-indicators)
6. [Event Logging](#event-logging)
7. [UI Structure](#ui-structure)
8. [File Structure](#file-structure)
9. [Data Structures](#data-structures)
10. [Notes](#notes)
11. [Corpse Clarification](#corpse-clarification)
12. [Future Considerations](#future-considerations)

---

## Feature Overview

### 1. Respawn Invincibility
Newly respawned bots are untouchable for a configurable number of frames. They cannot deal damage during this period. Invincibility breaks if the bot initiates combat.

### 2. Starvation
Bots that don't eat yellow dots or win battles for a configurable period lose lives over time. Starvation also causes stat decay. Resets when bot eats a dot or deals damage in combat.

### 3. Age
Bots age over time (frame count). When reaching max age, bots die and become corpses (food for others). Visual aging indicators appear as bots get old.

### 4. Reproduction - Asexual
Mature bots can spawn offspring. Parent loses half their lives. Offspring inherits parent's stats with noise. Parent and offspring have temporary mutual protection.

### 5. Reproduction - Sexual
Two compatible bots in prolonged proximity can produce offspring. Stats are averaged from both parents with noise. Strategy is blended from both parents.

### 6. Packs
Bots with similar strategies can form packs when near each other. Pack members share a target zone and can defend territory. Packs disband on member respawn or starvation.

### 7. Territory
Packs can claim territory and defend against outsiders. Territory positioning prefers dot clusters and avoids enemy clusters.

### 8. Cannibalism
Starving pack members may attack their own pack. Configurable trigger conditions and target selection.

---

## Implementation Phases

| Phase | Feature | Description | Complexity |
|-------|---------|-------------|------------|
| 1 | Respawn Invincibility | Invincibility frames, visual pulse, combat break | Low |
| 2 | Starvation | Inactivity tracking, life/stat decay | Low-Medium |
| 3 | Relationship Infrastructure | Parent/child tracking, protection system | Medium |
| 4 | Asexual Reproduction | Maturity, spawning, stat inheritance | Medium |
| 5 | Pack Formation | Similarity detection, pack creation, visual indicators | Medium-High |
| 6 | Sexual Reproduction | Proximity detection, dual inheritance, strategy blending | Medium |
| 7 | Age + Corpses | Aging, death, corpse food system | Medium |
| 8 | Pack Advanced | Territory, defense modes, cannibalism | High |

---

## Configuration Schema

```javascript
const lifecycleSettings = {

  // ===== RESPAWN INVINCIBILITY =====
  respawnInvincibility: {
    enabled: true,
    duration: 180,                    // 3 seconds at 60fps
    canDealDamage: false,
    breakOnCombatInitiation: true,
    visualEffect: 'pulse'             // 'pulse', 'flash', 'glow'
  },

  // ===== STARVATION =====
  starvation: {
    enabled: true,
    inactivityThreshold: 600,         // 10 seconds without food/combat
    damagePerTick: 0.5,
    tickInterval: 60,                 // damage every 1 second while starving

    resetConditions: {
      onDotEaten: true,
      onDamageDealt: true,            // attack > enemy.defence
      onKill: true
    },

    scaling: {
      enabled: true,
      factor: 0.1,                    // +10% faster per stat above baseline
      baselineStats: 18
    },

    statDecay: {
      enabled: true,
      decayPerTick: 0.1,
      minStats: { speed: 1, attack: 0, defence: 1, lives: 1 },
      order: 'random'                 // 'random', 'lowestFirst', 'highestFirst'
    }
  },

  // ===== AGE =====
  age: {
    enabled: false,
    maxAge: 36000,                    // 10 minutes at 60fps
    visualDecayStart: 0.8,            // show aging at 80% of max

    deathBehavior: 'corpse',          // 'remove', 'respawn', 'corpse'

    corpse: {
      nutritionValue: 2.0,            // stats gained when eaten
      duration: 600,                  // 10 seconds, 0 = until eaten
      saturationMultiplier: 0.2,
      opacity: 0.7
    },

    corpseInteraction: {
      nonPackMembers: 'food',
      packMembers: 'protected',       // 'protected', 'food', 'cannibalOnly'
      cannibalOverride: true
    }
  },

  // ===== REPRODUCTION =====
  reproduction: {

    asexual: {
      enabled: false,
      maturityMetric: 'frames',       // 'frames', 'stats', 'kills', 'hybrid'
      maturityThreshold: 1800,        // 30 seconds
      parentLifeCost: 0.5,            // fraction of lives to offspring
      statNoise: 0.1,                 // +/-10% variation
      cooldown: 900,                  // 15 seconds

      spawnLocation: 'nearParent',    // 'nearParent', 'random', 'parentDirection'
      spawnDistance: { min: 80, max: 150 }
    },

    sexual: {
      enabled: false,
      proximityDistance: 60,
      proximityDuration: 180,         // 3 seconds
      compatibilityThreshold: 0.5,    // strategy similarity required
      cooldown: 1200,                 // 20 seconds

      packBonus: {
        enabled: true,
        weight: 2.0                   // 2x more likely for pack members
      }
    },

    offspring: {
      protection: {
        duration: 300,                // 5 seconds
        generations: 1,               // 1 = parent/child, 2 = grandparent, etc.
        bidirectional: true
      }
    },

    strategyInheritance: {
      method: 'blend',                // 'blend', 'randomParent', 'dominant'
      noise: 0.15,
      mutationChance: 0.1
    }
  },

  // ===== PACKS =====
  packs: {
    enabled: false,

    formation: {
      similarityThreshold: 0.7,
      proximityDistance: 100,
      proximityDuration: 180          // 3 seconds
    },

    size: {
      max: 5,                         // 0 = unlimited
      overflowBehavior: 'reject'      // 'reject', 'kick'
    },

    bonds: {
      disbandOnRespawn: true,
      disbandOnStarvation: true,
      starvationDisbandThreshold: 0.5
    },

    leadership: {
      enabled: false,
      selection: 'strongest',         // 'strongest', 'oldest', 'founder'
      influence: 0.6
    },

    territory: {
      enabled: false,
      radius: 300,
      defendAgainstOutsiders: true,
      defenseMode: 'always',          // 'always', 'whenSettled', 'whenStationary'
      settledThreshold: 120,

      positioning: {
        preferDotClusters: true,
        avoidEnemyClusters: true,
        clusterWeight: 0.7,
        enemyWeight: 0.3
      }
    },

    cannibalism: {
      enabled: false,
      trigger: 'starving',            // 'starving', 'lowLives', 'always'
      lowLivesThreshold: 2,
      targetPreference: 'weakest',    // 'weakest', 'oldest', 'nearest', 'random'
      packOnly: true,
      corpseOnly: false
    }
  },

  // ===== PLAYER OVERRIDES =====
  playerOverrides: {
    enabled: true,                    // allow separate config for player
    starvation: { enabled: false },
    age: { enabled: false },
    reproduction: { enabled: true }
    // partial overrides, inherits rest from main config
  }
};
```

---

## Design Decisions

### Respawn Invincibility
- **Visual:** Pulsing white/golden outline (not transparency)
- **Combat:** Cannot deal damage while invincible
- **Break condition:** Invincibility ends if bot moves into another bot (initiates combat)

### Starvation
- **Reset condition:** Eating a dot OR dealing damage in combat (attack > enemy.defence)
- **Scaling:** Larger bots (more total stats) starve faster
- **Stat decay:** Enabled by default, reduces random stat by 0.1 per tick
- **Pack impact:** Starving bots leave their pack at 50% starvation threshold

### Age
- **Measurement:** Pure frame count
- **Death behavior:** Bot becomes a corpse (stationary food source)
- **Corpse appearance:** Desaturated (20% saturation) version of original hue, 70% opacity
- **Corpse nutrition:** 2.0 stat points (vs 0.1 for yellow dots)
- **Pack corpse rules:** Non-pack members treat as food; pack members protect unless cannibalism enabled

### Reproduction - Asexual
- **Maturity:** Frame-based by default (1800 frames = 30 seconds)
- **Life cost:** Parent loses 50% of lives to offspring
- **Spawn location:** Near parent (80-150 units away) with invincibility protection
- **Cooldown:** 15 seconds between reproductions

### Reproduction - Sexual
- **Trigger:** Prolonged proximity (3 seconds within 60 units) without combat
- **Compatibility:** Strategy similarity threshold of 0.5
- **Pack bonus:** Pack members 2x more likely to reproduce
- **Cooldown:** 20 seconds between reproductions

### Offspring Protection
- **Duration:** 5 seconds of mutual non-aggression
- **Generations:** Configurable depth (default 1 = parent/child only)
- **Bidirectional:** Both parent and offspring protected from each other

### Strategy Inheritance
- **Simple mode:** Blend behavior weights from both parents + noise
- **Advanced mode:** Random interleave of rules from both parents + noise
- **Expert mode:** Merge states from both parents, regenerate transitions + noise
- **Mutation:** 10% chance to randomize a single behavior/rule

### Packs
- **Formation:** Based on Simple mode behavior weight similarity (cosine/euclidean)
- **Advanced/Expert bots:** Treated as "loners" or use behavioral signature
- **Visual:** Colored ring around pack members (unique hue per pack)
- **Max size:** Configurable, default 5. Overflow bots treated as intruders.
- **Leadership:** Optional, configurable (strongest/oldest/founder)

### Territory
- **Defense modes:** 'always', 'whenSettled' (after 2 seconds in territory), 'whenStationary'
- **Positioning:** Gravitates toward dot clusters, away from enemy clusters
- **No dot manipulation:** Bots don't move dots, just prefer areas with dots

### Cannibalism
- **Trigger:** Starving by default
- **Target:** Weakest pack member by default
- **Scope:** Pack members only by default (can be expanded)

### Player Bot Offspring
- **Indicator:** Outlined star (vs filled star for player)
- **Generations:** Gold outline (gen 1), silver outline (gen 2), bronze outline (gen 3+)
- **Tracking:** `isPlayerOffspring` and `playerLineage` properties

---

## Visual Indicators

### Invincibility
- Pulsing white/golden outline
- Oscillates in opacity over duration

### Aging
- Starts at 80% of max age
- Gradual desaturation (color fades toward gray)
- Slight transparency increase (note: transparency is okay for aging, just not for invincibility)

### Corpses
- 20% saturation of original hue
- 70% opacity
- Stationary (no movement)

### Starvation
- Consider: shrinking size or color shift (implementation detail)

### Pack Membership
- Colored ring around bot
- Color derived from pack ID (unique hue per pack)
- Distinct from followed-bot indicator (white brackets)

### Player Offspring
```
Player bot:           ★ (solid gold star)
Generation 1 child:   ☆ (gold outline)
Generation 2:         ☆ (silver outline)
Generation 3+:        ☆ (bronze outline)
```

---

## Event Logging

New event types to integrate with existing logging system:

```javascript
// Lifecycle events
{ type: 'INVINCIBILITY_START', botIndex, duration }
{ type: 'INVINCIBILITY_END', botIndex, reason }  // 'expired', 'combatInitiated'
{ type: 'STARVATION_TICK', botIndex, livesRemaining, statDecay }
{ type: 'STARVATION_RESET', botIndex, reason }   // 'dotEaten', 'damageDealt', 'kill'
{ type: 'AGE_DEATH', botIndex, finalStats, offspringCount, corpseCreated }
{ type: 'CORPSE_CONSUMED', corpseIndex, consumerIndex, nutritionGained }
{ type: 'CORPSE_EXPIRED', corpseIndex }

// Reproduction events
{ type: 'REPRODUCTION_ASEXUAL', parentIndex, offspringIndex, stats, generation }
{ type: 'REPRODUCTION_SEXUAL', parent1Index, parent2Index, offspringIndex, stats }
{ type: 'PROTECTION_STARTED', bot1Index, bot2Index, duration, generations }
{ type: 'PROTECTION_ENDED', bot1Index, bot2Index }

// Pack events
{ type: 'PACK_FORMED', packId, memberIndices, similarity }
{ type: 'PACK_JOINED', packId, botIndex }
{ type: 'PACK_LEFT', packId, botIndex, reason }  // 'respawn', 'starving', 'kicked', 'voluntary'
{ type: 'PACK_DISBANDED', packId, reason }
{ type: 'PACK_TERRITORY_CLAIMED', packId, center, radius }
{ type: 'PACK_INTRUDER_DETECTED', packId, intruderIndex }
{ type: 'CANNIBALISM', predatorIndex, preyIndex, packId }
```

---

## UI Structure

### Tab Layout
```
[Stats] [Simple] [Advanced] [Expert] [Lifecycle] [Settings]
```

### Lifecycle Tab Sections

Each section has an "Enabled" toggle that reveals/hides detailed settings.

1. **Respawn Invincibility**
   - Duration slider
   - Visual effect dropdown
   - Combat behavior checkboxes

2. **Starvation**
   - Threshold slider
   - Damage per tick slider
   - Reset conditions checkboxes
   - Scaling toggle + factor
   - Stat decay toggle + settings

3. **Age**
   - Max age slider
   - Visual decay start slider
   - Death behavior dropdown
   - Corpse settings (nutrition, duration)

4. **Reproduction**
   - Asexual sub-section
     - Maturity metric dropdown
     - Threshold slider
     - Life cost slider
     - Spawn location dropdown
     - Cooldown slider
   - Sexual sub-section
     - Proximity settings
     - Compatibility threshold
     - Pack bonus settings
     - Cooldown slider
   - Offspring protection settings

5. **Packs**
   - Formation settings
   - Size limits
   - Bond settings
   - Leadership toggle + settings
   - Territory sub-section
   - Cannibalism sub-section

6. **Player Overrides**
   - Per-feature override toggles

---

## File Structure

New files to create:

```
bots-strategy-v9/
├── js/
│   ├── config.js          # Add lifecycleSettings
│   ├── game.js            # Modify Bot class
│   ├── main.js            # Modify game loop, collision handling
│   ├── ui.js              # Add Lifecycle tab UI
│   ├── debug.js           # Add relationship/pack info
│   ├── log.js             # Add new event types
│   ├── lifecycle.js       # NEW: Lifecycle logic (starvation, age, invincibility)
│   ├── reproduction.js    # NEW: Reproduction logic
│   ├── relationships.js   # NEW: Parent/child tracking, protection system
│   ├── packs.js           # NEW: Pack formation, management, territory
│   └── corpse.js          # NEW: Corpse class and management
```

---

## Data Structures

### Bot Class Extensions

```javascript
// Add to Bot class
this.age = 0;                        // frames alive
this.invincibilityFrames = 0;        // remaining invincibility
this.starvationCounter = 0;          // frames since last food/combat
this.reproductionCooldown = 0;       // frames until can reproduce again
this.offspringCount = 0;             // total offspring spawned
this.generation = 0;                 // 0 = original, 1 = child, 2 = grandchild
this.isPlayerOffspring = false;
this.playerLineage = 0;              // generations from player bot

this.relationships = {
  parentId: null,
  childIds: [],
  packId: null,
  mateHistory: [],                   // { botIndex, lastMateFrame }
  protectedFrom: [],                 // { botId, expiresAtFrame }
  protectedBy: []                    // { botId, expiresAtFrame }
};
```

### Pack Structure

```javascript
const pack = {
  id: 'pack_001',
  members: [botIndex1, botIndex2, ...],
  founderId: botIndex1,
  leaderId: botIndex1,               // if leadership enabled
  formedAtFrame: 1234,
  territory: {
    center: { x: 500, y: 500 },
    radius: 300,
    settledSince: 1300               // frame when settled, null if moving
  },
  hue: 120                           // visual identifier
};

// Global pack registry
const packs = new Map();             // packId -> pack object
let nextPackId = 1;
```

### Corpse Class

```javascript
class Corpse {
  constructor(bot) {
    this.x = bot.x;
    this.y = bot.y;
    this.originalHue = bot.hue;
    this.size = bot.size;
    this.nutritionValue = lifecycleSettings.age.corpse.nutritionValue;
    this.createdAtFrame = frameCount;
    this.duration = lifecycleSettings.age.corpse.duration;
    this.originalBotIndex = bot.index;
    this.packId = bot.relationships?.packId || null;
  }

  isExpired() {
    if (this.duration === 0) return false;  // permanent until eaten
    return frameCount - this.createdAtFrame > this.duration;
  }

  draw() { /* desaturated bot appearance */ }
}

// Global corpse list
let corpses = [];
```

### Protection Entry

```javascript
const protectionEntry = {
  botId: 5,
  expiresAtFrame: 1500,
  generation: 1                      // how many generations apart
};
```

---

## Notes

- **No git:** Use shell command to backup folder with `_backup_<version>` suffix before risky changes
- **Strategy similarity:** Only computed for Simple mode behavior weights
- **Advanced/Expert bots:** Cannot form packs (treated as loners)
- **UI:** Build incrementally with each phase
- **Logging:** Integrate all new events with existing simulation logging system

---

## Corpse Clarification

Corpses are **inert objects**, not modified bots:
- No movement (stationary where bot died)
- No AI or decision-making
- No stats (speed, attack, defence, lives) - only `nutritionValue`
- Cannot initiate or receive combat
- Can only be "consumed" (collision with living bot transfers nutrition)
- Visually: desaturated version of original bot appearance

This achieves the intent of "change speed and attack to 0, and don't respawn" by making corpses a completely separate entity class.

---

## Future Considerations

### Winner Scoring System

A future enhancement could determine a "winning" bot based on:
- Total offspring spawned (`offspringCount`)
- Sum of all descendants' ages
- Generational depth achieved
- Combined stats of living descendants

The data structures already track:
- `this.offspringCount` - direct offspring count
- `this.generation` - how many generations from original
- `this.relationships.parentId` and `childIds` - family tree traversal

### Potential Scoring Formula
```javascript
function calculateDynastyScore(bot) {
  let score = 0;
  const descendants = getAllDescendants(bot);  // recursive traversal

  for (const desc of descendants) {
    score += desc.age;                          // age contribution
    score += desc.isAlive ? 100 : 0;            // living bonus
    score += (desc.speed + desc.attack + desc.defence + desc.lives) * 10;  // stats
  }

  return score;
}
```

This would require implementing `getAllDescendants()` using the relationship tracking system.
