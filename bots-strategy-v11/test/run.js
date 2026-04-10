#!/usr/bin/env node
// Bots v11 Test Runner
// ---------------------------------------------------------------
// Usage: node bots-strategy-v11/test/run.js [--quick] [--suite <name>] [--seed <n>] [--verbose]
//
// Runs the test suites defined below. Each suite is a directory
// under test/. For each suite, runs `node --test --test-reporter=tap`
// and parses the TAP output to count passes/failures.
//
// Console shows a short bulletin per suite plus a final summary.
// Full TAP output and failure details are written to files under
// test/results/ (gitignored).

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_ROOT = __dirname;
const RESULTS_DIR = path.join(TEST_ROOT, 'results');

// Suites in execution order. Slow suites get skipped with --quick.
const ALL_SUITES = [
  { name: 'unit',        slow: false },
  { name: 'strategies',  slow: false },
  { name: 'integration', slow: false },
  { name: 'invariants',  slow: false },
  { name: 'simulation',  slow: true  },
];

// ---- Args --------------------------------------------------------

function parseArgs(argv) {
  const args = { quick: false, suite: null, seed: null, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--quick':            args.quick = true; break;
      case '--verbose': case '-v': args.verbose = true; break;
      case '--suite':            args.suite = argv[++i]; break;
      case '--seed':             args.seed = parseInt(argv[++i], 10); break;
      case '--help': case '-h':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Bots v11 test runner

Usage: node test/run.js [options]

Options:
  --quick               Skip slow suites (simulation)
  --suite <name>        Run only the named suite (unit, strategies, integration, invariants, simulation)
  --seed <n>            Pass a seed via TEST_SEED env var (tests can consume it)
  --verbose, -v         Print full TAP output to stdout too (in addition to log file)
  --help, -h            Show this help

Examples:
  node test/run.js                     Full suite
  node test/run.js --quick             Skip simulation tests
  node test/run.js --suite unit        Only unit tests
  node test/run.js --seed 123          Deterministic run with seed 123
`);
}

// ---- File utilities ----------------------------------------------

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

// ---- TAP parsing -------------------------------------------------

// Parse Node --test TAP output.
// Reliable approach: use the summary lines (# tests, # pass, # fail)
// at the bottom. Also collect individual failure lines for the
// failures log.
function parseTap(output) {
  const lines = output.split('\n');
  const result = {
    tests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    failures: [], // { name, message }
  };

  // Parse summary comment lines (these are the authoritative counts)
  for (const line of lines) {
    const m = line.match(/^#\s+(tests|pass|fail|skipped|duration_ms)\s+([\d.]+)$/);
    if (m) {
      const key = m[1];
      const val = parseFloat(m[2]);
      if (key === 'tests') result.tests = val;
      else if (key === 'pass') result.passed = val;
      else if (key === 'fail') result.failed = val;
      else if (key === 'skipped') result.skipped = val;
      else if (key === 'duration_ms') result.durationMs = val;
    }
  }

  // Collect failure names + trailing YAML block for details
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^not ok \d+ - (.+?)(\s*#.*)?$/);
    if (m) {
      const name = m[1].trim();
      // Walk forward, collect indented YAML-ish block lines
      const details = [];
      for (let j = i + 1; j < lines.length; j++) {
        const ln = lines[j];
        if (ln.startsWith('  ') || ln.startsWith('---') || ln.startsWith('...')) {
          details.push(ln);
          if (ln.trim() === '...') break;
        } else if (ln.match(/^(ok|not ok|#)/)) {
          break;
        } else if (ln.trim() === '') {
          break;
        }
      }
      result.failures.push({ name, message: details.join('\n') });
    }
  }

  return result;
}

// ---- Suite runner ------------------------------------------------

// Find all .test.js files recursively under a directory.
function findTestFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

function runSuite(suiteName, args) {
  const suitePath = path.join(TEST_ROOT, suiteName);
  if (!fs.existsSync(suitePath)) {
    return Promise.resolve({
      name: suiteName,
      skipped: true,
      reason: 'directory does not exist',
    });
  }

  const files = findTestFiles(suitePath);
  if (files.length === 0) {
    return Promise.resolve({
      name: suiteName,
      skipped: true,
      reason: 'no .test.js files found',
    });
  }

  return new Promise((resolve) => {
    const start = Date.now();
    const env = { ...process.env };
    if (args.seed !== null && args.seed !== undefined) {
      env.TEST_SEED = String(args.seed);
    }

    // Pass individual test files to avoid Node's per-version
    // directory-argument behavior differences.
    const child = spawn(
      'node',
      ['--test', '--test-reporter=tap', ...files],
      { cwd: path.resolve(TEST_ROOT, '..', '..'), env }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', (code) => {
      const wallMs = Date.now() - start;
      const parsed = parseTap(stdout);
      resolve({
        name: suiteName,
        skipped: false,
        exitCode: code,
        wallMs,
        tapMs: parsed.durationMs,
        tests: parsed.tests,
        passed: parsed.passed,
        failed: parsed.failed,
        skippedTests: parsed.skipped,
        failures: parsed.failures,
        stdout,
        stderr,
      });
    });
  });
}

// ---- Bulletin formatting -----------------------------------------

function printBulletin(result) {
  const name = result.name.padEnd(12);
  if (result.skipped) {
    console.log(`  ${name} (skipped — ${result.reason})`);
    return;
  }
  const check = result.failed === 0 ? '✓' : '✗';
  const dur = formatDuration(result.wallMs);
  const failStr = result.failed > 0 ? `   ✗ ${result.failed} failed` : '';
  console.log(`  ${name} ${check} ${String(result.passed).padStart(3)} passed${failStr}   (${dur})`);
}

// ---- Main --------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  ensureResultsDir();

  // Pick suites
  let suites = ALL_SUITES.map(s => s.name);
  if (args.quick) {
    suites = ALL_SUITES.filter(s => !s.slow).map(s => s.name);
  }
  if (args.suite) {
    if (!ALL_SUITES.find(s => s.name === args.suite)) {
      console.error(`Unknown suite: ${args.suite}`);
      console.error(`Available: ${ALL_SUITES.map(s => s.name).join(', ')}`);
      process.exit(2);
    }
    suites = [args.suite];
  }

  const ts = timestamp();
  const modeLabel = args.quick ? 'QUICK' : (args.suite ? `SUITE=${args.suite}` : 'FULL');
  const logFile = path.join(RESULTS_DIR, `${ts}-${modeLabel.toLowerCase()}.log`);
  const failFile = path.join(RESULTS_DIR, `${ts}-${modeLabel.toLowerCase()}-failures.log`);
  const summaryFile = path.join(RESULTS_DIR, 'last-run.json');

  console.log('');
  console.log(`Bots v11 tests — ${modeLabel}${args.seed != null ? ` seed=${args.seed}` : ''}`);
  console.log('─'.repeat(55));

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalWall = 0;
  const allFailures = [];
  const fullLog = [];

  for (const suiteName of suites) {
    const r = await runSuite(suiteName, args);
    results.push(r);
    printBulletin(r);

    if (!r.skipped) {
      totalPassed += r.passed;
      totalFailed += r.failed;
      totalWall += r.wallMs;
      fullLog.push(`==================== ${r.name} ====================`);
      fullLog.push(r.stdout);
      if (r.stderr) {
        fullLog.push('---- stderr ----');
        fullLog.push(r.stderr);
      }
      for (const f of r.failures) {
        allFailures.push({ suite: r.name, ...f });
      }
      if (args.verbose) {
        console.log(r.stdout);
      }
    }
  }

  console.log('─'.repeat(55));
  const overall = totalFailed === 0 ? '✓' : '✗';
  console.log(` ${overall} ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`   Total: ${formatDuration(totalWall)}`);

  // Write full log
  fs.writeFileSync(logFile, fullLog.join('\n\n'));
  console.log(`   Log: ${path.relative(process.cwd(), logFile)}`);

  // Write failure details
  if (allFailures.length > 0) {
    const failLog = allFailures
      .map(f => `[${f.suite}] ${f.name}\n${f.message}\n`)
      .join('\n');
    fs.writeFileSync(failFile, failLog);
    console.log(`   Failures: ${path.relative(process.cwd(), failFile)}`);
  }

  // Write machine-readable summary
  const summary = {
    timestamp: ts,
    mode: modeLabel,
    seed: args.seed,
    totalPassed,
    totalFailed,
    totalDurationMs: totalWall,
    suites: results.map(r => ({
      name: r.name,
      skipped: r.skipped,
      reason: r.reason,
      passed: r.passed,
      failed: r.failed,
      durationMs: r.wallMs,
    })),
  };
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  console.log('');
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Runner error:', err);
  process.exit(2);
});
