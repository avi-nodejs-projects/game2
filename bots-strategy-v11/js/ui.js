// Bots Strategy v9 - UI Setup (Stats, Tab Navigation, Reset, Init Orchestrator)

// ============ STATS UI ============
function getUsedPoints() {
  return playerStats.speed + playerStats.attack + playerStats.defence + playerStats.lives;
}

function updateStatsUI() {
  document.getElementById('speed-value').textContent = playerStats.speed;
  document.getElementById('attack-value').textContent = playerStats.attack;
  document.getElementById('defence-value').textContent = playerStats.defence;
  document.getElementById('lives-value').textContent = playerStats.lives;
  document.getElementById('points-count').textContent = TOTAL_POINTS - getUsedPoints();

  // Update stat bar fills
  const maxBarVal = TOTAL_POINTS;
  document.querySelectorAll('.stat-row[data-stat]').forEach(row => {
    const stat = row.dataset.stat;
    const fill = row.querySelector('.stat-bar-fill');
    if (fill) {
      fill.style.setProperty('--fill', (playerStats[stat] / maxBarVal * 100) + '%');
    }
  });

  // Update points ring
  const used = getUsedPoints();
  const pctUsed = (used / TOTAL_POINTS) * 100;
  const circle = document.querySelector('.points-circle');
  if (circle) circle.style.setProperty('--points-used', pctUsed);

  // Update radar chart
  drawStatRadar();

  const remaining = TOTAL_POINTS - getUsedPoints();
  document.querySelectorAll('.stat-btn.plus').forEach(btn => {
    btn.disabled = remaining <= 0;
  });
  document.querySelectorAll('.stat-btn.minus').forEach(btn => {
    const stat = btn.dataset.stat;
    btn.disabled = playerStats[stat] <= MIN_STAT;
  });
}

function initStatsUI() {
  document.querySelectorAll('.stat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stat = btn.dataset.stat;
      const isPlus = btn.classList.contains('plus');

      if (isPlus && getUsedPoints() < TOTAL_POINTS) {
        playerStats[stat]++;
      } else if (!isPlus && playerStats[stat] > MIN_STAT) {
        playerStats[stat]--;
      }

      updateStatsUI();
    });
  });

  document.getElementById('bonus-stat').addEventListener('change', (e) => {
    preferredBonusStat = e.target.value;
  });

  updateStatsUI();
}

function drawStatRadar() {
  const canvas = document.getElementById('stat-radar');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 20;

  ctx.clearRect(0, 0, w, h);

  const stats = ['speed', 'attack', 'defence', 'lives'];
  const colors = ['#4dd0e1', '#ef5350', '#5c6bc0', '#66bb6a'];
  const values = stats.map(s => playerStats[s]);
  const maxVal = TOTAL_POINTS;
  const angles = stats.map((_, i) => (Math.PI * 2 * i / stats.length) - Math.PI / 2);

  // Grid rings
  for (let ring = 1; ring <= 4; ring++) {
    const r = (ring / 4) * maxR;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    angles.forEach((a, i) => {
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  // Axis lines
  angles.forEach(a => {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
    ctx.stroke();
  });

  // Value polygon
  ctx.fillStyle = 'rgba(0, 188, 212, 0.15)';
  ctx.strokeStyle = '#00bcd4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const r = (v / maxVal) * maxR;
    const x = cx + Math.cos(angles[i]) * r;
    const y = cy + Math.sin(angles[i]) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Stat dots and labels
  values.forEach((v, i) => {
    const r = (v / maxVal) * maxR;
    const x = cx + Math.cos(angles[i]) * r;
    const y = cy + Math.sin(angles[i]) * r;

    // Dot
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Label
    const labelR = maxR + 14;
    const lx = cx + Math.cos(angles[i]) * labelR;
    const ly = cy + Math.sin(angles[i]) * labelR;
    ctx.fillStyle = colors[i];
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = ['SPD', 'ATK', 'DEF', 'HP'];
    ctx.fillText(labels[i], lx, ly);
  });
}

function updateRangeFill(input) {
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--range-fill', pct + '%');
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

// ============ RESET TO DEFAULTS ============
function resetToDefaults() {
  if (!confirm('Reset all settings to defaults? This will clear your current configuration.')) {
    return;
  }

  // Reset player stats
  Object.assign(playerStats, DEFAULT_PLAYER_STATS);
  preferredBonusStat = 'speed';
  document.getElementById('bonus-stat').value = 'speed';

  // Reset strategy mode
  strategyMode = 'simple';
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.mode-tab[data-mode="simple"]').classList.add('active');
  document.querySelectorAll('.strategy-mode').forEach(m => m.style.display = 'none');
  document.getElementById('simple-mode').style.display = 'block';

  // Reset behavior weights
  Object.keys(BEHAVIORS).forEach(key => {
    const params = {};
    if (BEHAVIORS[key].params) {
      Object.keys(BEHAVIORS[key].params).forEach(pkey => {
        params[pkey] = BEHAVIORS[key].params[pkey].value;
      });
    }
    behaviorWeights[key] = {
      enabled: BEHAVIORS[key].enabled,
      weight: BEHAVIORS[key].defaultWeight,
      params: params
    };
  });

  // Reset rules
  rules.length = 0;
  DEFAULT_RULES.forEach(r => rules.push(JSON.parse(JSON.stringify(r))));

  // Reset states and transitions
  states.length = 0;
  DEFAULT_STATES.forEach(s => states.push(JSON.parse(JSON.stringify(s))));
  transitions.length = 0;
  DEFAULT_TRANSITIONS.forEach(t => transitions.push(JSON.parse(JSON.stringify(t))));
  currentStateId = 'gathering';
  selectedState = null;

  // Reset global settings
  Object.assign(globalSettings, JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS)));

  // Reset NPC settings
  Object.assign(npcSettings.randomStats, DEFAULT_NPC_SETTINGS.randomStats);
  Object.assign(npcSettings.deathPenalty, DEFAULT_NPC_SETTINGS.deathPenalty);
  Object.assign(npcSettings.evolution, DEFAULT_NPC_SETTINGS.evolution);
  Object.assign(npcSettings.randomStrategy, DEFAULT_NPC_SETTINGS.randomStrategy);

  // Reset simulation settings
  Object.assign(simulationSettings, JSON.parse(JSON.stringify(DEFAULT_SIMULATION_SETTINGS)));

  // Reset billboard settings
  Object.assign(billboardSettings, JSON.parse(JSON.stringify(DEFAULT_BILLBOARD_SETTINGS)));

  // Reset lifecycle settings (deep reset)
  lifecycleSettings.respawnInvincibility = {
    enabled: false,
    duration: 180,
    canDealDamage: false,
    breakOnCombatInitiation: false,
    visualEffect: 'pulse'
  };
  lifecycleSettings.starvation = {
    enabled: false,
    inactivityThreshold: 600,
    damagePerTick: 0.5,
    tickInterval: 60,
    resetConditions: {
      onDotEaten: false,
      onDamageDealt: false,
      onKill: false
    },
    scaling: {
      enabled: false,
      factor: 0.1,
      baselineStats: 18
    },
    statDecay: {
      enabled: false,
      decayPerTick: 0.1,
      minStats: { speed: 1, attack: 0, defence: 1, lives: 1 },
      order: 'random'
    }
  };
  lifecycleSettings.age = {
    enabled: false,
    maxAge: 36000,
    visualDecayStart: 0.8,
    deathBehavior: 'corpse',
    corpse: {
      nutritionValue: 2.0,
      duration: 600,
      saturationMultiplier: 0.2,
      opacity: 0.7
    },
    corpseInteraction: {
      nonPackMembers: 'food',
      packMembers: 'protected',
      cannibalOverride: true
    }
  };
  lifecycleSettings.reproduction = {
    asexual: {
      enabled: false,
      maturityMetric: 'frames',
      maturityThreshold: 1800,
      parentLifeCost: 0.5,
      statNoise: 0.1,
      cooldown: 900,
      spawnLocation: 'nearParent',
      spawnDistance: { min: 80, max: 150 }
    },
    sexual: {
      enabled: false,
      proximityDistance: 60,
      proximityDuration: 180,
      compatibilityThreshold: 0.5,
      cooldown: 1200,
      packBonus: {
        enabled: false,
        weight: 2.0
      }
    },
    offspring: {
      protection: {
        duration: 300,
        generations: 1,
        bidirectional: true
      }
    },
    strategyInheritance: {
      method: 'blend',
      noise: 0.15,
      mutationChance: 0.1
    }
  };
  lifecycleSettings.packs = {
    enabled: false,
    formation: {
      similarityThreshold: 0.7,
      proximityDistance: 100,
      proximityDuration: 180
    },
    size: {
      max: 5,
      overflowBehavior: 'reject'
    },
    bonds: {
      disbandOnRespawn: false,
      disbandOnStarvation: false,
      starvationDisbandThreshold: 0.5
    },
    leadership: {
      enabled: false,
      selection: 'strongest',
      influence: 0.6
    },
    territory: {
      enabled: false,
      radius: 300,
      defendAgainstOutsiders: true,
      defenseMode: 'always',
      settledThreshold: 120,
      positioning: {
        preferDotClusters: true,
        avoidEnemyClusters: true,
        clusterWeight: 0.7,
        enemyWeight: 0.3
      }
    },
    cannibalism: {
      enabled: false,
      trigger: 'starving',
      lowLivesThreshold: 2,
      targetPreference: 'weakest',
      packOnly: true,
      corpseOnly: false
    }
  };
  lifecycleSettings.playerOverrides = {
    enabled: false,
    starvation: { enabled: true },
    age: { enabled: true },
    reproduction: { enabled: false }
  };

  // Update all UI elements
  updateStatsUI();
  renderBehaviorList();
  renderRuleList();
  renderStateMachine();
  updateStateEditor();

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

  // Update lifecycle and billboard UI
  updateLifecycleUI();
  updateBillboardUI();

  alert('All settings reset to defaults.');
}

// ============ INITIALIZE ALL UI ============
function initUI() {
  initStatsUI();
  initTabNavigation();
  renderBehaviorList();
  renderRuleList();
  initAdvancedModeUI();
  initStateMachineUI();
  initSettingsUI();
  initLifecycleUI();
  initImportExportUI();
  initSimulationControlsUI();

  // Randomize button for Simple mode
  document.getElementById('randomize-simple-btn').addEventListener('click', randomizeBehaviorWeights);

  // Initialize all range input fill tracks
  document.querySelectorAll('input[type="range"]').forEach(input => {
    updateRangeFill(input);
    input.addEventListener('input', () => updateRangeFill(input));
  });

  // Initialize lifecycle accordion
  initLifecycleAccordion();
}
