// Bots Strategy v11.2 - Battle Cam Panel
// Auto-directed cinematic camera that finds and shows interesting action

const battleCam = {
  canvas: null,
  ctx: null,
  rc: null,
  camera: {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    targetX: WORLD_WIDTH / 2,
    targetY: WORLD_HEIGHT / 2,
    zoom: 0.7,
    targetZoom: 0.7,
    smoothing: 0.08
  },
  // Director state
  currentTarget: null,
  currentScore: 0,
  shotType: 'OVERVIEW',
  shotLabel: 'Monitoring field...',
  lastEvalFrame: 0,
  evalInterval: 30,
  lastFeatured: new Map(),
  lastKillPos: null,
  lastKillFrame: -Infinity,
  // Cycle fallback
  cycleIndex: 0,
  cycleStartFrame: 0
};

function initBattleCamPanel() {
  battleCam.canvas = document.getElementById('canvas-battlecam');
  if (!battleCam.canvas) return;
  battleCam.ctx = battleCam.canvas.getContext('2d');
  battleCam.rc = createRenderContext(battleCam.canvas, battleCam.camera);
}

function scoreInterest() {
  const shots = [];

  for (let i = 0; i < bots.length; i++) {
    const bot1 = bots[i];

    for (let j = i + 1; j < bots.length; j++) {
      const bot2 = bots[j];
      const dx = bot1.x - bot2.x;
      const dy = bot1.y - bot2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Active combat
      if (dist < bot1.size + bot2.size + 10 && (bot1.combatCooldown > 0 || bot2.combatCooldown > 0)) {
        shots.push({
          score: 100,
          x: (bot1.x + bot2.x) / 2,
          y: (bot1.y + bot2.y) / 2,
          zoom: 1.5,
          type: 'COMBAT',
          label: `Bot #${bot1.index} vs Bot #${bot2.index}`,
          bots: [bot1.index, bot2.index]
        });
      }

      // Imminent combat
      if (dist < 100 && dist > bot1.size + bot2.size + 10) {
        // Check if closing
        const vx1 = bot1.targetX - bot1.x;
        const vy1 = bot1.targetY - bot1.y;
        const approaching = (dx * vx1 + dy * vy1) < 0 || (dx * (bot2.targetX - bot2.x) + dy * (bot2.targetY - bot2.y)) > 0;
        if (approaching) {
          shots.push({
            score: 70,
            x: (bot1.x + bot2.x) / 2,
            y: (bot1.y + bot2.y) / 2,
            zoom: 1.2,
            type: 'TENSION',
            label: `Bot #${bot1.index} approaching Bot #${bot2.index}`,
            bots: [bot1.index, bot2.index]
          });
        }
      }
    }

    // Player bot in danger
    if (playerBot && !bot1.isPlayer) {
      const dx = bot1.x - playerBot.x;
      const dy = bot1.y - playerBot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200) {
        shots.push({
          score: 90,
          x: (bot1.x + playerBot.x) / 2,
          y: (bot1.y + playerBot.y) / 2,
          zoom: 1.3,
          type: 'DANGER',
          label: `Bot #${bot1.index} threatens your bot!`,
          bots: [bot1.index, playerBot.index]
        });
      }
    }
  }

  // Reproduction events
  if (typeof matingPairs !== 'undefined') {
    for (const [key, progress] of Object.entries(typeof matingProgress !== 'undefined' ? matingProgress : {})) {
      if (progress > 0.5) {
        const [i, j] = key.split('-').map(Number);
        const b1 = bots.find(b => b.index === i);
        const b2 = bots.find(b => b.index === j);
        if (b1 && b2) {
          shots.push({
            score: 60,
            x: (b1.x + b2.x) / 2,
            y: (b1.y + b2.y) / 2,
            zoom: 1.2,
            type: 'REPRODUCTION',
            label: `Bot #${i} and Bot #${j} reproducing`,
            bots: [i, j]
          });
        }
      }
    }
  }

  // Strongest bot activity
  const strongest = typeof findStrongestBot === 'function' ? findStrongestBot() : null;
  if (strongest) {
    shots.push({
      score: 40,
      x: strongest.x,
      y: strongest.y,
      zoom: 1.0,
      type: 'OVERVIEW',
      label: `Strongest: Bot #${strongest.index}`,
      bots: [strongest.index]
    });
  }

  // Recent kill site
  if (battleCam.lastKillPos && frameCount - battleCam.lastKillFrame < 180) {
    const decay = 1 - (frameCount - battleCam.lastKillFrame) / 180;
    shots.push({
      score: 30 * decay,
      x: battleCam.lastKillPos.x,
      y: battleCam.lastKillPos.y,
      zoom: 1.3,
      type: 'KILL',
      label: 'Recent kill site',
      bots: []
    });
  }

  return shots.sort((a, b) => b.score - a.score);
}

function updateBattleCamDirector() {
  if (!battleCam.canvas || bots.length === 0) return;

  const shots = scoreInterest();

  if (shots.length > 0 && shots[0].score > 20) {
    const best = shots[0];
    battleCam.camera.targetX = best.x;
    battleCam.camera.targetY = best.y;
    battleCam.camera.targetZoom = best.zoom;
    battleCam.shotType = best.type;
    battleCam.shotLabel = best.label;
    battleCam.currentScore = best.score;
    battleCam.currentTarget = best;
    // Track featured bots
    for (const idx of best.bots) {
      battleCam.lastFeatured.set(idx, frameCount);
    }
  } else {
    // Fallback: cycle through bots
    if (frameCount - battleCam.cycleStartFrame > 300) {
      // Pick least-recently featured bot
      let bestBot = bots[0];
      let oldestFrame = Infinity;
      for (const bot of bots) {
        const lastFeat = battleCam.lastFeatured.get(bot.index) || 0;
        if (lastFeat < oldestFrame) {
          oldestFrame = lastFeat;
          bestBot = bot;
        }
      }
      battleCam.camera.targetX = bestBot.x;
      battleCam.camera.targetY = bestBot.y;
      battleCam.camera.targetZoom = 0.8;
      battleCam.shotType = 'OVERVIEW';
      battleCam.shotLabel = `Watching Bot #${bestBot.index}`;
      battleCam.cycleStartFrame = frameCount;
      battleCam.lastFeatured.set(bestBot.index, frameCount);
    }
  }
}

function updateBattleCamCamera() {
  if (!battleCam.canvas) return;
  const cam = battleCam.camera;
  cam.x += (cam.targetX - cam.x) * cam.smoothing;
  cam.y += (cam.targetY - cam.y) * cam.smoothing;
  cam.zoom += (cam.targetZoom - cam.zoom) * cam.smoothing;
}

function drawBattleCam() {
  if (!battleCam.canvas) return;
  const w = battleCam.canvas.width;
  const h = battleCam.canvas.height;
  if (w === 0 || h === 0) return;

  // Update render context reference (canvas may have resized)
  battleCam.rc = createRenderContext(battleCam.canvas, battleCam.camera);
  const rc = battleCam.rc;

  // Draw field and entities using the battle cam's own render context
  drawField(rc);

  // Draw corpses
  if (lifecycleSettings.age.enabled && typeof drawCorpses === 'function') {
    drawCorpses(rc);
  }

  // Draw dots
  const sortedDots = [...yellowDots].sort((a, b) => a.y - b.y);
  for (const dot of sortedDots) {
    dot.draw(rc);
  }

  // Draw bots (with focus effect — dim non-featured bots)
  const featuredBots = battleCam.currentTarget ? new Set(battleCam.currentTarget.bots || []) : new Set();
  const sortedBots = [...bots].sort((a, b) => a.y - b.y);
  for (const bot of sortedBots) {
    if (featuredBots.size > 0 && !featuredBots.has(bot.index)) {
      rc.ctx.globalAlpha = 0.4;
    }
    bot.draw(rc, false);
    rc.ctx.globalAlpha = 1;
  }

  // Vignette
  drawVignette(rc.ctx, w, h);

  // Info overlay
  drawBattleCamOverlay(rc.ctx, w, h);
}

function drawVignette(ctx, w, h) {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.65);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function drawBattleCamOverlay(ctx, w, h) {
  // Shot type badge
  const badgeColors = {
    COMBAT: '#ef5350',
    DANGER: '#ff9800',
    TENSION: '#ffd54f',
    REPRODUCTION: '#e91e63',
    KILL: '#f44336',
    OVERVIEW: '#78909c'
  };

  const color = badgeColors[battleCam.shotType] || '#78909c';

  // Badge background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(8, 8, 80, 18);
  ctx.fillStyle = color;
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(battleCam.shotType, 12, 21);

  // "Now watching" label at bottom
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, h - 24, w, 24);
  ctx.fillStyle = '#ccc';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(battleCam.shotLabel, w / 2, h - 9);
}

// Called from main.js when a bot is killed
function onBattleCamKill(x, y) {
  battleCam.lastKillPos = { x, y };
  battleCam.lastKillFrame = frameCount;
}

function resetBattleCam() {
  battleCam.camera.x = WORLD_WIDTH / 2;
  battleCam.camera.y = WORLD_HEIGHT / 2;
  battleCam.camera.targetX = WORLD_WIDTH / 2;
  battleCam.camera.targetY = WORLD_HEIGHT / 2;
  battleCam.camera.zoom = 0.7;
  battleCam.camera.targetZoom = 0.7;
  battleCam.currentTarget = null;
  battleCam.currentScore = 0;
  battleCam.shotType = 'OVERVIEW';
  battleCam.shotLabel = 'Monitoring field...';
  battleCam.lastFeatured.clear();
  battleCam.lastKillPos = null;
  battleCam.lastKillFrame = -Infinity;
}
