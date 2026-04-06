// Bots Strategy v9 - Configuration and Constants

// ============ GAME CONSTANTS ============
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const BOT_COUNT = 20;
const DOT_COUNT = 50;

const STARTING_STATS = {
  speed: 5,
  attack: 5,
  defence: 5,
  lives: 3
};

const TOTAL_POINTS = 18;
const MIN_STAT = 1;

// ============ PLAYER STATS ============
const playerStats = {
  speed: 5,
  attack: 5,
  defence: 5,
  lives: 3
};

// Default player stats for reset
const DEFAULT_PLAYER_STATS = {
  speed: 5,
  attack: 5,
  defence: 5,
  lives: 3
};

let preferredBonusStat = 'speed';
let strategyMode = 'simple';

// Monotonic bot index counter — never reset to bots.length to avoid collisions
let nextBotIndex = 0;

// ============ GLOBAL SETTINGS ============
const globalSettings = {
  reEvaluationRate: 30,
  behaviorSwitchCooldown: 15,
  randomnessNoise: 0.1,
  emergencyOverride: {
    enabled: false,
    livesThreshold: 2,
    behavior: 'flee'
  }
};

// Default global settings for reset
const DEFAULT_GLOBAL_SETTINGS = {
  reEvaluationRate: 30,
  behaviorSwitchCooldown: 15,
  randomnessNoise: 0.1,
  emergencyOverride: {
    enabled: false,
    livesThreshold: 2,
    behavior: 'flee'
  }
};

// ============ DEBUG STATE ============
let debugMode = false;
let showTargetLine = true;
let showContextValues = true;
let lastDecisionInfo = {
  mode: '',
  action: '',
  reason: '',
  firedRule: null
};

// ============ SIMULATION SETTINGS ============
const simulationSettings = {
  maxDecisions: 100,      // Stop after this many decisions (0 = unlimited)
  loggingEnabled: false,  // Enable decision logging
  logAllBots: false,      // Log all bots (true) or just player bot (false)
  pauseOnComplete: false  // Pause simulation when maxDecisions reached
};

// Default simulation settings for reset
const DEFAULT_SIMULATION_SETTINGS = {
  maxDecisions: 100,
  loggingEnabled: false,
  logAllBots: false,
  pauseOnComplete: false
};

// ============ NPC SETTINGS ============
const npcSettings = {
  randomStats: {
    enabled: false,           // Enable random stat distribution for NPCs
    totalPoints: 18,          // Total points to distribute
    minSpeed: 1,
    minAttack: 0,
    minDefence: 1,
    minLives: 1
  },
  deathPenalty: {
    enabled: false,           // Enable stat penalty on death instead of full reset
    penaltyPerStat: 1,        // Points lost per stat (except lives)
    minSpeed: 1,
    minAttack: 0,
    minDefence: 1
  },
  evolution: {
    enabled: false,           // Enable stat inheritance from killer
    inheritRatio: 0.5         // 0.5 = average of victim base and killer stats
  },
  randomStrategy: {
    enabled: false,           // Enable random strategy selection for NPCs
    useSimpleMode: true,      // NPCs can use simple mode behaviors
    useAdvancedMode: false,   // NPCs can use advanced mode rules
    useExpertMode: false      // NPCs can use expert mode FSM
  }
};

// Default NPC settings for reset
const DEFAULT_NPC_SETTINGS = {
  randomStats: {
    enabled: false,
    totalPoints: 18,
    minSpeed: 1,
    minAttack: 0,
    minDefence: 1,
    minLives: 1
  },
  deathPenalty: {
    enabled: false,
    penaltyPerStat: 1,
    minSpeed: 1,
    minAttack: 0,
    minDefence: 1
  },
  evolution: {
    enabled: false,
    inheritRatio: 0.5
  },
  randomStrategy: {
    enabled: false,
    useSimpleMode: true,
    useAdvancedMode: false,
    useExpertMode: false
  }
};

// NPC Strategy Templates (pre-defined behavior configurations for NPCs)
const NPC_STRATEGY_TEMPLATES = {
  gatherer: {
    name: 'Gatherer',
    behaviors: { gatherer: true, clusterFarmer: true, hunter: false, opportunist: false, survivor: true, avenger: false },
    weights: { gatherer: 60, clusterFarmer: 30, hunter: 0, opportunist: 0, survivor: 10, avenger: 0 }
  },
  hunter: {
    name: 'Hunter',
    behaviors: { gatherer: true, clusterFarmer: false, hunter: true, opportunist: false, survivor: true, avenger: true },
    weights: { gatherer: 20, clusterFarmer: 0, hunter: 50, opportunist: 0, survivor: 20, avenger: 10 }
  },
  survivor: {
    name: 'Survivor',
    behaviors: { gatherer: true, clusterFarmer: false, hunter: false, opportunist: true, survivor: true, avenger: false },
    weights: { gatherer: 30, clusterFarmer: 0, hunter: 0, opportunist: 40, survivor: 30, avenger: 0 }
  },
  opportunist: {
    name: 'Opportunist',
    behaviors: { gatherer: true, clusterFarmer: true, hunter: true, opportunist: true, survivor: true, avenger: false },
    weights: { gatherer: 25, clusterFarmer: 20, hunter: 15, opportunist: 25, survivor: 15, avenger: 0 }
  },
  aggressive: {
    name: 'Aggressive',
    behaviors: { gatherer: true, clusterFarmer: false, hunter: true, opportunist: false, survivor: false, avenger: true },
    weights: { gatherer: 15, clusterFarmer: 0, hunter: 55, opportunist: 0, survivor: 0, avenger: 30 }
  }
};

let simulationLog = {
  config: null,
  strategy: null,
  initialState: null,
  decisions: [],
  events: [],
  finalState: null
};

let decisionCount = 0;
let simulationRunning = false;
let simulationPaused = false;
let frameCount = 0;
let simulationSpeed = 1; // 1 = normal, 1.5 = x1.5, 2 = x2

// ============ BEHAVIOR DEFINITIONS ============
const BEHAVIORS = {
  gatherer: {
    name: 'Gatherer',
    desc: 'Seeks nearest food dot',
    defaultWeight: 50,
    enabled: true,
    params: {
      maxTargetDistance: { value: 9999, label: 'Max Target Distance', type: 'number', min: 100, max: 9999 },
      recalculateFrequency: { value: 30, label: 'Recalc Frequency', type: 'number', min: 1, max: 120 }
    }
  },
  clusterFarmer: {
    name: 'Cluster Farmer',
    desc: 'Seeks dense clusters of dots',
    defaultWeight: 30,
    enabled: true,
    params: {
      clusterRadius: { value: 150, label: 'Cluster Radius', type: 'number', min: 50, max: 300 },
      minClusterSize: { value: 2, label: 'Min Cluster Size', type: 'number', min: 2, max: 10 },
      abandonThreshold: { value: 1, label: 'Abandon When <', type: 'number', min: 0, max: 5 }
    }
  },
  hunter: {
    name: 'Hunter',
    desc: 'Seeks combat with enemies',
    defaultWeight: 20,
    enabled: false,
    params: {
      minAdvantage: { value: 0, label: 'Min Advantage', type: 'number', min: -5, max: 10 },
      preferWounded: { value: true, label: 'Prefer Wounded', type: 'checkbox' },
      woundedThreshold: { value: 3, label: 'Wounded If Lives <=', type: 'number', min: 1, max: 10 },
      chaseDuration: { value: 180, label: 'Chase Duration', type: 'number', min: 30, max: 600 }
    }
  },
  opportunist: {
    name: 'Opportunist',
    desc: 'Seeks safe dots (far from enemies)',
    defaultWeight: 40,
    enabled: false,
    params: {
      safetyRadius: { value: 150, label: 'Safety Radius', type: 'number', min: 50, max: 400 },
      fallbackBehavior: { value: 'flee', label: 'Fallback', type: 'select', options: ['flee', 'nearest', 'wait'] }
    }
  },
  survivor: {
    name: 'Survivor',
    desc: 'Avoids danger, prioritizes staying alive',
    defaultWeight: 60,
    enabled: false,
    params: {
      activationThreshold: { value: 3, label: 'Activate When Lives <=', type: 'number', min: 1, max: 10 },
      fleeDistance: { value: 300, label: 'Flee Distance', type: 'number', min: 100, max: 500 },
      threatRadius: { value: 200, label: 'Threat Radius', type: 'number', min: 50, max: 400 }
    }
  },
  avenger: {
    name: 'Avenger',
    desc: 'Pursues enemies that recently attacked',
    defaultWeight: 30,
    enabled: false,
    params: {
      pursuitDuration: { value: 180, label: 'Pursuit Duration', type: 'number', min: 30, max: 600 },
      finishThreshold: { value: 2, label: 'Only If Target Lives <=', type: 'number', min: 1, max: 10 }
    }
  }
};

// ============ BEHAVIOR WEIGHTS STATE ============
const behaviorWeights = {};
Object.keys(BEHAVIORS).forEach(key => {
  const params = {};
  if (BEHAVIORS[key].params) {
    Object.keys(BEHAVIORS[key].params).forEach(pkey => {
      params[pkey] = BEHAVIORS[key].params[pkey].value;
    });
  }
  behaviorWeights[key] = {
    enabled: BEHAVIORS[key].enabled,
    weight: BEHAVIORS[key].defaultWeight,
    params: params
  };
});

// ============ RULE DEFINITIONS ============
const SUBJECTS = {
  // My Stats
  'my.lives': 'My Lives',
  'my.attack': 'My Attack',
  'my.defence': 'My Defence',
  'my.speed': 'My Speed',
  'my.health_percent': 'My Health %',
  'my.total_stats': 'My Total Stats',
  'my.relative_power': 'My Relative Power',
  'my.zone': 'My Zone (1-9)',
  'am_strongest': 'Am Strongest',
  'am_weakest': 'Am Weakest',
  // Nearest Enemy
  'nearest_enemy.distance': 'Enemy Distance',
  'nearest_enemy.lives': 'Enemy Lives',
  'nearest_enemy.attack': 'Enemy Attack',
  'combat_advantage': 'Combat Advantage',
  'nearby_enemy_count': 'Nearby Enemies',
  // Other Enemies
  'weakest_enemy.distance': 'Weakest Enemy Dist',
  'weakest_enemy.lives': 'Weakest Enemy Lives',
  'strongest_enemy.distance': 'Strongest Enemy Dist',
  'enemy_cluster.size': 'Enemy Cluster Size',
  'enemy_cluster.distance': 'Enemy Cluster Dist',
  // Dots
  'nearest_dot.distance': 'Dot Distance',
  'dot_count_in_radius': 'Dots In Radius',
  'safe_dot_count': 'Safe Dot Count',
  'nearest_safe_dot.distance': 'Safe Dot Distance',
  // Clusters
  'best_cluster.size': 'Cluster Size',
  'best_cluster.distance': 'Cluster Distance',
  'best_cluster.density': 'Cluster Density',
  // Combat History
  'just_took_damage': 'Just Took Damage',
  'just_dealt_damage': 'Just Dealt Damage',
  'frames_since_damage_taken': 'Frames Since Hit',
  'last_attacker.distance': 'Last Attacker Dist'
};

const OPERATORS = ['<', '<=', '>', '>=', '=', '!='];

const ACTIONS = {
  'flee': 'Flee from nearest enemy',
  'hunt': 'Hunt nearest enemy',
  'hunt_weak': 'Hunt weakest enemy',
  'gather': 'Gather nearest dot',
  'gather_safe': 'Gather safest dot',
  'cluster': 'Farm best cluster',
  'wander': 'Random wander'
};

// ============ RULE TEMPLATES ============
const RULE_TEMPLATES = {
  aggressive: {
    name: 'Aggressive Hunter',
    rules: [
      { conditions: [{ subject: 'my.lives', operator: '<=', value: 1 }], action: 'flee' },
      { conditions: [{ subject: 'combat_advantage', operator: '>', value: 0 }], action: 'hunt' },
      { conditions: [], action: 'gather' }
    ]
  },
  safe: {
    name: 'Safe Gatherer',
    rules: [
      { conditions: [{ subject: 'nearest_enemy.distance', operator: '<', value: 150 }], action: 'flee' },
      { conditions: [{ subject: 'safe_dot_count', operator: '>', value: 0 }], action: 'gather_safe' },
      { conditions: [], action: 'gather' }
    ]
  },
  balanced: {
    name: 'Balanced',
    rules: [
      { conditions: [{ subject: 'my.lives', operator: '<=', value: 2 }, { subject: 'nearest_enemy.distance', operator: '<', value: 150 }], action: 'flee' },
      { conditions: [{ subject: 'combat_advantage', operator: '>', value: 2 }, { subject: 'nearest_enemy.distance', operator: '<', value: 200 }], action: 'hunt' },
      { conditions: [{ subject: 'best_cluster.size', operator: '>=', value: 3 }], action: 'cluster' },
      { conditions: [], action: 'gather' }
    ]
  },
  glassCannon: {
    name: 'Glass Cannon',
    rules: [
      { conditions: [{ subject: 'combat_advantage', operator: '>', value: 1 }], action: 'hunt' },
      { conditions: [{ subject: 'my.lives', operator: '<=', value: 1 }], action: 'flee' },
      { conditions: [], action: 'hunt_weak' }
    ]
  }
};

// ============ CONDITION PRESETS ============
const CONDITION_PRESETS = [
  { name: 'Low Health', condition: { subject: 'my.lives', operator: '<=', value: 2 } },
  { name: 'Enemy Near', condition: { subject: 'nearest_enemy.distance', operator: '<', value: 150 } },
  { name: 'Strong Advantage', condition: { subject: 'combat_advantage', operator: '>', value: 2 } },
  { name: 'Just Hit', condition: { subject: 'just_took_damage', operator: '=', value: 1 } },
  { name: 'Big Cluster', condition: { subject: 'best_cluster.size', operator: '>=', value: 4 } }
];

// ============ RULES STATE ============
let rules = [
  {
    conditions: [
      { subject: 'my.lives', operator: '<=', value: 2 },
      { subject: 'nearest_enemy.distance', operator: '<', value: 150 }
    ],
    action: 'flee'
  },
  {
    conditions: [
      { subject: 'just_took_damage', operator: '=', value: 1 }
    ],
    action: 'flee'
  },
  {
    conditions: [
      { subject: 'combat_advantage', operator: '>', value: 2 },
      { subject: 'nearest_enemy.distance', operator: '<', value: 200 }
    ],
    action: 'hunt'
  },
  {
    conditions: [
      { subject: 'best_cluster.size', operator: '>=', value: 3 }
    ],
    action: 'cluster'
  },
  {
    conditions: [],
    action: 'gather'
  }
];

// Default rules for reset
const DEFAULT_RULES = [
  {
    conditions: [
      { subject: 'my.lives', operator: '<=', value: 2 },
      { subject: 'nearest_enemy.distance', operator: '<', value: 150 }
    ],
    action: 'flee'
  },
  {
    conditions: [
      { subject: 'just_took_damage', operator: '=', value: 1 }
    ],
    action: 'flee'
  },
  {
    conditions: [
      { subject: 'combat_advantage', operator: '>', value: 2 },
      { subject: 'nearest_enemy.distance', operator: '<', value: 200 }
    ],
    action: 'hunt'
  },
  {
    conditions: [
      { subject: 'best_cluster.size', operator: '>=', value: 3 }
    ],
    action: 'cluster'
  },
  {
    conditions: [],
    action: 'gather'
  }
];

// ============ STATE MACHINE DEFINITIONS ============
let states = [
  { id: 'gathering', name: 'Gathering', x: 150, y: 150, behavior: 'gather', entryAction: null, exitAction: null },
  { id: 'hunting', name: 'Hunting', x: 400, y: 100, behavior: 'hunt', entryAction: null, exitAction: null },
  { id: 'fleeing', name: 'Fleeing', x: 400, y: 250, behavior: 'flee', entryAction: null, exitAction: null }
];

let transitions = [
  { from: 'gathering', to: 'hunting', condition: { subject: 'combat_advantage', operator: '>', value: 2 }, priority: 1 },
  { from: 'gathering', to: 'fleeing', condition: { subject: 'my.lives', operator: '<=', value: 2 }, priority: 2 },
  { from: 'hunting', to: 'gathering', condition: { subject: 'combat_advantage', operator: '<', value: 0 }, priority: 1 },
  { from: 'hunting', to: 'fleeing', condition: { subject: 'my.lives', operator: '<=', value: 2 }, priority: 2 },
  { from: 'fleeing', to: 'gathering', condition: { subject: 'nearest_enemy.distance', operator: '>', value: 200 }, priority: 1 }
];

// Default states for reset
const DEFAULT_STATES = [
  { id: 'gathering', name: 'Gathering', x: 150, y: 150, behavior: 'gather', entryAction: null, exitAction: null },
  { id: 'hunting', name: 'Hunting', x: 400, y: 100, behavior: 'hunt', entryAction: null, exitAction: null },
  { id: 'fleeing', name: 'Fleeing', x: 400, y: 250, behavior: 'flee', entryAction: null, exitAction: null }
];

// Default transitions for reset
const DEFAULT_TRANSITIONS = [
  { from: 'gathering', to: 'hunting', condition: { subject: 'combat_advantage', operator: '>', value: 2 }, priority: 1 },
  { from: 'gathering', to: 'fleeing', condition: { subject: 'my.lives', operator: '<=', value: 2 }, priority: 2 },
  { from: 'hunting', to: 'gathering', condition: { subject: 'combat_advantage', operator: '<', value: 0 }, priority: 1 },
  { from: 'hunting', to: 'fleeing', condition: { subject: 'my.lives', operator: '<=', value: 2 }, priority: 2 },
  { from: 'fleeing', to: 'gathering', condition: { subject: 'nearest_enemy.distance', operator: '>', value: 200 }, priority: 1 }
];

const STATE_ACTIONS = {
  'none': 'None',
  'log': 'Log State Change',
  'boost_speed': 'Temporary Speed Boost',
  'reset_target': 'Reset Target'
};

let currentStateId = 'gathering';
let selectedState = null;
let selectedTool = 'select';
let transitionStart = null;

// ============ LIFECYCLE SETTINGS ============
const lifecycleSettings = {

  // ===== RESPAWN INVINCIBILITY =====
  respawnInvincibility: {
    enabled: false,
    duration: 180,                    // 3 seconds at 60fps
    canDealDamage: false,
    breakOnCombatInitiation: false,
    visualEffect: 'pulse'             // 'pulse', 'flash', 'glow'
  },

  // ===== STARVATION =====
  starvation: {
    enabled: false,
    inactivityThreshold: 600,         // 10 seconds without food/combat
    damagePerTick: 0.5,
    tickInterval: 60,                 // damage every 1 second while starving

    resetConditions: {
      onDotEaten: false,
      onDamageDealt: false,           // attack > enemy.defence
      onKill: false
    },

    scaling: {
      enabled: false,
      factor: 0.1,                    // +10% faster per stat above baseline
      baselineStats: 18
    },

    statDecay: {
      enabled: false,
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
        enabled: false,
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
      disbandOnRespawn: false,
      disbandOnStarvation: false,
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
    enabled: false,                   // allow separate config for player
    starvation: { enabled: true },    // true = affected, !true = checkbox unchecked (not immune)
    age: { enabled: true },           // true = affected, !true = checkbox unchecked (not immune)
    reproduction: { enabled: false }
    // partial overrides, inherits rest from main config
  }
};

// ============ BILLBOARD SETTINGS ============
const billboardSettings = {
  enabled: true,
  maxBillboards: 5,              // Max billboards on screen at once
  spawnChance: 0.002,            // Chance per frame to spawn a new billboard (0.002 = ~12 per 100 seconds)
  minDuration: 300,              // Min frames a billboard stays (5 seconds)
  maxDuration: 900,              // Max frames a billboard stays (15 seconds)
  clusterProximityRadius: 200,   // How close to spawn to dot clusters
  minClusterSize: 2,             // Min dots in cluster to place billboard
  boardWidth: 120,               // Billboard width
  boardHeight: 60,               // Billboard height
  poleHeight: 40                 // Height of billboard pole
};

// Default billboard settings for reset
const DEFAULT_BILLBOARD_SETTINGS = {
  enabled: true,
  maxBillboards: 5,
  spawnChance: 0.002,
  minDuration: 300,
  maxDuration: 900,
  clusterProximityRadius: 200,
  minClusterSize: 2,
  boardWidth: 120,
  boardHeight: 60,
  poleHeight: 40
};

// ============ PETRI DISH VISUAL CONFIG ============
const PETRI_CONFIG = {
  trailLength: 120,           // frames of trail history per bot
  trailAccumulationDecay: 0.003, // alpha of fade rect per frame
  trailStampInterval: 5,      // stamp trail map every N frames
  trailStampAlpha: 0.015,     // opacity of each trail stamp
  ambientParticleCount: 60,   // floating background specks
  glowIntensity: 1.0,         // multiplier for bot outer glow
  membraneNoiseAmp: 3,        // max pixel noise on aged membranes
  nutrientPulseSpeed: 0.04,   // sin wave speed for food pulsing
  nutrientJitter: 1.5,        // max pixel jitter on nutrient sub-particles
  combatParticleCount: 20,    // particles on kill
  consumeParticleCount: 6,    // particles on food eat
  absorptionParticleCount: 8, // gold particles on kill winner
  particleMaxCount: 200,      // global particle pool cap
  filamentWobbleSpeed: 0.03,  // sin wave speed for pack filaments
  filamentWobbleAmp: 8        // pixel amplitude of filament wobble
};

// ============ LIFECYCLE STATE ============
let corpses = [];
let packs = new Map();               // packId -> pack object
let nextPackId = 1;
let protectionPairs = new Map();     // `${bot1Index}-${bot2Index}` -> expiryFrame
