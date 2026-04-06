// Bots Strategy v9 - Bot AI (context, conditions, actions, strategy modes)
// Extends Bot class via prototype

// ============ BEHAVIOR PARAMS HELPER ============
Bot.prototype.getBehaviorParams = function(behaviorKey) {
  if (this.isPlayer) {
    return behaviorWeights[behaviorKey]?.params || {};
  }
  // NPCs use default param values from BEHAVIORS definitions
  const defaults = {};
  const behaviorDef = BEHAVIORS[behaviorKey];
  if (behaviorDef?.params) {
    Object.keys(behaviorDef.params).forEach(pkey => {
      defaults[pkey] = behaviorDef.params[pkey].value;
    });
  }
  return defaults;
};

// ============ PER-FRAME CONTEXT GLOBALS CACHE ============
// Caches the frame-invariant parts of getContext() to avoid O(N²) recomputation
// per bot per re-target. Invalidated each new frame.
let _ctxGlobalCacheFrame = -1;
let _ctxGlobalCache = null;

function _computeContextGlobals() {
  if (frameCount === _ctxGlobalCacheFrame) return _ctxGlobalCache;
  _ctxGlobalCacheFrame = frameCount;

  const safetyRadius = behaviorWeights.opportunist?.params?.safetyRadius || 150;
  const safeDots = yellowDots.filter(dot => {
    for (const b of bots) {
      const dx = b.x - dot.x;
      const dy = b.y - dot.y;
      if (Math.sqrt(dx * dx + dy * dy) < safetyRadius) return false;
    }
    return true;
  });

  let weakestEnemy = null, weakestLives = Infinity;
  let strongestEnemy = null, strongestStats = -Infinity;

  for (const b of bots) {
    const ts = b.speed + b.attack + b.defence + b.lives;
    if (b.lives < weakestLives) { weakestLives = b.lives; weakestEnemy = b; }
    if (ts > strongestStats) { strongestStats = ts; strongestEnemy = b; }
  }

  // Enemy cluster detection: O(N²) — computed once per frame, not per bot
  // Count starts at 0 (neighbors only, not self) to avoid inflating cluster size for getContext callers
  const enemyClusterRadius = 200;
  const enemyClusterCounts = new Map();
  for (const b of bots) {
    let count = 0;
    for (const other of bots) {
      if (other === b) continue;
      const dx = other.x - b.x;
      const dy = other.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < enemyClusterRadius) count++;
    }
    enemyClusterCounts.set(b, count);
  }

  _ctxGlobalCache = { safeDots, weakestEnemy, strongestEnemy, enemyClusterCounts };
  return _ctxGlobalCache;
}

// ============ CONTEXT FOR RULE EVALUATION ============
Bot.prototype.getContext = function() {
  const { bot: nearestEnemy, dist: enemyDist } = this.findNearestBot();
  const { dot: nearestDot, dist: dotDist } = this.findNearestDot();
  const clusterParams = this.getBehaviorParams('clusterFarmer');
  const clusters = this.findDotClusters(clusterParams.clusterRadius);
  const bestCluster = clusters[0];

  const { safeDots, weakestEnemy: globalWeakest, strongestEnemy: globalStrongest, enemyClusterCounts } = _computeContextGlobals();

  let nearestSafeDot = null;
  let nearestSafeDotDist = Infinity;
  for (const dot of safeDots) {
    const dx = dot.x - this.x;
    const dy = dot.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestSafeDotDist) {
      nearestSafeDotDist = dist;
      nearestSafeDot = dot;
    }
  }

  // Per-bot distances to global weakest/strongest
  const weakestEnemy = globalWeakest !== this ? globalWeakest : null;
  const strongestEnemy = globalStrongest !== this ? globalStrongest : null;
  const weakestDist = weakestEnemy ? this.distanceTo(weakestEnemy) : Infinity;
  const weakestLives = weakestEnemy ? weakestEnemy.lives : Infinity;
  const strongestDist = strongestEnemy ? this.distanceTo(strongestEnemy) : Infinity;

  // Per-bot enemy cluster (largest cluster and its distance from this bot)
  let enemyClusterSize = 0;
  let enemyClusterDist = Infinity;
  for (const [b, count] of enemyClusterCounts) {
    if (b === this) continue;
    if (count > enemyClusterSize) {
      enemyClusterSize = count;
      const dx = b.x - this.x;
      const dy = b.y - this.y;
      enemyClusterDist = Math.sqrt(dx * dx + dy * dy);
    }
  }

  const zoneX = Math.min(2, Math.floor(this.x / (WORLD_WIDTH / 3)));
  const zoneY = Math.min(2, Math.floor(this.y / (WORLD_HEIGHT / 3)));
  const myZone = zoneY * 3 + zoneX + 1;

  const myTotalStats = this.speed + this.attack + this.defence + this.lives;
  let avgStats = 0;
  let avgCount = 0;
  let amStrongest = true, amWeakest = true;
  for (const bot of bots) {
    if (bot === this) continue;
    const ts = bot.speed + bot.attack + bot.defence + bot.lives;
    avgStats += ts;
    avgCount++;
    if (ts >= myTotalStats) amStrongest = false;
    if (ts <= myTotalStats) amWeakest = false;
  }
  avgStats = avgCount > 0 ? avgStats / avgCount : myTotalStats;

  const dotCountRadius = 200;
  let dotCountInRadius = 0;
  for (const dot of yellowDots) {
    const dx = dot.x - this.x;
    const dy = dot.y - this.y;
    if (Math.sqrt(dx * dx + dy * dy) < dotCountRadius) {
      dotCountInRadius++;
    }
  }

  let clusterDensity = 0;
  if (bestCluster && bestCluster.size > 0) {
    let maxDist = 0;
    for (const dot of bestCluster.dots) {
      const dx = dot.x - bestCluster.centerX;
      const dy = dot.y - bestCluster.centerY;
      maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
    }
    const clusterArea = Math.PI * Math.max(1, maxDist) * Math.max(1, maxDist);
    clusterDensity = bestCluster.size / (clusterArea / 10000);
  }

  return {
    'my.lives': this.lives,
    'my.attack': this.attack,
    'my.defence': this.defence,
    'my.speed': this.speed,
    'my.health_percent': (this.lives / this.initialLives) * 100,
    'my.total_stats': myTotalStats,
    'my.relative_power': avgStats > 0 ? myTotalStats / avgStats : 1,
    'my.zone': myZone,
    'am_strongest': amStrongest ? 1 : 0,
    'am_weakest': amWeakest ? 1 : 0,
    'nearest_enemy.distance': enemyDist,
    'nearest_enemy.lives': nearestEnemy ? nearestEnemy.lives : 999,
    'nearest_enemy.attack': nearestEnemy ? nearestEnemy.attack : 0,
    'combat_advantage': nearestEnemy ? this.evaluateCombatAdvantage(nearestEnemy) : 0,
    'nearby_enemy_count': this.countNearbyEnemies(),
    'weakest_enemy.distance': weakestDist,
    'weakest_enemy.lives': weakestLives,
    'strongest_enemy.distance': strongestDist,
    'enemy_cluster.size': enemyClusterSize,
    'enemy_cluster.distance': enemyClusterDist,
    'nearest_dot.distance': dotDist,
    'dot_count_in_radius': dotCountInRadius,
    'safe_dot_count': safeDots.length,
    'nearest_safe_dot.distance': nearestSafeDotDist,
    'best_cluster.size': bestCluster ? bestCluster.size : 0,
    'best_cluster.distance': bestCluster ? bestCluster.distance : 999,
    'best_cluster.density': clusterDensity,
    'just_took_damage': this.justTookDamage ? 1 : 0,
    'just_dealt_damage': this.justDealtDamage ? 1 : 0,
    'frames_since_damage_taken': this.frameLastTookDamage > 0 ? (frameCount - this.frameLastTookDamage) : 999,
    'last_attacker.distance': (this.lastAttacker && bots.includes(this.lastAttacker)) ? this.distanceTo(this.lastAttacker) : 999,
    _nearestEnemy: nearestEnemy,
    _nearestDot: nearestDot,
    _bestCluster: bestCluster,
    _safeDot: nearestSafeDot || this.findSafestDot(),
    _weakestEnemy: weakestEnemy
  };
};

// ============ CONDITION & ACTION EVALUATION ============
Bot.prototype.evaluateCondition = function(condition, context) {
  const value = context[condition.subject];
  if (value === undefined) return false;

  switch (condition.operator) {
    case '<': return value < condition.value;
    case '<=': return value <= condition.value;
    case '>': return value > condition.value;
    case '>=': return value >= condition.value;
    case '=': return value === condition.value;
    case '!=': return value !== condition.value;
    default: return false;
  }
};

Bot.prototype.executeAction = function(action, context) {
  // Store original target to detect if action failed to set a new one
  const originalTargetX = this.targetX;
  const originalTargetY = this.targetY;
  let targetSet = false;

  switch (action) {
    case 'flee': {
      if (context._nearestEnemy) {
        const fleeDistance = this.getBehaviorParams('survivor').fleeDistance || 300;
        const dx = this.x - context._nearestEnemy.x;
        const dy = this.y - context._nearestEnemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          this.targetX = this.x + (dx / dist) * fleeDistance;
          this.targetY = this.y + (dy / dist) * fleeDistance;
          targetSet = true;
        }
      }
      break;
    }

    case 'hunt': {
      const hunterParams = this.getBehaviorParams('hunter');
      // Prefer wounded targets if enabled and a wounded enemy exists
      if (hunterParams.preferWounded && context._weakestEnemy &&
          context._weakestEnemy.lives <= (hunterParams.woundedThreshold || 3)) {
        this.targetX = context._weakestEnemy.x;
        this.targetY = context._weakestEnemy.y;
        targetSet = true;
      } else if (context._nearestEnemy) {
        this.targetX = context._nearestEnemy.x;
        this.targetY = context._nearestEnemy.y;
        targetSet = true;
      }
      break;
    }

    case 'hunt_weak': {
      const weakest = this.findWeakestBot();
      if (weakest) {
        this.targetX = weakest.x;
        this.targetY = weakest.y;
        targetSet = true;
      }
      break;
    }

    case 'gather': {
      const gathererParams = this.getBehaviorParams('gatherer');
      const maxTargetDist = gathererParams.maxTargetDistance || 9999;
      if (context._nearestDot && context['nearest_dot.distance'] <= maxTargetDist) {
        this.targetX = context._nearestDot.x;
        this.targetY = context._nearestDot.y;
        targetSet = true;
      }
      break;
    }

    case 'gather_safe':
    case 'safe-gather': {
      const safeDot = context._safeDot || context._nearestDot;
      if (safeDot) {
        this.targetX = safeDot.x;
        this.targetY = safeDot.y;
        targetSet = true;
      }
      break;
    }

    case 'cluster': {
      const clusterFarmerParams = this.getBehaviorParams('clusterFarmer');
      const minClusterSize = clusterFarmerParams.minClusterSize || 2;
      if (context._bestCluster && context._bestCluster.dots.length >= minClusterSize) {
        let nearest = context._bestCluster.dots[0];
        let minDist = Infinity;
        for (const dot of context._bestCluster.dots) {
          const dx = dot.x - this.x;
          const dy = dot.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearest = dot;
          }
        }
        this.targetX = nearest.x;
        this.targetY = nearest.y;
        targetSet = true;
      }
      break;
    }

    case 'wander':
    default: {
      const margin = 100;
      this.targetX = margin + Math.random() * (WORLD_WIDTH - margin * 2);
      this.targetY = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
      targetSet = true;
      break;
    }
  }

  // Fallback to wander if action failed to set a new target
  if (!targetSet) {
    const margin = 100;
    this.targetX = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    this.targetY = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
  }

  this.targetX = Math.max(50, Math.min(WORLD_WIDTH - 50, this.targetX));
  this.targetY = Math.max(50, Math.min(WORLD_HEIGHT - 50, this.targetY));
  this.maxIdle = 30 + Math.random() * 60;
  this.idleTime = 0;
};

// ============ STRATEGY MODES ============
Bot.prototype.pickNewTarget = function() {
  if (this.isPlayer) {
    switch (strategyMode) {
      case 'simple':
        this.pickTargetSimpleMode();
        break;
      case 'advanced':
        this.pickTargetAdvancedMode();
        break;
      case 'expert':
        this.pickTargetExpertMode();
        break;
    }
  } else {
    // Check if NPC has a strategy assigned
    if (npcSettings.randomStrategy.enabled && this.npcStrategy) {
      this.pickTargetNPCStrategy();
    } else {
      this.pickNewTargetSimple();
    }
  }
};

// NPC strategy-based targeting (uses assigned behavior template)
Bot.prototype.pickTargetNPCStrategy = function() {
  const context = this.getContext();
  this.lastContext = context;

  // Get enabled behaviors and weights for this NPC
  const enabledBehaviors = [];
  let totalWeight = 0;

  Object.entries(this.npcBehaviors).forEach(([key, enabled]) => {
    if (enabled && this.npcWeights[key] > 0) {
      enabledBehaviors.push({ key, weight: this.npcWeights[key] });
      totalWeight += this.npcWeights[key];
    }
  });

  if (enabledBehaviors.length === 0) {
    this.pickNewTargetSimple();
    return;
  }

  // Add randomness noise
  if (globalSettings.randomnessNoise > 0) {
    enabledBehaviors.forEach(b => {
      b.weight *= (1 + (Math.random() - 0.5) * globalSettings.randomnessNoise * 2);
    });
    totalWeight = enabledBehaviors.reduce((sum, b) => sum + b.weight, 0);
  }

  // Select weighted random behavior
  let rand = Math.random() * totalWeight;
  let selectedBehavior = enabledBehaviors[0].key;

  for (const behavior of enabledBehaviors) {
    rand -= behavior.weight;
    if (rand <= 0) {
      selectedBehavior = behavior.key;
      break;
    }
  }

  // Map behavior to action using default parameters
  const hunterParams = this.getBehaviorParams('hunter');
  const survivorParams = this.getBehaviorParams('survivor');
  const avengerParams = this.getBehaviorParams('avenger');

  const behaviorActions = {
    gatherer: 'gather',
    clusterFarmer: 'cluster',
    hunter: context['combat_advantage'] >= (hunterParams.minAdvantage || 0) ? 'hunt' : 'gather',
    opportunist: 'gather_safe',
    survivor: context['my.lives'] <= (survivorParams.activationThreshold || 3) &&
              context['nearest_enemy.distance'] < (survivorParams.threatRadius || 200)
              ? 'flee' : 'gather',
    avenger: (() => {
      if (!this.lastAttacker || !bots.includes(this.lastAttacker)) return 'gather';
      if (context['frames_since_damage_taken'] > (avengerParams.pursuitDuration || 180)) return 'gather';
      if (this.lastAttacker.lives > (avengerParams.finishThreshold || 2)) return 'gather';
      return 'hunt';
    })()
  };

  const action = behaviorActions[selectedBehavior] || 'gather';
  this.lastAction = action;
  this.executeAction(action, context);
};

Bot.prototype.pickNewTargetSimple = function() {
  const dotChance = 1 - (this.lives / (this.lives + 3));

  if (Math.random() < dotChance) {
    const { dot } = this.findNearestDot();
    if (dot) {
      this.targetX = dot.x;
      this.targetY = dot.y;
      this.maxIdle = 30 + Math.random() * 60;
      this.idleTime = 0;
      return;
    }
  } else {
    const { bot } = this.findNearestBot();
    if (bot) {
      this.targetX = bot.x;
      this.targetY = bot.y;
      this.maxIdle = 30 + Math.random() * 60;
      this.idleTime = 0;
      return;
    }
  }

  const margin = 100;
  this.targetX = margin + Math.random() * (WORLD_WIDTH - margin * 2);
  this.targetY = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
  this.maxIdle = 60 + Math.random() * 180;
  this.idleTime = 0;
};

Bot.prototype.checkEmergencyOverride = function(context) {
  if (!globalSettings.emergencyOverride.enabled) return null;
  if (context['my.lives'] <= globalSettings.emergencyOverride.livesThreshold) {
    return globalSettings.emergencyOverride.behavior;
  }
  return null;
};

Bot.prototype.pickTargetSimpleMode = function() {
  const context = this.getContext();
  this.lastContext = context;

  const emergency = this.checkEmergencyOverride(context);
  if (emergency) {
    this.lastAction = emergency;
    this.lastDecisionInfo.reason = 'Emergency override';
    this.executeAction(emergency, context);
    logDecision(this, emergency, 'EMERGENCY_OVERRIDE', context, {});
    return;
  }

  const enabledBehaviors = [];
  let totalWeight = 0;

  Object.entries(behaviorWeights).forEach(([key, state]) => {
    if (state.enabled && state.weight > 0) {
      enabledBehaviors.push({ key, weight: state.weight });
      totalWeight += state.weight;
    }
  });

  if (enabledBehaviors.length === 0) {
    this.lastAction = 'gather';
    this.lastDecisionInfo.reason = 'No behaviors enabled';
    this.executeAction('gather', context);
    logDecision(this, 'gather', 'NO_BEHAVIORS_ENABLED', context, {});
    return;
  }

  if (globalSettings.randomnessNoise > 0) {
    enabledBehaviors.forEach(b => {
      b.weight *= (1 + (Math.random() - 0.5) * globalSettings.randomnessNoise * 2);
    });
    totalWeight = enabledBehaviors.reduce((sum, b) => sum + b.weight, 0);
  }

  let rand = Math.random() * totalWeight;
  let selectedBehavior = enabledBehaviors[0].key;

  for (const behavior of enabledBehaviors) {
    rand -= behavior.weight;
    if (rand <= 0) {
      selectedBehavior = behavior.key;
      break;
    }
  }

  // Map behavior to action using configured parameters
  const hunterParams = this.getBehaviorParams('hunter');
  const survivorParams = this.getBehaviorParams('survivor');
  const avengerParams = this.getBehaviorParams('avenger');

  const behaviorActions = {
    gatherer: 'gather',
    clusterFarmer: 'cluster',
    hunter: context['combat_advantage'] >= (hunterParams.minAdvantage || 0) ? 'hunt' : 'gather',
    opportunist: 'gather_safe',
    survivor: context['my.lives'] <= (survivorParams.activationThreshold || 3) &&
              context['nearest_enemy.distance'] < (survivorParams.threatRadius || 200)
              ? 'flee' : 'gather',
    avenger: (() => {
      if (!this.lastAttacker || !bots.includes(this.lastAttacker)) return 'gather';
      if (context['frames_since_damage_taken'] > (avengerParams.pursuitDuration || 180)) return 'gather';
      if (this.lastAttacker.lives > (avengerParams.finishThreshold || 2)) return 'gather';
      return 'hunt';
    })()
  };

  const action = behaviorActions[selectedBehavior] || 'gather';
  this.lastAction = action;
  this.lastDecisionInfo.reason = `Behavior: ${selectedBehavior}`;
  this.executeAction(action, context);
  logDecision(this, action, `BEHAVIOR:${selectedBehavior}`, context, { selectedBehavior });
};

Bot.prototype.pickTargetAdvancedMode = function() {
  const context = this.getContext();
  this.lastContext = context;

  const emergency = this.checkEmergencyOverride(context);
  if (emergency) {
    this.lastAction = emergency;
    this.lastDecisionInfo.reason = 'Emergency override';
    this.lastDecisionInfo.firedRule = null;
    this.executeAction(emergency, context);
    logDecision(this, emergency, 'EMERGENCY_OVERRIDE', context, {});
    return;
  }

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    let allMatch = true;
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      this.lastAction = rule.action;
      this.lastDecisionInfo.reason = `Rule #${i + 1}`;
      this.lastDecisionInfo.firedRule = i;
      this.executeAction(rule.action, context);
      logDecision(this, rule.action, `RULE:${i}`, context, { firedRuleIndex: i });
      return;
    }
  }

  this.lastAction = 'gather';
  this.lastDecisionInfo.reason = 'Default (no rules matched)';
  this.lastDecisionInfo.firedRule = null;
  this.executeAction('gather', context);
  logDecision(this, 'gather', 'DEFAULT_NO_RULES_MATCHED', context, {});
};

Bot.prototype.pickTargetExpertMode = function() {
  const context = this.getContext();
  this.lastContext = context;

  const emergency = this.checkEmergencyOverride(context);
  if (emergency) {
    this.lastAction = emergency;
    this.lastDecisionInfo.reason = 'Emergency override';
    this.executeAction(emergency, context);
    logDecision(this, emergency, 'EMERGENCY_OVERRIDE', context, {});
    return;
  }

  const currentTransitions = transitions
    .filter(t => t.from === this.currentFSMState)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const previousState = this.currentFSMState;

  for (const trans of currentTransitions) {
    if (this.evaluateCondition(trans.condition, context)) {
      this.currentFSMState = trans.to;
      if (this.isPlayer) currentStateId = this.currentFSMState;
      break;
    }
  }

  if (previousState !== this.currentFSMState) {
    const prevState = states.find(s => s.id === previousState);
    if (prevState && prevState.exitAction && prevState.exitAction !== 'none') {
      this.executeStateAction(prevState.exitAction, context);
    }

    const newState = states.find(s => s.id === this.currentFSMState);
    if (newState && newState.entryAction && newState.entryAction !== 'none') {
      this.executeStateAction(newState.entryAction, context);
    }
  }

  const currentState = states.find(s => s.id === this.currentFSMState);
  if (currentState) {
    this.lastAction = currentState.behavior;
    this.lastDecisionInfo.reason = `State: ${currentState.name}`;
    this.executeAction(currentState.behavior, context);
    logDecision(this, currentState.behavior, `FSM_STATE:${currentState.id}`, context, {
      previousState: previousState !== this.currentFSMState ? previousState : undefined
    });
  } else {
    this.lastAction = 'gather';
    this.lastDecisionInfo.reason = 'Default (no state)';
    this.executeAction('gather', context);
    logDecision(this, 'gather', 'DEFAULT_NO_STATE', context, {});
  }
};

Bot.prototype.executeStateAction = function(actionType, context) {
  switch (actionType) {
    case 'log':
      console.log(`[Bot ${this.index}] State action: ${actionType}`);
      break;
    case 'boost_speed':
      if (this.speedBoostFrames <= 0) {
        this.speed += 0.5;
      }
      this.speedBoostFrames = 180; // 3 seconds at 60fps; decremented in Bot.update()
      break;
    case 'reset_target':
      this.targetX = this.x;
      this.targetY = this.y;
      break;
  }
};
