// Bots Strategy v11.3 "The Arena" - Bot Rendering
// Extends Bot class via prototype — enhanced with arena visual effects

Bot.prototype.draw = function(isFollowed = false) {
  if (!isVisible(this.x, this.y, 150)) return;

  const screen = worldToScreen(this.x, this.y);
  const scale = getScale(this.y);
  const arenaActive = typeof arenaConfig !== 'undefined' && arenaConfig.enabled;

  // Breathing animation
  let breathFactor = 1.0;
  if (arenaActive) {
    breathFactor = 1 + 0.02 * Math.sin((frameCount + this.index * 47) * (Math.PI * 2) / 180);
  }
  const size = this.size * scale * breathFactor;
  const shadowOffset = this.shadowOffset * scale;

  // Age-based saturation
  let saturation = 60;
  if (lifecycleSettings.age.enabled && typeof getAgeVisualFactor === 'function') {
    saturation = Math.round(60 * getAgeVisualFactor(this));
  }

  // ---- ARENA PRE-BODY EFFECTS ----
  if (arenaActive) {
    // Power aura
    const totalStats = this.speed + this.attack + this.defence + this.lives;
    if (totalStats >= 20) {
      const tier = totalStats < 30 ? 1 : totalStats < 50 ? 2 : 3;
      const auraRadius = size * (1.5 + tier * 0.5);
      const auraAlpha = 0.08 + tier * 0.05;
      const gradient = ctx.createRadialGradient(screen.x, screen.y, size * 0.5, screen.x, screen.y, auraRadius);
      gradient.addColorStop(0, `hsla(${this.hue}, 80%, 65%, ${auraAlpha})`);
      gradient.addColorStop(1, `hsla(${this.hue}, 80%, 65%, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, auraRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Speed dominant: motion blur trail
    if (this.speed > this.attack && this.speed > this.defence && this.posHistory && this.posHistory.length > 0) {
      for (let i = 0; i < this.posHistory.length; i++) {
        const pos = this.posHistory[i];
        const s = worldToScreen(pos.x, pos.y);
        const alpha = 0.15 - i * 0.05;
        ctx.fillStyle = `hsla(${this.hue}, ${saturation}%, 50%, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, size * (0.8 - i * 0.1), size * (0.5 - i * 0.06), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- SHADOW (day-aware in arena) ----
  if (arenaActive && typeof getDayPhase === 'function') {
    const dayPhase = getDayPhase(frameCount);
    let shadowAlpha = 0.25, shadowLength = 1.0, sx = 0;
    if (dayPhase.phase === 'dawn') {
      sx = -size * 0.7; shadowLength = 1.6; shadowAlpha = 0.18;
    } else if (dayPhase.phase === 'day') {
      sx = 0; shadowLength = 0.6; shadowAlpha = 0.3;
    } else if (dayPhase.phase === 'dusk') {
      sx = size * 0.7; shadowLength = 1.6; shadowAlpha = 0.18;
    } else {
      shadowLength = 0.3; shadowAlpha = 0.08;
    }
    const sy = size * 0.3 * shadowLength;
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(screen.x + sx, screen.y + sy, size * 1.3 * shadowLength, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(screen.x + shadowOffset, screen.y + shadowOffset * 0.5, size * 1.3, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- BODY ----
  ctx.fillStyle = `hsl(${this.hue}, ${saturation}%, 50%)`;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, size, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = `hsl(${this.hue}, ${saturation}%, 70%)`;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y - size * 0.25, size * 0.65, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Direction indicator
  const dirX = Math.cos(this.angle) * size * 0.8;
  const dirY = Math.sin(this.angle) * size * 0.5;
  ctx.fillStyle = `hsl(${this.hue}, ${Math.round(saturation * 1.17)}%, 40%)`;
  ctx.beginPath();
  ctx.moveTo(screen.x + dirX, screen.y + dirY);
  ctx.lineTo(screen.x + dirX * 0.3 - dirY * 0.5, screen.y + dirY * 0.3 + dirX * 0.3);
  ctx.lineTo(screen.x + dirX * 0.3 + dirY * 0.5, screen.y + dirY * 0.3 - dirX * 0.3);
  ctx.closePath();
  ctx.fill();

  // ---- EYES (enhanced in arena) ----
  const eyeAngle = this.angle;
  const eyeOffset = size * 0.25;
  const eyeDist = size * 0.4;
  const lx = screen.x + Math.cos(eyeAngle) * eyeDist - Math.sin(eyeAngle) * eyeOffset;
  const ly = screen.y + Math.sin(eyeAngle) * eyeDist * 0.5 - size * 0.15;
  const rx = screen.x + Math.cos(eyeAngle) * eyeDist + Math.sin(eyeAngle) * eyeOffset;
  const ry = screen.y + Math.sin(eyeAngle) * eyeDist * 0.5 - size * 0.15;

  if (arenaActive) {
    const action = this.lastAction || '';
    let eyeRadius = 2.5 * scale;
    let eyeColor = '#fff';
    let pupilColor = '#1e293b';
    let pupilShift = 0;

    if (action === 'hunt' || action === 'hunt_weak') {
      eyeRadius = 1.8 * scale; eyeColor = '#ffdddd'; pupilColor = '#cc0000';
    } else if (action === 'flee') {
      eyeRadius = 3.5 * scale;
    } else if (!action || action === 'idle') {
      pupilShift = Math.sin(Math.floor(frameCount / 60) * 1.7 + this.index) * scale;
    }

    // White of eye
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(lx, ly, eyeRadius, 0, Math.PI * 2);
    ctx.arc(rx, ry, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    const pupilR = Math.min(eyeRadius * 0.6, 1.5 * scale);
    ctx.fillStyle = pupilColor;
    ctx.beginPath();
    ctx.arc(lx + pupilShift, ly, pupilR, 0, Math.PI * 2);
    ctx.arc(rx + pupilShift, ry, pupilR, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5 * scale, 0, Math.PI * 2);
    ctx.arc(rx, ry, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- ARENA POST-BODY EFFECTS ----
  if (arenaActive) {
    // Attack dominant: red energy wisps
    if (this.attack > this.speed && this.attack > this.defence) {
      for (let i = 0; i < 3; i++) {
        const a = frameCount * 0.05 + i * Math.PI * 2 / 3;
        const ox = Math.cos(a) * size * 1.5;
        const oy = Math.sin(a) * size * 1.0;
        ctx.fillStyle = `rgba(255, 60, 40, ${0.3 + 0.2 * Math.sin(frameCount * 0.1 + i)})`;
        ctx.beginPath();
        ctx.arc(screen.x + ox, screen.y + oy, 2 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Defence dominant: shield shimmer
    if (this.defence > this.speed && this.defence > this.attack) {
      const shimmer = 0.2 + 0.1 * Math.sin(frameCount * 0.08);
      ctx.strokeStyle = `rgba(100, 180, 255, ${shimmer})`;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(screen.x + Math.cos(this.angle) * size * 0.5, screen.y + Math.sin(this.angle) * size * 0.35,
              size * 0.8, this.angle - 0.8, this.angle + 0.8);
      ctx.stroke();
    }
  }

  // ===== LIFECYCLE VISUAL EFFECTS =====

  // Invincibility effect
  if (this.invincibilityFrames > 0) {
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(frameCount * 0.15));
    const effect = lifecycleSettings.respawnInvincibility.visualEffect;
    if (effect === 'pulse' || effect === 'glow') {
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      if (effect === 'glow') {
        ctx.strokeStyle = `rgba(255, 255, 200, ${pulse * 0.5})`;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (effect === 'flash') {
      if (Math.floor(frameCount / 10) % 2 === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size * 1.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Pack membership indicator
  if (this.relationships && this.relationships.packId !== null && lifecycleSettings.packs.enabled) {
    const pack = packs.get(this.relationships.packId);
    if (pack) {
      ctx.strokeStyle = `hsla(${pack.hue}, 70%, 50%, 0.6)`;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Starvation indicator
  if (this.isStarving && lifecycleSettings.starvation.enabled) {
    const starvePulse = 0.3 + 0.3 * Math.abs(Math.sin(frameCount * 0.08));
    ctx.fillStyle = `rgba(255, 0, 0, ${starvePulse})`;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, size * 0.8, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lives indicator
  const livesY = screen.y - size - 10 * scale;
  const displayLives = Math.floor(this.lives);
  for (let i = 0; i < Math.min(displayLives, 10); i++) {
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(screen.x - (Math.min(displayLives, 10) - 1) * 3 * scale + i * 6 * scale, livesY, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player indicator
  if (this.isPlayer) {
    ctx.fillStyle = '#ffdd00';
    ctx.font = `${14 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('★', screen.x, livesY - 12 * scale);
  }

  // Player offspring indicator
  if (this.isPlayerOffspring && !this.isPlayer) {
    const starY = livesY - 12 * scale;
    let starColor = this.playerLineage === 1 ? '#ffdd00' : this.playerLineage === 2 ? '#c0c0c0' : '#cd7f32';
    ctx.strokeStyle = starColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.font = `${14 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.strokeText('☆', screen.x, starY);
  }

  // Generation indicator (debug)
  if (this.generation > 0 && debugMode) {
    ctx.fillStyle = '#888';
    ctx.font = `${8 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`G${this.generation}`, screen.x, livesY - 20 * scale);
  }

  // Followed marker
  if (isFollowed) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    const bs = size * 2, bl = size * 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    // Corner brackets
    ctx.beginPath(); ctx.moveTo(screen.x - bs, screen.y - bs + bl); ctx.lineTo(screen.x - bs, screen.y - bs); ctx.lineTo(screen.x - bs + bl, screen.y - bs); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(screen.x + bs - bl, screen.y - bs); ctx.lineTo(screen.x + bs, screen.y - bs); ctx.lineTo(screen.x + bs, screen.y - bs + bl); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(screen.x - bs, screen.y + bs - bl); ctx.lineTo(screen.x - bs, screen.y + bs); ctx.lineTo(screen.x - bs + bl, screen.y + bs); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(screen.x + bs - bl, screen.y + bs); ctx.lineTo(screen.x + bs, screen.y + bs); ctx.lineTo(screen.x + bs, screen.y + bs - bl); ctx.stroke();
  }

  // ---- ARENA NAME TAG (on hover) ----
  if (arenaActive && typeof hoveredBot !== 'undefined' && this === hoveredBot) {
    const name = this.isPlayer ? 'YOUR BOT' : `Bot #${this.index}`;
    const stats = `S:${this.speed.toFixed(1)} A:${this.attack.toFixed(1)} D:${this.defence.toFixed(1)} L:${this.lives.toFixed(1)}`;
    const tagY = screen.y - size - 30 * scale;
    ctx.font = `bold ${11 * scale}px Arial`;
    const nameW = ctx.measureText(name).width;
    ctx.font = `${9 * scale}px Arial`;
    const statsW = ctx.measureText(stats).width;
    const w = Math.max(nameW, statsW) + 16;
    const h = 30 * scale;
    // Pill background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(screen.x - w / 2, tagY - h, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = `hsla(${this.hue}, 70%, 50%, 0.6)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${11 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(name, screen.x, tagY - h + 13 * scale);
    ctx.fillStyle = '#aaa';
    ctx.font = `${9 * scale}px Arial`;
    ctx.fillText(stats, screen.x, tagY - h + 24 * scale);
  }
};
