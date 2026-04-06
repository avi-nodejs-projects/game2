// Bots Strategy v9 - Bot Rendering
// Extends Bot class via prototype

Bot.prototype.draw = function(isFollowed = false) {
  if (!isVisible(this.x, this.y, 150)) return;

  const screen = worldToScreen(this.x, this.y);
  const scale = getScale(this.y);
  const size = this.size * scale;
  const shadowOffset = this.shadowOffset * scale;

  // Calculate age-based saturation (visual aging effect)
  let saturation = 60;
  if (lifecycleSettings.age.enabled && typeof getAgeVisualFactor === 'function') {
    const ageFactor = getAgeVisualFactor(this);
    saturation = Math.round(60 * ageFactor); // Desaturate as bot ages
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(
    screen.x + shadowOffset,
    screen.y + shadowOffset * 0.5,
    size * 1.3,
    size * 0.6,
    0, 0, Math.PI * 2
  );
  ctx.fill();

  // Body (with age-based saturation)
  ctx.fillStyle = `hsl(${this.hue}, ${saturation}%, 50%)`;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, size, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight (with age-based saturation)
  ctx.fillStyle = `hsl(${this.hue}, ${saturation}%, 70%)`;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y - size * 0.25, size * 0.65, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Direction indicator (with age-based saturation)
  const dirX = Math.cos(this.angle) * size * 0.8;
  const dirY = Math.sin(this.angle) * size * 0.5;
  ctx.fillStyle = `hsl(${this.hue}, ${Math.round(saturation * 1.17)}%, 40%)`;
  ctx.beginPath();
  ctx.moveTo(screen.x + dirX, screen.y + dirY);
  ctx.lineTo(screen.x + dirX * 0.3 - dirY * 0.5, screen.y + dirY * 0.3 + dirX * 0.3);
  ctx.lineTo(screen.x + dirX * 0.3 + dirY * 0.5, screen.y + dirY * 0.3 - dirX * 0.3);
  ctx.closePath();
  ctx.fill();

  // Eyes
  const eyeAngle = this.angle;
  const eyeOffset = size * 0.25;
  const eyeDist = size * 0.4;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(
    screen.x + Math.cos(eyeAngle) * eyeDist - Math.sin(eyeAngle) * eyeOffset,
    screen.y + Math.sin(eyeAngle) * eyeDist * 0.5 - size * 0.15,
    2.5 * scale, 0, Math.PI * 2
  );
  ctx.arc(
    screen.x + Math.cos(eyeAngle) * eyeDist + Math.sin(eyeAngle) * eyeOffset,
    screen.y + Math.sin(eyeAngle) * eyeDist * 0.5 - size * 0.15,
    2.5 * scale, 0, Math.PI * 2
  );
  ctx.fill();

  // ===== LIFECYCLE VISUAL EFFECTS =====

  // Invincibility effect (pulsing golden outline)
  if (this.invincibilityFrames > 0) {
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(frameCount * 0.15));
    const effect = lifecycleSettings.respawnInvincibility.visualEffect;

    if (effect === 'pulse' || effect === 'glow') {
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 1.4, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glow
      if (effect === 'glow') {
        ctx.strokeStyle = `rgba(255, 255, 200, ${pulse * 0.5})`;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (effect === 'flash') {
      const flashOn = Math.floor(frameCount / 10) % 2 === 0;
      if (flashOn) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size * 1.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Pack membership indicator (colored ring)
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

  // Starvation indicator (red tint/pulse)
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
    const starY = livesY - 12 * scale;
    ctx.fillStyle = '#ffdd00';
    ctx.font = `${14 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('★', screen.x, starY);
  }

  // Player offspring indicator
  if (this.isPlayerOffspring && !this.isPlayer) {
    const starY = livesY - 12 * scale;
    let starColor;
    if (this.playerLineage === 1) {
      starColor = '#ffdd00'; // Gold for gen 1
    } else if (this.playerLineage === 2) {
      starColor = '#c0c0c0'; // Silver for gen 2
    } else {
      starColor = '#cd7f32'; // Bronze for gen 3+
    }
    ctx.strokeStyle = starColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.font = `${14 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.strokeText('☆', screen.x, starY);
  }

  // Generation indicator (small number near offspring star)
  if (this.generation > 0 && debugMode) {
    const genY = livesY - 20 * scale;
    ctx.fillStyle = '#888';
    ctx.font = `${8 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`G${this.generation}`, screen.x, genY);
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

    const bracketSize = size * 2;
    const bracketLen = size * 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(screen.x - bracketSize, screen.y - bracketSize + bracketLen);
    ctx.lineTo(screen.x - bracketSize, screen.y - bracketSize);
    ctx.lineTo(screen.x - bracketSize + bracketLen, screen.y - bracketSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screen.x + bracketSize - bracketLen, screen.y - bracketSize);
    ctx.lineTo(screen.x + bracketSize, screen.y - bracketSize);
    ctx.lineTo(screen.x + bracketSize, screen.y - bracketSize + bracketLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screen.x - bracketSize, screen.y + bracketSize - bracketLen);
    ctx.lineTo(screen.x - bracketSize, screen.y + bracketSize);
    ctx.lineTo(screen.x - bracketSize + bracketLen, screen.y + bracketSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screen.x + bracketSize - bracketLen, screen.y + bracketSize);
    ctx.lineTo(screen.x + bracketSize, screen.y + bracketSize);
    ctx.lineTo(screen.x + bracketSize, screen.y + bracketSize - bracketLen);
    ctx.stroke();
  }
};
