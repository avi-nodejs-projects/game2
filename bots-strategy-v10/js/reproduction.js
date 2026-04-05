// Bots Strategy v10 - Reproduction System
// Handles: Asexual and Sexual reproduction, Stat inheritance, Strategy blending

// ============ ASEXUAL REPRODUCTION ============

function canReproduceAsexual(bot) {
  const cfg = lifecycleSettings.reproduction.asexual;
  if (!cfg.enabled) return false;

  // Check player override
  if (bot.isPlayer && lifecycleSettings.playerOverrides.enabled) {
    const override = lifecycleSettings.playerOverrides.reproduction;
    if (override && override.enabled === false) return false;
  }

  // Check cooldown
  if (bot.reproductionCooldown > 0) return false;

  // Check maturity
  if (!isMature(bot)) return false;

  // Check minimum lives (need enough to split)
  const livesNeeded = bot.lives * cfg.parentLifeCost;
  if (bot.lives - livesNeeded < 1) return false;

  return true;
}

function isMature(bot) {
  const cfg = lifecycleSettings.reproduction.asexual;

  switch (cfg.maturityMetric) {
    case 'frames':
      return bot.age >= cfg.maturityThreshold;
    case 'stats':
      const totalStats = bot.speed + bot.attack + bot.defence + bot.lives;
      return totalStats >= cfg.maturityThreshold;
    case 'kills':
      return (bot.killCount || 0) >= cfg.maturityThreshold;
    case 'hybrid':
      const hybridScore = bot.age / 600 + (bot.killCount || 0) * 10;
      return hybridScore >= cfg.maturityThreshold / 100;
    default:
      return bot.age >= cfg.maturityThreshold;
  }
}

function reproduceAsexual(parent) {
  if (!canReproduceAsexual(parent)) return null;

  const cfg = lifecycleSettings.reproduction.asexual;

  // Calculate offspring stats
  const offspringStats = calculateOffspringStatsAsexual(parent);

  // Calculate spawn position
  const spawnPos = calculateSpawnPosition(parent);

  // Create offspring
  const offspring = createOffspring(parent, null, offspringStats, spawnPos);

  // Parent loses lives
  parent.lives -= parent.lives * cfg.parentLifeCost;

  // Set cooldown
  parent.reproductionCooldown = cfg.cooldown;

  // Set up protection
  const protectionDuration = lifecycleSettings.reproduction.offspring.protection.duration;
  addProtection(parent, offspring, protectionDuration);

  // Apply invincibility to offspring if enabled
  if (lifecycleSettings.respawnInvincibility.enabled) {
    applyInvincibility(offspring, lifecycleSettings.respawnInvincibility.duration);
  }

  logEvent('REPRODUCTION_ASEXUAL', {
    parentIndex: parent.index,
    offspringIndex: offspring.index,
    offspringStats: offspringStats,
    generation: offspring.generation,
    parentLivesRemaining: parent.lives
  });

  return offspring;
}

function calculateOffspringStatsAsexual(parent) {
  const cfg = lifecycleSettings.reproduction.asexual;
  const noise = cfg.statNoise;

  const stats = {};
  ['speed', 'attack', 'defence', 'lives'].forEach(stat => {
    const baseValue = parent[stat];
    const variation = (Math.random() - 0.5) * 2 * noise * baseValue;
    stats[stat] = Math.max(stat === 'attack' ? 0 : 1, Math.round((baseValue + variation) * 10) / 10);
  });

  // Normalize to maintain reasonable total
  const targetTotal = TOTAL_POINTS;
  const currentTotal = stats.speed + stats.attack + stats.defence + stats.lives;
  if (currentTotal > targetTotal * 1.5) {
    const scale = (targetTotal * 1.5) / currentTotal;
    stats.speed = Math.max(1, Math.round(stats.speed * scale * 10) / 10);
    stats.attack = Math.max(0, Math.round(stats.attack * scale * 10) / 10);
    stats.defence = Math.max(1, Math.round(stats.defence * scale * 10) / 10);
    stats.lives = Math.max(1, Math.round(stats.lives * scale * 10) / 10);
  }

  return stats;
}

function calculateSpawnPosition(parent) {
  const cfg = lifecycleSettings.reproduction.asexual;
  const minDist = cfg.spawnDistance.min;
  const maxDist = cfg.spawnDistance.max;
  const dist = minDist + Math.random() * (maxDist - minDist);

  let x, y;

  switch (cfg.spawnLocation) {
    case 'random':
      const margin = 100;
      x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
      y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
      break;
    case 'parentDirection':
      const angle = parent.angle || Math.random() * Math.PI * 2;
      x = parent.x + Math.cos(angle) * dist;
      y = parent.y + Math.sin(angle) * dist;
      break;
    case 'nearParent':
    default:
      const randomAngle = Math.random() * Math.PI * 2;
      x = parent.x + Math.cos(randomAngle) * dist;
      y = parent.y + Math.sin(randomAngle) * dist;
      break;
  }

  // Clamp to world bounds
  x = Math.max(50, Math.min(WORLD_WIDTH - 50, x));
  y = Math.max(50, Math.min(WORLD_HEIGHT - 50, y));

  return { x, y };
}

// ============ SEXUAL REPRODUCTION ============

function canReproduceSexual(bot1, bot2) {
  const cfg = lifecycleSettings.reproduction.sexual;
  if (!cfg.enabled) return false;

  // Check cooldowns
  if (bot1.reproductionCooldown > 0 || bot2.reproductionCooldown > 0) return false;

  // Check maturity
  if (!isMature(bot1) || !isMature(bot2)) return false;

  // Check compatibility
  const similarity = calculateStrategySimilarity(bot1, bot2);
  if (similarity < cfg.compatibilityThreshold) return false;

  return true;
}

function updateMatingProgress(bot1, bot2) {
  const cfg = lifecycleSettings.reproduction.sexual;
  if (!cfg.enabled) return;

  const dist = Math.sqrt(
    Math.pow(bot1.x - bot2.x, 2) + Math.pow(bot1.y - bot2.y, 2)
  );

  if (dist <= cfg.proximityDistance) {
    // Increment mating progress
    const key = Math.min(bot1.index, bot2.index) + '-' + Math.max(bot1.index, bot2.index);

    let progress = bot1.matingProgress.get(bot2.index) || 0;
    progress++;
    bot1.matingProgress.set(bot2.index, progress);
    bot2.matingProgress.set(bot1.index, progress);

    // Check if reproduction threshold reached
    if (progress >= cfg.proximityDuration && canReproduceSexual(bot1, bot2)) {
      reproduceSexual(bot1, bot2);
      // Reset progress
      bot1.matingProgress.delete(bot2.index);
      bot2.matingProgress.delete(bot1.index);
    }
  } else {
    // Reset progress if too far apart
    bot1.matingProgress.delete(bot2.index);
    bot2.matingProgress.delete(bot1.index);
  }
}

function reproduceSexual(parent1, parent2) {
  const cfg = lifecycleSettings.reproduction.sexual;

  // Calculate offspring stats
  const offspringStats = calculateOffspringStatsSexual(parent1, parent2);

  // Calculate spawn position (between parents)
  const spawnPos = {
    x: (parent1.x + parent2.x) / 2 + (Math.random() - 0.5) * 50,
    y: (parent1.y + parent2.y) / 2 + (Math.random() - 0.5) * 50
  };
  spawnPos.x = Math.max(50, Math.min(WORLD_WIDTH - 50, spawnPos.x));
  spawnPos.y = Math.max(50, Math.min(WORLD_HEIGHT - 50, spawnPos.y));

  // Create offspring
  const offspring = createOffspring(parent1, parent2, offspringStats, spawnPos);

  // Set cooldowns
  parent1.reproductionCooldown = cfg.cooldown;
  parent2.reproductionCooldown = cfg.cooldown;

  // Record mate history
  parent1.relationships.mateHistory.push({ botIndex: parent2.index, frame: frameCount });
  parent2.relationships.mateHistory.push({ botIndex: parent1.index, frame: frameCount });

  // Set up protection with both parents
  const protectionDuration = lifecycleSettings.reproduction.offspring.protection.duration;
  addProtection(parent1, offspring, protectionDuration);
  addProtection(parent2, offspring, protectionDuration);

  // Apply invincibility to offspring if enabled
  if (lifecycleSettings.respawnInvincibility.enabled) {
    applyInvincibility(offspring, lifecycleSettings.respawnInvincibility.duration);
  }

  logEvent('REPRODUCTION_SEXUAL', {
    parent1Index: parent1.index,
    parent2Index: parent2.index,
    offspringIndex: offspring.index,
    offspringStats: offspringStats,
    generation: offspring.generation,
    arePackMates: arePackMates(parent1, parent2)
  });

  return offspring;
}

function calculateOffspringStatsSexual(parent1, parent2) {
  const cfg = lifecycleSettings.reproduction;
  const inheritanceCfg = cfg.strategyInheritance;
  const noise = inheritanceCfg.noise;

  // Pack mate bonus
  let bonus = 0;
  if (cfg.sexual.packBonus.enabled && arePackMates(parent1, parent2)) {
    bonus = 0.1; // 10% bonus to stats
  }

  const stats = {};
  ['speed', 'attack', 'defence', 'lives'].forEach(stat => {
    // Average of both parents
    const avgValue = (parent1[stat] + parent2[stat]) / 2;
    // Add variation
    const variation = (Math.random() - 0.5) * 2 * noise * avgValue;
    // Apply pack bonus
    const bonusValue = avgValue * bonus;
    stats[stat] = Math.max(stat === 'attack' ? 0 : 1, Math.round((avgValue + variation + bonusValue) * 10) / 10);
  });

  return stats;
}

// ============ OFFSPRING CREATION ============

function createOffspring(parent1, parent2, stats, position) {
  // Create new bot
  const newIndex = bots.length;
  const offspring = new Bot(newIndex, false);

  // Set position
  offspring.x = position.x;
  offspring.y = position.y;
  offspring.targetX = position.x;
  offspring.targetY = position.y;

  // Set stats
  offspring.speed = stats.speed;
  offspring.attack = stats.attack;
  offspring.defence = stats.defence;
  offspring.lives = stats.lives;
  offspring.initialLives = stats.lives;

  // Set base stats for evolution system
  offspring.baseStats = { ...stats };

  // Set visual properties
  offspring.hue = blendHue(parent1.hue, parent2 ? parent2.hue : parent1.hue);

  // Initialize lifecycle properties
  initBotLifecycleProperties(offspring);

  // Set parent relationship
  setParent(offspring, parent1);
  if (parent2) {
    // For sexual reproduction, track second parent in a different way
    offspring.relationships.secondParentId = parent2.index;
    parent2.relationships.childIds.push(offspring.index);
    parent2.offspringCount = (parent2.offspringCount || 0) + 1;
  }

  // Inherit strategy
  inheritStrategy(offspring, parent1, parent2);

  // Add to game
  bots.push(offspring);

  return offspring;
}

function blendHue(hue1, hue2) {
  // Handle hue wrapping (0-360)
  let diff = hue2 - hue1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  let blended = hue1 + diff / 2 + (Math.random() - 0.5) * 30; // Some variation
  if (blended < 0) blended += 360;
  if (blended >= 360) blended -= 360;

  return blended;
}

function inheritStrategy(offspring, parent1, parent2) {
  const cfg = lifecycleSettings.reproduction.strategyInheritance;

  // Only inherit for NPCs
  if (!parent1.npcStrategy && !parent2?.npcStrategy) return;

  let behaviors, weights;

  switch (cfg.method) {
    case 'randomParent':
      const selectedParent = Math.random() < 0.5 ? parent1 : (parent2 || parent1);
      behaviors = { ...selectedParent.npcBehaviors };
      weights = { ...selectedParent.npcWeights };
      break;

    case 'dominant':
      // Use parent with higher total stats
      const p1Stats = parent1.speed + parent1.attack + parent1.defence + parent1.lives;
      const p2Stats = parent2 ? parent2.speed + parent2.attack + parent2.defence + parent2.lives : 0;
      const dominant = p1Stats >= p2Stats ? parent1 : parent2;
      behaviors = { ...dominant.npcBehaviors };
      weights = { ...dominant.npcWeights };
      break;

    case 'blend':
    default:
      behaviors = {};
      weights = {};

      Object.keys(BEHAVIORS).forEach(key => {
        const w1 = parent1.npcWeights?.[key] || 0;
        const w2 = parent2?.npcWeights?.[key] || w1;
        const avgWeight = (w1 + w2) / 2;
        const noise = (Math.random() - 0.5) * 2 * cfg.noise * avgWeight;
        weights[key] = Math.max(0, Math.round(avgWeight + noise));
        behaviors[key] = weights[key] > 0;
      });
      break;
  }

  // Apply mutation
  if (Math.random() < cfg.mutationChance) {
    const behaviorKeys = Object.keys(BEHAVIORS);
    const mutatedKey = behaviorKeys[Math.floor(Math.random() * behaviorKeys.length)];
    weights[mutatedKey] = Math.floor(Math.random() * 100);
    behaviors[mutatedKey] = weights[mutatedKey] > 0;
  }

  offspring.npcBehaviors = behaviors;
  offspring.npcWeights = weights;
  offspring.npcStrategy = 'inherited';
}

// ============ MATING PROGRESS UPDATES ============

function updateAllMatingProgress() {
  const cfg = lifecycleSettings.reproduction.sexual;
  if (!cfg.enabled) return;

  // Check all bot pairs for mating progress
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const bot1 = bots[i];
      const bot2 = bots[j];

      // Skip protected pairs (already related)
      if (isProtected(bot1, bot2)) continue;

      // Skip bots in combat
      if (bot1.combatCooldown > 0 || bot2.combatCooldown > 0) continue;

      updateMatingProgress(bot1, bot2);
    }
  }
}

// ============ REPRODUCTION COOLDOWN UPDATE ============

function updateReproductionCooldowns() {
  for (const bot of bots) {
    if (bot.reproductionCooldown > 0) {
      bot.reproductionCooldown--;
    }
  }
}

// ============ REPRODUCTION CHECKS ============

function checkAsexualReproduction() {
  const cfg = lifecycleSettings.reproduction.asexual;
  if (!cfg.enabled) return;

  for (const bot of bots) {
    if (canReproduceAsexual(bot)) {
      reproduceAsexual(bot);
    }
  }
}
