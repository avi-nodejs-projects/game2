// Shared Game Engine for 3D Map Concepts
// Extracted from v11 — pure game logic, no rendering dependencies

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const BOT_COUNT = 20;
const DOT_COUNT = 50;
const STARTING_STATS = { speed: 5, attack: 5, defence: 5, lives: 3 };
const TOTAL_POINTS = 18;

class YellowDot {
  constructor() {
    this.size = 6;
    this.respawn();
  }
  respawn() {
    const m = 50;
    this.x = m + Math.random() * (WORLD_WIDTH - m * 2);
    this.y = m + Math.random() * (WORLD_HEIGHT - m * 2);
  }
}

class Bot {
  constructor(index, isPlayer = false) {
    this.index = index;
    this.isPlayer = isPlayer;
    this.size = 10 + Math.random() * 6;
    this.hue = isPlayer ? 200 : Math.random() * 360;
    this.color = `hsl(${this.hue}, 70%, 50%)`;
    this.colorHex = this._hslToHex(this.hue, 70, 50);
    this.killCount = 0;
    this.combatCooldown = 0;
    this.idleTime = 0;
    this.maxIdle = 60 + Math.random() * 120;
    this.angle = 0;
    this.lifetime = 0;
    this.justTookDamage = false;
    this.justDealtDamage = false;
    this.damageTimer = 0;
    this.damageDealtTimer = 0;
    this.lastAttacker = null;

    this.speed = isPlayer ? STARTING_STATS.speed : STARTING_STATS.speed;
    this.attack = isPlayer ? STARTING_STATS.attack : STARTING_STATS.attack;
    this.defence = isPlayer ? STARTING_STATS.defence : STARTING_STATS.defence;
    this.lives = isPlayer ? STARTING_STATS.lives : STARTING_STATS.lives;
    this.initialLives = this.lives;

    this.spawnAtRandom();
  }

  _hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
    return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
  }

  get totalStats() { return this.speed + this.attack + this.defence + this.lives; }

  spawnAtRandom() {
    const m = 100;
    this.x = m + Math.random() * (WORLD_WIDTH - m * 2);
    this.y = m + Math.random() * (WORLD_HEIGHT - m * 2);
    this.targetX = m + Math.random() * (WORLD_WIDTH - m * 2);
    this.targetY = m + Math.random() * (WORLD_HEIGHT - m * 2);
    this.idleTime = 0;
    this.maxIdle = 60 + Math.random() * 120;
    this.combatCooldown = 0;
  }

  resetStats() {
    this.speed = STARTING_STATS.speed;
    this.attack = STARTING_STATS.attack;
    this.defence = STARTING_STATS.defence;
    this.lives = STARTING_STATS.lives;
    this.initialLives = this.lives;
  }

  addRandomStat() {
    const stats = ['speed', 'attack', 'defence', 'lives'];
    const stat = stats[Math.floor(Math.random() * stats.length)];
    this[stat]++;
    if (stat === 'lives') this.initialLives++;
  }

  addPartialRandomStat() {
    const stats = ['speed', 'attack', 'defence', 'lives'];
    const stat = stats[Math.floor(Math.random() * stats.length)];
    this[stat] += 0.1;
    if (stat === 'lives') this.initialLives += 0.1;
  }

  distanceTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  findNearestDot(dots) {
    let nearest = null, minDist = Infinity;
    for (const dot of dots) {
      const d = this.distanceTo(dot);
      if (d < minDist) { minDist = d; nearest = dot; }
    }
    return { dot: nearest, dist: minDist };
  }

  findNearestBot(bots) {
    let nearest = null, minDist = Infinity;
    for (const bot of bots) {
      if (bot === this) continue;
      const d = this.distanceTo(bot);
      if (d < minDist) { minDist = d; nearest = bot; }
    }
    return { bot: nearest, dist: minDist };
  }

  pickNewTarget(bots, dots) {
    const dotChance = 1 - (this.lives / (this.lives + 3));
    if (Math.random() < dotChance) {
      const { dot } = this.findNearestDot(dots);
      if (dot) { this.targetX = dot.x; this.targetY = dot.y; this.maxIdle = 30 + Math.random() * 60; this.idleTime = 0; return; }
    } else {
      const { bot } = this.findNearestBot(bots);
      if (bot) { this.targetX = bot.x; this.targetY = bot.y; this.maxIdle = 30 + Math.random() * 60; this.idleTime = 0; return; }
    }
    const m = 100;
    this.targetX = m + Math.random() * (WORLD_WIDTH - m * 2);
    this.targetY = m + Math.random() * (WORLD_HEIGHT - m * 2);
    this.maxIdle = 60 + Math.random() * 180;
    this.idleTime = 0;
  }

  update(bots, dots) {
    this.lifetime++;
    if (this.combatCooldown > 0) this.combatCooldown--;
    if (this.damageTimer > 0) { this.damageTimer--; if (this.damageTimer === 0) { this.justTookDamage = false; this.lastAttacker = null; } }
    if (this.damageDealtTimer > 0) { this.damageDealtTimer--; if (this.damageDealtTimer === 0) this.justDealtDamage = false; }

    // Re-evaluate target periodically
    if (this.combatCooldown === 0 && this.lifetime % 30 === 0) {
      this.pickNewTarget(bots, dots);
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.idleTime++;
      if (this.idleTime > this.maxIdle) this.pickNewTarget(bots, dots);
    } else {
      const moveSpeed = 0.5 + this.speed * 0.2;
      this.x += (dx / dist) * moveSpeed;
      this.y += (dy / dist) * moveSpeed;
      this.angle = Math.atan2(dy, dx);
    }

    this.x = Math.max(20, Math.min(WORLD_WIDTH - 20, this.x));
    this.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, this.y));
  }
}

class GameEngine {
  constructor(options = {}) {
    this.botCount = options.botCount || BOT_COUNT;
    this.dotCount = options.dotCount || DOT_COUNT;
    this.bots = [];
    this.dots = [];
    this.frameCount = 0;
    this.paused = false;
    this.events = []; // buffered events for renderers to consume
    this.playerBot = null;
    this.followedBot = null;
    this.followIndex = 0;
  }

  init() {
    this.dots = [];
    for (let i = 0; i < this.dotCount; i++) this.dots.push(new YellowDot());

    this.bots = [];
    for (let i = 0; i < this.botCount; i++) {
      const bot = new Bot(i, i === 0);
      this.bots.push(bot);
    }
    this.playerBot = this.bots[0];
    this.followedBot = this.playerBot;
    this.followIndex = 0;
    this.frameCount = 0;
  }

  cycleFollowedBot() {
    this.followIndex = (this.followIndex + 1) % this.bots.length;
    this.followedBot = this.bots[this.followIndex];
  }

  update() {
    if (this.paused) return;
    this.events = [];
    this.frameCount++;

    for (const bot of this.bots) bot.update(this.bots, this.dots);
    this._processCollisions();
  }

  _processCollisions() {
    // Bot-Dot
    for (const bot of this.bots) {
      for (const dot of this.dots) {
        const dx = bot.x - dot.x, dy = bot.y - dot.y;
        if (Math.sqrt(dx * dx + dy * dy) < bot.size + dot.size) {
          bot.addPartialRandomStat();
          const oldPos = { x: dot.x, y: dot.y };
          dot.respawn();
          this.events.push({ type: 'eat', bot, dotPos: oldPos });
        }
      }
    }

    // Bot-Bot
    for (let i = 0; i < this.bots.length; i++) {
      for (let j = i + 1; j < this.bots.length; j++) {
        const b1 = this.bots[i], b2 = this.bots[j];
        const dx = b1.x - b2.x, dy = b1.y - b2.y;
        if (Math.sqrt(dx * dx + dy * dy) < b1.size + b2.size) {
          this._handleCombat(b1, b2);
        }
      }
    }
  }

  _handleCombat(bot1, bot2) {
    if (bot1.combatCooldown > 0 || bot2.combatCooldown > 0) return;

    let damage1 = bot2.attack - bot1.defence;
    let damage2 = bot1.attack - bot2.defence;

    // Stalemate: both defences >= opponent attack — use division formula
    if (damage1 <= 0 && damage2 <= 0) {
      damage1 = bot2.attack / Math.max(bot1.defence, 0.1);
      damage2 = bot1.attack / Math.max(bot2.defence, 0.1);
    } else {
      damage1 = Math.max(0, damage1);
      damage2 = Math.max(0, damage2);
    }

    bot1.lives -= damage1;
    bot2.lives -= damage2;

    if (damage1 > 0) { bot1.justTookDamage = true; bot1.damageTimer = 120; bot1.lastAttacker = bot2; }
    if (damage2 > 0) { bot2.justTookDamage = true; bot2.damageTimer = 120; bot2.lastAttacker = bot1; }
    if (damage2 > 0) { bot1.justDealtDamage = true; bot1.damageDealtTimer = 120; }
    if (damage1 > 0) { bot2.justDealtDamage = true; bot2.damageDealtTimer = 120; }

    bot1.combatCooldown = 60;
    bot2.combatCooldown = 60;

    this.events.push({ type: 'combat', bot1, bot2, damage1, damage2 });

    const b1Dead = bot1.lives <= 0;
    const b2Dead = bot2.lives <= 0;

    if (b1Dead && b2Dead) {
      this._handleDeath(bot1, null);
      this._handleDeath(bot2, null);
    } else if (b1Dead) {
      bot2.killCount++;
      this._handleDeath(bot1, bot2);
      bot2.addRandomStat();
    } else if (b2Dead) {
      bot1.killCount++;
      this._handleDeath(bot2, bot1);
      bot1.addRandomStat();
    }
  }

  _handleDeath(bot, killer) {
    this.events.push({ type: 'death', bot, killer, x: bot.x, y: bot.y });
    bot.resetStats();
    bot.spawnAtRandom();
    this.events.push({ type: 'spawn', bot });
  }
}
