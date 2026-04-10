#!/usr/bin/env node
// Machine-readable simulation logger for v11.
// Runs the full game loop headlessly, streams every significant
// event and periodic state snapshots to an NDJSON file (optionally
// gzipped). Intended for long runs that produce analysis-friendly
// datasets.
//
// Usage:
//   node bots-strategy-v11/test/simlog.js [options]
//
// Common options:
//   --seed N            deterministic RNG seed (default: 42)
//   --bots N            number of bots (default: 20)
//   --dots N            number of food dots (default: 50)
//   --frames N          frames to simulate (default: 60000)
//   --snap-every N      snapshot every N frames (default: 100, 0=off)
//   --out PATH          output file (default: sim-<ts>.ndjson[.gz])
//   --gzip              compress output with gzip
//   --lifecycle LIST    comma-separated: invincibility,starvation,age,repro-asexual,
//                       repro-sexual,packs,all,none (default: none)
//   --decisions         also log every pickNewTarget decision (VERBOSE)
//   --quiet             suppress progress output
//   --help              show this help
//
// Example:
//   node bots-strategy-v11/test/simlog.js --frames 60000 --lifecycle all --gzip \
//     --out /tmp/run-a.ndjson.gz

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createTestContext, runSimulation } = require('./helpers');

// ---- Arg parsing --------------------------------------------------

function parseArgs(argv) {
  const args = {
    seed: 42,
    bots: 20,
    dots: 50,
    frames: 60000,
    snapEvery: 100,
    out: null,
    gzip: false,
    lifecycle: 'none',
    decisions: false,
    quiet: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--seed':       args.seed = parseInt(argv[++i], 10); break;
      case '--bots':       args.bots = parseInt(argv[++i], 10); break;
      case '--dots':       args.dots = parseInt(argv[++i], 10); break;
      case '--frames':     args.frames = parseInt(argv[++i], 10); break;
      case '--snap-every': args.snapEvery = parseInt(argv[++i], 10); break;
      case '--out':        args.out = argv[++i]; break;
      case '--gzip':       args.gzip = true; break;
      case '--lifecycle':  args.lifecycle = argv[++i]; break;
      case '--decisions':  args.decisions = true; break;
      case '--quiet':      args.quiet = true; break;
      case '--help': case '-h':
        printHelp(); process.exit(0);
      default:
        console.error(`Unknown argument: ${a}`);
        printHelp();
        process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  const src = fs.readFileSync(__filename, 'utf8');
  // Print the banner comment at the top (skip shebang, stop at first
  // non-comment non-blank line).
  const lines = src.split('\n');
  let started = false;
  for (const line of lines) {
    if (line.startsWith('#!')) continue;
    if (line.startsWith('//')) {
      started = true;
      console.log(line.slice(3));
    } else if (line.trim() === '' && started) {
      console.log('');
    } else if (started) {
      break;
    }
  }
}

// ---- Stream writer ------------------------------------------------

function makeDefaultOutPath(args) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = `sim-${ts}-seed${args.seed}-${args.bots}b-${args.frames}f.ndjson`;
  return path.join(__dirname, 'results', args.gzip ? base + '.gz' : base);
}

function createWriter(filepath, gzip) {
  // Ensure directory exists
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fileStream = fs.createWriteStream(filepath);
  let out = fileStream;
  if (gzip) {
    const gz = zlib.createGzip({ level: 6 });
    gz.pipe(fileStream);
    out = gz;
  }

  let eventCount = 0;
  let bytesWritten = 0;

  return {
    write(obj) {
      const line = JSON.stringify(obj) + '\n';
      out.write(line);
      eventCount++;
      bytesWritten += line.length;
    },
    end() {
      return new Promise(resolve => {
        out.end(() => resolve({ eventCount, bytesWritten }));
      });
    },
    get stats() {
      return { eventCount, bytesWritten };
    },
  };
}

// ---- Lifecycle config toggle --------------------------------------

function applyLifecycle(ctx, spec) {
  const ls = ctx.lifecycleSettings;
  if (spec === 'none') return;
  const requested = spec === 'all'
    ? ['invincibility', 'starvation', 'age', 'repro-asexual', 'repro-sexual', 'packs']
    : spec.split(',').map(s => s.trim());

  for (const feature of requested) {
    switch (feature) {
      case 'invincibility':
        ls.respawnInvincibility.enabled = true;
        break;
      case 'starvation':
        ls.starvation.enabled = true;
        ls.starvation.resetConditions.onDotEaten = true;
        ls.starvation.resetConditions.onKill = true;
        break;
      case 'age':
        ls.age.enabled = true;
        ls.age.deathBehavior = 'respawn';
        break;
      case 'repro-asexual':
        ls.reproduction.asexual.enabled = true;
        ls.reproduction.asexual.maturityThreshold = 1800;
        ls.reproduction.asexual.cooldown = 900;
        break;
      case 'repro-sexual':
        ls.reproduction.sexual.enabled = true;
        break;
      case 'packs':
        ls.packs.enabled = true;
        break;
      default:
        throw new Error(`Unknown lifecycle feature: ${feature}`);
    }
  }
}

// ---- Event hooks (monkey-patch in vm context) ---------------------

// Capture a snapshot of all bot fields that matter for analysis.
function snapshotBots(ctx) {
  return ctx.bots.map(b => ({
    i: b.index,
    x: Math.round(b.x),
    y: Math.round(b.y),
    spd: b.speed,
    atk: b.attack,
    def: b.defence,
    lv: Math.round(b.lives * 10) / 10,  // 0.1 precision
    k: b.killCount,
    p: b.relationships ? b.relationships.packId : null,
    g: b.generation || 0,
    s: b.isStarving ? 1 : 0,
  }));
}

function snapshotDots(ctx) {
  return ctx.yellowDots.map(d => ({ x: Math.round(d.x), y: Math.round(d.y) }));
}

function installHooks(ctx, writer, options) {
  // ---- Combat hook: record every damage exchange + kills --------
  const origHandleCombat = ctx.handleCombat;
  ctx.handleCombat = function(bot1, bot2) {
    const b1LivesBefore = bot1.lives;
    const b2LivesBefore = bot2.lives;
    const b1KillsBefore = bot1.killCount || 0;
    const b2KillsBefore = bot2.killCount || 0;

    origHandleCombat.call(this, bot1, bot2);

    const damage1 = b1LivesBefore - bot1.lives;
    const damage2 = b2LivesBefore - bot2.lives;
    if (damage1 > 0 || damage2 > 0) {
      writer.write({
        t: 'combat',
        f: ctx.frameCount,
        a: bot1.index, b: bot2.index,
        da: round(damage1, 2), db: round(damage2, 2),
      });
    }
    // Kill detection: killCount increment → one side died
    if ((bot1.killCount || 0) > b1KillsBefore) {
      writer.write({
        t: 'kill', f: ctx.frameCount,
        k: bot1.index, v: bot2.index,
        kx: Math.round(bot1.x), ky: Math.round(bot1.y),
      });
    }
    if ((bot2.killCount || 0) > b2KillsBefore) {
      writer.write({
        t: 'kill', f: ctx.frameCount,
        k: bot2.index, v: bot1.index,
        kx: Math.round(bot2.x), ky: Math.round(bot2.y),
      });
    }
  };

  // ---- Dot eating: compare dot positions before/after processCollisions ---
  const origProcessCollisions = ctx.processCollisions;
  ctx.processCollisions = function() {
    // Snapshot dot positions before
    const beforeDotPositions = ctx.yellowDots.map(d => `${d.x},${d.y}`);
    const beforeBotIndices = ctx.bots.map(b => b.index); // for eat attribution
    const beforeStats = ctx.bots.map(b => b.speed + b.attack + b.defence + b.lives);

    origProcessCollisions.call(this);

    // Any dot that changed position was eaten
    for (let i = 0; i < ctx.yellowDots.length; i++) {
      const now = `${ctx.yellowDots[i].x},${ctx.yellowDots[i].y}`;
      if (now !== beforeDotPositions[i]) {
        // Attribute to whichever bot's stat total grew (any bot increased)
        let eaterIdx = -1;
        for (let j = 0; j < ctx.bots.length; j++) {
          const after = ctx.bots[j].speed + ctx.bots[j].attack + ctx.bots[j].defence + ctx.bots[j].lives;
          if (after > beforeStats[j] + 0.001) {
            eaterIdx = ctx.bots[j].index;
            beforeStats[j] = after; // prevent double-attribution if multiple dots eaten
            break;
          }
        }
        writer.write({ t: 'eat', f: ctx.frameCount, b: eaterIdx });
      }
    }
  };

  // ---- Lifecycle events: logEvent is already used by v11 --------
  // Not all events go through logEvent — the ones that do include
  // STARVATION_TICK, STARVATION_DEATH, AGE_DEATH, CORPSE_CREATED,
  // REPRODUCTION_ASEXUAL, REPRODUCTION_SEXUAL, PROTECTION_*, PACK_*
  const origLogEvent = ctx.logEvent;
  if (typeof origLogEvent === 'function') {
    ctx.logEvent = function(eventName, data) {
      writer.write({
        t: 'lifecycle',
        f: ctx.frameCount,
        n: eventName,
        d: data || {},
      });
      origLogEvent.call(this, eventName, data);
    };
  }

  // ---- Decisions (optional, VERBOSE) -----------------------------
  if (options.decisions) {
    const origLogDecision = ctx.logDecision;
    if (typeof origLogDecision === 'function') {
      ctx.logDecision = function(bot, action, reason, context, meta) {
        writer.write({
          t: 'decision',
          f: ctx.frameCount,
          b: bot.index,
          act: action,
          r: reason,
        });
        origLogDecision.call(this, bot, action, reason, context, meta);
      };
    }
  }
}

function round(n, decimals) {
  const m = Math.pow(10, decimals);
  return Math.round(n * m) / m;
}

// ---- Main ---------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  if (!args.out) args.out = makeDefaultOutPath(args);

  const ctx = createTestContext({ seed: args.seed, botCount: args.bots, dotCount: args.dots });
  applyLifecycle(ctx, args.lifecycle);

  const writer = createWriter(args.out, args.gzip);

  // Meta
  writer.write({
    t: 'meta',
    ts: new Date().toISOString(),
    seed: args.seed,
    bots: args.bots,
    dots: args.dots,
    frames: args.frames,
    snapEvery: args.snapEvery,
    lifecycle: args.lifecycle,
    decisions: args.decisions,
    worldWidth: ctx.WORLD_WIDTH,
    worldHeight: ctx.WORLD_HEIGHT,
  });

  // Initial state
  writer.write({
    t: 'init',
    bots: ctx.bots.map(b => ({
      i: b.index,
      x: Math.round(b.x), y: Math.round(b.y),
      spd: b.speed, atk: b.attack, def: b.defence, lv: b.lives,
      hue: Math.round(b.hue),
      player: b.isPlayer ? 1 : 0,
    })),
    dots: snapshotDots(ctx),
  });

  installHooks(ctx, writer, args);

  // Run simulation with periodic snapshots
  const t0 = Date.now();
  const snapEvery = args.snapEvery > 0 ? args.snapEvery : 0;
  const progressEvery = Math.max(Math.floor(args.frames / 20), 1000);

  runSimulation(ctx, args.frames, {
    onFrame: (frame, ctx) => {
      if (snapEvery > 0 && frame % snapEvery === 0) {
        writer.write({ t: 'snap', f: frame, bots: snapshotBots(ctx) });
      }
      if (!args.quiet && frame % progressEvery === 0) {
        const elapsed = Date.now() - t0;
        const pct = ((frame / args.frames) * 100).toFixed(1);
        const fps = Math.round(frame / (elapsed / 1000));
        process.stderr.write(`  ${pct}%  frame=${frame}  ${fps} fps  events=${writer.stats.eventCount}\r`);
      }
    },
  });
  if (!args.quiet) process.stderr.write('\n');

  // Final state
  writer.write({
    t: 'final',
    f: ctx.frameCount,
    bots: snapshotBots(ctx),
    dots: snapshotDots(ctx),
    totalKills: ctx.bots.reduce((s, b) => s + (b.killCount || 0), 0),
    elapsedMs: Date.now() - t0,
  });

  const finalStats = await writer.end();
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
  const sizeKB = (fs.statSync(args.out).size / 1024).toFixed(1);

  if (!args.quiet) {
    console.log(`\nWrote ${finalStats.eventCount} events / ${sizeKB} KB to:`);
    console.log(`  ${args.out}`);
    console.log(`Simulation time: ${elapsedSec}s  (${Math.round(args.frames / (elapsedSec))} fps)`);
  } else {
    console.log(args.out);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
