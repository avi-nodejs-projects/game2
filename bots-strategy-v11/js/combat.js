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

// ============ STAT REWARD / PENALTY MATH (DQ-7 / DQ-ELO) ============
//
// Compute the stat amount to award the killer for a winning combat.
// Defaults to the fixed `+1 per kill` v11 behavior; opt in to
// ratioLinear / ratioSqrt / elo via combatSettings.killReward.mode.
//
// All modes return `base` when the two bots have equal total stats.
// Stronger victim → bigger reward (upset), weaker victim → smaller.
// The 'elo' mode is chess-style:
//   expected = 1/(1 + 10^((victim-killer)/eloScale))
//   delta    = base * 2 * (1 - expected)
// which gives delta ≈ 0 for a dominant killer (no bully reward) and
// delta ≈ 2*base for an upset.
function computeKillReward(killer, victim) {
  const cfg = combatSettings && combatSettings.killReward;
  if (!cfg) return 1;
  const base = cfg.base || 0;
  if (cfg.mode === 'fixed' || !cfg.mode) return base;

  const killerTotal = killer.speed + killer.attack + killer.defence + killer.lives;
  const victimTotal = victim.speed + victim.attack + victim.defence + victim.lives;
  if (killerTotal <= 0) return base;

  switch (cfg.mode) {
    case 'ratioLinear': {
      return base * (victimTotal / killerTotal);
    }
    case 'ratioSqrt': {
      return base * Math.sqrt(victimTotal / killerTotal);
    }
    case 'elo': {
      const eloScale = cfg.eloScale || 400;
      const expected = 1 / (1 + Math.pow(10, (victimTotal - killerTotal) / eloScale));
      return base * 2 * (1 - expected);
    }
    default:
      return base;
  }
}

// Compute the stat amount to subtract from the loser. Only meaningful
// when deathBehavior is 'teleport' — the 'reset' path wipes stats so
// any penalty would be lost. Default mode 'none' returns 0 and is
// what the v11 reset mechanic uses.
//
// When killReward and lossPenalty are configured with the same mode +
// base, symmetric formulas (ratioLinear / ratioSqrt / elo) guarantee
// `computeKillReward(k, v) === computeLossPenalty(v, k)` so total
// stats across the system are conserved across any combat. That is
// the self-balancing property that replaces hard caps.
function computeLossPenalty(loser, killer) {
  const cfg = combatSettings && combatSettings.lossPenalty;
  if (!cfg || cfg.mode === 'none' || !cfg.mode) return 0;
  const base = cfg.base || 0;
  if (cfg.mode === 'fixed') return base;

  const loserTotal = loser.speed + loser.attack + loser.defence + loser.lives;
  const killerTotal = killer.speed + killer.attack + killer.defence + killer.lives;
  if (killerTotal <= 0) return 0;

  switch (cfg.mode) {
    case 'ratioLinear': {
      return base * (loserTotal / killerTotal);
    }
    case 'ratioSqrt': {
      return base * Math.sqrt(loserTotal / killerTotal);
    }
    case 'elo': {
      // Loser's expected win probability. Symmetric with killer's
      // expected: killer_expected + loser_expected == 1.
      const eloScale = cfg.eloScale || 400;
      const loserExpected = 1 / (1 + Math.pow(10, (killerTotal - loserTotal) / eloScale));
      return base * 2 * loserExpected;
    }
    default:
      return base;
  }
}

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
  // use the configured stalemate-breaker strategy.
  if (damage1 <= 0 && damage2 <= 0) {
    const sb = combatSettings && combatSettings.stalemateBreaker;
    if (!sb || !sb.enabled || sb.formula === 'skip') {
      // Walk past each other — no damage, no respawn, clear cooldowns
      // so they can re-engage next frame if desired.
      bot1.combatCooldown = 60;
      bot2.combatCooldown = 60;
      return;
    }
    if (sb.formula === 'forceRespawnBoth') {
      // Both bots respawn, no damage, no kill credit. Good for
      // "reset the board" style games where stalemates are bad
      // but you don't want to invent damage.
      handleBotDeath(bot1, null);
      handleBotDeath(bot2, null);
      return;
    }
    // Default: division formula (original v11 behavior)
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
      // Compute reward + penalty BEFORE handleBotDeath so we use the
      // pre-death stats of both bots (reset path will wipe bot1's).
      const reward1 = computeKillReward(bot2, bot1);
      const penalty1 = computeLossPenalty(bot1, bot2);
      bot2.addRandomStat(reward1);
      handleBotDeath(bot1, bot2, penalty1);
      if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onKill) {
        if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot2, 'kill');
      }
    } else if (bot2Dead) {
      bot1.killCount = (bot1.killCount || 0) + 1;
      const reward2 = computeKillReward(bot1, bot2);
      const penalty2 = computeLossPenalty(bot2, bot1);
      bot1.addRandomStat(reward2);
      handleBotDeath(bot2, bot1, penalty2);
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

  // Normal combat: apply subtraction-based damage (only positive values hurt).
  // If the damage floor is enabled, a weaker attacker can still chip at
  // a stronger defender, which prevents the "god-king" runaway where one
  // bot becomes mathematically invincible and snowballs forever.
  const df = combatSettings && combatSettings.damageFloor;
  const useFloor = df && df.enabled && df.fraction > 0;
  if (useFloor) {
    // Each side's damage is at least (attacker.attack * fraction), unless
    // they're invincible (which already clamped their outgoing damage to 0).
    if (!bot2Invincible || lifecycleSettings.respawnInvincibility.canDealDamage) {
      damage1 = Math.max(damage1, bot2.attack * df.fraction);
    }
    if (!bot1Invincible || lifecycleSettings.respawnInvincibility.canDealDamage) {
      damage2 = Math.max(damage2, bot1.attack * df.fraction);
    }
  }
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
    // bot2 killed bot1. Compute reward + penalty BEFORE handleBotDeath
    // so we use pre-death stats (the 'reset' path wipes bot1's).
    bot2.killCount = (bot2.killCount || 0) + 1;
    const reward = computeKillReward(bot2, bot1);
    const penalty = computeLossPenalty(bot1, bot2);
    bot2.addRandomStat(reward);
    handleBotDeath(bot1, bot2, penalty);

    // Reset starvation on kill
    if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onKill) {
      if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot2, 'kill');
    }
  } else if (bot2Dead) {
    // bot1 killed bot2
    bot1.killCount = (bot1.killCount || 0) + 1;
    const reward = computeKillReward(bot1, bot2);
    const penalty = computeLossPenalty(bot2, bot1);
    bot1.addRandomStat(reward);
    handleBotDeath(bot2, bot1, penalty);

    // Reset starvation on kill
    if (lifecycleSettings.starvation.enabled && lifecycleSettings.starvation.resetConditions.onKill) {
      if (typeof resetStarvationTimer === 'function') resetStarvationTimer(bot1, 'kill');
    }
  }
}

// Handle bot death with new NPC mechanics.
//
// Behavior depends on combatSettings.deathBehavior (DQ-6 / DQ-TELEPORT):
//   'reset'    — (v11 default) full stat reset, respawn at random
//                 location. Legacy behavior.
//   'teleport' — preserve stats, killCount, generation, age, and all
//                 relationships. Refill lives to (possibly reduced)
//                 initialLives. Apply `lossPenaltyAmount` to a random
//                 stat via Bot.applyLossPenalty. The bot "relocated
//                 after a loss" rather than "died".
//   'remove'   — remove bot from game entirely (ecosystem mode).
//
// `lossPenaltyAmount` is the pre-computed penalty from
// computeLossPenalty(loser, killer); ignored in 'reset' and 'remove'
// modes since stats get wiped/removed anyway.
function handleBotDeath(deadBot, killerBot, lossPenaltyAmount = 0) {
  const deathBehavior = (combatSettings && combatSettings.deathBehavior) || 'reset';

  // ---- 'remove' path: remove from game entirely -----------------
  if (deathBehavior === 'remove') {
    if (typeof handlePackMemberRespawn === 'function') {
      handlePackMemberRespawn(deadBot);
    }
    if (typeof clearRelationshipsOnDeath === 'function') {
      clearRelationshipsOnDeath(deadBot);
    }
    for (const b of bots) {
      if (b === deadBot) continue;
      if (b.matingProgress) b.matingProgress.delete(deadBot.index);
      if (b.packProximityMap) b.packProximityMap.delete(deadBot.index);
    }
    const idx = bots.indexOf(deadBot);
    if (idx > -1) bots.splice(idx, 1);
    // Update camera if it was following this bot
    if (camera.followBot === deadBot) {
      camera.followIndex = 0;
      camera.followBot = bots[0] || null;
    } else if (camera.followBot) {
      camera.followIndex = bots.indexOf(camera.followBot);
    }
    if (typeof showEventNotification === 'function' && killerBot) {
      const killerName = killerBot.isPlayer ? 'Your bot' : `Bot #${killerBot.index}`;
      const deadName = deadBot.isPlayer ? 'Your bot' : `Bot #${deadBot.index}`;
      showEventNotification('kill', `${killerName} eliminated ${deadName}`);
    }
    return;
  }

  // ---- 'teleport' path: preserve stats + relationships ---------
  if (deathBehavior === 'teleport') {
    // Apply loss penalty (if any) BEFORE refilling lives, so if the
    // penalty lands on 'lives' stat it shrinks initialLives and the
    // refill below uses the new value.
    if (lossPenaltyAmount > 0 && typeof deadBot.applyLossPenalty === 'function') {
      deadBot.applyLossPenalty(lossPenaltyAmount);
    }

    // Relocate to random point on the map
    deadBot.spawnAtRandom();

    // Refill lives to current max (possibly reduced by penalty above)
    deadBot.lives = deadBot.initialLives;

    // Clear transient combat state. DO NOT clear killCount,
    // generation, age, packId, parentId, childIds — the bot is
    // preserving its history.
    deadBot.combatCooldown = 0;
    deadBot.justTookDamage = false;
    deadBot.damageTimer = 0;
    deadBot.justDealtDamage = false;
    deadBot.damageDealtTimer = 0;
    deadBot.lastAttacker = null;
    deadBot.frameLastTookDamage = 0;
    deadBot.speedBoostFrames = 0;

    // Apply invincibility on "re-entry" if enabled — same as respawn
    // grace period, gives the bot a few frames to orient.
    if (lifecycleSettings.respawnInvincibility.enabled) {
      if (typeof applyInvincibility === 'function') {
        applyInvincibility(deadBot, lifecycleSettings.respawnInvincibility.duration);
      }
    }

    // Log it as a respawn event (same consumer-side data, different
    // semantics — simlog analysis can distinguish via combatSettings
    // recorded in the meta event).
    if (typeof logBotRespawn === 'function') {
      logBotRespawn(deadBot);
    }
    if (typeof showEventNotification === 'function' && killerBot) {
      const killerName = killerBot.isPlayer ? 'Your bot' : `Bot #${killerBot.index}`;
      const deadName = deadBot.isPlayer ? 'Your bot' : `Bot #${deadBot.index}`;
      showEventNotification('kill', `${killerName} defeated ${deadName}`);
    }
    return;
  }

  // ---- 'reset' path: original v11 behavior ---------------------
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
