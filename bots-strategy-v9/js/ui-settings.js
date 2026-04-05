// Bots Strategy v9 - Settings Tab, Simulation Controls, Import/Export UI

// ============ SETTINGS TAB HANDLERS ============
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

// ============ SIMULATION CONTROLS UI ============
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
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.mode-tab[data-mode="${strategyMode}"]`)?.classList.add('active');
        document.querySelectorAll('.strategy-mode').forEach(m => m.style.display = 'none');
        document.getElementById(strategyMode + '-mode').style.display = 'block';
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
