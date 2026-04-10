// Bots Strategy v11 - Combat & Collision System
// Extracted from main.js to make the combat layer testable in isolation.
//
// Pure-logic functions that operate on game state (bots, yellowDots, lifecycleSettings, etc.)
// but have no direct dependency on the canvas or DOM.
//
// Depends on (runtime globals from other files):
//   - bots, yellowDots, camera           (declared in main.js)
//   - frameCount, lifecycleSettings      (declared in config.js)
//   - Bot.prototype methods              (declared in game.js + bot-ai.js)
// Depends on (helper functions from other files):
//   - isProtected, clearRelationshipsOnDeath  (relationships.js)
//   - arePackMates, canCannibalize, handlePackMemberRespawn  (packs.js)
//   - applyInvincibility, breakInvincibility, resetStarvationTimer  (lifecycle.js)
//   - createCorpse, processCorpseCollisions  (corpse.js)
//   - logEvent, logBotRespawn            (log.js)
//   - showEventNotification              (ui-notifications.js)

// ============ COLLISION DETECTION ============
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

function handleCombat(bot1, bot2) {
  if (bot1.combatCooldown > 0 || bot2.combatCooldown > 0) return;

  // Check protection (from relationships/offspring)
  if (typeof isProtected === 'function' && isProtected(bot1, bot2)) {
    return; // Protected pair - no combat
  }

  // Check pack-mate cannibalism gate
  if (typeof arePackMates === 'function' && arePackMates(bot1, bot2)) {
    const canEat1 = typeof canCannibalize === 'function' && canCannibalize(bot1, bot2);
    const canEat2 = typeof canCannibalize === 'function' && canCannibalize(bot2, bot1);
    if (!canEat1 && !canEat2) return; // Pack mates protected unless cannibalism triggers
  }

  // Check invincibility
  const bot1Invincible = bot1.invincibilityFrames > 0;
  const bot2Invincible = bot2.invincibilityFrames > 0;

  // If both invincible, no combat
  if (bot1Invincible && bot2Invincible) return;

  // Break invincibility on combat initiation if configured
  if (lifecycleSettings.respawnInvincibility.breakOnCombatInitiation) {
    if (bot1Invincible) {
      if (typeof breakInvincibility === 'function') breakInvincibility(bot1, 'combatInitiated');
    }
    if (bot2Invincible) {
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
      bot1.frameLastTookDamage = frameCount;
    }
    if (damage2 > 0) {
      bot2.justTookDamage = true;
      bot2.damageTimer = 120;
      bot2.lastAttacker = bot1;
      bot2.frameLastTookDamage = frameCount;
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
      if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onKill) {
        if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot2, 'kill');
      }
    } else if (bot2Dead) {
      bot1.killCount = (bot1.killCount || 0) + 1;
      handleBotDeath(bot2, bot1);
      bot1.addRandomStat();
      if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onKill) {
        if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot1, 'kill');
      }
    } else {
      // Neither died - stalemate resolved via division damage, reset starvation for dealers
      if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onDamageDealt) {
        if (damage2 > 0 && typeof resetStarvationTimer === 'function') resetStarvationTimer(bot1, 'damageDealt');
        if (damage1 > 0 && typeof resetStarvationTimer === 'function') resetStarvationTimer(bot2, 'damageDealt');
      }
      // Neither died - stalemate resolved via division damage, no respawn needed
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
    bot1.frameLastTookDamage = frameCount;
  }
  if (damage2 > 0) {
    bot2.justTookDamage = true;
    bot2.damageTimer = 120;
    bot2.lastAttacker = bot1;
    bot2.frameLastTookDamage = frameCount;

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
    handleBotDeath(bot2, bot1);
    bot1.addRandomStat();

    // Reset starvation on kill
    if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onKill) {
      if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot1, 'kill');
    }
  }
}

// Handle bot death with new NPC mechanics
function handleBotDeath(deadBot, killerBot) {
  // Handle pack membership on death
  if (typeof handlePackMemberRespawn === 'function') {
    handlePackMemberRespawn(deadBot);
  }

  // Clear speed boost BEFORE handleDeath so the stat reset doesn't then get -0.5 applied
  deadBot.speedBoostFrames = 0;

  // Clear relationships on death
  if (typeof clearRelationshipsOnDeath === 'function') {
    clearRelationshipsOnDeath(deadBot);
  }

  // Reset lineage fields on respawn (clearRelationshipsOnDeath intentionally preserves them)
  deadBot.generation = 0;
  deadBot.isPlayerOffspring = false;
  deadBot.playerLineage = 0;
  if (deadBot.relationships) deadBot.relationships.parentId = null;

  // Use new handleDeath method which handles evolution and death penalty
  deadBot.handleDeath(killerBot);
  deadBot.spawnAtRandom();

  // Reset lifecycle properties on respawn
  deadBot.lifetime = 0;
  deadBot.starvationCounter = 0;
  deadBot.isStarving = false;
  deadBot.starvationTickCounter = 0;
  deadBot.age = 0;
  deadBot.reproductionCooldown = 0;
  deadBot.justTookDamage = false;
  deadBot.damageTimer = 0;
  deadBot.justDealtDamage = false;
  deadBot.damageDealtTimer = 0;
  deadBot.lastAttacker = null;
  deadBot.frameLastTookDamage = 0;
  if (deadBot.matingProgress) deadBot.matingProgress.clear();
  if (deadBot.packProximityMap) deadBot.packProximityMap.clear();

  // Clear stale references to this bot in all other bots' maps
  for (const b of bots) {
    if (b === deadBot) continue;
    if (b.matingProgress) b.matingProgress.delete(deadBot.index);
    if (b.packProximityMap) b.packProximityMap.delete(deadBot.index);
  }

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

  if (typeof showEventNotification === 'function') {
    if (killerBot) {
      const killerName = killerBot.isPlayer ? 'Your bot' : `Bot #${killerBot.index}`;
      const deadName = deadBot.isPlayer ? 'Your bot' : `Bot #${deadBot.index}`;
      showEventNotification('kill', `${killerName} eliminated ${deadName}`);
    }
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

  if (deathBehavior === 'corpse') {
    // Full relationship/map cleanup before removing bot
    if (typeof clearRelationshipsOnDeath === 'function') clearRelationshipsOnDeath(bot);
    for (const b of bots) {
      if (b === bot) continue;
      if (b.matingProgress) b.matingProgress.delete(bot.index);
      if (b.packProximityMap) b.packProximityMap.delete(bot.index);
    }
    // Create corpse at bot's location
    if (typeof createCorpse === 'function') {
      createCorpse(bot);
    }
    // Remove bot from game
    const corpseIndex = bots.indexOf(bot);
    if (corpseIndex > -1) {
      bots.splice(corpseIndex, 1);
    }
    // Update camera
    if (camera.followBot === bot) {
      camera.followIndex = 0;
      camera.followBot = bots[0] || null;
    } else if (camera.followBot) {
      camera.followIndex = bots.indexOf(camera.followBot);
    }
  } else if (deathBehavior === 'respawn') {
    // Clear speed boost BEFORE handleDeath (same fix as handleBotDeath)
    bot.speedBoostFrames = 0;
    // Clear relationships and pack membership (same as other death paths)
    if (typeof clearRelationshipsOnDeath === 'function') {
      clearRelationshipsOnDeath(bot);
    }
    // Reset lineage fields
    bot.generation = 0;
    bot.isPlayerOffspring = false;
    bot.playerLineage = 0;
    if (bot.relationships) bot.relationships.parentId = null;
    // Normal respawn
    bot.handleDeath(null);
    bot.spawnAtRandom();
    // Reset lifecycle properties (full reset matching handleBotDeath)
    bot.lifetime = 0;
    bot.starvationCounter = 0;
    bot.isStarving = false;
    bot.starvationTickCounter = 0;
    bot.age = 0;
    bot.reproductionCooldown = 0;
    bot.justTookDamage = false;
    bot.damageTimer = 0;
    bot.justDealtDamage = false;
    bot.damageDealtTimer = 0;
    bot.lastAttacker = null;
    bot.frameLastTookDamage = 0;
    if (bot.matingProgress) bot.matingProgress.clear();
    if (bot.packProximityMap) bot.packProximityMap.clear();
    for (const b of bots) {
      if (b === bot) continue;
      if (b.matingProgress) b.matingProgress.delete(bot.index);
      if (b.packProximityMap) b.packProximityMap.delete(bot.index);
    }
    if (lifecycleSettings.respawnInvincibility.enabled) {
      if (typeof applyInvincibility === 'function') {
        applyInvincibility(bot, lifecycleSettings.respawnInvincibility.duration);
      }
    }
  } else {
    // 'remove' - full relationship/map cleanup before removing bot
    if (typeof clearRelationshipsOnDeath === 'function') clearRelationshipsOnDeath(bot);
    for (const b of bots) {
      if (b === bot) continue;
      if (b.matingProgress) b.matingProgress.delete(bot.index);
      if (b.packProximityMap) b.packProximityMap.delete(bot.index);
    }
    const removeIndex = bots.indexOf(bot);
    if (removeIndex > -1) {
      bots.splice(removeIndex, 1);
    }
    if (camera.followBot === bot) {
      camera.followIndex = 0;
      camera.followBot = bots[0] || null;
    } else if (camera.followBot) {
      camera.followIndex = bots.indexOf(camera.followBot);
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

        if (bot.isPlayer && typeof showEventNotification === 'function') {
          // Don't spam - only show occasionally
          if (Math.random() < 0.3) {
            showEventNotification('levelup', `+0.1 stat gained`);
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
