// Bots Strategy v11.1 - Bot Rendering (Petri Dish Aesthetic)
// Extends Bot class via prototype — renders bots as biological organisms

Bot.prototype.draw = function(isFollowed = false) {
  if (!isVisible(this.x, this.y, 200)) return;

  const screen = worldToScreen(this.x, this.y);
  const scale = getScale(this.y);
  const size = this.size * scale;
  const totalStats = this.speed + this.attack + this.defence + this.lives;
  const glowRadius = size * (2 + Math.min(totalStats / 30, 2));
  const hue = this.hue;
  const noiseAmp = (typeof PETRI_CONFIG !== 'undefined' ? PETRI_CONFIG.membraneNoiseAmp : 3);

  // Age factor for visual decay
  let ageFactor = 1.0;
  if (lifecycleSettings.age.enabled && typeof getAgeVisualFactor === 'function') {
    ageFactor = getAgeVisualFactor(this);
  }

  // ===== LAYER 1: OUTER GLOW =====
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glowOpacity = 0.15 * (this.isPlayer ? 1.5 : 1.0);
  const glowGrad = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, glowRadius);
  glowGrad.addColorStop(0, `hsla(${hue}, 80%, 60%, ${glowOpacity})`);
  glowGrad.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ===== LAYER 2: MEMBRANE =====
  const membraneRadius = size * 1.2;
  let membraneOpacity = 0.6;

  // Starving flicker
  if (this.isStarving && lifecycleSettings.starvation.enabled) {
    membraneOpacity *= 0.3 + 0.7 * Math.abs(Math.sin(frameCount * 0.1));
  }

  ctx.lineWidth = 2 * scale;

  if (this.invincibilityFrames > 0) {
    // Invincibility: gold membrane
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(frameCount * 0.15));
    ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
  } else {
    ctx.strokeStyle = `hsla(${hue}, 60%, 50%, ${membraneOpacity})`;
  }

  ctx.beginPath();
  if (ageFactor < 1.0) {
    // Aging: draw noisy polygon membrane
    const vertices = 12;
    for (let i = 0; i <= vertices; i++) {
      const theta = (i / vertices) * Math.PI * 2;
      const noise = Math.sin(i * 7 + frameCount * 0.02) * noiseAmp * (1 - ageFactor);
      const r = membraneRadius + noise;
      const vx = screen.x + Math.cos(theta) * r;
      const vy = screen.y + Math.sin(theta) * r;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
  } else {
    ctx.arc(screen.x, screen.y, membraneRadius, 0, Math.PI * 2);
  }
  ctx.stroke();

  // ===== LAYER 3: CYTOPLASM (body fill) =====
  const cytoGrad = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, size);
  cytoGrad.addColorStop(0, `hsla(${hue}, 70%, 65%, 0.8)`);
  cytoGrad.addColorStop(1, `hsla(${hue}, 60%, 35%, 0.6)`);
  ctx.fillStyle = cytoGrad;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
  ctx.fill();

  // ===== LAYER 4: NUCLEUS =====
  const nx = screen.x + Math.cos(this.angle) * size * 0.2;
  const ny = screen.y + Math.sin(this.angle) * size * 0.2;
  ctx.fillStyle = `hsla(${hue}, 80%, 75%, 0.9)`;
  ctx.beginPath();
  ctx.arc(nx, ny, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // ===== LAYER 5: STAT ORGANELLES =====
  if (size > 8) {
    const organelles = [
      { ox: 0,           oy: -size * 0.5,  color: '#4dd0e1', stat: this.speed },
      { ox: size * 0.5,  oy: 0,            color: '#ef5350', stat: this.attack },
      { ox: 0,           oy: size * 0.5,   color: '#5c6bc0', stat: this.defence },
      { ox: -size * 0.5, oy: 0,            color: '#66bb6a', stat: this.lives }
    ];
    const dotRadius = 1.5 * scale;
    for (const org of organelles) {
      const alpha = Math.min(org.stat / 15, 1.0) * 0.7;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = org.color;
      ctx.beginPath();
      ctx.arc(screen.x + org.ox, screen.y + org.oy, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  // ===== LAYER 6: PSEUDOPOD (direction indicator) =====
  const tipDist = size * 1.8;
  const baseWidth = size * 0.3;
  const tipX = screen.x + Math.cos(this.angle) * tipDist;
  const tipY = screen.y + Math.sin(this.angle) * tipDist;
  const perpX = -Math.sin(this.angle);
  const perpY = Math.cos(this.angle);
  const baseX = screen.x + Math.cos(this.angle) * membraneRadius;
  const baseY = screen.y + Math.sin(this.angle) * membraneRadius;
  const midX = (baseX + tipX) / 2;
  const midY = (baseY + tipY) / 2;

  const pseudoOpacity = this.invincibilityFrames > 0 ? 0.5 : (membraneOpacity + 0.1);
  ctx.fillStyle = `hsla(${hue}, 60%, 50%, ${Math.min(pseudoOpacity, 1.0)})`;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo(midX + perpX * baseWidth, midY + perpY * baseWidth, baseX + perpX * baseWidth, baseY + perpY * baseWidth);
  ctx.lineTo(baseX - perpX * baseWidth, baseY - perpY * baseWidth);
  ctx.quadraticCurveTo(midX - perpX * baseWidth, midY - perpY * baseWidth, tipX, tipY);
  ctx.fill();

  // ===== LAYER 7: LIFECYCLE INDICATORS =====

  // Pack ring
  if (this.relationships && this.relationships.packId !== null && lifecycleSettings.packs.enabled) {
    const pack = packs.get(this.relationships.packId);
    if (pack) {
      ctx.strokeStyle = `hsla(${pack.hue}, 70%, 50%, 0.4)`;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Lives indicator (glowing dots)
  const livesY = screen.y - size - 10 * scale;
  const displayLives = Math.floor(this.lives);
  const lifeCount = Math.min(displayLives, 10);
  for (let i = 0; i < lifeCount; i++) {
    const lx = screen.x - (lifeCount - 1) * 3 * scale + i * 6 * scale;
    const ly = livesY;
    const lifeGlowR = 4 * scale;
    // Glow
    const lifeGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, lifeGlowR);
    lifeGlow.addColorStop(0, 'rgba(102, 255, 102, 0.8)');
    lifeGlow.addColorStop(1, 'rgba(102, 255, 102, 0)');
    ctx.fillStyle = lifeGlow;
    ctx.beginPath();
    ctx.arc(lx, ly, lifeGlowR, 0, Math.PI * 2);
    ctx.fill();
    // Core
    ctx.fillStyle = '#66ff66';
    ctx.beginPath();
    ctx.arc(lx, ly, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player indicator (glowing star)
  if (this.isPlayer) {
    const starY = livesY - 12 * scale;
    ctx.font = `${14 * scale}px Arial`;
    ctx.textAlign = 'center';
    // Glow pass
    ctx.save();
    ctx.shadowColor = '#ffdd00';
    ctx.shadowBlur = 8 * scale;
    ctx.fillStyle = 'rgba(255, 221, 0, 0.5)';
    ctx.fillText('★', screen.x, starY);
    ctx.restore();
    // Crisp pass
    ctx.fillStyle = '#ffdd00';
    ctx.fillText('★', screen.x, starY);
  }

  // Player offspring indicator
  if (this.isPlayerOffspring && !this.isPlayer) {
    const starY = livesY - 12 * scale;
    let starColor;
    if (this.playerLineage === 1) {
      starColor = '#ffdd00';
    } else if (this.playerLineage === 2) {
      starColor = '#c0c0c0';
    } else {
      starColor = '#cd7f32';
    }
    ctx.font = `${14 * scale}px Arial`;
    ctx.textAlign = 'center';
    // Glow pass
    ctx.save();
    ctx.shadowColor = starColor;
    ctx.shadowBlur = 6 * scale;
    ctx.strokeStyle = starColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeText('☆', screen.x, starY);
    ctx.restore();
    // Crisp pass
    ctx.strokeStyle = starColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeText('☆', screen.x, starY);
  }

  // Generation debug text
  if (this.generation > 0 && debugMode) {
    const genY = livesY - 20 * scale;
    ctx.fillStyle = '#888';
    ctx.font = `${8 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`G${this.generation}`, screen.x, genY);
  }

  // Followed marker (pulsing dashed ring)
  if (isFollowed) {
    const followOpacity = 0.2 + 0.3 * Math.sin(frameCount * 0.05);
    ctx.strokeStyle = `rgba(255, 255, 255, ${followOpacity})`;
    ctx.lineWidth = 2 * scale;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};
