// Bots Strategy v11.3 - Particle Pool System

// ============ PARTICLE TYPE PRESETS ============

const PARTICLE_TYPES = {
  SPARK: {
    color: null,         // randomized: white or yellow
    size: 2,
    life: 15,
    speed: 3,
    decay: 0.92,
    gravity: 0,
    fadeRate: 1.0,
    spread: Math.PI * 2
  },
  SHATTER: {
    color: null,         // bot-colored, passed via overrides
    size: 3,
    life: 30,
    speed: 2,
    decay: 0.95,
    gravity: 0.1,
    fadeRate: 0.8,
    spread: Math.PI * 2
  },
  ABSORB: {
    color: 'rgba(255, 215, 0, 1)',   // gold
    size: 2.5,
    life: 30,
    speed: 1.5,
    decay: 0.97,
    gravity: -0.05,
    fadeRate: 0.6,
    spread: Math.PI * 0.5
  },
  DUST: {
    color: null,         // randomized: earth tones
    size: 1.5,
    life: 60,
    speed: 0.3,
    decay: 0.99,
    gravity: -0.02,      // drifts upward (negative = up)
    fadeRate: 0.4,
    spread: Math.PI * 2
  },
  FIREFLY: {
    color: 'rgba(200, 255, 100, 1)', // soft green-yellow
    size: 2,
    life: 90,
    speed: 0.4,
    decay: 1.0,          // no velocity decay — random walk drives motion
    gravity: 0,
    fadeRate: 0,          // opacity handled by oscillation
    spread: Math.PI * 2
  }
};

// ============ HELPER FUNCTIONS ============

function randomSparkColor() {
  // White or yellow with slight variation
  const r = 220 + Math.random() * 35;
  const g = 200 + Math.random() * 55;
  const b = Math.random() < 0.5 ? 150 + Math.random() * 105 : 50 + Math.random() * 80;
  return `rgb(${r|0}, ${g|0}, ${b|0})`;
}

function randomDustColor() {
  // Earth tones: tan, brown, khaki
  const palette = [
    [194, 178, 128],  // sand
    [160, 132, 100],  // light brown
    [139, 119, 101],  // medium brown
    [210, 180, 140],  // tan
    [189, 183, 147],  // khaki
    [170, 150, 120]   // dusty brown
  ];
  const c = palette[(Math.random() * palette.length) | 0];
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// ============ PARTICLE POOL ============

const particlePool = {
  particles: [],
  activeCount: 0,

  /**
   * Pre-allocates the particle array.
   * @param {number} poolSize - Number of particles to pre-allocate (default 300)
   */
  init(poolSize = 300) {
    this.particles = [];
    this.activeCount = 0;
    for (let i = 0; i < poolSize; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0,
        size: 1,
        color: 'white',
        decay: 1,
        gravity: 0,
        fadeRate: 1,
        opacity: 1
      });
    }
  },

  /**
   * Finds the next inactive particle in the pool.
   * @returns {object|null} An inactive particle, or null if pool is exhausted.
   */
  _acquire() {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) {
        return this.particles[i];
      }
    }
    return null;
  },

  /**
   * Applies a type preset and overrides to a particle, then activates it.
   * @param {object} p - The particle object to configure.
   * @param {number} worldX - World x position.
   * @param {number} worldY - World y position.
   * @param {string} typeName - Key into PARTICLE_TYPES.
   * @param {object} [overrides] - Optional property overrides.
   * @returns {object} The configured particle.
   */
  _configure(p, worldX, worldY, typeName, overrides) {
    const preset = PARTICLE_TYPES[typeName] || PARTICLE_TYPES.SPARK;

    // Determine color
    let color;
    if (overrides && overrides.color) {
      color = overrides.color;
    } else if (preset.color) {
      color = preset.color;
    } else if (typeName === 'SPARK') {
      color = randomSparkColor();
    } else if (typeName === 'DUST') {
      color = randomDustColor();
    } else {
      color = 'white';
    }

    const speed = (overrides && overrides.speed !== undefined) ? overrides.speed : preset.speed;
    const spread = (overrides && overrides.spread !== undefined) ? overrides.spread : preset.spread;

    // Random emission angle
    const angle = Math.random() * spread - spread / 2;

    p.active = true;
    p.x = worldX;
    p.y = worldY;
    p.vx = Math.cos(angle) * speed * (0.5 + Math.random() * 0.5);
    p.vy = Math.sin(angle) * speed * (0.5 + Math.random() * 0.5);
    p.life = (overrides && overrides.life !== undefined) ? overrides.life : preset.life;
    p.maxLife = p.life;
    p.size = (overrides && overrides.size !== undefined) ? overrides.size : preset.size;
    p.color = color;
    p.decay = (overrides && overrides.decay !== undefined) ? overrides.decay : preset.decay;
    p.gravity = (overrides && overrides.gravity !== undefined) ? overrides.gravity : preset.gravity;
    p.fadeRate = (overrides && overrides.fadeRate !== undefined) ? overrides.fadeRate : preset.fadeRate;
    p.opacity = 1.0;

    // Apply any extra overrides (e.g., vx, vy for directed particles)
    if (overrides) {
      if (overrides.vx !== undefined) p.vx = overrides.vx;
      if (overrides.vy !== undefined) p.vy = overrides.vy;
      if (overrides.opacity !== undefined) p.opacity = overrides.opacity;
    }

    return p;
  },

  /**
   * Emits particles at a world position.
   * @param {number} worldX - Emission x in world coordinates.
   * @param {number} worldY - Emission y in world coordinates.
   * @param {number} count - Number of particles to emit.
   * @param {string} typeName - Particle type preset name.
   * @param {object} [overrides] - Optional property overrides applied per particle.
   */
  emit(worldX, worldY, count, typeName, overrides) {
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      if (!p) return; // pool exhausted
      this._configure(p, worldX, worldY, typeName, overrides);
    }
  },

  /**
   * Emits particles directed toward a target position.
   * For ABSORB type, velocity is biased toward the target with some angular spread.
   * For other types, velocity is fully directed toward the target.
   * @param {number} worldX - Emission x in world coordinates.
   * @param {number} worldY - Emission y in world coordinates.
   * @param {number} targetX - Target x in world coordinates.
   * @param {number} targetY - Target y in world coordinates.
   * @param {number} count - Number of particles to emit.
   * @param {string} typeName - Particle type preset name.
   */
  emitToward(worldX, worldY, targetX, targetY, count, typeName) {
    const dx = targetX - worldX;
    const dy = targetY - worldY;
    const baseAngle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    const preset = PARTICLE_TYPES[typeName] || PARTICLE_TYPES.SPARK;
    const spread = preset.spread;

    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      if (!p) return; // pool exhausted

      // Spread angle around direction to target
      const angleOffset = (Math.random() - 0.5) * spread;
      const angle = baseAngle + angleOffset;

      const speed = preset.speed * (0.5 + Math.random() * 0.5);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this._configure(p, worldX, worldY, typeName, {
        vx: vx,
        vy: vy
      });
    }
  },

  /**
   * Updates all active particles.
   * Applies velocity, velocity decay, gravity, life countdown, and opacity fade.
   * FIREFLY particles use oscillating opacity and random walk.
   */
  update() {
    this.activeCount = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      // Countdown life
      p.life--;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      this.activeCount++;

      // Apply gravity (negative = upward)
      p.vy += p.gravity;

      // Apply velocity
      p.x += p.vx;
      p.y += p.vy;

      // Decay velocity (friction)
      p.vx *= p.decay;
      p.vy *= p.decay;

      // Opacity handling
      if (p.fadeRate > 0) {
        // Standard fade: opacity decreases as life depletes
        const lifeRatio = p.life / p.maxLife;
        p.opacity = Math.pow(lifeRatio, p.fadeRate);
      }

      // FIREFLY special behavior: oscillating opacity and random walk
      // Detect FIREFLY by checking for zero fadeRate and long life
      if (p.fadeRate === 0 && p.maxLife >= 90) {
        p.opacity = 0.5 + 0.5 * Math.sin(p.life * 0.2);

        // Random walk: nudge velocity each frame
        p.vx += (Math.random() - 0.5) * 0.15;
        p.vy += (Math.random() - 0.5) * 0.15;

        // Clamp random walk speed
        const walkSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (walkSpeed > 0.8) {
          p.vx = (p.vx / walkSpeed) * 0.8;
          p.vy = (p.vy / walkSpeed) * 0.8;
        }
      }
    }
  },

  /**
   * Draws all active particles to the canvas.
   * Uses world-to-screen conversion and scale for correct rendering in camera space.
   * @param {CanvasRenderingContext2D} ctx - The canvas 2D context.
   * @param {function} worldToScreenFn - Converts (worldX, worldY) to {x, y} screen coords.
   * @param {function} getScaleFn - Returns the current camera scale factor.
   */
  draw(ctx, worldToScreenFn, getScaleFn) {
    const scale = getScaleFn();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      const screen = worldToScreenFn(p.x, p.y);
      const drawSize = p.size * scale;

      // Skip particles that are too small or fully transparent
      if (drawSize < 0.3 || p.opacity <= 0) continue;

      ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));
      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, drawSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Restore alpha
    ctx.globalAlpha = 1.0;
  }
};
