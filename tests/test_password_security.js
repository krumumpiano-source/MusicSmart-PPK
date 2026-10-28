// Password security: PBKDF2 hashing, legacy migration, demo accounts gated to dev mode, no plaintext in the tree.
// Uses throwaway passwords only. The real teacher password is never written in this file:
// the tree scan checks candidate words against the stored hash instead.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let store = {};
global.window = global;
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
const Store = require('../app/data/store.js');
global.Store = Store;

const ROOT = path.join(__dirname, '..');
const TMP_PW = 'Throwaway-Pw-For-Test-1';

(async () => {
  // 1. format + salt + iterations
  const h1 = await Store.hashSecretStrong(TMP_PW);
  const h2 = await Store.hashSecretStrong(TMP_PW);
  assert(/^pbkdf2-sha256\$v1\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(h1), 'versioned format');
  assert(Number(h1.split('$')[2]) >= 210000, 'iterations >= 210000');
  assert.notStrictEqual(h1, h2, 'random per-hash salt');
  assert(!h1.includes(TMP_PW));
  assert(await Store.verifySecretStrong(TMP_PW, h1));
  assert(!(await Store.verifySecretStrong(TMP_PW + 'x', h1)));
  assert(!(await Store.verifySecretStrong('', h1)));
  assert(!(await Store.verifySecretStrong(TMP_PW, 'sha256_abc')), 'legacy string is not a strong hash');
  assert(!(await Store.verifySecretStrong(TMP_PW, h1.replace(/\$\d+\$/, '$1$'))), 'tampered iteration count rejected');
  assert(Store._timingSafeEqual('abc', 'abc') && !Store._timingSafeEqual('abc', 'abd') && !Store._timingSafeEqual('abc', 'abcd'));

  // 2. default account has a strong hash and no plaintext
  const def = Store.getTeacherAccount();
  assert(Store.isStrongHash(def.secretHash), 'default account uses a strong hash');
  assert(!('secret' in def), 'default account carries no plaintext secret');
  assert(!(await Store.verifyRecordSecret(def, 'wrong-password-xyz')).ok);
  assert(!(await Store.verifyRecordSecret(def, '')).ok);

  // 3. change password: strong hash, nothing readable in storage, login works
  await Store.saveTeacherAccount({ email: def.email, secret: TMP_PW });
  assert(!JSON.stringify(store).includes(TMP_PW), 'no plaintext in localStorage after save');
  let r = await Store.verifyTeacherLogin(def.email, TMP_PW);
  assert.strictEqual(r.success, true);
  r = await Store.verifyTeacherLogin(def.email, TMP_PW + '1');
  assert.strictEqual(r.success, false);
  const chg = await Store.changeAdminPassword('Another-Throwaway-2');
  assert(chg.success);
  assert(!JSON.stringify(store).includes('Another-Throwaway-2'));
  assert.strictEqual((await Store.verifyTeacherLogin(def.email, 'Another-Throwaway-2')).success, true);

  // 4. legacy migration: old localStorage with sha256_ hash AND plaintext "secret" field
  store = {}; Store._cache && Store._cache.clear && Store._cache.clear();
  const LEG = 'Legacy-Throwaway-3';
  store.ppk_teacher_account = JSON.stringify({ email: def.email, secretType: 'password', secret: LEG, secretHash: Store.hashSecret(LEG, 'teacher') });
  Store._cache && Store._cache.clear && Store._cache.clear();
  const legacyRec = Store.getTeacherAccount();
  const vr = await Store.verifyRecordSecret(legacyRec, LEG);
  assert(vr.ok && vr.legacy, 'legacy hash accepted and flagged legacy');
  r = await Store.verifyTeacherLogin(def.email, LEG);
  assert.strictEqual(r.success, true, 'legacy account can still log in');
  const migrated = Store.getTeacherAccount();
  assert(Store.isStrongHash(migrated.secretHash), 'migrated to strong hash after login');
  assert(!('secret' in migrated), 'plaintext field removed after migration');
  assert(!store.ppk_teacher_account.includes(LEG) && !(store.ppk_teachers_list || '').includes(LEG), 'plaintext gone from storage');
  assert.strictEqual((await Store.verifyTeacherLogin(def.email, LEG)).success, true, 'still logs in after migration');

  // 5. intern / other teacher: no plaintext stored
  store = {}; Store._cache && Store._cache.clear && Store._cache.clear();
  const add = Store.addTeacher({ name: 'ครูทดสอบ', email: 'x_teacher@example.com', secret: 'Intern-Throwaway-4', role: 'ครูผู้ช่วย' });
  assert(add && add.success !== false);
  assert(!JSON.stringify(store).includes('Intern-Throwaway-4'), 'added teacher: password not stored in plaintext');
  assert.strictEqual((await Store.verifyTeacherLogin('x_teacher@example.com', 'Intern-Throwaway-4')).success, true);
  assert(Store.getTeachersList().every(t => !('secret' in t)), 'no teacher record has a plaintext secret');

  // 6. demo students only in dev mode, with a code that is not the teacher password
  const saved = process.env.USE_SAMPLE_DATA;
  process.env.USE_SAMPLE_DATA = '0';
  assert.strictEqual(Store.isDevMode(), false);
  assert.strictEqual(Store.getTestStudent('00000'), null, 'demo student disabled outside dev mode');
  assert.strictEqual(Store.isTestStudentSecretValid('demo-dev-only'), false, 'demo PIN refused outside dev mode');
  process.env.USE_SAMPLE_DATA = '1';
  assert.strictEqual(Store.isDevMode(), true);
  assert(Store.getTestStudent('00000'));
  assert.strictEqual(Store.isTestStudentSecretValid('demo-dev-only'), true);
  assert.strictEqual(Store.isTestStudentSecretValid(TMP_PW), false);
  assert(!(await Store.verifySecretStrong('demo-dev-only', def.secretHash)), 'demo PIN differs from teacher password');
  if (saved === undefined) delete process.env.USE_SAMPLE_DATA; else process.env.USE_SAMPLE_DATA = saved;

  // 7. no plaintext teacher password anywhere in the tree (checked by hash, not by literal)
  const skipDirs = new Set(['.git', 'node_modules', '_site', '_private', '__pycache__']);
  const skipFiles = new Set(['students.js']);
  const cands = new Set();
  (function walk(d) {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      if (skipDirs.has(n.name) || skipFiles.has(n.name)) continue;
      const p = path.join(d, n.name);
      if (n.isDirectory()) walk(p);
      else if (/\.(js|html|md|txt|py|json|yml|yaml|ps1|sh|css|csv|gs|bat|cmd)$/i.test(n.name) && fs.statSync(p).size < 5e6) {
        const t = fs.readFileSync(p, 'utf8');
        for (const m of t.matchAll(/(?<![A-Za-z0-9])[A-Za-z0-9]{5,12}(?![A-Za-z0-9])/g)) {
          if (/[A-Za-z]/.test(m[0]) && /\d/.test(m[0])) cands.add(m[0]);
        }
      }
    }
  })(ROOT);
  let leaked = null;
  for (const w of cands) {
    if (await Store.verifySecretStrong(w, def.secretHash)) { leaked = true; break; }
  }
  assert(!leaked, 'teacher password must not appear as a plain word anywhere in the project tree');
  console.log('password security tests passed (' + cands.size + ' candidate words scanned)');
})().catch(e => { console.error(e); process.exit(1); });
