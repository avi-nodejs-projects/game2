// Bots Strategy v10 - Billboard System
// Temporary advertisement billboards that appear near dot clusters
// Configuration is in config.js as billboardSettings

// ============ BRAND LOGOS ============
// Famous brand-style logos (stylized representations)
const BRAND_LOGOS = [
  {
    name: 'BotCola',
    bgColor: '#d32f2f',
    textColor: '#ffffff',
    text: 'BotCola',
    font: 'bold 16px Georgia',
    style: 'wave'
  },
  {
    name: 'iDot',
    bgColor: '#f5f5f5',
    textColor: '#555555',
    text: 'iDot',
    font: 'bold 20px Arial',
    style: 'apple',
    accent: '#a0a0a0'
  },
  {
    name: 'McBots',
    bgColor: '#ffeb3b',
    textColor: '#d32f2f',
    text: 'M',
    font: 'bold 36px Arial',
    style: 'arches'
  },
  {
    name: 'BotBucks',
    bgColor: '#00704A',
    textColor: '#ffffff',
    text: 'BOTBUCKS',
    font: 'bold 12px Arial',
    style: 'circle'
  },
  {
    name: 'Amazbot',
    bgColor: '#232f3e',
    textColor: '#ff9900',
    text: 'amazbot',
    font: 'bold 18px Arial',
    style: 'arrow'
  },
  {
    name: 'BotFlix',
    bgColor: '#000000',
    textColor: '#e50914',
    text: 'BOTFLIX',
    font: 'bold 18px Arial',
    style: 'netflix'
  },
  {
    name: 'Googbot',
    bgColor: '#ffffff',
    textColor: '#4285f4',
    text: 'Googbot',
    font: 'bold 16px Arial',
    style: 'google',
    colors: ['#4285f4', '#ea4335', '#fbbc05', '#34a853', '#4285f4', '#ea4335', '#34a853']
  },
  {
    name: 'NikBot',
    bgColor: '#f5f5f5',
    textColor: '#000000',
    text: 'Just Bot It.',
    font: 'bold 11px Arial',
    style: 'swoosh'
  },
  {
    name: 'BotKing',
    bgColor: '#ec7c26',
    textColor: '#f5ebdc',
    text: 'BOT KING',
    font: 'bold 12px Arial',
    style: 'burger'
  },
  {
    name: 'RedBot',
    bgColor: '#e2001a',
    textColor: '#ffffff',
    text: 'RedBot',
    font: 'italic bold 18px Arial',
    style: 'energydrink'
  }
];

// ============ BILLBOARD STATE ============
let billboards = [];

// ============ BILLBOARD CLASS ============
class Billboard {
  constructor(x, y, brand) {
    this.x = x;
    this.y = y;
    this.brand = brand;
    this.width = billboardSettings.boardWidth;
    this.height = billboardSettings.boardHeight;
    this.poleHeight = billboardSettings.poleHeight;
    this.duration = billboardSettings.minDuration +
      Math.random() * (billboardSettings.maxDuration - billboardSettings.minDuration);
    this.age = 0;
    this.fadeIn = 30;  // Frames to fade in
    this.fadeOut = 30; // Frames to fade out
  }

  update() {
    this.age++;
    return this.age < this.duration;
  }

  getOpacity() {
    if (this.age < this.fadeIn) {
      return this.age / this.fadeIn;
    } else if (this.age > this.duration - this.fadeOut) {
      return (this.duration - this.age) / this.fadeOut;
    }
    return 1;
  }

  draw(ctx, worldToScreen, getScale, isVisible) {
    if (!isVisible(this.x, this.y, 200)) return;

    const screen = worldToScreen(this.x, this.y);
    const scale = getScale(this.y);
    const opacity = this.getOpacity();

    const w = this.width * scale;
    const h = this.height * scale;
    const poleH = this.poleHeight * scale;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Draw pole
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(screen.x - 3 * scale, screen.y - poleH, 6 * scale, poleH);

    // Draw board shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(screen.x - w/2 + 4*scale, screen.y - poleH - h + 4*scale, w, h);

    // Draw board background
    ctx.fillStyle = this.brand.bgColor;
    ctx.fillRect(screen.x - w/2, screen.y - poleH - h, w, h);

    // Draw board border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(screen.x - w/2, screen.y - poleH - h, w, h);

    // Draw brand logo based on style
    this.drawBrand(ctx, screen.x, screen.y - poleH - h/2, w, h, scale);

    // Add shine effect
    const gradient = ctx.createLinearGradient(
      screen.x - w/2, screen.y - poleH - h,
      screen.x - w/2, screen.y - poleH
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(screen.x - w/2, screen.y - poleH - h, w, h);

    ctx.restore();
  }

  drawBrand(ctx, cx, cy, w, h, scale) {
    const brand = this.brand;
    ctx.fillStyle = brand.textColor;
    ctx.font = brand.font.replace(/(\d+)px/, (_, size) => `${parseInt(size) * scale}px`);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (brand.style) {
      case 'wave':
        // Coca-Cola style wavy text
        ctx.save();
        ctx.fillStyle = brand.textColor;
        ctx.font = brand.font.replace(/(\d+)px/, (_, size) => `${parseInt(size) * scale}px`);
        ctx.fillText(brand.text, cx, cy);
        ctx.restore();
        break;

      case 'apple':
        // Apple style with bitten apple icon
        ctx.fillStyle = brand.accent;
        ctx.beginPath();
        ctx.arc(cx - 25*scale, cy, 8*scale, 0, Math.PI * 2);
        ctx.fill();
        // Bite mark
        ctx.fillStyle = brand.bgColor;
        ctx.beginPath();
        ctx.arc(cx - 17*scale, cy - 2*scale, 4*scale, 0, Math.PI * 2);
        ctx.fill();
        // Text
        ctx.fillStyle = brand.textColor;
        ctx.fillText(brand.text, cx + 5*scale, cy);
        break;

      case 'arches':
        // McDonald's style golden arches
        ctx.fillStyle = brand.textColor;
        ctx.font = brand.font.replace(/(\d+)px/, (_, size) => `${parseInt(size) * scale}px`);
        ctx.fillText(brand.text, cx, cy);
        break;

      case 'circle':
        // Starbucks style circular logo
        ctx.beginPath();
        ctx.arc(cx - 20*scale, cy, 18*scale, 0, Math.PI * 2);
        ctx.strokeStyle = brand.textColor;
        ctx.lineWidth = 2*scale;
        ctx.stroke();
        ctx.font = brand.font.replace(/(\d+)px/, (_, size) => `${parseInt(size) * 0.6 * scale}px`);
        ctx.fillText('*', cx - 20*scale, cy);
        ctx.font = brand.font.replace(/(\d+)px/, (_, size) => `${parseInt(size) * scale}px`);
        ctx.fillText(brand.text, cx + 15*scale, cy);
        break;

      case 'arrow':
        // Amazon style with smile arrow
        ctx.fillText(brand.text, cx, cy - 3*scale);
        // Draw smile arrow
        ctx.beginPath();
        ctx.moveTo(cx - 20*scale, cy + 8*scale);
        ctx.quadraticCurveTo(cx, cy + 14*scale, cx + 25*scale, cy + 5*scale);
        ctx.strokeStyle = brand.textColor;
        ctx.lineWidth = 2*scale;
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(cx + 20*scale, cy + 2*scale);
        ctx.lineTo(cx + 27*scale, cy + 5*scale);
        ctx.lineTo(cx + 22*scale, cy + 10*scale);
        ctx.fillStyle = brand.textColor;
        ctx.fill();
        break;

      case 'netflix':
        // Netflix style
        ctx.fillText(brand.text, cx, cy);
        break;

      case 'google':
        // Google style multicolor
        const text = brand.text;
        const colors = brand.colors;
        let offset = -ctx.measureText(text).width / 2;
        for (let i = 0; i < text.length; i++) {
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillText(text[i], cx + offset + ctx.measureText(text[i]).width/2, cy);
          offset += ctx.measureText(text[i]).width;
        }
        break;

      case 'swoosh':
        // Nike style swoosh
        ctx.beginPath();
        ctx.moveTo(cx - 25*scale, cy + 5*scale);
        ctx.quadraticCurveTo(cx - 10*scale, cy + 15*scale, cx + 25*scale, cy - 8*scale);
        ctx.quadraticCurveTo(cx + 5*scale, cy + 5*scale, cx - 25*scale, cy + 5*scale);
        ctx.fillStyle = brand.textColor;
        ctx.fill();
        ctx.fillText(brand.text, cx, cy + 18*scale);
        break;

      case 'burger':
        // Burger King style with buns
        // Top bun
        ctx.fillStyle = '#f5ebdc';
        ctx.beginPath();
        ctx.ellipse(cx - 30*scale, cy - 5*scale, 15*scale, 8*scale, 0, Math.PI, 0);
        ctx.fill();
        // Bottom bun
        ctx.beginPath();
        ctx.ellipse(cx - 30*scale, cy + 5*scale, 15*scale, 8*scale, 0, 0, Math.PI);
        ctx.fill();
        // Text
        ctx.fillStyle = brand.textColor;
        ctx.fillText(brand.text, cx + 10*scale, cy);
        break;

      case 'energydrink':
        // Red Bull style
        ctx.fillText(brand.text, cx, cy - 5*scale);
        // Draw small wings
        ctx.font = `${10*scale}px Arial`;
        ctx.fillText('gives you WINGS', cx, cy + 12*scale);
        break;

      default:
        ctx.fillText(brand.text, cx, cy);
    }
  }
}

// ============ BILLBOARD MANAGEMENT ============
function findDotClustersForBillboards() {
  const clusterRadius = 150;
  const clusters = [];
  const used = new Set();

  for (let i = 0; i < yellowDots.length; i++) {
    if (used.has(i)) continue;

    const cluster = {
      dots: [yellowDots[i]],
      centerX: yellowDots[i].x,
      centerY: yellowDots[i].y
    };
    used.add(i);

    for (let j = i + 1; j < yellowDots.length; j++) {
      if (used.has(j)) continue;
      const dx = yellowDots[j].x - cluster.centerX;
      const dy = yellowDots[j].y - cluster.centerY;
      if (Math.sqrt(dx * dx + dy * dy) < clusterRadius) {
        cluster.dots.push(yellowDots[j]);
        used.add(j);
      }
    }

    cluster.centerX = cluster.dots.reduce((sum, d) => sum + d.x, 0) / cluster.dots.length;
    cluster.centerY = cluster.dots.reduce((sum, d) => sum + d.y, 0) / cluster.dots.length;

    if (cluster.dots.length >= billboardSettings.minClusterSize) {
      clusters.push(cluster);
    }
  }

  return clusters.sort((a, b) => b.dots.length - a.dots.length);
}

function spawnBillboard() {
  if (billboards.length >= billboardSettings.maxBillboards) return;

  const clusters = findDotClustersForBillboards();
  if (clusters.length === 0) return;

  // Pick a random cluster, weighted toward larger ones
  const totalSize = clusters.reduce((sum, c) => sum + c.dots.length, 0);
  let rand = Math.random() * totalSize;
  let selectedCluster = clusters[0];

  for (const cluster of clusters) {
    rand -= cluster.dots.length;
    if (rand <= 0) {
      selectedCluster = cluster;
      break;
    }
  }

  // Position billboard slightly offset from cluster center (use full radius)
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * billboardSettings.clusterProximityRadius;
  let x = selectedCluster.centerX + Math.cos(angle) * distance;
  let y = selectedCluster.centerY + Math.sin(angle) * distance;

  // Keep within world bounds
  x = Math.max(billboardSettings.boardWidth, Math.min(WORLD_WIDTH - billboardSettings.boardWidth, x));
  y = Math.max(billboardSettings.boardHeight + billboardSettings.poleHeight,
               Math.min(WORLD_HEIGHT - 50, y));

  // Check not too close to existing billboards
  for (const bb of billboards) {
    const dx = bb.x - x;
    const dy = bb.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < billboardSettings.boardWidth * 2) {
      return; // Too close, skip spawning
    }
  }

  // Pick random brand
  const brand = BRAND_LOGOS[Math.floor(Math.random() * BRAND_LOGOS.length)];

  billboards.push(new Billboard(x, y, brand));
}

function updateBillboards() {
  if (!billboardSettings.enabled) return;

  // Maybe spawn new billboard
  if (Math.random() < billboardSettings.spawnChance) {
    spawnBillboard();
  }

  // Update existing billboards, remove expired ones
  billboards = billboards.filter(bb => bb.update());
}

function drawBillboards() {
  if (!billboardSettings.enabled) return;

  // Sort by Y for proper depth ordering
  const sortedBillboards = [...billboards].sort((a, b) => a.y - b.y);

  for (const bb of sortedBillboards) {
    bb.draw(ctx, worldToScreen, getScale, isVisible);
  }
}
