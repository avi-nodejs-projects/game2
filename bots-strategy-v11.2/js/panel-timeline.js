// Bots Strategy v11.2 - Population Timeline Panel
// Scrolling stacked area chart of population and stats

const timeline = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  snapshots: [],
  maxSnapshots: 3600,
  snapshotInterval: 10,
  events: [],
  maxEvents: 1000,
  visibleFrames: 600,
  scrollOffset: 0,
  isLive: true,
  isDragging: false,
  dragStartX: 0,
  dragStartOffset: 0,
  legendState: { speed: true, attack: true, defence: true, lives: true }
};

const TIMELINE_STRATEGY_ORDER = ['gatherer', 'hunter', 'survivor', 'opportunist', 'aggressive', 'player', 'untyped'];

function initTimelinePanel() {
  timeline.canvas = document.getElementById('canvas-timeline');
  if (!timeline.canvas) return;
  timeline.ctx = timeline.canvas.getContext('2d');

  timeline.canvas.addEventListener('wheel', timelineMouseWheel, { passive: false });
  timeline.canvas.addEventListener('mousedown', timelineMouseDown);
  timeline.canvas.addEventListener('mousemove', timelineMouseMove);
  timeline.canvas.addEventListener('mouseup', timelineMouseUp);
}

function captureTimelineSnapshot() {
  const snapshot = {
    frame: frameCount,
    population: { total: bots.length },
    avgStats: { speed: 0, attack: 0, defence: 0, lives: 0 }
  };

  // Count by strategy
  const counts = {};
  for (const key of TIMELINE_STRATEGY_ORDER) counts[key] = 0;

  for (const bot of bots) {
    let strat = 'untyped';
    if (bot.isPlayer) strat = 'player';
    else if (bot.npcStrategy) strat = bot.npcStrategy;
    counts[strat] = (counts[strat] || 0) + 1;

    snapshot.avgStats.speed += bot.speed;
    snapshot.avgStats.attack += bot.attack;
    snapshot.avgStats.defence += bot.defence;
    snapshot.avgStats.lives += bot.lives;
  }

  snapshot.population.byStrategy = counts;

  if (bots.length > 0) {
    snapshot.avgStats.speed /= bots.length;
    snapshot.avgStats.attack /= bots.length;
    snapshot.avgStats.defence /= bots.length;
    snapshot.avgStats.lives /= bots.length;
  }

  timeline.snapshots.push(snapshot);
  if (timeline.snapshots.length > timeline.maxSnapshots) {
    timeline.snapshots.shift();
  }
}

function recordTimelineEvent(type, description) {
  timeline.events.push({ frame: frameCount, type, description });
  if (timeline.events.length > timeline.maxEvents) {
    timeline.events.shift();
  }
}

function drawTimeline() {
  if (!timeline.canvas) return;
  timeline.width = timeline.canvas.width;
  timeline.height = timeline.canvas.height;
  if (timeline.width === 0 || timeline.height === 0) return;
  const ctx = timeline.ctx;

  // Clear
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, timeline.width, timeline.height);

  if (timeline.snapshots.length < 2) {
    ctx.fillStyle = '#555';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data...', timeline.width / 2, timeline.height / 2);
    return;
  }

  const margin = { top: 10, right: 50, bottom: 30, left: 45 };
  const chartW = timeline.width - margin.left - margin.right;
  const chartH = timeline.height - margin.top - margin.bottom;

  // Determine visible range
  const totalSnapshots = timeline.snapshots.length;
  const visibleCount = Math.floor(timeline.visibleFrames / timeline.snapshotInterval);
  let endIdx = totalSnapshots - 1;
  if (timeline.isLive) {
    timeline.scrollOffset = 0;
  } else {
    endIdx = Math.max(visibleCount, totalSnapshots - 1 - timeline.scrollOffset);
  }
  const startIdx = Math.max(0, endIdx - visibleCount);
  const visible = timeline.snapshots.slice(startIdx, endIdx + 1);
  if (visible.length < 2) return;

  // Find max population for Y scale
  let maxPop = 1;
  for (const s of visible) {
    if (s.population.total > maxPop) maxPop = s.population.total;
  }
  maxPop = Math.ceil(maxPop * 1.2);

  // X scale
  const xStep = chartW / (visible.length - 1);

  // Draw stacked areas
  const strategies = TIMELINE_STRATEGY_ORDER;
  const strategyColors = {
    gatherer: '#66bb6a',
    hunter: '#ef5350',
    survivor: '#4dd0e1',
    opportunist: '#ffa726',
    aggressive: '#ab47bc',
    player: '#42a5f5',
    untyped: '#78909c'
  };

  // Build cumulative stacks
  const stacks = [];
  for (let i = 0; i < visible.length; i++) {
    const s = visible[i];
    let cumulative = 0;
    const stackEntry = {};
    for (const strat of strategies) {
      const count = (s.population.byStrategy && s.population.byStrategy[strat]) || 0;
      stackEntry[strat] = { bottom: cumulative, top: cumulative + count };
      cumulative += count;
    }
    stacks.push(stackEntry);
  }

  // Draw each strategy area (bottom to top)
  for (const strat of strategies) {
    ctx.fillStyle = strategyColors[strat] || '#555';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    // Top line (left to right)
    for (let i = 0; i < visible.length; i++) {
      const x = margin.left + i * xStep;
      const y = margin.top + chartH - (stacks[i][strat].top / maxPop) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Bottom line (right to left)
    for (let i = visible.length - 1; i >= 0; i--) {
      const x = margin.left + i * xStep;
      const y = margin.top + chartH - (stacks[i][strat].bottom / maxPop) * chartH;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draw stat lines (secondary Y axis)
  let maxStat = 1;
  for (const s of visible) {
    for (const stat of ['speed', 'attack', 'defence', 'lives']) {
      if (s.avgStats[stat] > maxStat) maxStat = s.avgStats[stat];
    }
  }
  maxStat = Math.ceil(maxStat * 1.2);

  const statColors = { speed: '#4dd0e1', attack: '#ef5350', defence: '#5c6bc0', lives: '#66bb6a' };
  for (const stat of ['speed', 'attack', 'defence', 'lives']) {
    if (!timeline.legendState[stat]) continue;
    ctx.strokeStyle = statColors[stat];
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let i = 0; i < visible.length; i++) {
      const x = margin.left + i * xStep;
      const y = margin.top + chartH - (visible[i].avgStats[stat] / maxStat) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw event markers
  for (const ev of timeline.events) {
    const snapIdx = Math.floor(ev.frame / timeline.snapshotInterval) - (timeline.snapshots.length > 0 ? Math.floor(timeline.snapshots[0].frame / timeline.snapshotInterval) : 0);
    const visIdx = snapIdx - startIdx;
    if (visIdx < 0 || visIdx >= visible.length) continue;

    const x = margin.left + visIdx * xStep;
    let color = '#888';
    if (ev.type === 'death') color = '#ef5350';
    else if (ev.type === 'birth') color = '#66bb6a';
    else if (ev.type === 'pack') color = '#42a5f5';
    else if (ev.type === 'player') color = '#ffd54f';

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + chartH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Draw axes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + chartH);
  ctx.lineTo(margin.left + chartW, margin.top + chartH);
  ctx.stroke();

  // Y-axis labels (population)
  ctx.fillStyle = '#888';
  ctx.font = '9px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(maxPop * i / 4);
    const y = margin.top + chartH - (i / 4) * chartH;
    ctx.fillText(val, margin.left - 5, y + 3);
  }

  // Y-axis labels (stats, right side)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#666';
  for (let i = 0; i <= 4; i++) {
    const val = (maxStat * i / 4).toFixed(1);
    const y = margin.top + chartH - (i / 4) * chartH;
    ctx.fillText(val, margin.left + chartW + 5, y + 3);
  }

  // X-axis labels (time in seconds)
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  const labelCount = Math.min(6, visible.length);
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.floor(i * (visible.length - 1) / (labelCount - 1));
    const x = margin.left + idx * xStep;
    const seconds = Math.round(visible[idx].frame / 60);
    ctx.fillText(`${seconds}s`, x, margin.top + chartH + 15);
  }

  // Live indicator
  if (timeline.isLive) {
    ctx.fillStyle = '#66bb6a';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('● LIVE', timeline.width - 10, 15);
  }
}

function timelineMouseWheel(e) {
  e.preventDefault();
  // Zoom time window
  const delta = e.deltaY > 0 ? 1.2 : 0.8;
  timeline.visibleFrames = Math.round(Math.min(3600, Math.max(300, timeline.visibleFrames * delta)));
}

function timelineMouseDown(e) {
  timeline.isDragging = true;
  timeline.dragStartX = e.clientX;
  timeline.dragStartOffset = timeline.scrollOffset;
  timeline.isLive = false;
}

function timelineMouseMove(e) {
  if (!timeline.isDragging) return;
  const dx = e.clientX - timeline.dragStartX;
  const snapshotsPerPixel = (timeline.visibleFrames / timeline.snapshotInterval) / timeline.width;
  timeline.scrollOffset = Math.max(0, Math.round(timeline.dragStartOffset + dx * snapshotsPerPixel));
}

function timelineMouseUp() {
  timeline.isDragging = false;
  // If scrolled to end, go back to live
  if (timeline.scrollOffset === 0) {
    timeline.isLive = true;
  }
}

function resetTimeline() {
  timeline.snapshots = [];
  timeline.events = [];
  timeline.scrollOffset = 0;
  timeline.isLive = true;
}
