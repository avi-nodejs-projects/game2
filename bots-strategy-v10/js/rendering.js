// Bots Strategy v10 - Rendering and Drawing

// ============ SINGLE-PLAYER DRAWING ============
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
  const mapSize = 120;
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

function updateUI() {
  const bot = camera.followBot;
  if (bot) {
    const playerLabel = bot.isPlayer ? ' (YOUR BOT)' : '';
    let strategyInfo = '';
    if (bot.isPlayer) {
      strategyInfo = `<br><br><strong>Strategy Mode:</strong> ${strategyMode}`;
      if (strategyMode === 'expert') {
        const currentState = states.find(s => s.id === bot.currentFSMState);
        strategyInfo += `<br>Current State: ${currentState ? currentState.name : bot.currentFSMState}`;
      }
    }
    const bonusInfo = bot.isPlayer ? `<br>Bonus Stat: ${bot.preferredStat}` : '';
    statsDiv.innerHTML = `
      <strong>Following Bot #${camera.followIndex + 1}${playerLabel}</strong><br>
      <span style="display:inline-block;width:10px;height:10px;background:hsl(${bot.hue},60%,50%);border-radius:50%;margin-right:5px;"></span>
      Hue: ${Math.floor(bot.hue)}<br><br>
      <strong>Stats:</strong><br>
      Speed: ${bot.speed.toFixed(1)}<br>
      Attack: ${bot.attack.toFixed(1)}<br>
      Defence: ${bot.defence.toFixed(1)}<br>
      Lives: ${bot.lives.toFixed(1)}${bonusInfo}${strategyInfo}<br><br>
      <strong>Position:</strong><br>
      X: ${Math.floor(bot.x)} / ${WORLD_WIDTH}<br>
      Y: ${Math.floor(bot.y)} / ${WORLD_HEIGHT}<br><br>
      <strong>Camera:</strong> ${camera.autoFollow ? 'Auto' : 'Manual'}
    `;
  }
}

// ============ VIEWPORT-SPECIFIC DRAWING (TWO-PLAYER) ============
function drawFieldForViewport() {
  const vp = currentViewport;

  // Sky gradient
  const skyGradient = ctx.createLinearGradient(vp.x, vp.y, vp.x, vp.y + vp.height * 0.3);
  skyGradient.addColorStop(0, '#87CEEB');
  skyGradient.addColorStop(1, '#4a7c3f');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(vp.x, vp.y, vp.width, vp.height * 0.3);

  // Ground gradient
  const gradient = ctx.createLinearGradient(vp.x, vp.y + vp.height * 0.2, vp.x, vp.y + vp.height);
  gradient.addColorStop(0, '#4a7c3f');
  gradient.addColorStop(1, '#2d5a27');
  ctx.fillStyle = gradient;
  ctx.fillRect(vp.x, vp.y + vp.height * 0.2, vp.width, vp.height * 0.8);

  // Grass details
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

  drawWorldBoundaryForViewport();
}

function drawWorldBoundaryForViewport() {
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

    const vp = currentViewport;
    if ((start.x >= vp.x - 100 && start.x <= vp.x + vp.width + 100) ||
        (end.x >= vp.x - 100 && end.x <= vp.x + vp.width + 100) ||
        (start.y >= vp.y - 100 && start.y <= vp.y + vp.height + 100) ||
        (end.y >= vp.y - 100 && end.y <= vp.y + vp.height + 100)) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }
}

function drawBillboardsForViewport() {
  if (typeof drawBillboards === 'function') {
    drawBillboards();
  }
}

function drawCorpsesForViewport() {
  if (lifecycleSettings.age.enabled && typeof drawCorpses === 'function') {
    drawCorpses();
  }
}

function drawDotsForViewport() {
  const sortedDots = [...yellowDots].sort((a, b) => a.y - b.y);
  for (const dot of sortedDots) {
    dot.draw();
  }
}

function drawBotsForViewport(viewportPlayerIndex) {
  const sortedBots = [...bots].sort((a, b) => a.y - b.y);
  const cam = viewportPlayerIndex === 0 ? camera : camera2;

  for (const bot of sortedBots) {
    // Highlight the player that owns this viewport
    const isViewportOwner = bot.isPlayer && bot.playerIndex === viewportPlayerIndex;
    bot.draw(bot === cam.followBot || isViewportOwner);
  }
}

function drawTargetLineForViewport(viewportPlayerIndex) {
  const bot = playerBots[viewportPlayerIndex];
  if (!bot || !debugMode) return;

  const screen = worldToScreen(bot.x, bot.y);
  const targetScreen = worldToScreen(bot.targetX, bot.targetY);

  // Color based on action
  let lineColor = '#ffffff';
  switch (bot.lastAction) {
    case 'gather':
    case 'cluster':
      lineColor = '#ffdd00';
      break;
    case 'hunt':
    case 'hunt_weak':
      lineColor = '#ff4444';
      break;
    case 'flee':
      lineColor = '#44ff44';
      break;
    case 'gather_safe':
    case 'safe-gather':
      lineColor = '#00ffff';
      break;
  }

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y);
  ctx.lineTo(targetScreen.x, targetScreen.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMinimapForViewport(viewportPlayerIndex) {
  const vp = currentViewport;
  const mapSize = 80; // Smaller minimap in split-screen
  const mapX = vp.x + vp.width - mapSize - 10;
  const mapY = vp.y + 10;
  const scale = mapSize / Math.max(WORLD_WIDTH, WORLD_HEIGHT);

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(mapX, mapY, mapSize, mapSize);

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);

  // Dots
  ctx.fillStyle = '#ffdd00';
  for (const dot of yellowDots) {
    ctx.beginPath();
    ctx.arc(mapX + dot.x * scale, mapY + dot.y * scale, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bots
  for (const bot of bots) {
    if (bot.isPlayer) {
      // Color based on player
      ctx.fillStyle = bot.playerIndex === 0 ? '#FFD700' : '#00CED1';
      ctx.beginPath();
      ctx.arc(mapX + bot.x * scale, mapY + bot.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `hsl(${bot.hue}, 60%, 50%)`;
      ctx.beginPath();
      ctx.arc(mapX + bot.x * scale, mapY + bot.y * scale, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Camera view box
  const cam = viewportPlayerIndex === 0 ? camera : camera2;
  const viewLeft = (cam.x - vp.width / 2) * scale;
  const viewTop = (cam.y - vp.height / 2) * scale;
  const viewWidth = vp.width * scale;
  const viewHeight = vp.height * scale;

  ctx.strokeStyle = viewportPlayerIndex === 0 ? '#FFD700' : '#00CED1';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX + viewLeft, mapY + viewTop, viewWidth, viewHeight);
}

function drawPlayerLabel(viewportPlayerIndex) {
  const vp = currentViewport;
  const label = viewportPlayerIndex === 0 ? 'PLAYER 1' : 'PLAYER 2';
  const color = viewportPlayerIndex === 0 ? '#FFD700' : '#00CED1';

  ctx.fillStyle = color;
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(label, vp.x + 10, vp.y + 20);

  // Player stats
  const bot = playerBots[viewportPlayerIndex];
  if (bot) {
    ctx.font = '11px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`HP: ${bot.lives.toFixed(1)} | SPD: ${bot.speed.toFixed(1)} | ATK: ${bot.attack.toFixed(1)} | DEF: ${bot.defence.toFixed(1)}`,
      vp.x + 10, vp.y + 38);
  }
}

function updateTwoPlayerUI() {
  // Update stats div with both players' info
  if (statsDiv) {
    let html = '';

    for (let i = 0; i < 2; i++) {
      const bot = playerBots[i];
      if (!bot) continue;

      const pConfig = playerConfigs[i];
      const stratMode = pConfig.strategyMode;

      html += `
        <div style="border-left: 3px solid ${pConfig.color}; padding-left: 8px; margin-bottom: 10px;">
          <strong>Player ${i + 1}</strong><br>
          SPD: ${bot.speed.toFixed(1)} | ATK: ${bot.attack.toFixed(1)}<br>
          DEF: ${bot.defence.toFixed(1)} | HP: ${bot.lives.toFixed(1)}<br>
          Mode: ${stratMode}
        </div>
      `;
    }

    statsDiv.innerHTML = html;
  }
}

// ============ SIMULATION STATUS DISPLAY ============
function updateSimulationStatus() {
  const statusEl = document.getElementById('sim-status');
  if (statusEl) {
    statusEl.textContent = `Frame: ${frameCount} | Decisions: ${decisionCount}/${simulationSettings.maxDecisions || '∞'} | Speed: x${simulationSpeed}`;
  }
}

function updateStrongestBotDisplay() {
  const displayEl = document.getElementById('strongest-bot-display');
  if (!displayEl) return;

  const strongest = findStrongestBot();
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
