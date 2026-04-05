// Bots Strategy v10 - Collision Detection and Combat

// ============ COLLISION CHECKS ============
function checkBotDotCollision(bot, dot) {
  const dx = bot.x - dot.x;
  const dy = bot.y - dot.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < bot.size + dot.size;
}

function checkBotBotCollision(bot1, bot2) {
  const dx = bot1.x - bot2.x;
  const dy = bot1.y - bot2.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < bot1.size + bot2.size;
}

// ============ COMBAT ============
function handleCombat(bot1, bot2) {
  if (bot1.combatCooldown > 0 || bot2.combatCooldown > 0) return;

  // Check protection (from relationships/offspring)
  if (typeof isProtected === 'function' && isProtected(bot1, bot2)) {
    return; // Protected pair - no combat
  }

  // Check invincibility
  const bot1Invincible = bot1.invincibilityFrames > 0;
  const bot2Invincible = bot2.invincibilityFrames > 0;

  // If both invincible, no combat
  if (bot1Invincible && bot2Invincible) return;

  // Break invincibility on combat initiation if configured
  if (lifecycleSettings.respawnInvincibility.breakOnCombatInitiation) {
    // The bot that moved toward the other initiates combat
    // For simplicity, break both if either is invincible and not configured to deal damage
    if (bot1Invincible && !lifecycleSettings.respawnInvincibility.canDealDamage) {
      if (typeof breakInvincibility === 'function') breakInvincibility(bot1, 'combatInitiated');
    }
    if (bot2Invincible && !lifecycleSettings.respawnInvincibility.canDealDamage) {
      if (typeof breakInvincibility === 'function') breakInvincibility(bot2, 'combatInitiated');
    }
  }

  const bot1LivesBefore = bot1.lives;
  const bot2LivesBefore = bot2.lives;

  // Calculate damage using subtraction: attack - defence
  // Invincible bots take no damage
  let damage1 = bot1Invincible ? 0 : bot2.attack - bot1.defence;
  let damage2 = bot2Invincible ? 0 : bot1.attack - bot2.defence;

  // Invincible bots can't deal damage unless configured
  if (bot1Invincible && !lifecycleSettings.respawnInvincibility.canDealDamage) {
    damage2 = 0;
  }
  if (bot2Invincible && !lifecycleSettings.respawnInvincibility.canDealDamage) {
    damage1 = 0;
  }

  // If both bots would take no damage (both have defence >= opponent's attack),
  // use division formula and respawn both at different positions
  if (damage1 <= 0 && damage2 <= 0) {
    // Use division formula: attack / defence
    damage1 = bot1Invincible ? 0 : bot2.attack / Math.max(bot1.defence, 0.1);
    damage2 = bot2Invincible ? 0 : bot1.attack / Math.max(bot2.defence, 0.1);

    // Re-apply invincibility damage restriction
    if (bot1Invincible && !lifecycleSettings.respawnInvincibility.canDealDamage) {
      damage2 = 0;
    }
    if (bot2Invincible && !lifecycleSettings.respawnInvincibility.canDealDamage) {
      damage1 = 0;
    }

    bot1.lives -= damage1;
    bot2.lives -= damage2;

    // Set damage flags
    if (damage1 > 0) {
      bot1.justTookDamage = true;
      bot1.damageTimer = 120;
      bot1.lastAttacker = bot2;
    }
    if (damage2 > 0) {
      bot2.justTookDamage = true;
      bot2.damageTimer = 120;
      bot2.lastAttacker = bot1;
    }
    if (damage2 > 0) {
      bot1.justDealtDamage = true;
      bot1.damageDealtTimer = 120;
    }
    if (damage1 > 0) {
      bot2.justDealtDamage = true;
      bot2.damageDealtTimer = 120;
    }

    bot1.combatCooldown = 60;
    bot2.combatCooldown = 60;

    // Check for deaths in stalemate scenario
    const bot1Dead = bot1.lives <= 0;
    const bot2Dead = bot2.lives <= 0;

    if (bot1Dead && bot2Dead) {
      handleBotDeath(bot1, null);
      handleBotDeath(bot2, null);
    } else if (bot1Dead) {
      bot2.killCount = (bot2.killCount || 0) + 1;
      handleBotDeath(bot1, bot2);
      bot2.addRandomStat();
    } else if (bot2Dead) {
      bot1.killCount = (bot1.killCount || 0) + 1;
      handleBotDeath(bot2, bot1);
      bot1.addRandomStat();
    } else {
      // Neither died - just respawn both at different random positions
      bot1.spawnAtRandom();
      bot2.spawnAtRandom();
    }
    return;
  }

  // Normal combat: apply subtraction-based damage (only positive values hurt)
  damage1 = Math.max(0, damage1);
  damage2 = Math.max(0, damage2);

  bot1.lives -= damage1;
  bot2.lives -= damage2;

  if (damage1 > 0) {
    bot1.justTookDamage = true;
    bot1.damageTimer = 120;
    bot1.lastAttacker = bot2;
  }
  if (damage2 > 0) {
    bot2.justTookDamage = true;
    bot2.damageTimer = 120;
    bot2.lastAttacker = bot1;

    // Reset starvation for bot1 (dealt damage)
    if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onDamageDealt) {
      if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot1, 'damageDealt');
    }
  }

  if (damage2 > 0) {
    bot1.justDealtDamage = true;
    bot1.damageDealtTimer = 120;
  }
  if (damage1 > 0) {
    bot2.justDealtDamage = true;
    bot2.damageDealtTimer = 120;

    // Reset starvation for bot2 (dealt damage)
    if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onDamageDealt) {
      if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot2, 'damageDealt');
    }
  }

  bot1.combatCooldown = 60;
  bot2.combatCooldown = 60;

  const bot1Dead = bot1.lives <= 0;
  const bot2Dead = bot2.lives <= 0;

  if (bot1Dead && bot2Dead) {
    // Both died - no clear winner, use null as killer
    handleBotDeath(bot1, null);
    handleBotDeath(bot2, null);
  } else if (bot1Dead) {
    const bot1LostLives = bot1LivesBefore - bot1.lives;
    const bot2LostLives = bot2LivesBefore - bot2.lives;

    // bot2 killed bot1
    bot2.killCount = (bot2.killCount || 0) + 1;
    // Apply penalty BEFORE death handling so it affects baseStats before respawn
    if (bot1LostLives >= bot2LostLives) {
      bot1.applyRespawnPenalty();
    }
    handleBotDeath(bot1, bot2);
    bot2.addRandomStat();

    // Reset starvation on kill
    if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onKill) {
      if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot2, 'kill');
    }
  } else if (bot2Dead) {
    const bot1LostLives = bot1LivesBefore - bot1.lives;
    const bot2LostLives = bot2LivesBefore - bot2.lives;

    // bot1 killed bot2
    bot1.killCount = (bot1.killCount || 0) + 1;
    // Apply penalty BEFORE death handling so it affects baseStats before respawn
    if (bot2LostLives >= bot1LostLives) {
      bot2.applyRespawnPenalty();
    }
    handleBotDeath(bot2, bot1);
    bot1.addRandomStat();

    // Reset starvation on kill
    if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onKill) {
      if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot1, 'kill');
    }
  }
}

// ============ DEATH HANDLING ============

// Handle bot death with new NPC mechanics
function handleBotDeath(deadBot, killerBot) {
  // Handle pack membership on death
  if (typeof handlePackMemberRespawn === 'function') {
    handlePackMemberRespawn(deadBot);
  }

  // Clear relationships on death
  if (typeof clearRelationshipsOnDeath === 'function') {
    clearRelationshipsOnDeath(deadBot);
  }

  // Use new handleDeath method which handles evolution and death penalty
  deadBot.handleDeath(killerBot);
  deadBot.spawnAtRandom();

  // Reset lifecycle properties on respawn
  deadBot.starvationCounter = 0;
  deadBot.isStarving = false;
  deadBot.starvationTickCounter = 0;
  deadBot.age = 0;
  deadBot.reproductionCooldown = 0;
  if (deadBot.matingProgress) deadBot.matingProgress.clear();
  if (deadBot.packProximityMap) deadBot.packProximityMap.clear();

  // Apply invincibility on respawn if enabled
  if (lifecycleSettings.respawnInvincibility.enabled) {
    if (typeof applyInvincibility === 'function') {
      applyInvincibility(deadBot, lifecycleSettings.respawnInvincibility.duration);
    }
  }

  // Log respawn
  if (typeof logBotRespawn === 'function') {
    logBotRespawn(deadBot);
  }
}

// Handle age death (separate from combat death)
function handleAgeDeath(bot) {
  const deathBehavior = lifecycleSettings.age.deathBehavior;

  logEvent('AGE_DEATH', {
    botIndex: bot.index,
    finalStats: {
      speed: bot.speed,
      attack: bot.attack,
      defence: bot.defence,
      lives: bot.lives
    },
    offspringCount: bot.offspringCount || 0,
    age: bot.age
  });

  // Handle pack membership
  if (typeof handlePackMemberRespawn === 'function') {
    handlePackMemberRespawn(bot);
  }

  // Clear relationships on death
  if (typeof clearRelationshipsOnDeath === 'function') {
    clearRelationshipsOnDeath(bot);
  }

  if (deathBehavior === 'corpse') {
    // Create corpse at bot's location
    if (typeof createCorpse === 'function') {
      createCorpse(bot);
    }
    // Remove bot from game
    const index = bots.indexOf(bot);
    if (index > -1) {
      bots.splice(index, 1);
    }
    // Update camera if following this bot
    if (camera.followBot === bot) {
      camera.followIndex = 0;
      camera.followBot = bots[0] || null;
    }
    // Update camera2 if following this bot (two-player mode)
    if (camera2.followBot === bot) {
      camera2.followIndex = 0;
      camera2.followBot = bots[0] || null;
    }
  } else if (deathBehavior === 'respawn') {
    // Normal respawn
    bot.handleDeath(null);
    bot.spawnAtRandom();
    // Reset lifecycle properties
    bot.starvationCounter = 0;
    bot.isStarving = false;
    bot.age = 0;
    if (lifecycleSettings.respawnInvincibility.enabled) {
      if (typeof applyInvincibility === 'function') {
        applyInvincibility(bot, lifecycleSettings.respawnInvincibility.duration);
      }
    }
  } else {
    // 'remove' - just remove from game
    const index = bots.indexOf(bot);
    if (index > -1) {
      bots.splice(index, 1);
    }
    if (camera.followBot === bot) {
      camera.followIndex = 0;
      camera.followBot = bots[0] || null;
    }
    // Update camera2 if following this bot (two-player mode)
    if (camera2.followBot === bot) {
      camera2.followIndex = 0;
      camera2.followBot = bots[0] || null;
    }
  }
}

// Handle starvation death
function handleStarvationDeath(bot) {
  logEvent('STARVATION_DEATH', {
    botIndex: bot.index,
    finalStats: {
      speed: bot.speed,
      attack: bot.attack,
      defence: bot.defence,
      lives: bot.lives
    }
  });

  handleBotDeath(bot, null);
}

// ============ COLLISION PROCESSING ============
function processCollisions() {
  // Bot-Dot collisions
  for (const bot of bots) {
    for (const dot of yellowDots) {
      if (checkBotDotCollision(bot, dot)) {
        bot.addPartialRandomStat();
        dot.respawn();

        // Reset starvation on dot consumption
        if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onDotEaten) {
          if (typeof resetStarvationTimer === 'function') {
            resetStarvationTimer(bot, 'dotEaten');
          }
        }
      }
    }
  }

  // Bot-Bot collisions (combat)
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      if (checkBotBotCollision(bots[i], bots[j])) {
        handleCombat(bots[i], bots[j]);
      }
    }
  }

  // Bot-Corpse collisions
  if (lifecycleSettings.age.enabled && typeof processCorpseCollisions === 'function') {
    processCorpseCollisions();
  }
}
