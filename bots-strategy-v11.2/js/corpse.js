// Bots Strategy v9 - Corpse System

class Corpse {
  constructor(bot) {
    this.x = bot.x;
    this.y = bot.y;
    this.originalHue = bot.hue;
    this.size = bot.size;
    this.nutritionValue = lifecycleSettings.age.corpse.nutritionValue;
    this.createdAtFrame = frameCount;
    this.duration = lifecycleSettings.age.corpse.duration;
    this.originalBotIndex = bot.index;
    this.packId = bot.relationships ? bot.relationships.packId : null;
    this.angle = bot.angle || 0;
  }

  update() {
    // Return false if expired (should be removed)
    if (this.duration > 0) {
      const elapsed = frameCount - this.createdAtFrame;
      return elapsed < this.duration;
    }
    // duration 0 means permanent until eaten
    return true;
  }

  getTimeRemaining() {
    if (this.duration === 0) return Infinity;
    return Math.max(0, this.duration - (frameCount - this.createdAtFrame));
  }

  getFadeAlpha() {
    if (this.duration === 0) return lifecycleSettings.age.corpse.opacity;

    const elapsed = frameCount - this.createdAtFrame;
    const remaining = this.duration - elapsed;
    const fadeStart = this.duration * 0.3; // Start fading at 30% remaining

    if (remaining > fadeStart) {
      return lifecycleSettings.age.corpse.opacity;
    }

    // Fade from opacity to 0.2 over the last 30%
    const fadeProgress = 1 - (remaining / fadeStart);
    const baseOpacity = lifecycleSettings.age.corpse.opacity;
    return baseOpacity - (fadeProgress * (baseOpacity - 0.2));
  }

  draw(rc) {
    if (!rc.isVisible(this.x, this.y)) return;

    const { ctx } = rc;
    const screen = rc.worldToScreen(this.x, this.y);
    const scale = rc.getScale(this.y);
    const size = this.size * scale;
    const fadeAlpha = this.getFadeAlpha();
    const saturation = lifecycleSettings.age.corpse.saturationMultiplier * 100;

    // Shadow (lighter for corpse)
    ctx.fillStyle = `rgba(0,0,0,${0.1 * fadeAlpha})`;
    ctx.beginPath();
    ctx.ellipse(
      screen.x + size * 0.3,
      screen.y + size * 0.2,
      size * 1.2,
      size * 0.5,
      0, 0, Math.PI * 2
    );
    ctx.fill();

    // Body (desaturated)
    ctx.fillStyle = `hsla(${this.originalHue}, ${saturation}%, 40%, ${fadeAlpha})`;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, size, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight (very faded)
    ctx.fillStyle = `hsla(${this.originalHue}, ${saturation * 0.5}%, 55%, ${fadeAlpha * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - size * 0.2, size * 0.5, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // X eyes to indicate death
    ctx.strokeStyle = `rgba(60, 40, 40, ${fadeAlpha})`;
    ctx.lineWidth = 2 * scale;
    const eyeSize = 3 * scale;
    const eyeY = screen.y - size * 0.1;

    // Left eye X
    const leftEyeX = screen.x - size * 0.25;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - eyeSize, eyeY - eyeSize);
    ctx.lineTo(leftEyeX + eyeSize, eyeY + eyeSize);
    ctx.moveTo(leftEyeX + eyeSize, eyeY - eyeSize);
    ctx.lineTo(leftEyeX - eyeSize, eyeY + eyeSize);
    ctx.stroke();

    // Right eye X
    const rightEyeX = screen.x + size * 0.25;
    ctx.beginPath();
    ctx.moveTo(rightEyeX - eyeSize, eyeY - eyeSize);
    ctx.lineTo(rightEyeX + eyeSize, eyeY + eyeSize);
    ctx.moveTo(rightEyeX + eyeSize, eyeY - eyeSize);
    ctx.lineTo(rightEyeX - eyeSize, eyeY + eyeSize);
    ctx.stroke();

    // Nutrition indicator (small glow around corpse)
    if (this.nutritionValue > 1) {
      ctx.strokeStyle = `rgba(100, 255, 100, ${fadeAlpha * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ============ CORPSE MANAGEMENT ============

function createCorpse(bot) {
  const corpse = new Corpse(bot);
  corpses.push(corpse);

  logEvent('CORPSE_CREATED', {
    botIndex: bot.index,
    position: { x: Math.round(bot.x), y: Math.round(bot.y) },
    nutritionValue: corpse.nutritionValue,
    packId: corpse.packId
  });

  return corpse;
}

function updateCorpses() {
  // Filter out expired corpses
  const expiredCorpses = corpses.filter(c => !c.update());
  expiredCorpses.forEach(c => {
    logEvent('CORPSE_EXPIRED', {
      originalBotIndex: c.originalBotIndex,
      position: { x: Math.round(c.x), y: Math.round(c.y) }
    });
  });

  corpses = corpses.filter(c => c.update());
}

function drawCorpses(rc) {
  // Sort by Y for proper depth ordering
  const sortedCorpses = [...corpses].sort((a, b) => a.y - b.y);
  for (const corpse of sortedCorpses) {
    corpse.draw(rc);
  }
}

function checkBotCorpseCollision(bot, corpse) {
  const dx = bot.x - corpse.x;
  const dy = bot.y - corpse.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < bot.size + corpse.size;
}

function canConsumeCorpse(bot, corpse) {
  const cfg = lifecycleSettings.age.corpseInteraction;

  // Check if bot is in same pack as corpse
  if (corpse.packId !== null && bot.relationships && bot.relationships.packId === corpse.packId) {
    // Same pack member
    switch (cfg.packMembers) {
      case 'protected':
        // Can only consume if cannibalism override is enabled and bot is cannibal
        if (cfg.cannibalOverride && lifecycleSettings.packs.cannibalism.enabled) {
          return canCannibalize(bot, corpse);
        }
        return false;
      case 'food':
        return true;
      case 'cannibalOnly':
        return lifecycleSettings.packs.cannibalism.enabled;
      default:
        return false;
    }
  }

  // Non-pack member
  return cfg.nonPackMembers === 'food';
}

function consumeCorpse(bot, corpse) {
  // Apply nutrition — addPartialRandomStat gives +0.1 per call, so multiply by 10
  // to deliver the full nutritionValue (e.g. 2.0 nutrition = 20 calls = 2.0 stat points)
  const nutrition = corpse.nutritionValue;
  const calls = Math.round(nutrition * 10);

  for (let i = 0; i < calls; i++) {
    bot.addPartialRandomStat();
  }

  // Reset starvation
  if (lifecycleSettings.starvation.resetConditions.onDotEaten) {
    resetStarvationTimer(bot, 'corpseConsumed');
  }

  logEvent('CORPSE_CONSUMED', {
    corpseOriginalBotIndex: corpse.originalBotIndex,
    consumerIndex: bot.index,
    nutritionGained: nutrition,
    position: { x: Math.round(corpse.x), y: Math.round(corpse.y) }
  });

  // Remove corpse from array
  const index = corpses.indexOf(corpse);
  if (index > -1) {
    corpses.splice(index, 1);
  }
}

function processCorpseCollisions() {
  for (const bot of bots) {
    for (let i = corpses.length - 1; i >= 0; i--) {
      const corpse = corpses[i];
      if (checkBotCorpseCollision(bot, corpse)) {
        if (canConsumeCorpse(bot, corpse)) {
          consumeCorpse(bot, corpse);
        }
      }
    }
  }
}

function clearCorpses() {
  corpses = [];
}
