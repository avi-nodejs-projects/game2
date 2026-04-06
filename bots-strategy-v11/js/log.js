// Bots Strategy v9 - Simulation Logging

// ============ LOG INITIALIZATION ============
function initSimulationLog() {
  simulationLog = {
    version: "4.0",
    timestamp: new Date().toISOString(),
    config: captureConfig(),
    strategy: captureStrategy(),
    initialState: null,
    decisions: [],
    events: [],
    finalState: null
  };
  decisionCount = 0;
  frameCount = 0;
}

function captureConfig() {
  return {
    playerStats: { ...playerStats },
    preferredBonusStat: preferredBonusStat,
    globalSettings: JSON.parse(JSON.stringify(globalSettings)),
    simulationSettings: { ...simulationSettings },
    worldSize: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    botCount: BOT_COUNT,
    dotCount: DOT_COUNT
  };
}

function captureStrategy() {
  const strategy = {
    mode: strategyMode
  };

  if (strategyMode === 'simple') {
    strategy.behaviors = {};
    Object.entries(behaviorWeights).forEach(([key, state]) => {
      if (state.enabled) {
        strategy.behaviors[key] = {
          weight: state.weight,
          params: { ...state.params }
        };
      }
    });
  } else if (strategyMode === 'advanced') {
    strategy.rules = rules.map((rule, idx) => ({
      index: idx,
      conditions: rule.conditions.map(c => ({
        subject: c.subject,
        operator: c.operator,
        value: c.value
      })),
      action: rule.action
    }));
  } else if (strategyMode === 'expert') {
    strategy.states = states.map(s => ({
      id: s.id,
      name: s.name,
      behavior: s.behavior,
      entryAction: s.entryAction,
      exitAction: s.exitAction
    }));
    strategy.transitions = transitions.map(t => ({
      from: t.from,
      to: t.to,
      condition: { ...t.condition },
      priority: t.priority
    }));
    strategy.initialState = currentStateId;
  }

  return strategy;
}

function captureInitialState() {
  simulationLog.initialState = {
    frame: 0,
    bots: bots.map(captureBot),
    dots: yellowDots.map(captureDot)
  };
}

function captureBot(bot) {
  return {
    index: bot.index,
    isPlayer: bot.isPlayer,
    x: round(bot.x),
    y: round(bot.y),
    targetX: round(bot.targetX),
    targetY: round(bot.targetY),
    stats: {
      speed: round(bot.speed),
      attack: round(bot.attack),
      defence: round(bot.defence),
      lives: round(bot.lives)
    },
    fsmState: bot.isPlayer && strategyMode === 'expert' ? bot.currentFSMState : undefined
  };
}

function captureDot(dot, index) {
  return {
    index: index,
    x: round(dot.x),
    y: round(dot.y)
  };
}

function round(val) {
  return Math.round(val * 100) / 100;
}

// ============ DECISION LOGGING ============
function logDecision(bot, action, reason, context, additionalInfo = {}) {
  if (!simulationSettings.loggingEnabled) return;
  if (!simulationSettings.logAllBots && !bot.isPlayer) return;

  decisionCount++;

  const decision = {
    decisionNum: decisionCount,
    frame: frameCount,
    botIndex: bot.index,
    isPlayer: bot.isPlayer,
    position: { x: round(bot.x), y: round(bot.y) },
    action: action,
    reason: reason,
    target: { x: round(bot.targetX), y: round(bot.targetY) },
    context: captureRelevantContext(context),
    worldState: captureWorldState()
  };

  if (strategyMode === 'advanced' && additionalInfo.firedRuleIndex !== undefined) {
    decision.firedRuleIndex = additionalInfo.firedRuleIndex;
  }
  if (strategyMode === 'expert') {
    decision.fsmState = bot.currentFSMState;
    if (additionalInfo.previousState) {
      decision.previousFsmState = additionalInfo.previousState;
    }
  }
  if (additionalInfo.selectedBehavior) {
    decision.selectedBehavior = additionalInfo.selectedBehavior;
  }

  simulationLog.decisions.push(decision);

  // Update decision count display
  const countEl = document.getElementById('log-decision-count');
  if (countEl) {
    countEl.textContent = `Decisions logged: ${decisionCount}`;
  }

  if (simulationSettings.maxDecisions > 0 && decisionCount >= simulationSettings.maxDecisions) {
    if (simulationSettings.pauseOnComplete) {
      pauseSimulation();
    }
  }
}

function captureRelevantContext(context) {
  if (!context) return null;

  return {
    my: {
      lives: round(context['my.lives']),
      attack: round(context['my.attack']),
      defence: round(context['my.defence']),
      speed: round(context['my.speed']),
      totalStats: round(context['my.total_stats']),
      zone: context['my.zone']
    },
    nearestEnemy: {
      distance: round(context['nearest_enemy.distance']),
      lives: context['nearest_enemy.lives'],
      attack: context['nearest_enemy.attack']
    },
    combatAdvantage: round(context['combat_advantage']),
    nearbyEnemyCount: context['nearby_enemy_count'],
    nearestDot: {
      distance: round(context['nearest_dot.distance'])
    },
    safeDotCount: context['safe_dot_count'],
    bestCluster: {
      size: context['best_cluster.size'],
      distance: round(context['best_cluster.distance'])
    },
    justTookDamage: context['just_took_damage'] === 1,
    justDealtDamage: context['just_dealt_damage'] === 1
  };
}

function captureWorldState() {
  return {
    bots: bots.map(b => ({
      index: b.index,
      x: round(b.x),
      y: round(b.y),
      lives: round(b.lives)
    })),
    dots: yellowDots.map((d, i) => ({
      index: i,
      x: round(d.x),
      y: round(d.y)
    }))
  };
}

// ============ EVENT LOGGING ============
function logEvent(eventType, data) {
  if (!simulationSettings.loggingEnabled) return;

  simulationLog.events.push({
    frame: frameCount,
    type: eventType,
    data: data
  });
}

function logCombat(bot1, bot2, damage1, damage2, bot1Died, bot2Died) {
  logEvent('COMBAT', {
    bot1: { index: bot1.index, livesAfter: round(bot1.lives), damage: damage1, died: bot1Died },
    bot2: { index: bot2.index, livesAfter: round(bot2.lives), damage: damage2, died: bot2Died }
  });
}

function logDotCollected(bot, dotIndex) {
  logEvent('DOT_COLLECTED', {
    botIndex: bot.index,
    dotIndex: dotIndex
  });
}

function logBotRespawn(bot) {
  logEvent('RESPAWN', {
    botIndex: bot.index,
    newPosition: { x: round(bot.x), y: round(bot.y) }
  });
}

// ============ FINAL STATE ============
function captureFinalState() {
  simulationLog.finalState = {
    frame: frameCount,
    totalDecisions: decisionCount,
    bots: bots.map(captureBot),
    dots: yellowDots.map(captureDot)
  };
}

// ============ LOG OUTPUT ============
function generateLogOutput() {
  captureFinalState();
  return JSON.stringify(simulationLog, null, 2);
}

function generateCompactLog() {
  captureFinalState();

  const lines = [];
  lines.push(`LOG_VERSION:4.0`);
  lines.push(`TIMESTAMP:${simulationLog.timestamp}`);
  lines.push(`MODE:${strategyMode}`);
  lines.push(`MAX_DECISIONS:${simulationSettings.maxDecisions}`);
  lines.push(`---CONFIG_START---`);
  lines.push(JSON.stringify(simulationLog.config));
  lines.push(`---CONFIG_END---`);
  lines.push(`---STRATEGY_START---`);
  lines.push(JSON.stringify(simulationLog.strategy));
  lines.push(`---STRATEGY_END---`);
  lines.push(`---INITIAL_STATE_START---`);
  lines.push(JSON.stringify(simulationLog.initialState));
  lines.push(`---INITIAL_STATE_END---`);
  lines.push(`---DECISIONS_START---`);
  simulationLog.decisions.forEach(d => {
    lines.push(`D:${JSON.stringify(d)}`);
  });
  lines.push(`---DECISIONS_END---`);
  lines.push(`---EVENTS_START---`);
  simulationLog.events.forEach(e => {
    lines.push(`E:${JSON.stringify(e)}`);
  });
  lines.push(`---EVENTS_END---`);
  lines.push(`---FINAL_STATE_START---`);
  lines.push(JSON.stringify(simulationLog.finalState));
  lines.push(`---FINAL_STATE_END---`);

  return lines.join('\n');
}

// ============ SIMULATION CONTROL ============
function pauseSimulation() {
  simulationPaused = true;
  updateLogOutput();
  showLogPanel();
}

function resumeSimulation() {
  simulationPaused = false;
}

function resetSimulationLog() {
  initSimulationLog();
}

function updateLogOutput() {
  const textarea = document.getElementById('log-output');
  if (textarea) {
    textarea.value = generateCompactLog();
  }
}

function showLogPanel() {
  const panel = document.getElementById('log-panel');
  if (panel) {
    panel.classList.add('visible');
  }
}

function hideLogPanel() {
  const panel = document.getElementById('log-panel');
  if (panel) {
    panel.classList.remove('visible');
  }
}
