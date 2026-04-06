// Bots Strategy v11.2 "The War Room" - Main Game Loop

// ============ CANVAS & CONTEXT ============
let canvas, ctx;
let rafHandle = null; // requestAnimationFrame handle for cancellation

// ============ RENDER CONTEXT ============
// A render context bundles a canvas, its 2d context, and a camera together
// so rendering functions can draw to any panel independently.
let primaryRC = null;

function createRenderContext(canvasEl, cameraObj) {
  const c = canvasEl.getContext('2d');
  return {
    canvas: canvasEl,
    ctx: c,
    camera: cameraObj,
    worldToScreen(worldX, worldY) {
      const zoom = this.camera.zoom || 1;
      return {
        x: (worldX - this.camera.x) * zoom + this.canvas.width / 2,
        y: (worldY - this.camera.y) * zoom + this.canvas.height / 2
      };
    },
    isVisible(worldX, worldY, margin = 100) {
      const screen = this.worldToScreen(worldX, worldY);
      return screen.x > -margin && screen.x < this.canvas.width + margin &&
             screen.y > -margin && screen.y < this.canvas.height + margin;
    },
    getScale(worldY) {
      const zoom = this.camera.zoom || 1;
      const distFromCamera = worldY - this.camera.y;
      const scale = 1 + (distFromCamera / WORLD_HEIGHT) * 0.3;
      return Math.max(0.5, Math.min(1.5, scale)) * zoom;
    }
  };
}

// ============ GAME STATE ============
let yellowDots = [];
let bots = [];
let playerBot = null;

const camera = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  followBot: null,
  followIndex: 0,
  smoothing: 0.08,
  offsetY: -100,
  autoFollow: true
};

// ============ COORDINATE HELPERS (backward compat — delegate to primaryRC) ============
function worldToScreen(worldX, worldY) {
  if (primaryRC) return primaryRC.worldToScreen(worldX, worldY);
  return {
    x: worldX - camera.x + canvas.width / 2,
    y: worldY - camera.y + canvas.height / 2
  };
}

function isVisible(worldX, worldY, margin = 100) {
  if (primaryRC) return primaryRC.isVisible(worldX, worldY, margin);
  const screen = worldToScreen(worldX, worldY);
  return screen.x > -margin && screen.x < canvas.width + margin &&
         screen.y > -margin && screen.y < canvas.height + margin;
}

function getScale(worldY) {
  if (primaryRC) return primaryRC.getScale(worldY);
  const distFromCamera = worldY - camera.y;
  const scale = 1 + (distFromCamera / WORLD_HEIGHT) * 0.3;
  return Math.max(0.5, Math.min(1.5, scale));
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

    // War Room: notify panels of combat
    if (typeof onRelWebCombat === 'function') onRelWebCombat(bot1.index, bot2.index);
    if (typeof recordHeatEvent === 'function') recordHeatEvent((bot1.x + bot2.x) / 2, (bot1.y + bot2.y) / 2, 'combat');

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

  // War Room: notify panels of combat
  if (typeof onRelWebCombat === 'function') onRelWebCombat(bot1.index, bot2.index);
  if (typeof recordHeatEvent === 'function') recordHeatEvent((bot1.x + bot2.x) / 2, (bot1.y + bot2.y) / 2, 'combat');

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
  // War Room: notify panels of death
  if (typeof recordTimelineEvent === 'function') {
    const label = killerBot ? `Bot #${deadBot.index} killed by Bot #${killerBot.index}` : `Bot #${deadBot.index} died`;
    recordTimelineEvent(deadBot.isPlayer ? 'player' : 'death', label);
  }
  if (typeof onBattleCamKill === 'function') onBattleCamKill(deadBot.x, deadBot.y);
  if (typeof recordHeatEvent === 'function') recordHeatEvent(deadBot.x, deadBot.y, 'death');

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
        if (typeof recordHeatEvent === 'function') recordHeatEvent(dot.x, dot.y, 'resource');
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

// ============ TACTICAL OVERLAYS ============
function drawHeatMap(rc) {
  if (!showHeatMap) return;
  const { ctx, canvas } = rc;

  for (let r = 0; r < HEAT_GRID_SIZE; r++) {
    for (let c = 0; c < HEAT_GRID_SIZE; c++) {
      const worldX = c * HEAT_CELL_SIZE;
      const worldY = r * HEAT_CELL_SIZE;
      const center = rc.worldToScreen(worldX + HEAT_CELL_SIZE / 2, worldY + HEAT_CELL_SIZE / 2);
      if (center.x < -HEAT_CELL_SIZE || center.x > canvas.width + HEAT_CELL_SIZE ||
          center.y < -HEAT_CELL_SIZE || center.y > canvas.height + HEAT_CELL_SIZE) continue;

      const idx = r * HEAT_GRID_SIZE + c;
      const combat = Math.min(1, heatMapGrid.combat[idx] / 10);
      const resource = Math.min(1, heatMapGrid.resource[idx] / 20);
      const death = Math.min(1, heatMapGrid.death[idx] / 5);

      const tl = rc.worldToScreen(worldX, worldY);
      const br = rc.worldToScreen(worldX + HEAT_CELL_SIZE, worldY + HEAT_CELL_SIZE);
      const w = br.x - tl.x;
      const h = br.y - tl.y;

      if (combat > 0.01) {
        ctx.fillStyle = `rgba(255, 50, 50, ${combat * 0.3})`;
        ctx.fillRect(tl.x, tl.y, w, h);
      }
      if (resource > 0.01) {
        ctx.fillStyle = `rgba(50, 255, 50, ${resource * 0.2})`;
        ctx.fillRect(tl.x, tl.y, w, h);
      }
      if (death > 0.01) {
        ctx.fillStyle = `rgba(160, 50, 255, ${death * 0.35})`;
        ctx.fillRect(tl.x, tl.y, w, h);
      }
    }
  }
}

function drawThreatRanges(rc) {
  if (!showThreatRanges) return;
  const { ctx } = rc;

  for (const bot of bots) {
    if (!rc.isVisible(bot.x, bot.y, 300)) continue;
    const screen = rc.worldToScreen(bot.x, bot.y);
    const radius = 150 * rc.getScale(bot.y);

    let color;
    if (bot.lastAction === 'hunt' || bot.lastAction === 'hunt_weak') color = 'rgba(255,50,50,0.08)';
    else if (bot.lastAction === 'flee') color = 'rgba(255,255,50,0.08)';
    else color = 'rgba(50,255,50,0.06)';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Thin outline
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.15)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPackTerritories(rc) {
  if (!lifecycleSettings.packs.enabled || typeof packs === 'undefined') return;
  const { ctx } = rc;

  for (const [packId, pack] of packs) {
    const members = [...pack.members]
      .map(idx => bots.find(b => b.index === idx))
      .filter(Boolean);
    if (members.length < 2) continue;

    // Compute convex hull
    const points = members.map(m => rc.worldToScreen(m.x, m.y));
    const hull = convexHull(points);
    if (hull.length < 2) continue;

    ctx.fillStyle = `hsla(${pack.hue}, 70%, 50%, 0.08)`;
    ctx.strokeStyle = `hsla(${pack.hue}, 70%, 50%, 0.25)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i++) {
      ctx.lineTo(hull[i].x, hull[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// Simple convex hull (Graham scan)
function convexHull(points) {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);

  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ============ DRAWING ============
function drawField(rc) {
  const { ctx, canvas } = rc;
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.3);
  skyGradient.addColorStop(0, '#87CEEB');
  skyGradient.addColorStop(1, '#4a7c3f');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.3);

  const gradient = ctx.createLinearGradient(0, canvas.height * 0.2, 0, canvas.height);
  gradient.addColorStop(0, '#4a7c3f');
  gradient.addColorStop(1, '#2d5a27');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, canvas.height * 0.2, canvas.width, canvas.height * 0.8);

  ctx.fillStyle = 'rgba(60, 100, 50, 0.3)';
  for (let i = 0; i < 300; i++) {
    const worldX = ((i * 127) % WORLD_WIDTH);
    const worldY = ((i * 89) % WORLD_HEIGHT);
    if (rc.isVisible(worldX, worldY, 50)) {
      const screen = rc.worldToScreen(worldX, worldY);
      const scale = rc.getScale(worldY);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = 'rgba(100, 150, 80, 0.15)';
  for (let i = 0; i < 15; i++) {
    const worldX = (i * 173 + 50) % WORLD_WIDTH;
    const worldY = (i * 131 + 30) % WORLD_HEIGHT;
    if (rc.isVisible(worldX, worldY, 150)) {
      const screen = rc.worldToScreen(worldX, worldY);
      const scale = rc.getScale(worldY);
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, (60 + i * 10) * scale, (30 + i * 5) * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWorldBoundary(rc);
}

function drawWorldBoundary(rc) {
  const { ctx, canvas } = rc;
  ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
  ctx.lineWidth = 4;

  const edges = [
    { x1: 0, y1: 0, x2: WORLD_WIDTH, y2: 0 },
    { x1: 0, y1: WORLD_HEIGHT, x2: WORLD_WIDTH, y2: WORLD_HEIGHT },
    { x1: 0, y1: 0, x2: 0, y2: WORLD_HEIGHT },
    { x1: WORLD_WIDTH, y1: 0, x2: WORLD_WIDTH, y2: WORLD_HEIGHT }
  ];

  for (const edge of edges) {
    const start = rc.worldToScreen(edge.x1, edge.y1);
    const end = rc.worldToScreen(edge.x2, edge.y2);

    if ((start.x >= -100 && start.x <= canvas.width + 100) ||
        (end.x >= -100 && end.x <= canvas.width + 100) ||
        (start.y >= -100 && start.y <= canvas.height + 100) ||
        (end.y >= -100 && end.y <= canvas.height + 100)) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }
}

function drawMinimap(rc) {
  const { ctx, canvas } = rc;
  const mapSize = 160;
  const mapX = canvas.width - mapSize - 15;
  const mapY = 15;
  const scale = mapSize / Math.max(WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(mapX, mapY, mapSize, mapSize);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);

  ctx.fillStyle = '#ffdd00';
  for (const dot of yellowDots) {
    ctx.beginPath();
    ctx.arc(mapX + dot.x * scale, mapY + dot.y * scale, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const bot of bots) {
    if (bot.isPlayer) {
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath();
      ctx.arc(mapX + bot.x * scale, mapY + bot.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('★', mapX + bot.x * scale, mapY + bot.y * scale + 3);
    } else {
      ctx.fillStyle = bot === camera.followBot ? '#ffffff' : `hsl(${bot.hue}, 60%, 50%)`;
      ctx.beginPath();
      ctx.arc(mapX + bot.x * scale, mapY + bot.y * scale, bot === camera.followBot ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const viewLeft = (camera.x - canvas.width / 2) * scale;
  const viewTop = (camera.y - canvas.height / 2) * scale;
  const viewWidth = canvas.width * scale;
  const viewHeight = canvas.height * scale;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX + viewLeft, mapY + viewTop, viewWidth, viewHeight);
}

function updateCamera() {
  if (camera.followBot && camera.autoFollow) {
    const targetX = camera.followBot.x;
    const targetY = camera.followBot.y + camera.offsetY;

    camera.x += (targetX - camera.x) * camera.smoothing;
    camera.y += (targetY - camera.y) * camera.smoothing;
  }
}

function updateUI() {
  const bot = camera.followBot;
  if (!bot) return;

  // Update HUD bot name/tag
  const nameEl = document.getElementById('hud-bot-name');
  const tagEl = document.getElementById('hud-bot-tag');
  if (nameEl) nameEl.textContent = bot.isPlayer ? 'Your Bot' : `Bot #${bot.index}`;
  if (tagEl) {
    tagEl.textContent = bot.isPlayer ? 'PLAYER' : 'NPC';
    tagEl.className = 'hud-bot-tag ' + (bot.isPlayer ? 'player' : 'npc');
  }

  // Update stat values and bars
  const maxStatDisplay = 20; // reasonable max for bar display
  const statMap = {speed: 'hud-speed', attack: 'hud-attack', defence: 'hud-defence', lives: 'hud-lives'};
  const barMap = {speed: 'hud-bar-speed', attack: 'hud-bar-attack', defence: 'hud-bar-defence', lives: 'hud-bar-lives'};

  for (const [stat, id] of Object.entries(statMap)) {
    const el = document.getElementById(id);
    if (el) el.textContent = bot[stat].toFixed(1);
    const bar = document.getElementById(barMap[stat]);
    if (bar) bar.style.width = Math.min(100, (bot[stat] / maxStatDisplay) * 100) + '%';
  }

  // Update extra info
  const posEl = document.getElementById('hud-position');
  if (posEl) posEl.textContent = `X: ${Math.round(bot.x)} Y: ${Math.round(bot.y)}`;
  const killsEl = document.getElementById('hud-kills');
  if (killsEl) killsEl.textContent = `Kills: ${bot.killCount || 0}`;
  const actionEl = document.getElementById('hud-action');
  if (actionEl) actionEl.textContent = `Action: ${bot.lastAction || 'idle'}`;

}

// ============ GAME LOOP ============
let speedAccumulator = 0;

function animate() {
  if (!simulationRunning) return; // stop loop on simulation end; do not re-queue
  if (simulationPaused) {
    rafHandle = requestAnimationFrame(animate);
    return;
  }

  // Speed control: accumulate fractional updates
  speedAccumulator += simulationSpeed;
  const updatesToRun = Math.floor(speedAccumulator);
  speedAccumulator -= updatesToRun;

  for (let updateIdx = 0; updateIdx < updatesToRun; updateIdx++) {
    runGameUpdate();
  }

  // Always draw once per frame
  updateCamera();
  drawField(primaryRC);

  // Tactical overlays (Panel 1)
  drawHeatMap(primaryRC);
  drawThreatRanges(primaryRC);
  drawPackTerritories(primaryRC);

  // Draw billboards (before dots and bots, in background)
  if (typeof drawBillboards === 'function') {
    drawBillboards(primaryRC);
  }

  // Draw corpses
  if (lifecycleSettings.age.enabled) {
    if (typeof drawCorpses === 'function') {
      drawCorpses(primaryRC);
    }
  }

  const sortedDots = [...yellowDots].sort((a, b) => a.y - b.y);
  for (const dot of sortedDots) {
    dot.draw(primaryRC);
  }

  const sortedBots = [...bots].sort((a, b) => a.y - b.y);
  for (const bot of sortedBots) {
    bot.draw(primaryRC, bot === camera.followBot);
  }

  drawTargetLine(primaryRC);
  drawMinimap(primaryRC);

  // ---- PANEL 2: Relationship Web (every 3 frames) ----
  if (frameCount % 3 === 0 && typeof drawRelationshipGraph === 'function') {
    syncRelationshipNodes();
    computeForces();
    drawRelationshipGraph();
  }

  // ---- PANEL 3: Population Timeline (every 10 frames) ----
  if (frameCount % 10 === 0 && typeof drawTimeline === 'function') {
    drawTimeline();
  }

  // ---- PANEL 4: Battle Cam (every frame for smooth camera) ----
  if (typeof drawBattleCam === 'function' && typeof battleCam !== 'undefined') {
    if (frameCount % battleCam.evalInterval === 0) updateBattleCamDirector();
    updateBattleCamCamera();
    drawBattleCam();
  }

  // ---- UI updates ----
  updateUI();
  if (frameCount % 10 === 0) updateDebugPanel();
  updateSimulationStatus();
  updateStrongestBotDisplay();

  rafHandle = requestAnimationFrame(animate);
}

function runGameUpdate() {
  frameCount++;

  // ===== LIFECYCLE UPDATES =====

  // Update invincibility timers
  if (lifecycleSettings.respawnInvincibility.enabled) {
    for (const bot of bots) {
      if (typeof updateInvincibility === 'function') {
        updateInvincibility(bot);
      }
    }
  }

  // Update starvation
  if (lifecycleSettings.starvation.enabled) {
    for (let i = bots.length - 1; i >= 0; i--) {
      const bot = bots[i];
      if (typeof updateStarvation === 'function') {
        const result = updateStarvation(bot);
        if (result === 'death') {
          handleStarvationDeath(bot);
        }
      }
    }
  }

  // Update age
  if (lifecycleSettings.age.enabled) {
    for (let i = bots.length - 1; i >= 0; i--) {
      const bot = bots[i];
      if (typeof updateAge === 'function') {
        const result = updateAge(bot);
        if (result === 'death') {
          handleAgeDeath(bot);
        }
      }
    }
  }

  // Update protections
  if (typeof updateProtections === 'function') {
    updateProtections();
  }

  // Update reproduction cooldowns
  if (typeof updateReproductionCooldowns === 'function') {
    updateReproductionCooldowns();
  }

  // Check asexual reproduction
  if (lifecycleSettings.reproduction.asexual.enabled) {
    if (typeof checkAsexualReproduction === 'function') {
      checkAsexualReproduction();
    }
  }

  // Update mating progress (sexual reproduction)
  if (lifecycleSettings.reproduction.sexual.enabled) {
    if (typeof updateAllMatingProgress === 'function') {
      updateAllMatingProgress();
    }
  }

  // Update pack formation (every 60 frames)
  if (lifecycleSettings.packs.enabled && frameCount % 60 === 0) {
    if (typeof evaluatePackFormation === 'function') {
      evaluatePackFormation();
    }
    if (typeof updatePacks === 'function') {
      updatePacks();
    }
  }

  // Update corpses
  if (lifecycleSettings.age.enabled) {
    if (typeof updateCorpses === 'function') {
      updateCorpses();
    }
  }

  // Update billboards
  if (typeof updateBillboards === 'function') {
    updateBillboards();
  }

  // ===== END LIFECYCLE UPDATES =====

  processCollisions();

  // Update bots (no drawing here)
  for (const bot of bots) {
    bot.update();
  }

  // Timeline snapshot
  if (typeof captureTimelineSnapshot === 'function' && typeof timeline !== 'undefined' && frameCount % timeline.snapshotInterval === 0) {
    captureTimelineSnapshot();
  }

  // Heat map decay
  if (frameCount % 60 === 0) {
    decayHeatMap();
  }
}

function updateSimulationStatus() {
  const statusEl = document.getElementById('sim-status');
  if (statusEl) {
    statusEl.textContent = `Frame: ${frameCount} | Decisions: ${decisionCount}/${simulationSettings.maxDecisions || '∞'} | Speed: x${simulationSpeed}`;
  }
}

// Find the bot that would win against all others in a 1v1 encounter
function findStrongestBot() {
  if (bots.length === 0) return null;

  let strongestBot = null;
  let maxWinScore = -Infinity;

  for (const bot of bots) {
    let winScore = 0;

    for (const other of bots) {
      if (bot === other) continue;

      // Calculate damage per encounter using the new formula
      // Primary: attack - defence, fallback to attack / defence if both <= 0
      let damageWeDealtToOther = bot.attack - other.defence;
      let damageWeTakeFromOther = other.attack - bot.defence;

      // If both would take no damage, use division formula
      if (damageWeDealtToOther <= 0 && damageWeTakeFromOther <= 0) {
        damageWeDealtToOther = bot.attack / Math.max(other.defence, 0.1);
        damageWeTakeFromOther = other.attack / Math.max(bot.defence, 0.1);
      } else {
        // Only positive damage counts
        damageWeDealtToOther = Math.max(0, damageWeDealtToOther);
        damageWeTakeFromOther = Math.max(0, damageWeTakeFromOther);
      }

      // Survivability: how many hits we can take vs how many hits to kill them
      const hitsToKillThem = damageWeDealtToOther > 0 ? Math.ceil(other.lives / damageWeDealtToOther) : Infinity;
      const hitsToKillUs = damageWeTakeFromOther > 0 ? Math.ceil(bot.lives / damageWeTakeFromOther) : Infinity;

      // We win if we can kill them before they kill us
      if (hitsToKillThem < hitsToKillUs) {
        winScore += 1;
      } else if (hitsToKillThem === hitsToKillUs) {
        // Tie-breaker: higher total stats
        const ourTotal = bot.speed + bot.attack + bot.defence + bot.lives;
        const theirTotal = other.speed + other.attack + other.defence + other.lives;
        if (ourTotal > theirTotal) winScore += 0.5;
      }
    }

    if (winScore > maxWinScore) {
      maxWinScore = winScore;
      strongestBot = bot;
    }
  }

  return strongestBot;
}

let _strongestBotCache = null;
let _strongestBotCacheFrame = -60;

function updateStrongestBotDisplay() {
  const displayEl = document.getElementById('strongest-bot-display');
  if (!displayEl) return;

  // Recompute at most once every 60 frames — findStrongestBot is O(N²)
  if (frameCount - _strongestBotCacheFrame >= 60) {
    _strongestBotCacheFrame = frameCount;
    _strongestBotCache = findStrongestBot();
  }
  const strongest = _strongestBotCache;
  if (strongest) {
    const isPlayer = strongest.isPlayer;
    const marker = isPlayer ? ' (YOU)' : '';
    displayEl.innerHTML = `
      <strong>Strongest:</strong> Bot #${strongest.index + 1}${marker}
      <span style="color:hsl(${strongest.hue},60%,60%);">●</span>
      SPD:${strongest.speed.toFixed(1)} ATK:${strongest.attack.toFixed(1)} DEF:${strongest.defence.toFixed(1)} HP:${strongest.lives.toFixed(1)}
    `;
  } else {
    displayEl.innerHTML = '<strong>Strongest:</strong> N/A';
  }
}

// ============ GAME START ============
function startGame() {
  const setup = document.getElementById('setup');
  setup.classList.add('exiting');
  setTimeout(() => {
    setup.style.display = 'none';
    document.getElementById('war-room').classList.add('active');
    document.getElementById('ui').style.display = 'block';
    document.getElementById('controls').style.display = 'flex';
    document.getElementById('sim-controls').style.display = 'flex';
    document.getElementById('strongest-bot-display').style.display = 'block';
  }, 400);

  // Initialize logging
  initSimulationLog();
  simulationRunning = true;
  simulationPaused = false;

  for (let i = 0; i < DOT_COUNT; i++) {
    yellowDots.push(new YellowDot());
  }

  playerBot = new Bot(0, true);
  bots.push(playerBot);

  for (let i = 1; i < BOT_COUNT; i++) {
    bots.push(new Bot(i, false));
  }

  // nextBotIndex starts after all initial bots so createOffspring never collides
  nextBotIndex = BOT_COUNT;

  // Capture initial state for log
  captureInitialState();

  camera.followBot = playerBot;
  camera.followIndex = 0;

  animate();
}

// ============ COPY STRONGEST BOT AND RECONFIGURE ============
function copyStrongestBotAndReconfigure() {
  const strongest = findStrongestBot();
  if (!strongest) {
    stopSimulation();
    return;
  }

  // Copy stats from strongest bot
  // Normalize stats to fit within TOTAL_POINTS
  const totalStats = strongest.speed + strongest.attack + strongest.defence + strongest.lives;
  const ratio = TOTAL_POINTS / totalStats;

  // Scale stats proportionally and round
  let newSpeed = Math.max(MIN_STAT, Math.round(strongest.speed * ratio));
  let newAttack = Math.max(0, Math.round(strongest.attack * ratio)); // attack can be 0
  let newDefence = Math.max(MIN_STAT, Math.round(strongest.defence * ratio));
  let newLives = Math.max(MIN_STAT, Math.round(strongest.lives * ratio));

  // Adjust for rounding errors - add/remove from highest stat
  let currentTotal = newSpeed + newAttack + newDefence + newLives;
  while (currentTotal < TOTAL_POINTS) {
    // Add to highest original stat
    if (strongest.lives >= strongest.speed && strongest.lives >= strongest.attack && strongest.lives >= strongest.defence) {
      newLives++;
    } else if (strongest.attack >= strongest.speed && strongest.attack >= strongest.defence) {
      newAttack++;
    } else if (strongest.defence >= strongest.speed) {
      newDefence++;
    } else {
      newSpeed++;
    }
    currentTotal++;
  }
  while (currentTotal > TOTAL_POINTS) {
    // Remove from lowest stat (that can be reduced)
    if (newAttack > 0 && strongest.attack <= strongest.speed && strongest.attack <= strongest.defence && strongest.attack <= strongest.lives) {
      newAttack--;
    } else if (newLives > MIN_STAT && strongest.lives <= strongest.speed && strongest.lives <= strongest.defence) {
      newLives--;
    } else if (newDefence > MIN_STAT && strongest.defence <= strongest.speed) {
      newDefence--;
    } else if (newSpeed > MIN_STAT) {
      newSpeed--;
    } else if (newAttack > 0) {
      newAttack--;
    }
    currentTotal--;
  }

  playerStats.speed = newSpeed;
  playerStats.attack = newAttack;
  playerStats.defence = newDefence;
  playerStats.lives = newLives;

  // Copy strategy if strongest is NPC with random strategy
  let strategiesCopied = false;
  if (!strongest.isPlayer && strongest.npcBehaviors && strongest.npcWeights) {
    // Copy NPC's behavior weights to the global behaviorWeights
    Object.keys(behaviorWeights).forEach(key => {
      if (strongest.npcBehaviors.hasOwnProperty(key)) {
        behaviorWeights[key].enabled = strongest.npcBehaviors[key];
      }
      if (strongest.npcWeights.hasOwnProperty(key)) {
        behaviorWeights[key].weight = strongest.npcWeights[key];
      }
    });
    // Set strategy mode to simple since we're copying behavior weights
    strategyMode = 'simple';

    // Update the mode tab UI to reflect the copied strategy
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.mode-tab[data-mode="simple"]').classList.add('active');
    document.querySelectorAll('.strategy-mode').forEach(m => m.style.display = 'none');
    document.getElementById('simple-mode').style.display = 'block';
    strategiesCopied = true;
  }
  // If strongest is player, keep current strategy settings

  // Store flag for stopSimulationInternal to switch to Strategy tab
  window._strategiesCopied = strategiesCopied;

  // Now stop and reconfigure
  stopSimulationInternal();
}

// ============ STOP SIMULATION (internal helper) ============
function stopSimulationInternal() {
  // Cancel the pending animation frame before clearing state
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }

  // Stop the simulation
  simulationRunning = false;
  simulationPaused = false;

  // Clear game state
  yellowDots.length = 0;
  bots.length = 0;
  playerBot = null;
  frameCount = 0;
  nextBotIndex = 0;
  decisionCount = 0;
  speedAccumulator = 0;
  simulationSpeed = 1;

  // Clear corpses and packs
  if (typeof corpses !== 'undefined') corpses.length = 0;
  if (typeof packs !== 'undefined') packs.clear();

  // Invalidate per-frame context cache so stale bot refs from old sim aren't served
  if (typeof _ctxGlobalCacheFrame !== 'undefined') {
    _ctxGlobalCacheFrame = -1;
    _ctxGlobalCache = null;
  }
  _strongestBotCache = null;
  _strongestBotCacheFrame = -60;
  if (typeof protectionPairs !== 'undefined') protectionPairs.clear();
  if (typeof billboards !== 'undefined') billboards.length = 0;

  // Reset War Room panel states
  resetHeatMap();
  if (typeof resetTimeline === 'function') resetTimeline();
  if (typeof resetBattleCam === 'function') resetBattleCam();
  if (typeof relWeb !== 'undefined') {
    relWeb.nodes.clear();
    relWeb.combatEdges.length = 0;
  }

  // Reset camera
  camera.x = WORLD_WIDTH / 2;
  camera.y = WORLD_HEIGHT / 2;
  camera.followBot = null;
  camera.followIndex = 0;
  camera.autoFollow = true;

  // Reset simulation log
  if (typeof resetSimulationLog === 'function') {
    resetSimulationLog();
  }

  // Hide game UI
  document.getElementById('war-room').classList.remove('active');
  // Reset fullscreen panel state
  if (fullscreenPanel !== null) {
    const panel = document.querySelector(`[data-panel="${fullscreenPanel}"]`);
    if (panel) panel.classList.remove('fullscreen');
    document.querySelectorAll('.panel').forEach(p => p.style.display = '');
    fullscreenPanel = null;
  }
  document.getElementById('ui').style.display = 'none';
  document.getElementById('controls').style.display = 'none';
  document.getElementById('sim-controls').style.display = 'none';
  document.getElementById('debug-panel').classList.remove('visible');
  document.getElementById('strongest-bot-display').style.display = 'none';
  hideLogPanel();

  // Reset speed buttons
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.speed === '1') btn.classList.add('active');
  });

  // Show setup page with updated settings
  document.getElementById('setup').style.display = 'flex';
  document.getElementById('setup').classList.remove('exiting');

  // If strategies were copied, switch to the Strategy tab
  if (window._strategiesCopied) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="strategy"]').classList.add('active');
    document.getElementById('strategy-tab').classList.add('active');
    window._strategiesCopied = false;
  }

  // Update UI to reflect current settings
  updateStatsUI();
  renderBehaviorList();
  renderRuleList();
  renderStateMachine();
  updateLifecycleUI();
  updateBillboardUI();

  // Update global settings UI
  document.getElementById('reeval-rate').value = globalSettings.reEvaluationRate;
  document.getElementById('switch-cooldown').value = globalSettings.behaviorSwitchCooldown;
  document.getElementById('randomness-noise').value = globalSettings.randomnessNoise * 100;
  document.getElementById('noise-value').textContent = globalSettings.randomnessNoise.toFixed(2);
  document.getElementById('emergency-enabled').checked = globalSettings.emergencyOverride.enabled;
  document.getElementById('emergency-threshold').value = globalSettings.emergencyOverride.livesThreshold;
  document.getElementById('emergency-behavior').value = globalSettings.emergencyOverride.behavior;

  // Update NPC settings UI
  document.getElementById('npc-random-stats').checked = npcSettings.randomStats.enabled;
  document.getElementById('npc-death-penalty').checked = npcSettings.deathPenalty.enabled;
  document.getElementById('npc-evolution').checked = npcSettings.evolution.enabled;
  document.getElementById('npc-evolution-ratio').value = npcSettings.evolution.inheritRatio * 100;
  document.getElementById('evolution-ratio-value').textContent = npcSettings.evolution.inheritRatio.toFixed(2);
  document.getElementById('npc-random-strategy').checked = npcSettings.randomStrategy.enabled;

  // Update simulation settings UI
  document.getElementById('max-decisions').value = simulationSettings.maxDecisions;
  document.getElementById('logging-enabled').checked = simulationSettings.loggingEnabled;
  document.getElementById('log-all-bots').checked = simulationSettings.logAllBots;
  document.getElementById('pause-on-complete').checked = simulationSettings.pauseOnComplete;

  // Update strategy mode tab selection
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.mode-tab[data-mode="${strategyMode}"]`).classList.add('active');
  document.querySelectorAll('.strategy-mode').forEach(m => m.style.display = 'none');
  document.getElementById(strategyMode + '-mode').style.display = 'block';
}

// ============ STOP SIMULATION ============
function stopSimulation() {
  stopSimulationInternal();
}

// ============ KEYBOARD CONTROLS ============
function initKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    // Panel shortcuts work even without bots
    if (e.key === '1') { toggleFullscreen(1); return; }
    if (e.key === '2') { toggleFullscreen(2); return; }
    if (e.key === '3') { toggleFullscreen(3); return; }
    if (e.key === '4') { toggleFullscreen(4); return; }
    if (e.key === 'Escape') {
      if (fullscreenPanel !== null) { toggleFullscreen(fullscreenPanel); return; }
    }

    if (bots.length === 0) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      camera.followIndex = (camera.followIndex + 1) % bots.length;
      camera.followBot = bots[camera.followIndex];
    }
    if (e.key === ' ') {
      e.preventDefault();
      camera.autoFollow = !camera.autoFollow;
    }
    if (e.key === 'd' || e.key === 'D') {
      debugMode = !debugMode;
      const panel = document.getElementById('debug-panel');
      if (debugMode) {
        panel.classList.add('visible');
        updateDebugPanel();
      } else {
        panel.classList.remove('visible');
      }
    }
    if (e.key === 'l' || e.key === 'L') {
      const panel = document.getElementById('log-panel');
      if (panel.classList.contains('visible')) {
        hideLogPanel();
      } else {
        updateLogOutput();
        showLogPanel();
      }
    }
    if (e.key === 'h' || e.key === 'H') {
      showHeatMap = !showHeatMap;
    }
    if (e.key === 't' || e.key === 'T') {
      showThreatRanges = !showThreatRanges;
    }
    if (e.key === 'p' || e.key === 'P') {
      simulationPaused = !simulationPaused;
      if (simulationPaused) {
        updateLogOutput();
      }
    }
  });
}

// ============ INITIALIZATION ============
// ============ PANEL MANAGEMENT ============
let activePanel = 1;
let fullscreenPanel = null;
let showHeatMap = false;
let showThreatRanges = false;

// ============ HEAT MAP ============
const HEAT_GRID_SIZE = 20;
const HEAT_CELL_SIZE = WORLD_WIDTH / HEAT_GRID_SIZE;
const heatMapGrid = {
  combat: new Float32Array(HEAT_GRID_SIZE * HEAT_GRID_SIZE),
  resource: new Float32Array(HEAT_GRID_SIZE * HEAT_GRID_SIZE),
  death: new Float32Array(HEAT_GRID_SIZE * HEAT_GRID_SIZE)
};

function recordHeatEvent(worldX, worldY, type) {
  const col = Math.floor(worldX / HEAT_CELL_SIZE);
  const row = Math.floor(worldY / HEAT_CELL_SIZE);
  if (col >= 0 && col < HEAT_GRID_SIZE && row >= 0 && row < HEAT_GRID_SIZE) {
    heatMapGrid[type][row * HEAT_GRID_SIZE + col] += 1;
  }
}

function decayHeatMap() {
  for (let i = 0; i < HEAT_GRID_SIZE * HEAT_GRID_SIZE; i++) {
    heatMapGrid.combat[i] *= 0.98;
    heatMapGrid.resource[i] *= 0.98;
    heatMapGrid.death[i] *= 0.98;
  }
}

function resetHeatMap() {
  heatMapGrid.combat.fill(0);
  heatMapGrid.resource.fill(0);
  heatMapGrid.death.fill(0);
}

function setActivePanel(panelNum) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-panel'));
  const panel = document.querySelector(`[data-panel="${panelNum}"]`);
  if (panel) panel.classList.add('active-panel');
  activePanel = panelNum;
}

function toggleFullscreen(panelNum) {
  const warRoom = document.getElementById('war-room');
  const panel = document.querySelector(`[data-panel="${panelNum}"]`);
  if (!panel) return;

  if (fullscreenPanel === panelNum) {
    // Return to quad view
    panel.classList.remove('fullscreen');
    document.querySelectorAll('.panel').forEach(p => p.style.display = '');
    warRoom.style.display = 'grid';
    fullscreenPanel = null;
  } else {
    // Exit previous fullscreen if any
    if (fullscreenPanel !== null) {
      const prev = document.querySelector(`[data-panel="${fullscreenPanel}"]`);
      if (prev) prev.classList.remove('fullscreen');
      document.querySelectorAll('.panel').forEach(p => p.style.display = '');
      warRoom.style.display = 'grid';
    }
    // Go fullscreen
    document.querySelectorAll('.panel').forEach(p => {
      p.style.display = (p.dataset.panel == panelNum) ? '' : 'none';
    });
    panel.classList.add('fullscreen');
    fullscreenPanel = panelNum;
  }
  // Trigger resize for canvas sizing
  window.dispatchEvent(new Event('resize'));
}

function initPanelChrome() {
  // Click panel to set active
  document.querySelectorAll('.panel').forEach(panel => {
    panel.addEventListener('mousedown', () => {
      setActivePanel(parseInt(panel.dataset.panel));
    });
  });
  // Maximize buttons
  document.querySelectorAll('.panel-maximize').forEach(btn => {
    const panel = btn.closest('.panel');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen(parseInt(panel.dataset.panel));
    });
  });
  // Double-click titlebar to fullscreen
  document.querySelectorAll('.panel-titlebar').forEach(titlebar => {
    const panel = titlebar.closest('.panel');
    titlebar.addEventListener('dblclick', () => {
      toggleFullscreen(parseInt(panel.dataset.panel));
    });
  });

  setActivePanel(1);
}

function initCanvasResize() {
  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      const c = entry.target.querySelector('canvas');
      if (c) {
        const titlebar = entry.target.querySelector('.panel-titlebar');
        const titlebarH = titlebar ? titlebar.offsetHeight : 24;
        c.width = Math.floor(entry.contentRect.width);
        c.height = Math.floor(entry.contentRect.height - titlebarH);
      }
    }
  });
  document.querySelectorAll('.panel').forEach(p => ro.observe(p));
}

function init() {
  // Primary canvas for tactical panel
  canvas = document.getElementById('canvas-tactical');
  ctx = canvas.getContext('2d');
  // Initial size — will be overridden by ResizeObserver
  canvas.width = 900;
  canvas.height = 700;

  primaryRC = createRenderContext(canvas, camera);

  initUI();
  initDebugUI();
  initKeyboardControls();
  initPanelChrome();
  initCanvasResize();

  // Init panel modules if available
  if (typeof initRelationshipPanel === 'function') initRelationshipPanel();
  if (typeof initTimelinePanel === 'function') initTimelinePanel();
  if (typeof initBattleCamPanel === 'function') initBattleCamPanel();

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('stop-sim-btn').addEventListener('click', stopSimulation);
  document.getElementById('copy-strongest-btn').addEventListener('click', copyStrongestBotAndReconfigure);
  document.getElementById('reset-defaults-btn').addEventListener('click', resetToDefaults);
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
