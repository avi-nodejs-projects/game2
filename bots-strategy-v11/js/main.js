// Bots Strategy v9 - Main Game Loop

// ============ CANVAS & CONTEXT ============
let canvas, ctx;
let rafHandle = null; // requestAnimationFrame handle for cancellation

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

// ============ COORDINATE HELPERS ============
function worldToScreen(worldX, worldY) {
  return {
    x: worldX - camera.x + canvas.width / 2,
    y: worldY - camera.y + canvas.height / 2
  };
}

function isVisible(worldX, worldY, margin = 100) {
  const screen = worldToScreen(worldX, worldY);
  return screen.x > -margin && screen.x < canvas.width + margin &&
         screen.y > -margin && screen.y < canvas.height + margin;
}

function getScale(worldY) {
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

// ============ DRAWING ============
function drawField() {
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
    if (isVisible(worldX, worldY, 50)) {
      const screen = worldToScreen(worldX, worldY);
      const scale = getScale(worldY);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = 'rgba(100, 150, 80, 0.15)';
  for (let i = 0; i < 15; i++) {
    const worldX = (i * 173 + 50) % WORLD_WIDTH;
    const worldY = (i * 131 + 30) % WORLD_HEIGHT;
    if (isVisible(worldX, worldY, 150)) {
      const screen = worldToScreen(worldX, worldY);
      const scale = getScale(worldY);
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, (60 + i * 10) * scale, (30 + i * 5) * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWorldBoundary();
}

function drawWorldBoundary() {
  ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
  ctx.lineWidth = 4;

  const edges = [
    { x1: 0, y1: 0, x2: WORLD_WIDTH, y2: 0 },
    { x1: 0, y1: WORLD_HEIGHT, x2: WORLD_WIDTH, y2: WORLD_HEIGHT },
    { x1: 0, y1: 0, x2: 0, y2: WORLD_HEIGHT },
    { x1: WORLD_WIDTH, y1: 0, x2: WORLD_WIDTH, y2: WORLD_HEIGHT }
  ];

  for (const edge of edges) {
    const start = worldToScreen(edge.x1, edge.y1);
    const end = worldToScreen(edge.x2, edge.y2);

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

function drawMinimap() {
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
  drawField();

  // Draw billboards (before dots and bots, in background)
  if (typeof drawBillboards === 'function') {
    drawBillboards();
  }

  // Draw corpses
  if (lifecycleSettings.age.enabled) {
    if (typeof drawCorpses === 'function') {
      drawCorpses();
    }
  }

  const sortedDots = [...yellowDots].sort((a, b) => a.y - b.y);
  for (const dot of sortedDots) {
    dot.draw();
  }

  const sortedBots = [...bots].sort((a, b) => a.y - b.y);
  for (const bot of sortedBots) {
    bot.draw(bot === camera.followBot);
  }

  drawTargetLine();
  drawMinimap();
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
    canvas.style.display = 'block';
    requestAnimationFrame(() => canvas.classList.add('entering'));
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
  canvas.classList.remove('entering');
  canvas.style.display = 'none';
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
    if (e.key === 'p' || e.key === 'P') {
      simulationPaused = !simulationPaused;
      if (simulationPaused) {
        updateLogOutput();
      }
    }
  });
}

// ============ INITIALIZATION ============
function init() {
  canvas = document.getElementById('field');
  ctx = canvas.getContext('2d');
  canvas.width = 900;
  canvas.height = 700;

  initUI();
  initDebugUI();
  initKeyboardControls();

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('stop-sim-btn').addEventListener('click', stopSimulation);
  document.getElementById('copy-strongest-btn').addEventListener('click', copyStrongestBotAndReconfigure);
  document.getElementById('reset-defaults-btn').addEventListener('click', resetToDefaults);
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
