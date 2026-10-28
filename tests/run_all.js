// Cross-platform test runner (Windows / macOS / Linux) - no bash or python3 alias needed.
// Usage: node tests/run_all.js [--skip-py]
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const env = Object.assign({}, process.env, { USE_SAMPLE_DATA: '1' });
const results = [];

function run(label, cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0;
  results.push({ label, ok, out: (r.stdout || '') + (r.stderr || ''), err: r.error && r.error.message });
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  if (!ok) console.log(((r.stdout || '') + (r.stderr || '') + (r.error ? r.error.message : '')).split('\n').slice(-15).join('\n'));
}

function findPython() {
  for (const c of ['python3', 'python', 'py']) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  return null;
}

// 1. syntax checks
const syntaxFiles = ['app/sw.js', 'google_apps_script.js'];
for (const dir of ['app/js', 'app/data']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) if (f.endsWith('.js')) syntaxFiles.push(dir + '/' + f);
}
for (const f of syntaxFiles) run('node --check ' + f, process.execPath, ['--check', f]);

// 2. Apps Script template in sync
const py = findPython();
if (py) run('sync_apps_script_template --check', py, ['tools/sync_apps_script_template.py', '--check']);
else console.log('SKIP python not found (sync check + .py tests)');

// 3. tests
const tests = [];
for (const f of fs.readdirSync(path.join(ROOT, 'tests')).sort()) {
  if (!/^test_.*\.(js|py)$/.test(f)) continue;
  tests.push('tests/' + f);
}
tests.push('test_e2e_suite.js');
for (const t of tests) {
  if (t.endsWith('.py')) { if (py) run(t, py, [t]); }
  else run(t, process.execPath, [t]);
}

const failed = results.filter(r => !r.ok);
console.log('\n' + results.length + ' checks, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
if (failed.length) { console.log('FAILED:\n  ' + failed.map(f => f.label).join('\n  ')); process.exit(1); }
console.log('ALL SUITES PASSED');
