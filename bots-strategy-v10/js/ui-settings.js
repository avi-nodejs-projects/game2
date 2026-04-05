// Bots Strategy v10 - Settings Tab UI, Import/Export, Reset

function initSettingsUI() {
  document.getElementById('reeval-rate').addEventListener('change', (e) => {
    globalSettings.reEvaluationRate = parseInt(e.target.value);
  });

  document.getElementById('switch-cooldown').addEventListener('change', (e) => {
    globalSettings.behaviorSwitchCooldown = parseInt(e.target.value);
  });

  document.getElementById('randomness-noise').addEventListener('input', (e) => {
    globalSettings.randomnessNoise = parseInt(e.target.value) / 100;
    document.getElementById('noise-value').textContent = globalSettings.randomnessNoise.toFixed(2);
  });

  document.getElementById('emergency-enabled').addEventListener('change', (e) => {
    globalSettings.emergencyOverride.enabled = e.target.checked;
  });

  document.getElementById('emergency-threshold').addEventListener('change', (e) => {
    globalSettings.emergencyOverride.livesThreshold = parseInt(e.target.value);
  });

  document.getElementById('emergency-behavior').addEventListener('change', (e) => {
    globalSettings.emergencyOverride.behavior = e.target.value;
  });

  // NPC settings
  document.getElementById('npc-random-stats').addEventListener('change', (e) => {
    npcSettings.randomStats.enabled = e.target.checked;
  });

  document.getElementById('npc-death-penalty').addEventListener('change', (e) => {
    npcSettings.deathPenalty.enabled = e.target.checked;
  });

  document.getElementById('npc-evolution').addEventListener('change', (e) => {
    npcSettings.evolution.enabled = e.target.checked;
  });

  document.getElementById('npc-evolution-ratio').addEventListener('input', (e) => {
    npcSettings.evolution.inheritRatio = parseInt(e.target.value) / 100;
    document.getElementById('evolution-ratio-value').textContent = npcSettings.evolution.inheritRatio.toFixed(2);
  });

  document.getElementById('npc-random-strategy').addEventListener('change', (e) => {
    npcSettings.randomStrategy.enabled = e.target.checked;
  });

  // Simulation logging settings
  document.getElementById('max-decisions').addEventListener('change', (e) => {
    simulationSettings.maxDecisions = parseInt(e.target.value);
  });

  document.getElementById('logging-enabled').addEventListener('change', (e) => {
    simulationSettings.loggingEnabled = e.target.checked;
  });

  document.getElementById('log-all-bots').addEventListener('change', (e) => {
    simulationSettings.logAllBots = e.target.checked;
  });

  document.getElementById('pause-on-complete').addEventListener('change', (e) => {
    simulationSettings.pauseOnComplete = e.target.checked;
  });

  // Billboard settings
  document.getElementById('billboard-enabled').addEventListener('change', (e) => {
    billboardSettings.enabled = e.target.checked;
  });

  document.getElementById('billboard-max').addEventListener('change', (e) => {
    billboardSettings.maxBillboards = parseInt(e.target.value);
  });

  document.getElementById('billboard-spawn-chance').addEventListener('input', (e) => {
    billboardSettings.spawnChance = parseInt(e.target.value) / 1000;
    document.getElementById('billboard-spawn-value').textContent = billboardSettings.spawnChance.toFixed(3);
  });

  document.getElementById('billboard-min-duration').addEventListener('change', (e) => {
    billboardSettings.minDuration = parseInt(e.target.value);
  });

  document.getElementById('billboard-max-duration').addEventListener('change', (e) => {
    billboardSettings.maxDuration = parseInt(e.target.value);
  });

  document.getElementById('billboard-proximity').addEventListener('change', (e) => {
    billboardSettings.clusterProximityRadius = parseInt(e.target.value);
  });

  document.getElementById('billboard-min-cluster').addEventListener('change', (e) => {
    billboardSettings.minClusterSize = parseInt(e.target.value);
  });

  document.getElementById('billboard-width').addEventListener('change', (e) => {
    billboardSettings.boardWidth = parseInt(e.target.value);
  });

  document.getElementById('billboard-height').addEventListener('change', (e) => {
    billboardSettings.boardHeight = parseInt(e.target.value);
  });

  document.getElementById('billboard-pole-height').addEventListener('change', (e) => {
    billboardSettings.poleHeight = parseInt(e.target.value);
  });
}

function initSimulationControlsUI() {
  document.getElementById('pause-btn').addEventListener('click', () => {
    simulationPaused = true;
    updateLogOutput();
  });

  document.getElementById('resume-btn').addEventListener('click', () => {
    simulationPaused = false;
  });

  // Speed control buttons
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      simulationSpeed = speed;
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('show-log-btn').addEventListener('click', () => {
    updateLogOutput();
    showLogPanel();
  });

  document.getElementById('close-log-btn').addEventListener('click', () => {
    hideLogPanel();
  });

  document.getElementById('copy-log-btn').addEventListener('click', () => {
    const textarea = document.getElementById('log-output');
    textarea.select();
    document.execCommand('copy');
    alert('Log copied to clipboard!');
  });

  document.getElementById('download-log-btn').addEventListener('click', () => {
    const log = document.getElementById('log-output').value;
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ============ IMPORT/EXPORT ============
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function exportConfig() {
  const config = {
    version: '4.3',
    mode: strategyMode,
    behaviors: behaviorWeights,
    rules: rules,
    stateMachine: {
      states: states,
      transitions: transitions,
      initialState: currentStateId
    },
    globalSettings: globalSettings,
    npcSettings: npcSettings,
    lifecycleSettings: lifecycleSettings,
    billboardSettings: billboardSettings
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bot-strategy-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);

      if (config.behaviors) {
        Object.keys(config.behaviors).forEach(key => {
          if (behaviorWeights[key]) {
            behaviorWeights[key] = config.behaviors[key];
          }
        });
      }

      if (config.rules) {
        rules.length = 0;
        config.rules.forEach(r => rules.push(r));
      }

      if (config.stateMachine) {
        states.length = 0;
        config.stateMachine.states.forEach(s => states.push(s));
        transitions.length = 0;
        config.stateMachine.transitions.forEach(t => transitions.push(t));
        if (config.stateMachine.initialState) {
          currentStateId = config.stateMachine.initialState;
        }
      }

      if (config.globalSettings) {
        Object.assign(globalSettings, config.globalSettings);
        document.getElementById('reeval-rate').value = globalSettings.reEvaluationRate;
        document.getElementById('switch-cooldown').value = globalSettings.behaviorSwitchCooldown;
        document.getElementById('randomness-noise').value = globalSettings.randomnessNoise * 100;
        document.getElementById('noise-value').textContent = globalSettings.randomnessNoise.toFixed(2);
        document.getElementById('emergency-enabled').checked = globalSettings.emergencyOverride.enabled;
        document.getElementById('emergency-threshold').value = globalSettings.emergencyOverride.livesThreshold;
        document.getElementById('emergency-behavior').value = globalSettings.emergencyOverride.behavior;
      }

      if (config.npcSettings) {
        Object.assign(npcSettings, config.npcSettings);
        document.getElementById('npc-random-stats').checked = npcSettings.randomStats.enabled;
        document.getElementById('npc-death-penalty').checked = npcSettings.deathPenalty.enabled;
        document.getElementById('npc-evolution').checked = npcSettings.evolution.enabled;
        document.getElementById('npc-evolution-ratio').value = npcSettings.evolution.inheritRatio * 100;
        document.getElementById('evolution-ratio-value').textContent = npcSettings.evolution.inheritRatio.toFixed(2);
        document.getElementById('npc-random-strategy').checked = npcSettings.randomStrategy.enabled;
      }

      if (config.lifecycleSettings) {
        // Deep merge lifecycle settings
        deepMerge(lifecycleSettings, config.lifecycleSettings);
        updateLifecycleUI();
      }

      if (config.billboardSettings) {
        Object.assign(billboardSettings, config.billboardSettings);
        updateBillboardUI();
      }

      if (config.mode) {
        strategyMode = config.mode;
      }

      renderBehaviorList();
      renderRuleList();
      renderStateMachine();

      alert('Configuration imported successfully!');
    } catch (err) {
      alert('Error importing configuration: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function initImportExportUI() {
  document.getElementById('export-btn').addEventListener('click', exportConfig);

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importConfig(e.target.files[0]);
      e.target.value = '';
    }
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
