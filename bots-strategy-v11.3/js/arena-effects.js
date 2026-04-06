// Bots Strategy v11.3 "The Arena" - Screen Effects & Arena Systems
//
// Depends on globals from other files (loaded before this one):
//   ctx, canvas, camera, worldToScreen(), isVisible(), getScale(),
//   bots, playerBot, frameCount, arenaConfig,
//   particlePool (particles.js), stampScorchMark (main.js)

// ============ 1. EVENT BUS (lightweight) ============

const arenaEvents = {
  _listeners: {},

  /**
   * Register a callback for an event name.
   * @param {string} event - Event name (e.g. 'combat:contact').
   * @param {function} fn - Callback receiving a data object.
   */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },

  /**
   * Emit an event, calling all registered callbacks with the data.
   * @param {string} event - Event name.
   * @param {object} [data] - Data payload.
   */
  emit(event, data) {
    const fns = this._listeners[event];
    if (!fns) return;
    for (let i = 0; i < fns.length; i++) {
      fns[i](data);
    }
  }
};

// ============ 2. SCREEN SHAKE ============

const screenShake = { intensity: 0, duration: 0 };

/**
 * Trigger a screen shake effect.
 * Uses the maximum of the current and new intensity/duration so
 * overlapping shakes feel additive rather than cutting each other short.
 * @param {number} intensity - Pixel displacement amplitude.
 * @param {number} duration - Frames to shake.
 */
function triggerScreenShake(intensity, duration) {
  screenShake.intensity = Math.max(screenShake.intensity, intensity);
  screenShake.duration = Math.max(screenShake.duration, duration);
}

/**
 * Compute the current shake offset and decay.
 * Call once per frame before rendering; apply the returned offset
 * as a canvas translate.
 * @returns {{x: number, y: number}} Pixel offset to apply.
 */
function applyScreenShake() {
  if (screenShake.duration <= 0) {
    screenShake.intensity = 0;
    return { x: 0, y: 0 };
  }

  const x = (Math.random() - 0.5) * 2 * screenShake.intensity;
  const y = (Math.random() - 0.5) * 2 * screenShake.intensity;

  screenShake.duration--;
  screenShake.intensity *= 0.92; // smooth decay

  return { x, y };
}

// ============ 3. VIGNETTE ============

let _vignetteCanvas = null;
let _vignetteCtx = null;
let _vignetteBaseIntensity = 0.3;
let _vignetteRedIntensity = 0;

/**
 * Pre-render the vignette gradient onto an offscreen canvas.
 * Call once at init and whenever the main canvas resizes.
 * @param {number} width - Canvas width.
 * @param {number} height - Canvas height.
 */
function initVignette(width, height) {
  _vignetteCanvas = document.createElement('canvas');
  _vignetteCanvas.width = width;
  _vignetteCanvas.height = height;
  _vignetteCtx = _vignetteCanvas.getContext('2d');

  // Radial gradient: transparent center, black edges
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);

  const grad = _vignetteCtx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,1)');

  _vignetteCtx.fillStyle = grad;
  _vignetteCtx.fillRect(0, 0, width, height);
}

/**
 * Adjust vignette intensities.
 * Uses max so overlapping triggers accumulate rather than override.
 * @param {number} base - Base darkness (0..1). Default ambient is 0.3.
 * @param {number} red - Red tint intensity for low-health warning (0..1).
 */
function setVignetteIntensity(base, red) {
  _vignetteBaseIntensity = Math.max(_vignetteBaseIntensity, base);
  _vignetteRedIntensity = Math.max(_vignetteRedIntensity, red);
}

/**
 * Draw the vignette overlay onto the main canvas.
 * Always-on subtle (0.3), intensifies during combat, red tint at low health.
 * Also decays intensity back toward baseline each frame.
 * @param {CanvasRenderingContext2D} mainCtx - Main canvas context.
 * @param {number} w - Canvas width.
 * @param {number} h - Canvas height.
 */
function drawVignette(mainCtx, w, h) {
  // Recreate offscreen canvas if dimensions changed
  if (!_vignetteCanvas || _vignetteCanvas.width !== w || _vignetteCanvas.height !== h) {
    initVignette(w, h);
  }

  // Boost intensity when the followed bot is in combat
  let combatBoost = 0;
  if (camera.followBot) {
    if (camera.followBot.damageTimer > 0 || camera.followBot.damageDealtTimer > 0) {
      combatBoost = 0.15;
    }
  }

  const totalBase = Math.min(1, _vignetteBaseIntensity + combatBoost);

  // Dark vignette
  mainCtx.save();
  mainCtx.globalAlpha = totalBase;
  mainCtx.drawImage(_vignetteCanvas, 0, 0);
  mainCtx.restore();

  // Red tint overlay for low health
  if (_vignetteRedIntensity > 0) {
    mainCtx.save();
    mainCtx.globalAlpha = _vignetteRedIntensity * 0.3;
    mainCtx.fillStyle = '#ff0000';
    mainCtx.fillRect(0, 0, w, h);
    mainCtx.restore();
  }

  // Decay intensities back toward ambient baseline
  _vignetteBaseIntensity += (0.3 - _vignetteBaseIntensity) * 0.02;
  _vignetteRedIntensity *= 0.97;
}

// ============ 4. FREEZE FRAME ============

let freezeFrames = 0;

/**
 * Trigger a freeze-frame (hit-stop) effect for dramatic kills/impacts.
 * Uses max so overlapping triggers don't cut each other short.
 * @param {number} frames - Number of frames to freeze.
 */
function triggerFreezeFrame(frames) {
  freezeFrames = Math.max(freezeFrames, frames);
}

/**
 * Check whether the game update should be skipped this frame.
 * Call at the top of the game update; if true, skip all logic updates
 * but still render (the frozen frame).
 * @returns {boolean} True if the game should skip this update tick.
 */
function shouldSkipGameUpdate() {
  if (freezeFrames > 0) {
    freezeFrames--;
    return true;
  }
  return false;
}

// ============ 5. DAMAGE NUMBERS ============

const damageNumbers = [];
const MAX_DAMAGE_NUMBERS = 10;
const DAMAGE_NUMBER_LIFETIME = 45;
const DAMAGE_NUMBER_RISE_PX = 30; // total pixels to float up over lifetime

/**
 * Spawn a floating damage number at a world position.
 * @param {number} worldX - World X.
 * @param {number} worldY - World Y.
 * @param {number} amount - Damage amount (positive number).
 * @param {boolean} blocked - True if the hit was fully blocked (0 damage).
 */
function spawnDamageNumber(worldX, worldY, amount, blocked) {
  // Evict oldest if at capacity
  if (damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
    damageNumbers.shift();
  }

  damageNumbers.push({
    worldX: worldX,
    worldY: worldY,
    text: blocked ? 'BLOCKED' : `\u2212${amount.toFixed(1)}`,
    color: blocked ? '#66bb6a' : '#ef5350',
    life: DAMAGE_NUMBER_LIFETIME,
    maxLife: DAMAGE_NUMBER_LIFETIME
  });
}

/**
 * Update all active damage numbers: float upward and age.
 * Call once per frame.
 */
function updateDamageNumbers() {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const dn = damageNumbers[i];
    dn.life--;
    // Float upward in world space
    dn.worldY -= DAMAGE_NUMBER_RISE_PX / DAMAGE_NUMBER_LIFETIME;
    if (dn.life <= 0) {
      damageNumbers.splice(i, 1);
    }
  }
}

/**
 * Draw all active damage numbers to the canvas.
 * Uses worldToScreen() for camera-correct positioning.
 */
function drawDamageNumbers() {
  for (let i = 0; i < damageNumbers.length; i++) {
    const dn = damageNumbers[i];
    const screen = worldToScreen(dn.worldX, dn.worldY);
    const alpha = dn.life / dn.maxLife;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = dn.color;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(dn.text, screen.x, screen.y);
    ctx.restore();
  }
}

// ============ 6. IMPACT RINGS ============

const impactRings = [];

/**
 * Spawn an expanding impact ring at a world position.
 * @param {number} worldX - Center X in world coords.
 * @param {number} worldY - Center Y in world coords.
 * @param {number} maxRadius - Maximum expansion radius.
 * @param {number} life - Total frames for the ring to last.
 */
function spawnImpactRing(worldX, worldY, maxRadius, life) {
  impactRings.push({
    x: worldX,
    y: worldY,
    radius: 0,
    maxRadius: maxRadius || 40,
    life: life || 20,
    maxLife: life || 20
  });
}

/**
 * Update all impact rings: expand and age. Remove when done.
 * Call once per frame.
 */
function updateImpactRings() {
  for (let i = impactRings.length - 1; i >= 0; i--) {
    const ring = impactRings[i];
    ring.life--;
    // Ease-out expansion toward maxRadius
    ring.radius += (ring.maxRadius - ring.radius) * 0.15;
    if (ring.life <= 0) {
      impactRings.splice(i, 1);
    }
  }
}

/**
 * Draw all impact rings as white expanding circles with fading alpha.
 */
function drawImpactRings() {
  for (let i = 0; i < impactRings.length; i++) {
    const ring = impactRings[i];
    const screen = worldToScreen(ring.x, ring.y);
    const alpha = ring.life / ring.maxLife;
    const zoom = camera.zoom || 1;

    ctx.save();
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 2 * alpha) * zoom;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, ring.radius * zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ============ 7. KILL FEED ============

const killFeed = [];
const MAX_KILL_FEED = 5;
const KILL_FEED_DURATION = 300; // 5 seconds at 60fps

/**
 * Add an entry to the kill feed.
 * @param {object} killerBot - The bot that got the kill (or null for environmental death).
 * @param {object} deadBot - The bot that died.
 */
function addKillFeedEntry(killerBot, deadBot) {
  const killerName = killerBot
    ? (killerBot.isPlayer ? 'YOUR BOT' : `Bot #${killerBot.index}`)
    : '???';
  const deadName = deadBot.isPlayer ? 'YOUR BOT' : `Bot #${deadBot.index}`;
  const killerHue = killerBot ? killerBot.hue : 0;
  const deadHue = deadBot.hue;
  const isPlayerInvolved = (killerBot && killerBot.isPlayer) || deadBot.isPlayer;
  const isPlayerKill = killerBot && killerBot.isPlayer;
  const isPlayerDeath = deadBot.isPlayer;

  killFeed.unshift({
    killerName,
    deadName,
    killerHue,
    deadHue,
    isPlayerInvolved,
    isPlayerKill,
    isPlayerDeath,
    spawnFrame: frameCount
  });

  if (killFeed.length > MAX_KILL_FEED) {
    killFeed.pop();
  }
}

/**
 * Draw the kill feed in the top-right corner of the screen.
 * Each entry fades after KILL_FEED_DURATION frames (5 seconds).
 * Format: "Bot #5 -> Bot #12" with color coding.
 */
function drawKillFeed() {
  const x = canvas.width - 15;
  let y = 190; // positioned below minimap

  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = '11px Arial';

  for (let i = 0; i < killFeed.length; i++) {
    const entry = killFeed[i];
    const age = frameCount - entry.spawnFrame;

    // Remove expired entries
    if (age > KILL_FEED_DURATION) {
      killFeed.splice(i, 1);
      i--;
      continue;
    }

    // Fade out in last 60 frames (1 second)
    const alpha = age > KILL_FEED_DURATION - 60
      ? (KILL_FEED_DURATION - age) / 60
      : 1;

    ctx.globalAlpha = alpha;

    // Measure full text
    const fullText = `${entry.killerName} \u2192 ${entry.deadName}`;
    const tw = ctx.measureText(fullText).width;

    // Background pill
    ctx.fillStyle = entry.isPlayerInvolved ? 'rgba(255,215,0,0.15)' : 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - tw - 12, y - 11, tw + 16, 17);

    // Killer name color
    if (entry.isPlayerKill) {
      ctx.fillStyle = '#ffd54f'; // gold for player
    } else {
      ctx.fillStyle = `hsl(${entry.killerHue}, 60%, 65%)`;
    }

    // Measure parts for individual coloring
    const arrowText = ' \u2192 ';
    const killerWidth = ctx.measureText(entry.killerName).width;
    const arrowWidth = ctx.measureText(arrowText).width;

    // Draw killer name
    ctx.textAlign = 'right';
    ctx.fillText(entry.killerName, x - 4 - ctx.measureText(entry.deadName).width - arrowWidth, y);

    // Draw arrow
    ctx.fillStyle = '#ccc';
    ctx.fillText(arrowText, x - 4 - ctx.measureText(entry.deadName).width, y);

    // Draw dead name color
    if (entry.isPlayerDeath) {
      ctx.fillStyle = '#ff4444'; // red for player death
    } else {
      ctx.fillStyle = `hsl(${entry.deadHue}, 60%, 65%)`;
    }
    ctx.fillText(entry.deadName, x - 4, y);

    y += 20;
  }

  ctx.restore();
}

// ============ 8. KILL BANNER (HTML overlay) ============

const _killBanners = [];

/**
 * Show a cinematic kill banner when the player kills or is killed.
 * Creates a DOM element in #kill-banner-container that slides in from
 * the top, holds 90 frames, then slides out.
 * Gold accent for player kills, red for player deaths.
 * @param {object} killer - Killer bot (or null).
 * @param {object} dead - Dead bot.
 */
function showKillBanner(killer, dead) {
  const container = document.getElementById('kill-banner-container');
  if (!container) return;

  const isPlayerKill = killer && killer.isPlayer;
  const isPlayerDeath = dead && dead.isPlayer;

  // Only show banners involving the player
  if (!isPlayerKill && !isPlayerDeath) return;

  const banner = document.createElement('div');
  banner.className = 'kill-banner' + (isPlayerDeath ? ' player-death' : '');

  const icon = isPlayerDeath ? '\u2620' : '\u2694';
  const killerName = killer
    ? (killer.isPlayer ? 'YOUR BOT' : `Bot #${killer.index}`)
    : 'Unknown';
  const deadName = dead.isPlayer ? 'YOUR BOT' : `Bot #${dead.index}`;
  const accentColor = isPlayerDeath ? '#ff3333' : '#ffd700';

  banner.innerHTML = `${icon} ${killerName} eliminated ${deadName}`;
  banner.style.cssText = `
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 32px;
    font: bold 18px monospace;
    color: #fff;
    background: linear-gradient(135deg, rgba(0,0,0,0.85), rgba(20,20,20,0.9));
    border-bottom: 3px solid ${accentColor};
    border-radius: 0 0 8px 8px;
    text-shadow: 0 0 8px ${accentColor};
    letter-spacing: 2px;
    white-space: nowrap;
    z-index: 100;
    transition: top 0.3s ease-out;
    pointer-events: none;
  `;

  container.appendChild(banner);

  // Slide in
  requestAnimationFrame(() => {
    banner.style.top = '0px';
  });

  // Track for frame-based cleanup
  _killBanners.push({
    el: banner,
    holdFrames: 90,
    phase: 'hold', // hold -> slideOut -> done
    _removeTimer: 0
  });
}

/**
 * Update kill banners: count down hold, slide out, remove from DOM.
 * Call once per frame.
 */
function updateKillBanners() {
  for (let i = _killBanners.length - 1; i >= 0; i--) {
    const b = _killBanners[i];

    if (b.phase === 'hold') {
      b.holdFrames--;
      if (b.holdFrames <= 0) {
        b.phase = 'slideOut';
        b.el.style.top = '-60px';
        b._removeTimer = 20; // buffer for CSS transition
      }
    } else if (b.phase === 'slideOut') {
      b._removeTimer--;
      if (b._removeTimer <= 0) {
        b.el.remove();
        _killBanners.splice(i, 1);
      }
    }
  }
}

// ============ 9. TENSION LINES (approach detection) ============

const tensionLines = [];

/**
 * Normalize an angle to the range [-PI, PI].
 * @param {number} a - Angle in radians.
 * @returns {number} Normalized angle.
 */
function _normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Check whether two bots are approaching each other.
 * Returns true if both bots' movement directions (from their angle property)
 * point within ~60 degrees of the direct line between them.
 * @param {object} bot1 - First bot.
 * @param {object} bot2 - Second bot.
 * @returns {boolean}
 */
function areApproaching(bot1, bot2) {
  const dx = bot2.x - bot1.x;
  const dy = bot2.y - bot1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return false;

  // Angle from bot1 toward bot2, and from bot2 toward bot1
  const angle1To2 = Math.atan2(dy, dx);
  const angle2To1 = Math.atan2(-dy, -dx);

  // How far each bot's movement angle deviates from the direct approach line
  const diff1 = Math.abs(_normalizeAngle(bot1.angle - angle1To2));
  const diff2 = Math.abs(_normalizeAngle(bot2.angle - angle2To1));

  return diff1 < Math.PI / 3 && diff2 < Math.PI / 3;
}

/**
 * Scan all bot pairs for approach situations within 120 world units.
 * Populates the tensionLines array with active pair data.
 * Call once per frame (or every few frames for performance).
 */
function detectApproachPhase() {
  tensionLines.length = 0;

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const b1 = bots[i];
      const b2 = bots[j];

      const dx = b1.x - b2.x;
      const dy = b1.y - b2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120 && dist > 30 && areApproaching(b1, b2)) {
        tensionLines.push({
          bot1: b1,
          bot2: b2,
          intensity: 1 - dist / 120 // closer = more intense
        });
      }
    }
  }
}

/**
 * Draw tension lines between approaching bots as dashed red-orange
 * oscillating lines.
 */
function drawTensionLines() {
  if (tensionLines.length === 0) return;

  ctx.save();

  for (let i = 0; i < tensionLines.length; i++) {
    const t = tensionLines[i];
    const s1 = worldToScreen(t.bot1.x, t.bot1.y);
    const s2 = worldToScreen(t.bot2.x, t.bot2.y);

    const pulse = 0.3 + 0.3 * Math.sin(frameCount * 0.15);

    ctx.strokeStyle = `rgba(255, 100, 50, ${t.intensity * pulse})`;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = (frameCount * 2) % 8;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

// ============ 10. DANGER INDICATORS (off-screen threats) ============

/**
 * Draw red chevron indicators at screen edges for off-screen threats
 * near the currently followed bot (within 300 world units).
 * Shows the closest 3 threats with distance labels.
 */
function drawDangerIndicators() {
  const followed = camera.followBot;
  if (!followed) return;

  // Find off-screen threats within 300 units
  const threats = [];
  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    if (bot === followed || bot.lives <= 0) continue;

    const dx = bot.x - followed.x;
    const dy = bot.y - followed.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 300 || dist < 10) continue;

    // Check if off-screen (use negative margin to require being clearly off-screen)
    if (!isVisible(bot.x, bot.y, -30)) {
      const angle = Math.atan2(dy, dx);
      threats.push({ dist, angle });
    }
  }

  // Sort by distance, show closest 3
  threats.sort((a, b) => a.dist - b.dist);
  const toShow = threats.slice(0, 3);
  if (toShow.length === 0) return;

  ctx.save();

  for (let i = 0; i < toShow.length; i++) {
    const t = toShow[i];

    // Position at screen edge along the angle from center
    const edgeX = canvas.width / 2 + Math.cos(t.angle) * (canvas.width / 2 - 40);
    const edgeY = canvas.height / 2 + Math.sin(t.angle) * (canvas.height / 2 - 40);

    const alpha = 1 - t.dist / 300;
    const pulse = 0.6 + 0.4 * Math.sin(frameCount * 0.1 + i);

    // Draw chevron pointing toward threat
    ctx.save();
    ctx.translate(edgeX, edgeY);
    ctx.rotate(t.angle);

    ctx.fillStyle = `rgba(255, 50, 50, ${alpha * pulse})`;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();

    // Second chevron slightly behind for double-chevron look
    ctx.globalAlpha = alpha * pulse * 0.5;
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-9, -5);
    ctx.lineTo(-9, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Distance label
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(t.dist), edgeX, edgeY + 18);
  }

  ctx.restore();
}

// ============ 11. STAT POPUPS ============

const statPopups = [];
const MAX_STAT_POPUPS = 8;
const STAT_POPUP_LIFETIME = 60;

/**
 * Spawn a floating stat-change text near the HUD area.
 * @param {string} text - Text to display (e.g. "+0.1 SPD").
 * @param {string} [color='#ffffff'] - CSS color string.
 */
function spawnStatPopup(text, color) {
  if (statPopups.length >= MAX_STAT_POPUPS) {
    statPopups.shift();
  }

  statPopups.push({
    text: text,
    color: color || '#ffffff',
    life: STAT_POPUP_LIFETIME,
    maxLife: STAT_POPUP_LIFETIME
  });
}

/**
 * Draw all active stat popups. They float upward and fade out.
 */
function drawStatPopups() {
  for (let i = statPopups.length - 1; i >= 0; i--) {
    const p = statPopups[i];
    p.life--;

    if (p.life <= 0) {
      statPopups.splice(i, 1);
      continue;
    }

    const progress = 1 - p.life / p.maxLife;
    const alpha = 1 - progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    // Stack popups near the left edge, drifting upward
    ctx.fillText(p.text, 15, 250 - progress * 25 - i * 16);
    ctx.restore();
  }
}

// ============ 12. ARENA EVENT LISTENERS ============

/**
 * Register all arena effect listeners on the event bus.
 * Should be called once during game initialization, after all
 * other systems (particlePool, etc.) are ready.
 */
function initArenaEventListeners() {

  // --- combat:contact ---
  // Fired whenever two bots collide in combat (every hit).
  // Expected data: { bot1, bot2, damage1, damage2, x, y }
  arenaEvents.on('combat:contact', function (data) {
    const contactX = data.x;
    const contactY = data.y;
    const visible = isVisible(contactX, contactY);

    // Sparks at contact point (10 SPARK particles)
    if (visible && typeof particlePool !== 'undefined') {
      particlePool.emit(contactX, contactY, 10, 'SPARK');
    }

    // Screen shake proportional to damage
    const maxDmg = Math.max(data.damage1 || 0, data.damage2 || 0);
    const shakeInt = Math.min(3 + maxDmg, arenaConfig.shake.maxIntensity);
    triggerScreenShake(shakeInt, 8);

    // Damage numbers on each bot
    if (data.damage1 > 0) {
      spawnDamageNumber(data.bot1.x, data.bot1.y - 15, data.damage1, false);
    } else {
      spawnDamageNumber(data.bot1.x, data.bot1.y - 15, 0, true);
    }
    if (data.damage2 > 0) {
      spawnDamageNumber(data.bot2.x, data.bot2.y - 15, data.damage2, false);
    } else {
      spawnDamageNumber(data.bot2.x, data.bot2.y - 15, 0, true);
    }

    // Impact ring at contact point
    spawnImpactRing(contactX, contactY, 80, 15);
  });

  // --- combat:kill ---
  // Fired when a bot is eliminated.
  // Expected data: { killer, dead, x, y, isPlayerKill, isPlayerDeath }
  arenaEvents.on('combat:kill', function (data) {
    const killX = data.x;
    const killY = data.y;
    const visible = isVisible(killX, killY);

    // Freeze frame (4 frames if the kill is on-screen)
    if (visible) {
      triggerFreezeFrame(4);
    }

    // Shatter particles at the dead bot's position (25 SHATTER)
    if (typeof particlePool !== 'undefined') {
      const shatterColor = `hsl(${data.dead.hue}, 60%, 50%)`;
      particlePool.emit(killX, killY, 25, 'SHATTER', { color: shatterColor });
    }

    // Shockwave ring (larger, slower than combat contact)
    spawnImpactRing(killX, killY, 100, 20);

    // Scorch mark on the ground (defined in main.js)
    if (typeof stampScorchMark === 'function') {
      stampScorchMark(killX, killY);
    }

    // Kill feed entry
    addKillFeedEntry(data.killer, data.dead);

    // Absorb particles from dead toward killer
    if (data.killer && typeof particlePool !== 'undefined') {
      particlePool.emitToward(killX, killY, data.killer.x, data.killer.y, 8, 'ABSORB');
    }

    // --- Player-specific extras ---

    if (data.isPlayerKill) {
      // Bigger screen shake for player kills
      triggerScreenShake(arenaConfig.shake.maxIntensity, 12);
      // Kill banner (gold accent)
      showKillBanner(data.killer, data.dead);
    }

    if (data.isPlayerDeath) {
      // Large screen shake
      triggerScreenShake(arenaConfig.shake.maxIntensity, 15);
      // Red vignette pulse
      setVignetteIntensity(0.8, 0.6);
      // Kill banner (red accent)
      showKillBanner(data.killer, data.dead);
      // Hold camera at death position so the scene lingers
      arenaEvents.emit('camera:holdPosition', {
        x: killX,
        y: killY,
        duration: 120
      });
    }
  });
}
