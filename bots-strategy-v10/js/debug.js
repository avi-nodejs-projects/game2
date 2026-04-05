// Bots Strategy v10 - Debug Panel

function updateDebugPanel() {
  if (!debugMode) return;

  // In two-player mode, show info for both players
  if (gameMode === 'two-player' && playerBots.length > 0) {
    updateDebugPanelTwoPlayer();
    return;
  }

  // Single-player mode
  if (!playerBot) return;

  const panel = document.getElementById('debug-panel');
  const context = playerBot.getContext();
  playerBot.lastContext = context;

  // Current State
  const stateDiv = document.getElementById('debug-state');
  let stateHtml = `<div class="debug-value"><span class="label">Mode:</span><span class="value">${strategyMode}</span></div>`;

  if (strategyMode === 'expert') {
    // Use bot's getStates() method to get player-specific states
    const stateList = playerBot.getStates();
    const currentState = stateList.find(s => s.id === playerBot.currentFSMState);
    stateHtml += `<div class="debug-value"><span class="label">FSM State:</span><span class="value">${currentState ? currentState.name : playerBot.currentFSMState}</span></div>`;
  }
  stateDiv.innerHTML = stateHtml;

  // Last Decision
  const decisionDiv = document.getElementById('debug-decision');
  decisionDiv.innerHTML = `
    <div class="debug-value"><span class="label">Action:</span><span class="value">${playerBot.lastAction || 'none'}</span></div>
    <div class="debug-value"><span class="label">Reason:</span><span class="value">${lastDecisionInfo.reason || '-'}</span></div>
  `;

  // Context Values
  if (showContextValues) {
    document.getElementById('debug-context-section').style.display = 'block';
    const contextDiv = document.getElementById('debug-context');
    let contextHtml = '';

    const groups = {
      'My Stats': ['my.lives', 'my.attack', 'my.defence', 'my.speed', 'my.total_stats'],
      'Enemies': ['nearest_enemy.distance', 'combat_advantage', 'nearby_enemy_count'],
      'Dots': ['nearest_dot.distance', 'safe_dot_count', 'best_cluster.size']
    };

    Object.entries(groups).forEach(([groupName, keys]) => {
      contextHtml += `<div class="context-group"><div class="context-group-title">${groupName}</div>`;
      keys.forEach(key => {
        let val = context[key];
        if (typeof val === 'number') val = val.toFixed(1);
        let valClass = '';
        if (key === 'my.lives' && val <= 2) valClass = 'warning';
        if (key === 'combat_advantage' && val > 2) valClass = 'good';
        contextHtml += `<div class="debug-value"><span class="label">${SUBJECTS[key] || key}:</span><span class="value ${valClass}">${val}</span></div>`;
      });
      contextHtml += '</div>';
    });

    contextDiv.innerHTML = contextHtml;
  } else {
    document.getElementById('debug-context-section').style.display = 'none';
  }
}

function updateDebugPanelTwoPlayer() {
  const stateDiv = document.getElementById('debug-state');
  const decisionDiv = document.getElementById('debug-decision');

  let stateHtml = '';
  let decisionHtml = '';

  for (let i = 0; i < playerBots.length; i++) {
    const bot = playerBots[i];
    if (!bot) continue;

    const pConfig = playerConfigs[i];
    const mode = pConfig.strategyMode;
    const color = pConfig.color;

    stateHtml += `<div style="border-left: 3px solid ${color}; padding-left: 5px; margin-bottom: 8px;">`;
    stateHtml += `<div class="debug-value"><span class="label">P${i + 1} Mode:</span><span class="value">${mode}</span></div>`;

    if (mode === 'expert') {
      const stateList = bot.getStates();
      const currentState = stateList.find(s => s.id === bot.currentFSMState);
      stateHtml += `<div class="debug-value"><span class="label">FSM State:</span><span class="value">${currentState ? currentState.name : bot.currentFSMState}</span></div>`;
    }
    stateHtml += '</div>';

    decisionHtml += `<div style="border-left: 3px solid ${color}; padding-left: 5px; margin-bottom: 8px;">`;
    decisionHtml += `<div class="debug-value"><span class="label">P${i + 1} Action:</span><span class="value">${bot.lastAction || 'none'}</span></div>`;
    decisionHtml += '</div>';
  }

  stateDiv.innerHTML = stateHtml;
  decisionDiv.innerHTML = decisionHtml;

  // Show context for active player only
  if (showContextValues && playerBots[activePlayerIndex]) {
    document.getElementById('debug-context-section').style.display = 'block';
    const contextDiv = document.getElementById('debug-context');
    const bot = playerBots[activePlayerIndex];
    const context = bot.getContext();
    bot.lastContext = context;

    let contextHtml = `<div style="color: ${playerConfigs[activePlayerIndex].color}; font-weight: bold; margin-bottom: 5px;">Player ${activePlayerIndex + 1} Context</div>`;

    const groups = {
      'My Stats': ['my.lives', 'my.attack', 'my.defence', 'my.speed', 'my.total_stats'],
      'Enemies': ['nearest_enemy.distance', 'combat_advantage', 'nearby_enemy_count'],
      'Dots': ['nearest_dot.distance', 'safe_dot_count', 'best_cluster.size']
    };

    Object.entries(groups).forEach(([groupName, keys]) => {
      contextHtml += `<div class="context-group"><div class="context-group-title">${groupName}</div>`;
      keys.forEach(key => {
        let val = context[key];
        if (typeof val === 'number') val = val.toFixed(1);
        let valClass = '';
        if (key === 'my.lives' && val <= 2) valClass = 'warning';
        if (key === 'combat_advantage' && val > 2) valClass = 'good';
        contextHtml += `<div class="debug-value"><span class="label">${SUBJECTS[key] || key}:</span><span class="value ${valClass}">${val}</span></div>`;
      });
      contextHtml += '</div>';
    });

    contextDiv.innerHTML = contextHtml;
  } else {
    document.getElementById('debug-context-section').style.display = 'none';
  }
}

function drawTargetLine() {
  if (!debugMode || !showTargetLine || !playerBot) return;

  const screen = worldToScreen(playerBot.x, playerBot.y);
  const targetScreen = worldToScreen(playerBot.targetX, playerBot.targetY);

  let color = '#ffdd00';
  if (playerBot.lastAction === 'flee') color = '#ff6b6b';
  else if (playerBot.lastAction === 'hunt' || playerBot.lastAction === 'hunt_weak') color = '#ff4444';
  else if (playerBot.lastAction === 'gather' || playerBot.lastAction === 'gather_safe') color = '#51cf66';
  else if (playerBot.lastAction === 'cluster') color = '#ffb400';

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y);
  ctx.lineTo(targetScreen.x, targetScreen.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(targetScreen.x, targetScreen.y, 10, 0, Math.PI * 2);
  ctx.stroke();
}

function initDebugUI() {
  document.getElementById('show-target-line').addEventListener('change', (e) => {
    showTargetLine = e.target.checked;
  });

  document.getElementById('show-context').addEventListener('change', (e) => {
    showContextValues = e.target.checked;
    updateDebugPanel();
  });
}
