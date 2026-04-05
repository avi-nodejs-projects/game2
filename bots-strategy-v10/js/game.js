// Bots Strategy v10 - Game Classes

// ============ YELLOW DOT CLASS ============
class YellowDot {
  constructor() {
    this.respawn();
    this.size = 6;
  }

  respawn() {
    const margin = 50;
    this.x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    this.y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
  }

  draw() {
    if (!isVisible(this.x, this.y)) return;

    const screen = worldToScreen(this.x, this.y);
    const scale = getScale(this.y);
    const size = this.size * scale;

    ctx.fillStyle = 'rgba(255, 255, 100, 0.3)';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffaa';
    ctx.beginPath();
    ctx.arc(screen.x - 2 * scale, screen.y - 2 * scale, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============ BOT CLASS ============
class Bot {
  constructor(index, isPlayer = false, playerIndex = null) {
    this.index = index;
    this.isPlayer = isPlayer;
    this.playerIndex = playerIndex; // null for NPCs, 0 for Player 1, 1 for Player 2
    this.size = 10 + Math.random() * 6;

    // Set hue based on player index or random for NPCs
    if (isPlayer && playerIndex !== null) {
      const pConfig = playerConfigs[playerIndex];
      // Convert hex color to hue
      this.hue = this.hexToHue(pConfig.color);
    } else {
      this.hue = Math.random() * 360;
    }

    this.shadowOffset = this.size * 0.4;
    this.preferredStat = isPlayer && playerIndex !== null ? playerConfigs[playerIndex].preferredBonusStat : null;
    this.initialLives = isPlayer && playerIndex !== null ? playerConfigs[playerIndex].stats.lives : STARTING_STATS.lives;
    this.justTookDamage = false;
    this.justDealtDamage = false;
    this.damageTimer = 0;
    this.damageDealtTimer = 0;
    this.lastAttacker = null;
    this.currentFSMState = isPlayer && playerIndex !== null ? playerConfigs[playerIndex].currentStateId : 'gathering';
    this.lastAction = '';
    this.lastContext = null;

    // NPC-specific properties
    this.baseStats = null;  // Stores NPC's base/starting stats for evolution
    this.npcStrategy = null; // NPC's strategy template key
    this.npcBehaviors = null; // NPC's behavior configuration
    this.npcWeights = null;   // NPC's behavior weights

    // Lifecycle properties
    this.invincibilityFrames = 0;
    this.starvationCounter = 0;
    this.isStarving = false;
    this.starvationTickCounter = 0;
    this.age = 0;
    this.reproductionCooldown = 0;
    this.offspringCount = 0;
    this.generation = 0;
    this.isPlayerOffspring = false;
    this.playerLineage = 0;
    this.killCount = 0;

    // Relationships
    this.relationships = {
      parentId: null,
      secondParentId: null,
      childIds: [],
      packId: null,
      mateHistory: [],
      protectedFrom: [],
      protectedBy: []
    };
    this.matingProgress = new Map();
    this.packProximityMap = new Map();

    this.initializeStats();
    this.spawnAtRandom();
    this.angle = 0;
  }

  // Helper to convert hex color to hue value
  hexToHue(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;

    if (max !== min) {
      const d = max - min;
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return Math.round(h * 360);
  }

  // Initialize stats - handles random distribution for NPCs
  initializeStats() {
    if (this.isPlayer && this.playerIndex !== null) {
      // Use player-specific config
      const pConfig = playerConfigs[this.playerIndex];
      this.speed = pConfig.stats.speed;
      this.attack = pConfig.stats.attack;
      this.defence = pConfig.stats.defence;
      this.lives = pConfig.stats.lives;
      this.initialLives = pConfig.stats.lives;
    } else if (this.isPlayer) {
      // Fallback to legacy playerStats
      this.speed = playerStats.speed;
      this.attack = playerStats.attack;
      this.defence = playerStats.defence;
      this.lives = playerStats.lives;
      this.initialLives = playerStats.lives;
    } else {
      if (npcSettings.randomStats.enabled) {
        this.generateRandomStats();
      } else {
        this.speed = STARTING_STATS.speed;
        this.attack = STARTING_STATS.attack;
        this.defence = STARTING_STATS.defence;
        this.lives = STARTING_STATS.lives;
      }
      // Store base stats for evolution
      this.baseStats = {
        speed: this.speed,
        attack: this.attack,
        defence: this.defence,
        lives: this.lives
      };
      this.initialLives = this.lives;

      // Initialize NPC strategy if enabled
      if (npcSettings.randomStrategy.enabled) {
        this.assignRandomStrategy();
      }
    }
  }

  // Generate random stats for NPC with constraints
  generateRandomStats() {
    const cfg = npcSettings.randomStats;
    const minTotal = cfg.minSpeed + cfg.minAttack + cfg.minDefence + cfg.minLives;
    const remaining = cfg.totalPoints - minTotal;

    // Start with minimums
    this.speed = cfg.minSpeed;
    this.attack = cfg.minAttack;
    this.defence = cfg.minDefence;
    this.lives = cfg.minLives;

    // Distribute remaining points randomly
    const stats = ['speed', 'attack', 'defence', 'lives'];
    for (let i = 0; i < remaining; i++) {
      const stat = stats[Math.floor(Math.random() * stats.length)];
      this[stat]++;
    }
  }

  // Assign a random strategy to NPC
  assignRandomStrategy() {
    const templateKeys = Object.keys(NPC_STRATEGY_TEMPLATES);
    const randomKey = templateKeys[Math.floor(Math.random() * templateKeys.length)];
    const template = NPC_STRATEGY_TEMPLATES[randomKey];

    this.npcStrategy = randomKey;
    this.npcBehaviors = { ...template.behaviors };
    this.npcWeights = { ...template.weights };
  }

  resetStats() {
    if (this.isPlayer && this.playerIndex !== null) {
      // Use player-specific config
      const pConfig = playerConfigs[this.playerIndex];
      this.speed = pConfig.stats.speed;
      this.attack = pConfig.stats.attack;
      this.defence = pConfig.stats.defence;
      this.lives = pConfig.stats.lives;
      this.initialLives = pConfig.stats.lives;
    } else if (this.isPlayer) {
      // Fallback to legacy playerStats
      this.speed = playerStats.speed;
      this.attack = playerStats.attack;
      this.defence = playerStats.defence;
      this.lives = playerStats.lives;
      this.initialLives = playerStats.lives;
    } else {
      // Use base stats if available, otherwise use defaults
      const base = this.baseStats || STARTING_STATS;
      this.speed = base.speed;
      this.attack = base.attack;
      this.defence = base.defence;
      this.lives = base.lives;
      this.initialLives = base.lives;
    }
  }

  // Apply death penalty - lose points from current stats instead of full reset
  applyDeathPenalty() {
    if (!npcSettings.deathPenalty.enabled) {
      this.resetStats();
      return;
    }

    const cfg = npcSettings.deathPenalty;
    const penalty = cfg.penaltyPerStat;

    // Reduce each stat by penalty amount (except lives which resets)
    this.speed = Math.max(cfg.minSpeed, this.speed - penalty);
    this.attack = Math.max(cfg.minAttack, this.attack - penalty);
    this.defence = Math.max(cfg.minDefence, this.defence - penalty);

    // Reset lives to base/starting value (use player stats for player bot)
    let baseLives;
    if (this.isPlayer) {
      // Use player-specific stats for two-player mode
      const pIdx = this.playerIndex !== undefined ? this.playerIndex : 0;
      baseLives = (gameMode === 'two-player' && playerConfigs[pIdx])
        ? playerConfigs[pIdx].stats.lives
        : playerStats.lives;
    } else {
      baseLives = this.baseStats ? this.baseStats.lives : STARTING_STATS.lives;
    }
    this.lives = baseLives;
    this.initialLives = baseLives;
  }

  // Inherit stats from killer bot (evolution)
  inheritFromKiller(killer) {
    if (!npcSettings.evolution.enabled || this.isPlayer || !killer) {
      return;
    }

    const ratio = npcSettings.evolution.inheritRatio;
    const myBase = this.baseStats || STARTING_STATS;

    // Calculate new base stats as weighted average
    const newBaseSpeed = Math.round(myBase.speed * (1 - ratio) + killer.speed * ratio);
    const newBaseAttack = Math.round(myBase.attack * (1 - ratio) + killer.attack * ratio);
    const newBaseDefence = Math.round(myBase.defence * (1 - ratio) + killer.defence * ratio);
    const newBaseLives = Math.round(myBase.lives * (1 - ratio) + killer.lives * ratio);

    // Calculate total points
    const newTotal = newBaseSpeed + newBaseAttack + newBaseDefence + newBaseLives;
    const targetTotal = npcSettings.randomStats.enabled ? npcSettings.randomStats.totalPoints : TOTAL_POINTS;

    // Normalize to target total points while preserving relative distribution
    if (newTotal > 0) {
      const scale = targetTotal / newTotal;
      this.baseStats = {
        speed: Math.max(1, Math.round(newBaseSpeed * scale)),
        attack: Math.max(0, Math.round(newBaseAttack * scale)),
        defence: Math.max(1, Math.round(newBaseDefence * scale)),
        lives: Math.max(1, Math.round(newBaseLives * scale))
      };

      // Adjust if rounding caused total mismatch
      let currentTotal = this.baseStats.speed + this.baseStats.attack + this.baseStats.defence + this.baseStats.lives;
      while (currentTotal < targetTotal) {
        const stats = ['speed', 'attack', 'defence', 'lives'];
        this.baseStats[stats[Math.floor(Math.random() * stats.length)]]++;
        currentTotal++;
      }
      while (currentTotal > targetTotal) {
        const stats = ['speed', 'attack', 'defence', 'lives'].filter(s =>
          (s === 'attack' && this.baseStats[s] > 0) ||
          (s !== 'attack' && this.baseStats[s] > 1)
        );
        if (stats.length > 0) {
          this.baseStats[stats[Math.floor(Math.random() * stats.length)]]--;
          currentTotal--;
        } else {
          break;
        }
      }
    }
  }

  // Handle NPC death with new mechanics
  handleDeath(killer) {
    // First inherit stats from killer if evolution is enabled
    this.inheritFromKiller(killer);

    // Apply death penalty to all bots (including player) when enabled
    if (npcSettings.deathPenalty.enabled) {
      this.applyDeathPenalty();
    } else {
      this.resetStats();
    }
  }

  spawnAtRandom() {
    const margin = 100;
    this.x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    this.y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
    // Set a random target away from spawn position to start moving immediately
    this.targetX = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    this.targetY = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
    this.idleTime = 0;
    this.maxIdle = 60 + Math.random() * 120;
    this.combatCooldown = 0;

    // Clear lifecycle state from previous life
    this.matingProgress.clear();
    this.packProximityMap.clear();
  }

  // ============ HELPER METHODS ============
  findNearestDot() {
    let nearest = null;
    let minDist = Infinity;
    for (const dot of yellowDots) {
      const dx = dot.x - this.x;
      const dy = dot.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = dot;
      }
    }
    return { dot: nearest, dist: minDist };
  }

  findNearestBot() {
    let nearest = null;
    let minDist = Infinity;
    for (const bot of bots) {
      if (bot === this) continue;
      const dx = bot.x - this.x;
      const dy = bot.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = bot;
      }
    }
    return { bot: nearest, dist: minDist };
  }

  findWeakestBot() {
    let weakest = null;
    let minLives = Infinity;
    for (const bot of bots) {
      if (bot === this) continue;
      if (bot.lives < minLives) {
        minLives = bot.lives;
        weakest = bot;
      }
    }
    return weakest;
  }

  findSafestDot(minEnemyDist = 150) {
    let safest = null;
    let bestScore = -Infinity;

    for (const dot of yellowDots) {
      let minEnemyDistFromDot = Infinity;
      for (const bot of bots) {
        if (bot === this) continue;
        const dx = bot.x - dot.x;
        const dy = bot.y - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minEnemyDistFromDot) {
          minEnemyDistFromDot = dist;
        }
      }

      if (minEnemyDistFromDot >= minEnemyDist) {
        const dx = dot.x - this.x;
        const dy = dot.y - this.y;
        const distToMe = Math.sqrt(dx * dx + dy * dy);
        const score = minEnemyDistFromDot - distToMe * 0.5;
        if (score > bestScore) {
          bestScore = score;
          safest = dot;
        }
      }
    }

    return safest;
  }

  findDotClusters() {
    const clusterRadius = 150;
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < yellowDots.length; i++) {
      if (used.has(i)) continue;

      const cluster = {
        dots: [yellowDots[i]],
        centerX: yellowDots[i].x,
        centerY: yellowDots[i].y
      };
      used.add(i);

      for (let j = i + 1; j < yellowDots.length; j++) {
        if (used.has(j)) continue;
        const dx = yellowDots[j].x - cluster.centerX;
        const dy = yellowDots[j].y - cluster.centerY;
        if (Math.sqrt(dx * dx + dy * dy) < clusterRadius) {
          cluster.dots.push(yellowDots[j]);
          used.add(j);
        }
      }

      cluster.centerX = cluster.dots.reduce((sum, d) => sum + d.x, 0) / cluster.dots.length;
      cluster.centerY = cluster.dots.reduce((sum, d) => sum + d.y, 0) / cluster.dots.length;

      const dx = cluster.centerX - this.x;
      const dy = cluster.centerY - this.y;
      cluster.distance = Math.sqrt(dx * dx + dy * dy);

      const speedFactor = 0.5 + this.speed * 0.1;
      cluster.value = (cluster.dots.length * 10) / (cluster.distance / speedFactor + 50);
      cluster.size = cluster.dots.length;

      clusters.push(cluster);
    }

    return clusters.sort((a, b) => b.value - a.value);
  }

  evaluateCombatAdvantage(target) {
    // Primary damage formula: attack - defence
    let damageWeDeal = this.attack - target.defence;
    let damageWeTake = target.attack - this.defence;

    // If both would take no damage, use division formula
    if (damageWeDeal <= 0 && damageWeTake <= 0) {
      damageWeDeal = this.attack / Math.max(target.defence, 0.1);
      damageWeTake = target.attack / Math.max(this.defence, 0.1);
    } else {
      // Only positive damage counts
      damageWeDeal = Math.max(0, damageWeDeal);
      damageWeTake = Math.max(0, damageWeTake);
    }

    const ourSurvivability = this.lives / (damageWeTake + 0.1);
    const theirSurvivability = target.lives / (damageWeDeal + 0.1);
    return ourSurvivability - theirSurvivability;
  }

  countNearbyEnemies(radius = 200) {
    let count = 0;
    for (const bot of bots) {
      if (bot === this) continue;
      const dx = bot.x - this.x;
      const dy = bot.y - this.y;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        count++;
      }
    }
    return count;
  }

  distanceTo(target) {
    if (!target) return Infinity;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============ CONTEXT FOR RULE EVALUATION ============
  getContext() {
    const { bot: nearestEnemy, dist: enemyDist } = this.findNearestBot();
    const { dot: nearestDot, dist: dotDist } = this.findNearestDot();
    const clusters = this.findDotClusters();
    const bestCluster = clusters[0];

    // Use player-specific behavior weights if available, otherwise global
    const weights = this.getBehaviorWeights();
    const safetyRadius = weights.opportunist?.params?.safetyRadius || 150;
    const safeDots = yellowDots.filter(dot => {
      for (const bot of bots) {
        if (bot === this) continue;
        const dx = bot.x - dot.x;
        const dy = bot.y - dot.y;
        if (Math.sqrt(dx * dx + dy * dy) < safetyRadius) return false;
      }
      return true;
    });

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

    let weakestEnemy = null, weakestDist = Infinity, weakestLives = Infinity;
    let strongestEnemy = null, strongestDist = Infinity, strongestStats = -Infinity;
    for (const bot of bots) {
      if (bot === this) continue;
      const dx = bot.x - this.x;
      const dy = bot.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const totalStats = bot.speed + bot.attack + bot.defence + bot.lives;

      if (bot.lives < weakestLives || (bot.lives === weakestLives && dist < weakestDist)) {
        weakestLives = bot.lives;
        weakestDist = dist;
        weakestEnemy = bot;
      }
      if (totalStats > strongestStats) {
        strongestStats = totalStats;
        strongestDist = dist;
        strongestEnemy = bot;
      }
    }

    let enemyClusterSize = 0;
    let enemyClusterDist = Infinity;
    const enemyClusterRadius = 200;
    for (const bot of bots) {
      if (bot === this) continue;
      let clusterCount = 1;
      for (const other of bots) {
        if (other === this || other === bot) continue;
        const dx = other.x - bot.x;
        const dy = other.y - bot.y;
        if (Math.sqrt(dx * dx + dy * dy) < enemyClusterRadius) {
          clusterCount++;
        }
      }
      if (clusterCount > enemyClusterSize) {
        enemyClusterSize = clusterCount;
        const dx = bot.x - this.x;
        const dy = bot.y - this.y;
        enemyClusterDist = Math.sqrt(dx * dx + dy * dy);
      }
    }

    const zoneX = Math.min(2, Math.floor(this.x / (WORLD_WIDTH / 3)));
    const zoneY = Math.min(2, Math.floor(this.y / (WORLD_HEIGHT / 3)));
    const myZone = zoneY * 3 + zoneX + 1;

    const myTotalStats = this.speed + this.attack + this.defence + this.lives;
    let avgStats = 0;
    let amStrongest = true, amWeakest = true;
    for (const bot of bots) {
      const ts = bot.speed + bot.attack + bot.defence + bot.lives;
      avgStats += ts;
      if (bot !== this) {
        if (ts >= myTotalStats) amStrongest = false;
        if (ts <= myTotalStats) amWeakest = false;
      }
    }
    avgStats = bots.length > 0 ? avgStats / bots.length : myTotalStats;

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
      'frames_since_damage_taken': this.damageTimer > 0 ? (120 - this.damageTimer) : 999,
      'last_attacker.distance': this.lastAttacker ? this.distanceTo(this.lastAttacker) : 999,
      _nearestEnemy: nearestEnemy,
      _nearestDot: nearestDot,
      _bestCluster: bestCluster,
      _safeDot: nearestSafeDot || this.findSafestDot(),
      _weakestEnemy: weakestEnemy
    };
  }

  // ============ CONDITION & ACTION EVALUATION ============
  evaluateCondition(condition, context) {
    const value = context[condition.subject];
    if (value === undefined) return false;

    // Ensure numeric comparison for numeric values (condition.value may be string from UI)
    const condValue = typeof value === 'number' ? Number(condition.value) : condition.value;

    switch (condition.operator) {
      case '<': return value < condValue;
      case '<=': return value <= condValue;
      case '>': return value > condValue;
      case '>=': return value >= condValue;
      case '=': return value == condValue; // Use == for type coercion
      case '!=': return value != condValue; // Use != for type coercion
      default: return false;
    }
  }

  executeAction(action, context) {
    let targetSet = false;

    switch (action) {
      case 'flee':
        if (context._nearestEnemy) {
          const dx = this.x - context._nearestEnemy.x;
          const dy = this.y - context._nearestEnemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            this.targetX = this.x + (dx / dist) * 300;
            this.targetY = this.y + (dy / dist) * 300;
            targetSet = true;
          }
        }
        break;

      case 'hunt':
        if (context._nearestEnemy) {
          this.targetX = context._nearestEnemy.x;
          this.targetY = context._nearestEnemy.y;
          targetSet = true;
        }
        break;

      case 'hunt_weak':
        const weakest = this.findWeakestBot();
        if (weakest) {
          this.targetX = weakest.x;
          this.targetY = weakest.y;
          targetSet = true;
        }
        break;

      case 'gather':
        if (context._nearestDot) {
          this.targetX = context._nearestDot.x;
          this.targetY = context._nearestDot.y;
          targetSet = true;
        }
        break;

      case 'gather_safe':
      case 'safe-gather':
        const safeDot = context._safeDot || context._nearestDot;
        if (safeDot) {
          this.targetX = safeDot.x;
          this.targetY = safeDot.y;
          targetSet = true;
        }
        break;

      case 'cluster':
        if (context._bestCluster && context._bestCluster.dots.length > 0) {
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

      case 'wander':
      default:
        const margin = 100;
        this.targetX = margin + Math.random() * (WORLD_WIDTH - margin * 2);
        this.targetY = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
        targetSet = true;
        break;
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
  }

  // ============ STRATEGY MODES ============
  pickNewTarget() {
    if (this.isPlayer) {
      // Get strategy mode from player config or global (for backwards compatibility)
      const mode = (this.playerIndex !== null && playerConfigs[this.playerIndex])
        ? playerConfigs[this.playerIndex].strategyMode
        : strategyMode;

      switch (mode) {
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
  }

  // Get the behavior weights for this bot (player-specific or global)
  getBehaviorWeights() {
    if (this.isPlayer && this.playerIndex !== null && playerConfigs[this.playerIndex].behaviorWeights) {
      return playerConfigs[this.playerIndex].behaviorWeights;
    }
    return behaviorWeights;
  }

  // Get the rules for this bot (player-specific or global)
  getRules() {
    if (this.isPlayer && this.playerIndex !== null && playerConfigs[this.playerIndex].rules) {
      return playerConfigs[this.playerIndex].rules;
    }
    return rules;
  }

  // Get the states for this bot (player-specific or global)
  getStates() {
    if (this.isPlayer && this.playerIndex !== null && playerConfigs[this.playerIndex].states) {
      return playerConfigs[this.playerIndex].states;
    }
    return states;
  }

  // Get the transitions for this bot (player-specific or global)
  getTransitions() {
    if (this.isPlayer && this.playerIndex !== null && playerConfigs[this.playerIndex].transitions) {
      return playerConfigs[this.playerIndex].transitions;
    }
    return transitions;
  }

  // NPC strategy-based targeting (uses assigned behavior template)
  pickTargetNPCStrategy() {
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

    // Map behavior to action
    const behaviorActions = {
      gatherer: 'gather',
      clusterFarmer: 'cluster',
      hunter: 'hunt',
      opportunist: 'gather_safe',
      survivor: context['my.health_percent'] < 50 ? 'flee' : 'gather',
      avenger: this.justTookDamage ? 'hunt' : 'gather'
    };

    const action = behaviorActions[selectedBehavior] || 'gather';
    this.lastAction = action;
    this.executeAction(action, context);
  }

  pickNewTargetSimple() {
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
  }

  checkEmergencyOverride(context) {
    if (!globalSettings.emergencyOverride.enabled) return null;
    if (context['my.lives'] <= globalSettings.emergencyOverride.livesThreshold) {
      return globalSettings.emergencyOverride.behavior;
    }
    return null;
  }

  pickTargetSimpleMode() {
    const context = this.getContext();
    this.lastContext = context;

    const emergency = this.checkEmergencyOverride(context);
    if (emergency) {
      this.lastAction = emergency;
      lastDecisionInfo.reason = 'Emergency override';
      this.executeAction(emergency, context);
      logDecision(this, emergency, 'EMERGENCY_OVERRIDE', context, {});
      return;
    }

    const weights = this.getBehaviorWeights();
    const enabledBehaviors = [];
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, state]) => {
      if (state.enabled && state.weight > 0) {
        enabledBehaviors.push({ key, weight: state.weight });
        totalWeight += state.weight;
      }
    });

    if (enabledBehaviors.length === 0) {
      this.lastAction = 'gather';
      lastDecisionInfo.reason = 'No behaviors enabled';
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

    const behaviorActions = {
      gatherer: 'gather',
      clusterFarmer: 'cluster',
      hunter: 'hunt',
      opportunist: 'gather_safe',
      survivor: context['my.health_percent'] < 50 ? 'flee' : 'gather',
      avenger: this.justTookDamage ? 'hunt' : 'gather'
    };

    const action = behaviorActions[selectedBehavior] || 'gather';
    this.lastAction = action;
    lastDecisionInfo.reason = `Behavior: ${selectedBehavior}`;
    this.executeAction(action, context);
    logDecision(this, action, `BEHAVIOR:${selectedBehavior}`, context, { selectedBehavior });
  }

  pickTargetAdvancedMode() {
    const context = this.getContext();
    this.lastContext = context;

    const emergency = this.checkEmergencyOverride(context);
    if (emergency) {
      this.lastAction = emergency;
      lastDecisionInfo.reason = 'Emergency override';
      lastDecisionInfo.firedRule = null;
      this.executeAction(emergency, context);
      logDecision(this, emergency, 'EMERGENCY_OVERRIDE', context, {});
      return;
    }

    const ruleList = this.getRules();
    for (let i = 0; i < ruleList.length; i++) {
      const rule = ruleList[i];
      let allMatch = true;
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        this.lastAction = rule.action;
        lastDecisionInfo.reason = `Rule #${i + 1}`;
        lastDecisionInfo.firedRule = i;
        this.executeAction(rule.action, context);
        logDecision(this, rule.action, `RULE:${i}`, context, { firedRuleIndex: i });
        return;
      }
    }

    this.lastAction = 'gather';
    lastDecisionInfo.reason = 'Default (no rules matched)';
    lastDecisionInfo.firedRule = null;
    this.executeAction('gather', context);
    logDecision(this, 'gather', 'DEFAULT_NO_RULES_MATCHED', context, {});
  }

  pickTargetExpertMode() {
    const context = this.getContext();
    this.lastContext = context;

    const emergency = this.checkEmergencyOverride(context);
    if (emergency) {
      this.lastAction = emergency;
      lastDecisionInfo.reason = 'Emergency override';
      this.executeAction(emergency, context);
      logDecision(this, emergency, 'EMERGENCY_OVERRIDE', context, {});
      return;
    }

    const stateList = this.getStates();
    const transitionList = this.getTransitions();

    const currentTransitions = transitionList
      .filter(t => t.from === this.currentFSMState)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const previousState = this.currentFSMState;

    for (const trans of currentTransitions) {
      if (this.evaluateCondition(trans.condition, context)) {
        this.currentFSMState = trans.to;
        // Update the player's config if applicable
        if (this.playerIndex !== null && playerConfigs[this.playerIndex]) {
          playerConfigs[this.playerIndex].currentStateId = this.currentFSMState;
        } else {
          currentStateId = this.currentFSMState;
        }
        break;
      }
    }

    if (previousState !== this.currentFSMState) {
      const prevState = stateList.find(s => s.id === previousState);
      if (prevState && prevState.exitAction && prevState.exitAction !== 'none') {
        this.executeStateAction(prevState.exitAction, context);
      }

      const newState = stateList.find(s => s.id === this.currentFSMState);
      if (newState && newState.entryAction && newState.entryAction !== 'none') {
        this.executeStateAction(newState.entryAction, context);
      }
    }

    const currentState = stateList.find(s => s.id === this.currentFSMState);
    if (currentState) {
      this.lastAction = currentState.behavior;
      lastDecisionInfo.reason = `State: ${currentState.name}`;
      this.executeAction(currentState.behavior, context);
      logDecision(this, currentState.behavior, `FSM_STATE:${currentState.id}`, context, {
        previousState: previousState !== this.currentFSMState ? previousState : undefined
      });
    } else {
      this.lastAction = 'gather';
      lastDecisionInfo.reason = 'Default (no state)';
      this.executeAction('gather', context);
      logDecision(this, 'gather', 'DEFAULT_NO_STATE', context, {});
    }
  }

  executeStateAction(actionType, context) {
    switch (actionType) {
      case 'log':
        console.log(`[Bot ${this.index}] State action: ${actionType}`);
        break;
      case 'boost_speed':
        this.speed += 0.5;
        setTimeout(() => this.speed -= 0.5, 3000);
        break;
      case 'reset_target':
        this.targetX = this.x;
        this.targetY = this.y;
        break;
    }
  }

  // ============ STAT MODIFICATIONS ============
  addRandomStat() {
    const stats = ['speed', 'attack', 'defence', 'lives'];
    let stat;

    if (this.isPlayer && this.preferredStat && Math.random() < 0.5) {
      stat = this.preferredStat;
    } else {
      stat = stats[Math.floor(Math.random() * stats.length)];
    }

    this[stat]++;
  }

  addPartialRandomStat() {
    const stats = ['speed', 'attack', 'defence', 'lives'];
    let stat;

    if (this.isPlayer && this.preferredStat && Math.random() < 0.5) {
      stat = this.preferredStat;
    } else {
      stat = stats[Math.floor(Math.random() * stats.length)];
    }

    this[stat] += 0.1;
  }

  applyRespawnPenalty() {
    // This penalty reduces the bot's BASE stats so the reduction persists after respawn
    // For NPCs: reduces baseStats which are used on respawn
    // For players: reduces the current stats (player stats are already at their base)
    const stats = ['speed', 'attack', 'defence', 'lives'];
    const stat = stats[Math.floor(Math.random() * stats.length)];

    // Get the appropriate minimum value based on player config or starting stats
    let minValue;
    if (this.isPlayer && this.playerIndex !== null) {
      // Two-player mode: use player-specific config
      minValue = playerConfigs[this.playerIndex].stats[stat];
    } else if (this.isPlayer) {
      // Legacy single-player mode
      minValue = playerStats[stat];
    } else {
      minValue = STARTING_STATS[stat];
    }

    // For NPCs, apply penalty to baseStats so it persists through respawn
    if (!this.isPlayer && this.baseStats) {
      const penalty = this.baseStats[stat] * 0.1;
      this.baseStats[stat] = Math.max(minValue, this.baseStats[stat] - penalty);
      // Also apply to current stats so the effect is visible
      this[stat] = Math.max(minValue, this[stat] - penalty);
    } else {
      // For players, apply to current stats
      const penalty = this[stat] * 0.1;
      this[stat] = Math.max(minValue, this[stat] - penalty);
    }
  }

  // ============ UPDATE & DRAW ============
  update() {
    if (this.combatCooldown > 0) {
      this.combatCooldown--;
    }

    if (this.damageTimer > 0) {
      this.damageTimer--;
      if (this.damageTimer === 0) {
        this.justTookDamage = false;
        this.lastAttacker = null;
      }
    }

    if (this.damageDealtTimer > 0) {
      this.damageDealtTimer--;
      if (this.damageDealtTimer === 0) {
        this.justDealtDamage = false;
      }
    }

    // Stuck detection - track position changes
    if (this._lastX === undefined) {
      this._lastX = this.x;
      this._lastY = this.y;
      this._stuckFrames = 0;
      this._stuckLogged = false;
    }

    const posDx = Math.abs(this.x - this._lastX);
    const posDy = Math.abs(this.y - this._lastY);
    const moved = posDx > 0.1 || posDy > 0.1;

    if (!moved) {
      this._stuckFrames++;
      // Log after 2 seconds (120 frames) of being stuck
      if (this._stuckFrames >= 120 && !this._stuckLogged) {
        this._stuckLogged = true;
        const targetDx = this.targetX - this.x;
        const targetDy = this.targetY - this.y;
        const distToTarget = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
        console.warn(`🔴 STUCK BOT DETECTED - Bot #${this.index} (${this.isPlayer ? 'PLAYER' : 'NPC'})`);
        console.log('  Position:', { x: this.x.toFixed(1), y: this.y.toFixed(1) });
        console.log('  Target:', { x: this.targetX.toFixed(1), y: this.targetY.toFixed(1) });
        console.log('  Distance to target:', distToTarget.toFixed(2));
        console.log('  Idle time / max:', this.idleTime, '/', this.maxIdle);
        console.log('  Last action:', this.lastAction);
        console.log('  Stats:', { speed: this.speed.toFixed(1), attack: this.attack.toFixed(1), defence: this.defence.toFixed(1), lives: this.lives.toFixed(1) });
        console.log('  Combat cooldown:', this.combatCooldown);
        const playerStrategyMode = this.isPlayer && this.playerIndex !== null && playerConfigs[this.playerIndex]
          ? playerConfigs[this.playerIndex].strategyMode
          : strategyMode;
        console.log('  Strategy mode:', this.isPlayer ? playerStrategyMode : (this.npcStrategy || 'simple'));
        if (this.isPlayer && this.lastContext) {
          console.log('  Last context:', {
            nearestEnemyDist: this.lastContext['nearest_enemy.distance']?.toFixed(1),
            nearestDotDist: this.lastContext['nearest_dot.distance']?.toFixed(1),
            bestClusterSize: this.lastContext['best_cluster.size'],
            combatAdvantage: this.lastContext['combat_advantage']?.toFixed(2)
          });
        }
        console.log('  Frame:', frameCount);
      }
    } else {
      this._stuckFrames = 0;
      this._stuckLogged = false;
    }

    this._lastX = this.x;
    this._lastY = this.y;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.idleTime++;
      if (this.idleTime > this.maxIdle) {
        this.pickNewTarget();
      }
    } else {
      const moveSpeed = 0.5 + (this.speed * 0.2);
      this.x += (dx / dist) * moveSpeed;
      this.y += (dy / dist) * moveSpeed;
      this.angle = Math.atan2(dy, dx);
    }

    this.x = Math.max(20, Math.min(WORLD_WIDTH - 20, this.x));
    this.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, this.y));
  }

  draw(isFollowed = false) {
    if (!isVisible(this.x, this.y, 150)) return;

    const screen = worldToScreen(this.x, this.y);
    const scale = getScale(this.y);
    const size = this.size * scale;
    const shadowOffset = this.shadowOffset * scale;

    // Calculate age-based saturation (visual aging effect)
    let saturation = 60;
    if (lifecycleSettings.age.enabled && typeof getAgeVisualFactor === 'function') {
      const ageFactor = getAgeVisualFactor(this);
      saturation = Math.round(60 * ageFactor); // Desaturate as bot ages
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(
      screen.x + shadowOffset,
      screen.y + shadowOffset * 0.5,
      size * 1.3,
      size * 0.6,
      0, 0, Math.PI * 2
    );
    ctx.fill();

    // Body (with age-based saturation)
    ctx.fillStyle = `hsl(${this.hue}, ${saturation}%, 50%)`;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, size, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight (with age-based saturation)
    ctx.fillStyle = `hsl(${this.hue}, ${saturation}%, 70%)`;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - size * 0.25, size * 0.65, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator (with age-based saturation)
    const dirX = Math.cos(this.angle) * size * 0.8;
    const dirY = Math.sin(this.angle) * size * 0.5;
    ctx.fillStyle = `hsl(${this.hue}, ${Math.round(saturation * 1.17)}%, 40%)`;
    ctx.beginPath();
    ctx.moveTo(screen.x + dirX, screen.y + dirY);
    ctx.lineTo(screen.x + dirX * 0.3 - dirY * 0.5, screen.y + dirY * 0.3 + dirX * 0.3);
    ctx.lineTo(screen.x + dirX * 0.3 + dirY * 0.5, screen.y + dirY * 0.3 - dirX * 0.3);
    ctx.closePath();
    ctx.fill();

    // Eyes
    const eyeAngle = this.angle;
    const eyeOffset = size * 0.25;
    const eyeDist = size * 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(
      screen.x + Math.cos(eyeAngle) * eyeDist - Math.sin(eyeAngle) * eyeOffset,
      screen.y + Math.sin(eyeAngle) * eyeDist * 0.5 - size * 0.15,
      2.5 * scale, 0, Math.PI * 2
    );
    ctx.arc(
      screen.x + Math.cos(eyeAngle) * eyeDist + Math.sin(eyeAngle) * eyeOffset,
      screen.y + Math.sin(eyeAngle) * eyeDist * 0.5 - size * 0.15,
      2.5 * scale, 0, Math.PI * 2
    );
    ctx.fill();

    // ===== LIFECYCLE VISUAL EFFECTS =====

    // Invincibility effect (pulsing golden outline)
    if (this.invincibilityFrames > 0) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(frameCount * 0.15));
      const effect = lifecycleSettings.respawnInvincibility.visualEffect;

      if (effect === 'pulse' || effect === 'glow') {
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size * 1.4, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glow
        if (effect === 'glow') {
          ctx.strokeStyle = `rgba(255, 255, 200, ${pulse * 0.5})`;
          ctx.lineWidth = 2 * scale;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, size * 1.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (effect === 'flash') {
        const flashOn = Math.floor(frameCount / 10) % 2 === 0;
        if (flashOn) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2 * scale;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, size * 1.3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Pack membership indicator (colored ring)
    if (this.relationships && this.relationships.packId !== null && lifecycleSettings.packs.enabled) {
      const pack = packs.get(this.relationships.packId);
      if (pack) {
        ctx.strokeStyle = `hsla(${pack.hue}, 70%, 50%, 0.6)`;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Starvation indicator (red tint/pulse)
    if (this.isStarving && lifecycleSettings.starvation.enabled) {
      const starvePulse = 0.3 + 0.3 * Math.abs(Math.sin(frameCount * 0.08));
      ctx.fillStyle = `rgba(255, 0, 0, ${starvePulse})`;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, size * 0.8, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lives indicator
    const livesY = screen.y - size - 10 * scale;
    const displayLives = Math.floor(this.lives);
    for (let i = 0; i < Math.min(displayLives, 10); i++) {
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(screen.x - (Math.min(displayLives, 10) - 1) * 3 * scale + i * 6 * scale, livesY, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player indicator
    if (this.isPlayer) {
      const starY = livesY - 12 * scale;
      ctx.fillStyle = '#ffdd00';
      ctx.font = `${14 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('★', screen.x, starY);
    }

    // Player offspring indicator
    if (this.isPlayerOffspring && !this.isPlayer) {
      const starY = livesY - 12 * scale;
      let starColor;
      if (this.playerLineage === 1) {
        starColor = '#ffdd00'; // Gold for gen 1
      } else if (this.playerLineage === 2) {
        starColor = '#c0c0c0'; // Silver for gen 2
      } else {
        starColor = '#cd7f32'; // Bronze for gen 3+
      }
      ctx.strokeStyle = starColor;
      ctx.lineWidth = 1.5 * scale;
      ctx.font = `${14 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.strokeText('☆', screen.x, starY);
    }

    // Generation indicator (small number near offspring star)
    if (this.generation > 0 && debugMode) {
      const genY = livesY - 20 * scale;
      ctx.fillStyle = '#888';
      ctx.font = `${8 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`G${this.generation}`, screen.x, genY);
    }

    // Followed marker
    if (isFollowed) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 1.8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      const bracketSize = size * 2;
      const bracketLen = size * 0.6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(screen.x - bracketSize, screen.y - bracketSize + bracketLen);
      ctx.lineTo(screen.x - bracketSize, screen.y - bracketSize);
      ctx.lineTo(screen.x - bracketSize + bracketLen, screen.y - bracketSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(screen.x + bracketSize - bracketLen, screen.y - bracketSize);
      ctx.lineTo(screen.x + bracketSize, screen.y - bracketSize);
      ctx.lineTo(screen.x + bracketSize, screen.y - bracketSize + bracketLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(screen.x - bracketSize, screen.y + bracketSize - bracketLen);
      ctx.lineTo(screen.x - bracketSize, screen.y + bracketSize);
      ctx.lineTo(screen.x - bracketSize + bracketLen, screen.y + bracketSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(screen.x + bracketSize - bracketLen, screen.y + bracketSize);
      ctx.lineTo(screen.x + bracketSize, screen.y + bracketSize);
      ctx.lineTo(screen.x + bracketSize, screen.y + bracketSize - bracketLen);
      ctx.stroke();
    }
  }
}
