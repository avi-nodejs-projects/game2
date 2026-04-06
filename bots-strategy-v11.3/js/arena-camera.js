// Bots Strategy v11.3 "The Arena" - Director Camera AI
// Uses globals: camera, bots, playerBot, frameCount, arenaConfig, isVisible, arenaEvents

// ============ SHOT TYPES ============
const SHOT_TYPES = {
  FOLLOW:           { zoom: 1.0 },
  CONFRONTATION:    { zoom: 0.8 },
  WIDE:             { zoom: 0.6 },
  KILL_CLOSEUP:     { zoom: 1.5 },
  PLAYER_DRAMATIC:  { zoom: 0.9 }
};

// ============ DIRECTOR STATE ============
const director = {
  enabled: false,
  currentShot: {
    type: null,
    target: null,
    startFrame: 0
  },
  holdPosition: {
    x: 0,
    y: 0,
    endFrame: 0
  },
  minShotDuration: 120,   // 2 seconds at 60 FPS
  transitionFrames: 30
};

// ============ TOGGLE ============

function toggleDirector() {
  director.enabled = !director.enabled;
  if (!director.enabled) {
    camera.targetZoom = 1.0;
  }
}

// ============ MAIN UPDATE ============

function updateDirector() {
  if (!director.enabled) return;

  // --- Handle held position (death cam) ---
  if (director.holdPosition.endFrame > 0) {
    if (frameCount <= director.holdPosition.endFrame) {
      // Override camera position to hold on the death location
      camera.x += (director.holdPosition.x - camera.x) * camera.smoothing;
      camera.y += (director.holdPosition.y - camera.y) * camera.smoothing;
      camera.autoFollow = false;
      return;
    }
    // Hold expired — clear it and restore auto-follow
    director.holdPosition.endFrame = 0;
    camera.autoFollow = true;
  }

  // --- Minimum shot duration gate ---
  const shotAge = frameCount - director.currentShot.startFrame;
  if (director.currentShot.type !== null && shotAge < director.minShotDuration) {
    return;
  }

  // --- Evaluate next shot ---
  const next = evaluateBestShot();
  if (!next) return;

  // --- Apply the shot ---
  director.currentShot.type = next.type;
  director.currentShot.target = next.target;
  director.currentShot.startFrame = frameCount;

  camera.targetZoom = SHOT_TYPES[next.type].zoom;

  if (next.target) {
    camera.followBot = next.target;
    camera.autoFollow = true;
  } else {
    // Wide shot — no specific bot to follow
    camera.autoFollow = false;
  }
}

// ============ SHOT EVALUATION ============

function evaluateBestShot() {
  // Priority 1 (KILL_CLOSEUP) is handled reactively via the arenaEvents listener,
  // so we skip it here and start from Priority 2.

  // --- Priority 2: Player in danger ---
  if (playerBot && playerBot.lives > 0) {
    for (let i = 0; i < bots.length; i++) {
      const enemy = bots[i];
      if (enemy === playerBot || enemy.lives <= 0) continue;

      const dx = enemy.x - playerBot.x;
      const dy = enemy.y - playerBot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150 && enemy.attack > playerBot.defence) {
        return { type: 'PLAYER_DRAMATIC', target: playerBot };
      }
    }
  }

  // --- Priority 3: Confrontation — two bots approaching each other within 120 units ---
  for (let i = 0; i < bots.length; i++) {
    const bot1 = bots[i];
    if (bot1.lives <= 0) continue;

    for (let j = i + 1; j < bots.length; j++) {
      const bot2 = bots[j];
      if (bot2.lives <= 0) continue;

      const dx = bot2.x - bot1.x;
      const dy = bot2.y - bot1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120 && areApproaching(bot1, bot2)) {
        // Follow the midpoint by targeting whichever bot is the player, or bot1
        const focusBot = (bot1 === playerBot) ? bot1 :
                         (bot2 === playerBot) ? bot2 : bot1;
        return { type: 'CONFRONTATION', target: focusBot };
      }
    }
  }

  // --- Priority 4: Follow active bot — 50% bias toward player ---
  if (playerBot && playerBot.lives > 0 && Math.random() < 0.5) {
    return { type: 'FOLLOW', target: playerBot };
  }

  // Pick a hunting bot (one whose target is another bot, i.e. actively pursuing)
  const hunters = [];
  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    if (bot.lives <= 0) continue;
    if (bot.currentAction === 'hunt' || bot.currentAction === 'avenge') {
      hunters.push(bot);
    }
  }

  if (hunters.length > 0) {
    const pick = hunters[Math.floor(Math.random() * hunters.length)];
    return { type: 'FOLLOW', target: pick };
  }

  // Fallback: follow any living bot
  const alive = bots.filter(b => b.lives > 0);
  if (alive.length > 0) {
    const pick = alive[Math.floor(Math.random() * alive.length)];
    return { type: 'FOLLOW', target: pick };
  }

  // --- Priority 5: Wide establishing shot ---
  return { type: 'WIDE', target: null };
}

// ============ HELPERS ============

/**
 * Check if both bots are moving toward each other.
 * For each bot, compute the angle between its movement direction and the
 * direction toward the other bot. If both angles are less than PI/3,
 * they are approaching.
 */
function areApproaching(bot1, bot2) {
  // Bot 1's movement direction
  const mv1x = bot1.targetX - bot1.x;
  const mv1y = bot1.targetY - bot1.y;
  // Direction from bot1 toward bot2
  const to2x = bot2.x - bot1.x;
  const to2y = bot2.y - bot1.y;

  const angle1 = angleBetween(mv1x, mv1y, to2x, to2y);

  // Bot 2's movement direction
  const mv2x = bot2.targetX - bot2.x;
  const mv2y = bot2.targetY - bot2.y;
  // Direction from bot2 toward bot1
  const to1x = bot1.x - bot2.x;
  const to1y = bot1.y - bot2.y;

  const angle2 = angleBetween(mv2x, mv2y, to1x, to1y);

  return angle1 < Math.PI / 3 && angle2 < Math.PI / 3;
}

/**
 * Compute the unsigned angle between two 2D vectors.
 * Returns a value in [0, PI].
 */
function angleBetween(ax, ay, bx, by) {
  const dot = ax * bx + ay * by;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magB = Math.sqrt(bx * bx + by * by);
  if (magA < 0.001 || magB < 0.001) return Math.PI; // stationary = not approaching
  return Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB))));
}

/**
 * Normalize an angle to the range [-PI, PI].
 */
function normalizeAngle(a) {
  while (a > Math.PI)  a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// ============ EVENT LISTENERS ============

arenaEvents.on('combat:kill', (data) => {
  if (!director.enabled) return;

  // Only react if the kill location is currently on screen
  if (!isVisible(data.x, data.y, 50)) return;

  // Override current shot with a kill close-up
  director.currentShot.type = 'KILL_CLOSEUP';
  director.currentShot.target = data.killer || null;
  director.currentShot.startFrame = frameCount;

  camera.targetZoom = SHOT_TYPES.KILL_CLOSEUP.zoom;

  // Hold the camera at the kill position
  director.holdPosition.x = data.x;
  director.holdPosition.y = data.y;
  director.holdPosition.endFrame = frameCount + 60; // hold for 1 second

  camera.autoFollow = false;
});

arenaEvents.on('camera:holdPosition', (data) => {
  if (!director.enabled) return;

  director.holdPosition.x = data.x;
  director.holdPosition.y = data.y;
  director.holdPosition.endFrame = frameCount + (data.duration || 120);

  camera.autoFollow = false;
});
