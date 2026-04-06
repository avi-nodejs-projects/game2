// Bots Strategy v9 - Game Classes (YellowDot, Bot core)
// AI methods in bot-ai.js, rendering in bot-render.js

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

  draw(rc) {
    if (!rc.isVisible(this.x, this.y)) return;

    const { ctx } = rc;
    const screen = rc.worldToScreen(this.x, this.y);
    const scale = rc.getScale(this.y);
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
  constructor(index, isPlayer = false) {
    this.index = index;
    this.isPlayer = isPlayer;
    this.size = 10 + Math.random() * 6;
    this.hue = isPlayer ? 200 : Math.random() * 360;
    this.shadowOffset = this.size * 0.4;
    this.preferredStat = isPlayer ? preferredBonusStat : null;
    this.initialLives = isPlayer ? playerStats.lives : STARTING_STATS.lives;
    this.justTookDamage = false;
    this.justDealtDamage = false;
    this.damageTimer = 0;
    this.damageDealtTimer = 0;
    this.lastAttacker = null;
    this.frameLastTookDamage = 0; // for avenger pursuitDuration tracking
    this.currentFSMState = 'gathering';
    this.lastAction = '';
    this.lastContext = null;
    this.lastDecisionInfo = { mode: '', action: '', reason: '', firedRule: null };

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
    this.lifetime = 0; // always-incrementing counter, independent of age feature
    this.speedBoostFrames = 0; // frame-based speed boost tracker
    this._reEvalTimer = 0; // periodic re-evaluation timer
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

  // ============ STAT MANAGEMENT ============
  initializeStats() {
    if (this.isPlayer) {
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

  assignRandomStrategy() {
    const templateKeys = Object.keys(NPC_STRATEGY_TEMPLATES);
    const randomKey = templateKeys[Math.floor(Math.random() * templateKeys.length)];
    const template = NPC_STRATEGY_TEMPLATES[randomKey];

    this.npcStrategy = randomKey;
    this.npcBehaviors = { ...template.behaviors };
    this.npcWeights = { ...template.weights };
  }

  resetStats() {
    if (this.isPlayer) {
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

  applyDeathPenalty() {
    if (!npcSettings.deathPenalty.enabled) {
      this.resetStats();
      return;
    }

    const cfg = npcSettings.deathPenalty;
    const penalty = cfg.penaltyPerStat;
    const base = this.baseStats || STARTING_STATS;

    // Apply penalty to base stats so evolution and death penalty compose correctly
    this.speed = Math.max(cfg.minSpeed, base.speed - penalty);
    this.attack = Math.max(cfg.minAttack, base.attack - penalty);
    this.defence = Math.max(cfg.minDefence, base.defence - penalty);

    // Reset lives to base/starting value (use player stats for player bot)
    const baseLives = this.isPlayer ? playerStats.lives : (this.baseStats ? this.baseStats.lives : STARTING_STATS.lives);
    this.lives = baseLives;
    this.initialLives = baseLives;
  }

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

  // ============ SPAWN ============
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

  findDotClusters(radius) {
    const clusterRadius = radius || 150;
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
    if (stat === 'lives') this.initialLives++;
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
    if (stat === 'lives') this.initialLives += 0.1;
  }

  applyRespawnPenalty() {
    const stats = ['speed', 'attack', 'defence', 'lives'];
    const stat = stats[Math.floor(Math.random() * stats.length)];
    const penalty = this[stat] * 0.1;
    const minValue = this.isPlayer ? playerStats[stat] : STARTING_STATS[stat];
    this[stat] = Math.max(minValue, this[stat] - penalty);
  }

  // ============ UPDATE ============
  update() {
    this.lifetime++;

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

    // Frame-based speed boost (replaces setTimeout approach in executeStateAction)
    if (this.speedBoostFrames > 0) {
      this.speedBoostFrames--;
      if (this.speedBoostFrames === 0) {
        this.speed -= 0.5;
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
        console.log('  Strategy mode:', this.isPlayer ? strategyMode : (this.npcStrategy || 'simple'));
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

    // Periodic re-evaluation: re-target every reEvaluationRate frames even while moving
    if (this.combatCooldown === 0) {
      this._reEvalTimer++;
      if (this._reEvalTimer >= globalSettings.reEvaluationRate) {
        this._reEvalTimer = 0;
        this.pickNewTarget();
      }
    }

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
}
