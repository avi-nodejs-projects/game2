// Bots Strategy v11.2 - Relationship Web Panel
// Force-directed graph visualization of bot relationships

const relWeb = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  nodes: new Map(),       // botIndex -> { x, y, vx, vy, radius, birthFrame, deathFrame }
  combatEdges: [],        // { from, to, createdAt }
  dragNode: null,
  hoveredNode: null,
  REPULSION: 500,
  ATTRACTION: 0.05,
  CENTER_GRAVITY: 0.01,
  DAMPING: 0.9,
  MIN_NODE_SIZE: 8,
  MAX_NODE_SIZE: 30
};

// Strategy colors (consistent across panels)
const STRATEGY_COLORS = {
  gatherer: '#66bb6a',
  hunter: '#ef5350',
  survivor: '#4dd0e1',
  opportunist: '#ffa726',
  aggressive: '#ab47bc',
  player: '#42a5f5',
  default: '#78909c'
};

function getStrategyColor(bot) {
  if (bot.isPlayer) return STRATEGY_COLORS.player;
  if (bot.npcStrategy) return STRATEGY_COLORS[bot.npcStrategy] || STRATEGY_COLORS.default;
  return STRATEGY_COLORS.default;
}

function initRelationshipPanel() {
  relWeb.canvas = document.getElementById('canvas-relationship');
  if (!relWeb.canvas) return;
  relWeb.ctx = relWeb.canvas.getContext('2d');

  // Mouse interactions
  relWeb.canvas.addEventListener('mousedown', relWebMouseDown);
  relWeb.canvas.addEventListener('mousemove', relWebMouseMove);
  relWeb.canvas.addEventListener('mouseup', relWebMouseUp);
  relWeb.canvas.addEventListener('click', relWebClick);
}

function syncRelationshipNodes() {
  if (!relWeb.canvas) return;
  relWeb.width = relWeb.canvas.width;
  relWeb.height = relWeb.canvas.height;
  if (relWeb.width === 0 || relWeb.height === 0) return;

  const livingBotIndices = new Set(bots.map(b => b.index));

  // Add new nodes for bots that appeared
  for (const bot of bots) {
    if (!relWeb.nodes.has(bot.index)) {
      relWeb.nodes.set(bot.index, {
        x: relWeb.width / 2 + (Math.random() - 0.5) * relWeb.width * 0.5,
        y: relWeb.height / 2 + (Math.random() - 0.5) * relWeb.height * 0.5,
        vx: 0,
        vy: 0,
        radius: 0, // will animate in
        birthFrame: frameCount,
        deathFrame: null
      });
    }
  }

  // Mark dead bots for fade-out
  for (const [idx, node] of relWeb.nodes) {
    if (!livingBotIndices.has(idx) && node.deathFrame === null) {
      node.deathFrame = frameCount;
    }
  }

  // Remove nodes that have finished death animation (60 frames)
  for (const [idx, node] of relWeb.nodes) {
    if (node.deathFrame !== null && frameCount - node.deathFrame > 60) {
      relWeb.nodes.delete(idx);
    }
  }

  // Clean old combat edges (fade after 300 frames = 5 seconds)
  relWeb.combatEdges = relWeb.combatEdges.filter(e => frameCount - e.createdAt < 300);
}

function getEdgesForGraph() {
  const edges = [];

  for (const bot of bots) {
    if (!bot.relationships) continue;

    // Pack bonds
    if (bot.relationships.packId !== null && typeof packs !== 'undefined') {
      const pack = packs.get(bot.relationships.packId);
      if (pack) {
        for (const memberIdx of pack.members) {
          if (memberIdx > bot.index && relWeb.nodes.has(memberIdx)) {
            edges.push({ from: bot.index, to: memberIdx, type: 'pack', packHue: pack.hue });
          }
        }
      }
    }

    // Parent-child
    if (bot.relationships.parentId !== null && relWeb.nodes.has(bot.relationships.parentId)) {
      edges.push({ from: bot.relationships.parentId, to: bot.index, type: 'parent' });
    }
  }

  // Combat edges (temporary)
  for (const ce of relWeb.combatEdges) {
    if (relWeb.nodes.has(ce.from) && relWeb.nodes.has(ce.to)) {
      edges.push({ from: ce.from, to: ce.to, type: 'combat', createdAt: ce.createdAt });
    }
  }

  return edges;
}

function computeForces() {
  if (!relWeb.canvas || relWeb.width === 0) return;

  const nodes = [...relWeb.nodes.entries()].filter(([, n]) => n.deathFrame === null);
  const edges = getEdgesForGraph();

  // Repulsion between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [, a] = nodes[i];
      const [, b] = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = relWeb.REPULSION / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // Attraction along edges
  for (const edge of edges) {
    const a = relWeb.nodes.get(edge.from);
    const b = relWeb.nodes.get(edge.to);
    if (!a || !b || a.deathFrame !== null || b.deathFrame !== null) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = dist * relWeb.ATTRACTION;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // Center gravity
  for (const [, node] of nodes) {
    const dx = relWeb.width / 2 - node.x;
    const dy = relWeb.height / 2 - node.y;
    node.vx += dx * relWeb.CENTER_GRAVITY;
    node.vy += dy * relWeb.CENTER_GRAVITY;
  }

  // Apply velocity with damping
  for (const [, node] of nodes) {
    if (node === relWeb.dragNode) continue; // don't move dragged node
    node.vx *= relWeb.DAMPING;
    node.vy *= relWeb.DAMPING;
    node.x += node.vx;
    node.y += node.vy;
    // Keep in bounds
    node.x = Math.max(20, Math.min(relWeb.width - 20, node.x));
    node.y = Math.max(20, Math.min(relWeb.height - 20, node.y));
  }
}

function getNodeRadius(bot) {
  const totalStats = bot.speed + bot.attack + bot.defence + bot.lives;
  const t = Math.min(1, totalStats / 40); // normalize to ~40 max total
  return relWeb.MIN_NODE_SIZE + t * (relWeb.MAX_NODE_SIZE - relWeb.MIN_NODE_SIZE);
}

function drawRelationshipGraph() {
  if (!relWeb.canvas || relWeb.width === 0 || relWeb.height === 0) return;
  const ctx = relWeb.ctx;

  // Clear
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, relWeb.width, relWeb.height);

  const edges = getEdgesForGraph();

  // Draw edges
  for (const edge of edges) {
    const a = relWeb.nodes.get(edge.from);
    const b = relWeb.nodes.get(edge.to);
    if (!a || !b) continue;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    if (edge.type === 'pack') {
      ctx.strokeStyle = `hsla(${edge.packHue}, 70%, 50%, 0.5)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
    } else if (edge.type === 'parent') {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
    } else if (edge.type === 'combat') {
      const age = frameCount - edge.createdAt;
      const alpha = Math.max(0, 1 - age / 300) * 0.6;
      ctx.strokeStyle = `rgba(255, 60, 60, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
    }

    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw nodes
  for (const bot of bots) {
    const node = relWeb.nodes.get(bot.index);
    if (!node) continue;

    const targetRadius = getNodeRadius(bot);

    // Birth animation
    const age = frameCount - node.birthFrame;
    const birthScale = Math.min(1, age / 20);

    // Death animation
    let deathScale = 1;
    if (node.deathFrame !== null) {
      deathScale = Math.max(0, 1 - (frameCount - node.deathFrame) / 60);
    }

    node.radius = targetRadius * birthScale * deathScale;
    if (node.radius < 0.5) continue;

    const color = getStrategyColor(bot);

    // Node body
    ctx.fillStyle = color;
    ctx.globalAlpha = (bot.lives / (bot.initialLives || 3)) * deathScale;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Border (pack color or white)
    if (bot.relationships && bot.relationships.packId !== null && typeof packs !== 'undefined') {
      const pack = packs.get(bot.relationships.packId);
      ctx.strokeStyle = pack ? `hsl(${pack.hue}, 70%, 60%)` : 'rgba(255,255,255,0.3)';
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    }
    ctx.lineWidth = bot.isPlayer ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Player gold border
    if (bot.isPlayer) {
      ctx.strokeStyle = '#ffdd00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Index label
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(8, node.radius * 0.7)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bot.isPlayer ? '★' : bot.index, node.x, node.y);
  }

  // Draw dead nodes (fading)
  for (const [idx, node] of relWeb.nodes) {
    if (node.deathFrame === null) continue;
    const deathAge = frameCount - node.deathFrame;
    if (deathAge > 60) continue;
    const alpha = Math.max(0, 1 - deathAge / 60);
    const pulse = Math.sin(deathAge * 0.3) * 0.3;

    ctx.fillStyle = `rgba(255, 50, 50, ${(alpha + pulse) * 0.5})`;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * (1 - deathAge / 60), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Record a combat event for the relationship web
function onRelWebCombat(bot1Index, bot2Index) {
  relWeb.combatEdges.push({ from: bot1Index, to: bot2Index, createdAt: frameCount });
}

// Mouse interaction
function relWebMouseDown(e) {
  const rect = relWeb.canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const [idx, node] of relWeb.nodes) {
    const dx = mx - node.x;
    const dy = my - node.y;
    if (dx * dx + dy * dy < node.radius * node.radius) {
      relWeb.dragNode = node;
      return;
    }
  }
}

function relWebMouseMove(e) {
  if (!relWeb.dragNode) return;
  const rect = relWeb.canvas.getBoundingClientRect();
  relWeb.dragNode.x = e.clientX - rect.left;
  relWeb.dragNode.y = e.clientY - rect.top;
}

function relWebMouseUp() {
  relWeb.dragNode = null;
}

function relWebClick(e) {
  if (relWeb.dragNode) return;
  const rect = relWeb.canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const [idx, node] of relWeb.nodes) {
    const dx = mx - node.x;
    const dy = my - node.y;
    if (dx * dx + dy * dy < node.radius * node.radius) {
      // Follow this bot in Panel 1
      const bot = bots.find(b => b.index === idx);
      if (bot) {
        camera.followBot = bot;
        camera.followIndex = bots.indexOf(bot);
        camera.autoFollow = true;
      }
      return;
    }
  }
}
