// Bots Strategy v10 - Main Game Loop and Initialization

// ============ CANVAS & CONTEXT ============
let canvas, ctx;
let statsDiv;

// ============ GAME STATE ============
let yellowDots = [];
let bots = [];
let playerBot = null;        // Legacy single-player reference
let playerBots = [];         // Two-player mode: [player1Bot, player2Bot]
let activePlayerIndex = 0;   // Which player's view is currently active/focused

// ============ GAME LOOP ============
let speedAccumulator = 0;

function animate() {
  if (simulationPaused) {
    requestAnimationFrame(animate);
    return;
  }

  // Speed control: accumulate fractional updates
  speedAccumulator += simulationSpeed;
  const updatesToRun = Math.floor(speedAccumulator);
  speedAccumulator -= updatesToRun;

  for (let updateIdx = 0; updateIdx < updatesToRun; updateIdx++) {
    runGameUpdate();
  }

  // Update both cameras in two-player mode
  updateCamera();
  if (gameMode === 'two-player') {
    updateCamera2();
  }

  // Clear entire canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameMode === 'two-player') {
    // === LEFT VIEWPORT (Player 1) ===
    setLeftViewport();
    ctx.save();
    ctx.beginPath();
    ctx.rect(currentViewport.x, currentViewport.y, currentViewport.width, currentViewport.height);
    ctx.clip();

    drawFieldForViewport();
    drawBillboardsForViewport();
    drawCorpsesForViewport();
    drawDotsForViewport();
    drawBotsForViewport(0); // Player 1's view
    drawTargetLineForViewport(0);
    drawMinimapForViewport(0);
    drawPlayerLabel(0);

    ctx.restore();

    // === DIVIDER ===
    ctx.fillStyle = '#333';
    ctx.fillRect(canvas.width / 2 - 2, 0, 4, canvas.height);

    // === RIGHT VIEWPORT (Player 2) ===
    setRightViewport();
    ctx.save();
    ctx.beginPath();
    ctx.rect(currentViewport.x, currentViewport.y, currentViewport.width, currentViewport.height);
    ctx.clip();

    drawFieldForViewport();
    drawBillboardsForViewport();
    drawCorpsesForViewport();
    drawDotsForViewport();
    drawBotsForViewport(1); // Player 2's view
    drawTargetLineForViewport(1);
    drawMinimapForViewport(1);
    drawPlayerLabel(1);

    ctx.restore();

    // Draw shared HUD elements
    updateTwoPlayerUI();
  } else {
    // === SINGLE PLAYER MODE ===
    setFullViewport();
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
  }

  updateDebugPanel();
  updateSimulationStatus();
  updateStrongestBotDisplay();

  requestAnimationFrame(animate);
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

// ============ STRONGEST BOT CALCULATION ============
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

// ============ GAME START ============
function startGame() {
  document.getElementById('setup').style.display = 'none';
  canvas.style.display = 'block';
  document.getElementById('ui').style.display = 'block';
  document.getElementById('controls').style.display = 'block';
  document.getElementById('sim-controls').style.display = 'flex';
  document.getElementById('strongest-bot-display').style.display = 'block';

  // Show correct controls help
  if (gameMode === 'two-player') {
    document.getElementById('controls-single').style.display = 'none';
    document.getElementById('controls-two-player').style.display = 'inline';
  } else {
    document.getElementById('controls-single').style.display = 'inline';
    document.getElementById('controls-two-player').style.display = 'none';
  }

  // Initialize logging
  initSimulationLog();
  simulationRunning = true;
  simulationPaused = false;

  for (let i = 0; i < DOT_COUNT; i++) {
    yellowDots.push(new YellowDot());
  }

  // Clear player bots array
  playerBots = [];

  if (gameMode === 'two-player') {
    // Two-player mode: create two player bots
    // Player 1
    const player1Bot = new Bot(0, true, 0);
    bots.push(player1Bot);
    playerBots.push(player1Bot);

    // Player 2
    const player2Bot = new Bot(1, true, 1);
    bots.push(player2Bot);
    playerBots.push(player2Bot);

    // Legacy reference points to player 1
    playerBot = player1Bot;

    // Remaining bots are NPCs
    for (let i = 2; i < BOT_COUNT; i++) {
      bots.push(new Bot(i, false));
    }

    // Set up split-screen mode
    setupSplitScreen();
    activePlayerIndex = 0;

    // Camera 1 follows Player 1
    camera.followBot = player1Bot;
    camera.followIndex = 0;
    camera.x = player1Bot.x;
    camera.y = player1Bot.y + camera.offsetY;

    // Camera 2 follows Player 2
    camera2.followBot = player2Bot;
    camera2.followIndex = 1;
    camera2.x = player2Bot.x;
    camera2.y = player2Bot.y + camera2.offsetY;
  } else {
    // Single-player mode (original)
    playerBot = new Bot(0, true, 0);
    bots.push(playerBot);
    playerBots.push(playerBot);

    for (let i = 1; i < BOT_COUNT; i++) {
      bots.push(new Bot(i, false));
    }

    camera.followBot = playerBot;
    camera.followIndex = 0;
  }

  // Capture initial state for log
  captureInitialState();

  animate();
}

// Set up split-screen rendering for two-player mode
function setupSplitScreen() {
  canvas.classList.add('split-screen');
}

// Clean up split-screen mode
function teardownSplitScreen() {
  canvas.classList.remove('split-screen');
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
  // Stop the simulation
  simulationRunning = false;
  simulationPaused = true;

  // Clear game state
  yellowDots.length = 0;
  bots.length = 0;
  playerBot = null;
  playerBots = [];
  activePlayerIndex = 0;
  frameCount = 0;
  decisionCount = 0;
  speedAccumulator = 0;
  simulationSpeed = 1;

  // Teardown split-screen if active
  teardownSplitScreen();

  // Reset canvas size
  canvas.width = 900;
  canvas.height = 700;
  setFullViewport();

  // Clear corpses and packs
  if (typeof corpses !== 'undefined') corpses.length = 0;
  if (typeof packs !== 'undefined') packs.clear();
  if (typeof protectionPairs !== 'undefined') protectionPairs.clear();
  if (typeof billboards !== 'undefined') billboards.length = 0;

  // Reset cameras
  resetCameras();

  // Reset simulation log
  if (typeof resetSimulationLog === 'function') {
    resetSimulationLog();
  }

  // Hide game UI
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
  document.getElementById('setup').style.display = 'block';

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
      if (gameMode === 'two-player') {
        // In two-player mode, TAB cycles through bots in the active player's viewport
        const activeCam = activePlayerIndex === 0 ? camera : camera2;
        activeCam.followIndex = (activeCam.followIndex + 1) % bots.length;
        activeCam.followBot = bots[activeCam.followIndex];
      } else {
        camera.followIndex = (camera.followIndex + 1) % bots.length;
        camera.followBot = bots[camera.followIndex];
      }
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (gameMode === 'two-player') {
        // Toggle auto-follow for active player's camera
        const activeCam = activePlayerIndex === 0 ? camera : camera2;
        activeCam.autoFollow = !activeCam.autoFollow;
      } else {
        camera.autoFollow = !camera.autoFollow;
      }
    }

    // Switch active player (1/2 keys)
    if (gameMode === 'two-player') {
      if (e.key === '1') {
        activePlayerIndex = 0;
        // Snap camera to player 1's bot
        camera.followBot = playerBots[0];
        camera.followIndex = bots.indexOf(playerBots[0]);
      }
      if (e.key === '2') {
        activePlayerIndex = 1;
        // Snap camera to player 2's bot
        camera2.followBot = playerBots[1];
        camera2.followIndex = bots.indexOf(playerBots[1]);
      }
      // Home key: Reset both cameras to their respective player bots
      if (e.key === 'Home') {
        e.preventDefault();
        if (playerBots[0]) {
          camera.followBot = playerBots[0];
          camera.followIndex = bots.indexOf(playerBots[0]);
          camera.autoFollow = true;
        }
        if (playerBots[1]) {
          camera2.followBot = playerBots[1];
          camera2.followIndex = bots.indexOf(playerBots[1]);
          camera2.autoFollow = true;
        }
      }
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
  statsDiv = document.getElementById('stats');

  canvas.width = 900;
  canvas.height = 700;

  // Initialize viewport to full canvas
  setFullViewport();

  initUI();
  initDebugUI();
  initKeyboardControls();

  document.getElementById('start-btn').addEventListener('click', () => {
    // Resize canvas for two-player mode
    if (gameMode === 'two-player') {
      canvas.width = 1400;  // Wider canvas for split-screen
      canvas.height = 700;
    } else {
      canvas.width = 900;
      canvas.height = 700;
    }
    setFullViewport();
    startGame();
  });

  document.getElementById('stop-sim-btn').addEventListener('click', stopSimulation);
  document.getElementById('copy-strongest-btn').addEventListener('click', copyStrongestBotAndReconfigure);
  document.getElementById('reset-defaults-btn').addEventListener('click', resetToDefaults);
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
