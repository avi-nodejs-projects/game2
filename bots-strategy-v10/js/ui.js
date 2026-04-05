// Bots Strategy v10 - UI Core (Game Mode, Stats, Tabs, Init)

// ============ GAME MODE TOGGLE ============
function initGameModeToggle() {
  document.querySelectorAll('.game-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.game-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameMode = btn.dataset.mode;
      updateGameModeUI();
    });
  });
}

function updateGameModeUI() {
  const setupContainer = document.getElementById('setup-container');
  const setupDiv = document.getElementById('setup');
  const player2Setup = document.getElementById('player2-setup');

  if (gameMode === 'two-player') {
    // Sync legacy state to playerConfigs[0] before switching
    syncLegacyToPlayerConfig(0);

    setupContainer.classList.remove('single-player');
    setupContainer.classList.add('two-player');
    setupDiv.classList.add('two-player-mode');
    player2Setup.style.display = 'block';

    // Initialize Player 2 UI
    initPlayer2UI();
    updateStatsUI(1);
    renderBehaviorList(1);
  } else {
    // Sync playerConfigs[0] back to legacy state
    syncPlayerConfigToLegacy(0);

    setupContainer.classList.add('single-player');
    setupContainer.classList.remove('two-player');
    setupDiv.classList.remove('two-player-mode');
    player2Setup.style.display = 'none';
  }
}

// ============ PLAYER 2 UI INITIALIZATION ============
let player2Initialized = false;

function initPlayer2UI() {
  if (player2Initialized) return;
  player2Initialized = true;

  // Player 2 stat buttons
  document.querySelectorAll('#player2-setup .stat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stat = btn.dataset.stat;
      const isPlus = btn.classList.contains('plus');
      const config = playerConfigs[1];

      if (isPlus && getUsedPoints(1) < TOTAL_POINTS) {
        config.stats[stat]++;
      } else if (!isPlus && config.stats[stat] > MIN_STAT) {
        config.stats[stat]--;
      }

      updateStatsUI(1);
    });
  });

  // Player 2 bonus stat
  document.getElementById('p2-bonus-stat').addEventListener('change', (e) => {
    playerConfigs[1].preferredBonusStat = e.target.value;
  });

  // Player 2 strategy mode tabs
  document.querySelectorAll('#player2-setup .mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#player2-setup .mode-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#player2-setup .strategy-mode').forEach(m => m.style.display = 'none');
      tab.classList.add('active');
      playerConfigs[1].strategyMode = tab.dataset.mode;
      document.getElementById('p2-' + tab.dataset.mode + '-mode').style.display = 'block';
    });
  });

  // Player 2 tabs navigation
  document.querySelectorAll('#player2-setup .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#player2-setup .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#player2-setup .tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    });
  });

  // Player 2 randomize button
  const p2RandomizeBtn = document.getElementById('p2-randomize-simple-btn');
  if (p2RandomizeBtn) {
    p2RandomizeBtn.addEventListener('click', () => randomizeBehaviorWeights(1));
  }

  // Player 2 add rule button
  const p2AddRuleBtn = document.getElementById('p2-add-rule-btn');
  if (p2AddRuleBtn) {
    p2AddRuleBtn.addEventListener('click', () => {
      playerConfigs[1].rules.push({
        conditions: [{ subject: 'my.lives', operator: '>', value: 0 }],
        action: 'gather'
      });
      renderRuleList(1);
    });
  }
}

// ============ STATS UI ============
function getUsedPoints(playerIndex = 0) {
  if (playerIndex === 0) {
    return playerStats.speed + playerStats.attack + playerStats.defence + playerStats.lives;
  } else {
    const config = playerConfigs[playerIndex];
    return config.stats.speed + config.stats.attack + config.stats.defence + config.stats.lives;
  }
}

function updateStatsUI(playerIndex = 0) {
  if (playerIndex === 0) {
    document.getElementById('speed-value').textContent = playerStats.speed;
    document.getElementById('attack-value').textContent = playerStats.attack;
    document.getElementById('defence-value').textContent = playerStats.defence;
    document.getElementById('lives-value').textContent = playerStats.lives;
    document.getElementById('points-count').textContent = TOTAL_POINTS - getUsedPoints(0);

    const remaining = TOTAL_POINTS - getUsedPoints(0);
    document.querySelectorAll('#player1-setup .stat-btn.plus, #stats-tab .stat-btn.plus').forEach(btn => {
      if (!btn.dataset.player || btn.dataset.player === '0') {
        btn.disabled = remaining <= 0;
      }
    });
    document.querySelectorAll('#player1-setup .stat-btn.minus, #stats-tab .stat-btn.minus').forEach(btn => {
      if (!btn.dataset.player || btn.dataset.player === '0') {
        const stat = btn.dataset.stat;
        btn.disabled = playerStats[stat] <= MIN_STAT;
      }
    });
  } else {
    const config = playerConfigs[playerIndex];
    document.getElementById('p2-speed-value').textContent = config.stats.speed;
    document.getElementById('p2-attack-value').textContent = config.stats.attack;
    document.getElementById('p2-defence-value').textContent = config.stats.defence;
    document.getElementById('p2-lives-value').textContent = config.stats.lives;
    document.getElementById('p2-points-count').textContent = TOTAL_POINTS - getUsedPoints(1);

    const remaining = TOTAL_POINTS - getUsedPoints(1);
    document.querySelectorAll('#player2-setup .stat-btn.plus').forEach(btn => {
      btn.disabled = remaining <= 0;
    });
    document.querySelectorAll('#player2-setup .stat-btn.minus').forEach(btn => {
      const stat = btn.dataset.stat;
      btn.disabled = config.stats[stat] <= MIN_STAT;
    });
  }
}

function initStatsUI() {
  // Player 1 stat buttons (original)
  document.querySelectorAll('#player1-setup .stat-btn, #stats-tab .stat-btn').forEach(btn => {
    if (btn.dataset.player && btn.dataset.player !== '0') return; // Skip P2 buttons
    btn.addEventListener('click', () => {
      const stat = btn.dataset.stat;
      const isPlus = btn.classList.contains('plus');

      if (isPlus && getUsedPoints(0) < TOTAL_POINTS) {
        playerStats[stat]++;
      } else if (!isPlus && playerStats[stat] > MIN_STAT) {
        playerStats[stat]--;
      }

      updateStatsUI(0);
    });
  });

  document.getElementById('bonus-stat').addEventListener('change', (e) => {
    preferredBonusStat = e.target.value;
  });

  updateStatsUI(0);
}

// ============ TAB NAVIGATION ============
function initTabNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    });
  });

  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.strategy-mode').forEach(m => m.style.display = 'none');
      tab.classList.add('active');
      strategyMode = tab.dataset.mode;
      document.getElementById(strategyMode + '-mode').style.display = 'block';

      if (strategyMode === 'expert') {
        renderStateMachine();
      }
    });
  });
}

// ============ INITIALIZE ALL UI ============
function initUI() {
  initGameModeToggle();
  initStatsUI();
  initTabNavigation();
  renderBehaviorList(0);
  renderRuleList(0);
  initAdvancedModeUI();
  initStateMachineUI();
  initSettingsUI();
  initLifecycleUI();
  initImportExportUI();
  initSimulationControlsUI();

  // Randomize button for Simple mode (Player 1)
  document.getElementById('randomize-simple-btn').addEventListener('click', () => randomizeBehaviorWeights(0));
}
