// Bots Strategy v10 - Lifecycle System
// Handles: Invincibility, Starvation, Age

// ============ INVINCIBILITY ============

function applyInvincibility(bot, duration) {
  if (!lifecycleSettings.respawnInvincibility.enabled) return;

  bot.invincibilityFrames = duration || lifecycleSettings.respawnInvincibility.duration;
  logEvent('INVINCIBILITY_START', {
    botIndex: bot.index,
    duration: bot.invincibilityFrames
  });
}

function updateInvincibility(bot) {
  if (bot.invincibilityFrames > 0) {
    bot.invincibilityFrames--;
    if (bot.invincibilityFrames === 0) {
      logEvent('INVINCIBILITY_END', {
        botIndex: bot.index,
        reason: 'expired'
      });
    }
  }
}

function isInvincible(bot) {
  return bot.invincibilityFrames > 0;
}

function breakInvincibility(bot, reason) {
  if (bot.invincibilityFrames > 0) {
    bot.invincibilityFrames = 0;
    logEvent('INVINCIBILITY_END', {
      botIndex: bot.index,
      reason: reason || 'combatInitiated'
    });
  }
}

function canDealDamageWhileInvincible() {
  return lifecycleSettings.respawnInvincibility.canDealDamage;
}

function shouldBreakInvincibilityOnCombat() {
  return lifecycleSettings.respawnInvincibility.breakOnCombatInitiation;
}

// ============ STARVATION ============

function resetStarvationTimer(bot, reason) {
  if (!lifecycleSettings.starvation.enabled) return;

  const wasStarving = bot.isStarving;
  bot.starvationCounter = 0;
  bot.isStarving = false;
  bot.starvationTickCounter = 0;

  if (wasStarving) {
    logEvent('STARVATION_RESET', {
      botIndex: bot.index,
      reason: reason
    });
  }
}

function updateStarvation(bot) {
  if (!lifecycleSettings.starvation.enabled) return;

  // Check player override
  if (bot.isPlayer && lifecycleSettings.playerOverrides.enabled &&
      lifecycleSettings.playerOverrides.starvation &&
      !lifecycleSettings.playerOverrides.starvation.enabled) {
    return;
  }

  const cfg = lifecycleSettings.starvation;

  // Calculate effective threshold with scaling
  let effectiveThreshold = cfg.inactivityThreshold;
  if (cfg.scaling.enabled) {
    const totalStats = bot.speed + bot.attack + bot.defence + bot.lives;
    const statDiff = totalStats - cfg.scaling.baselineStats;
    if (statDiff > 0) {
      const scaleFactor = 1 - (statDiff * cfg.scaling.factor);
      effectiveThreshold = Math.max(60, effectiveThreshold * Math.max(0.1, scaleFactor));
    }
  }

  bot.starvationCounter++;

  if (bot.starvationCounter >= effectiveThreshold) {
    bot.isStarving = true;

    // Only apply damage on tick intervals
    if (!bot.starvationTickCounter) bot.starvationTickCounter = 0;
    bot.starvationTickCounter++;

    if (bot.starvationTickCounter >= cfg.tickInterval) {
      bot.starvationTickCounter = 0;

      // Apply damage
      const previousLives = bot.lives;
      bot.lives -= cfg.damagePerTick;

      // Apply stat decay
      let statDecayed = null;
      if (cfg.statDecay.enabled) {
        statDecayed = applyStarvationStatDecay(bot);
      }

      logEvent('STARVATION_TICK', {
        botIndex: bot.index,
        livesRemaining: bot.lives,
        livesLost: cfg.damagePerTick,
        statDecayed: statDecayed
      });

      // Check for starvation death
      if (bot.lives <= 0) {
        return 'death';
      }
    }
  }

  return null;
}

function applyStarvationStatDecay(bot) {
  const cfg = lifecycleSettings.starvation.statDecay;
  const stats = ['speed', 'attack', 'defence'];
  let targetStat;

  switch (cfg.order) {
    case 'lowestFirst':
      targetStat = stats.reduce((min, s) => bot[s] < bot[min] ? s : min, 'speed');
      break;
    case 'highestFirst':
      targetStat = stats.reduce((max, s) => bot[s] > bot[max] ? s : max, 'speed');
      break;
    case 'random':
    default:
      targetStat = stats[Math.floor(Math.random() * stats.length)];
      break;
  }

  const minValue = cfg.minStats[targetStat];
  if (bot[targetStat] > minValue) {
    bot[targetStat] = Math.max(minValue, bot[targetStat] - cfg.decayPerTick);
    return { stat: targetStat, newValue: bot[targetStat] };
  }

  return null;
}

function getStarvationProgress(bot) {
  if (!lifecycleSettings.starvation.enabled) return 0;

  const cfg = lifecycleSettings.starvation;
  let effectiveThreshold = cfg.inactivityThreshold;

  if (cfg.scaling.enabled) {
    const totalStats = bot.speed + bot.attack + bot.defence + bot.lives;
    const statDiff = totalStats - cfg.scaling.baselineStats;
    if (statDiff > 0) {
      const scaleFactor = 1 - (statDiff * cfg.scaling.factor);
      effectiveThreshold = Math.max(60, effectiveThreshold * Math.max(0.1, scaleFactor));
    }
  }

  return Math.min(1, bot.starvationCounter / effectiveThreshold);
}

// ============ AGE ============

function updateAge(bot) {
  if (!lifecycleSettings.age.enabled) return null;

  // Check player override
  if (bot.isPlayer && lifecycleSettings.playerOverrides.enabled &&
      lifecycleSettings.playerOverrides.age &&
      !lifecycleSettings.playerOverrides.age.enabled) {
    return null;
  }

  bot.age++;

  if (bot.age >= lifecycleSettings.age.maxAge) {
    return 'death';
  }

  return null;
}

function getAgeProgress(bot) {
  if (!lifecycleSettings.age.enabled) return 0;
  return bot.age / lifecycleSettings.age.maxAge;
}

function getAgeVisualFactor(bot) {
  if (!lifecycleSettings.age.enabled) return 1;

  const ageProgress = getAgeProgress(bot);
  const decayStart = lifecycleSettings.age.visualDecayStart;

  if (ageProgress < decayStart) return 1;

  // Linear decay from 1 to 0.5 between decayStart and 1.0
  const decayProgress = (ageProgress - decayStart) / (1 - decayStart);
  return 1 - (decayProgress * 0.5);
}

// ============ LIFECYCLE INITIALIZATION ============

function initBotLifecycleProperties(bot) {
  // Invincibility
  bot.invincibilityFrames = 0;

  // Starvation
  bot.starvationCounter = 0;
  bot.isStarving = false;
  bot.starvationTickCounter = 0;

  // Age
  bot.age = 0;

  // Reproduction
  bot.reproductionCooldown = 0;
  bot.offspringCount = 0;
  bot.generation = 0;
  bot.isPlayerOffspring = false;
  bot.playerLineage = 0;

  // Relationships
  bot.relationships = {
    parentId: null,
    secondParentId: null,
    childIds: [],
    packId: null,
    mateHistory: [],
    protectedFrom: [],
    protectedBy: []
  };

  // Mating progress (for sexual reproduction)
  bot.matingProgress = new Map();
}

function resetBotLifecycleOnRespawn(bot) {
  // Reset invincibility (will be applied after respawn)
  bot.invincibilityFrames = 0;

  // Reset starvation
  bot.starvationCounter = 0;
  bot.isStarving = false;
  bot.starvationTickCounter = 0;

  // Reset age
  bot.age = 0;

  // Reset reproduction cooldown
  bot.reproductionCooldown = 0;

  // Clear mating progress
  bot.matingProgress.clear();
}

// ============ HELPER FUNCTIONS ============

function shouldApplyLifecycleToBot(bot, feature) {
  // Check if feature is enabled globally
  if (!lifecycleSettings[feature] || !lifecycleSettings[feature].enabled) {
    return false;
  }

  // Check player override
  if (bot.isPlayer && lifecycleSettings.playerOverrides.enabled) {
    const override = lifecycleSettings.playerOverrides[feature];
    if (override !== undefined && override.enabled !== undefined) {
      return override.enabled;
    }
  }

  return true;
}
