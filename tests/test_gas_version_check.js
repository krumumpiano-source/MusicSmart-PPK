/* GAS ↔ แอป: เวอร์ชันโค้ด GAS ตรงกับเทมเพลตในแอป · ping รายงานเวอร์ชัน · แอปแจ้ง "ต้องอัปเดต GAS" เมื่อไม่ตรง ·
 * ล็อกเวอร์ชัน: แก้ google_apps_script.js แล้วต้องเปลี่ยน GAS_VERSION (ไม่งั้นทดสอบไม่ผ่าน) · workflow เทมเพลตปลอดภัย (ไม่ trigger เอง)
 * อัปเดตล็อกหลังเปลี่ยนเวอร์ชัน: node tests/test_gas_version_check.js --update-lock */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
const gas = fs.readFileSync(path.join(ROOT, 'google_apps_script.js'), 'utf8').replace(/\r\n/g, '\n');
const mv = /var GAS_VERSION = '([^']+)';/.exec(gas);
const version = mv && mv[1];
const codeHash = crypto.createHash('sha256').update(gas.replace(/var GAS_VERSION = '[^']+';/, 'var GAS_VERSION = \'\';')).digest('hex');
const lockPath = path.join(ROOT, 'tools/curriculum/gas_version.lock.json');
if (process.argv.includes('--update-lock')) {
  const old = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : null;
  if (old && old.codeHash !== codeHash && old.version === version) { console.error('✗ โค้ด GAS เปลี่ยนแต่ GAS_VERSION ยังเป็น ' + version + ' — แก้เลขเวอร์ชันก่อน'); process.exit(1); }
  fs.writeFileSync(lockPath, JSON.stringify({ version, codeHash, note: 'ล็อกเวอร์ชัน GAS: สร้างโดย tests/test_gas_version_check.js --update-lock' }, null, 1) + '\n');
  console.log('อัปเดตล็อกเป็น ' + version); process.exit(0);
}
check('google_apps_script.js มี GAS_VERSION รูปแบบ ปี.เดือน.วัน-ลำดับ', /^\d{4}\.\d{2}\.\d{2}-\d+$/.test(version || ''));
check('ping ส่ง gasVersion กลับ', /action === 'ping'[\s\S]{0,400}gasVersion: GAS_VERSION/.test(gas));
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : null;
check('มีไฟล์ล็อกเวอร์ชัน', !!lock);
check('ถ้าแก้โค้ด GAS ต้องเปลี่ยน GAS_VERSION (แล้วรัน --update-lock)', lock && (lock.codeHash === codeHash ? lock.version === version : false), lock && lock.version === version ? 'โค้ดเปลี่ยนแต่ GAS_VERSION ยังเดิม' : 'รัน node tests/test_gas_version_check.js --update-lock');

// ฝั่งแอป
global.window = global;
const store = {}; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
try { Object.defineProperty(global, 'navigator', { value: { onLine: true }, configurable: true, writable: true }); } catch (e) { /* Node ใหม่: ใช้ navigator ของระบบ */ }
const GS = require(path.join(ROOT, 'app/js/google-sheet-sync.js'));
const G = (typeof GS === 'object' && GS.evaluateGasVersion) ? GS : global.GoogleSheetSync;
check('แอปอ่านเวอร์ชันที่คาดหวังจากเทมเพลตที่ฝัง = เวอร์ชันของไฟล์ GAS', G && G.expectedGasVersion() === version);
const sheetSrc = fs.readFileSync(path.join(ROOT, 'app/js/google-sheet-sync.js'), 'utf8');
check('เทมเพลตที่ฝังมี GAS_VERSION และ gasVersion ใน ping', /var GAS_VERSION = '/.test(G.APPS_SCRIPT_CODE) && /gasVersion: GAS_VERSION/.test(G.APPS_SCRIPT_CODE));
let ev = G.evaluateGasVersion({ gasVersion: version });
check('เวอร์ชันตรง → ok ไม่แจ้งเตือน', ev.ok === true && !/ต้องอัปเดต GAS/.test(ev.message));
ev = G.evaluateGasVersion({ gasVersion: '2020.01.01-1' });
check('เวอร์ชันไม่ตรง → "ต้องอัปเดต GAS" บอกทั้งที่มีอยู่และที่ต้องการ', ev.ok === false && /ต้องอัปเดต GAS/.test(ev.message) && ev.message.indexOf('2020.01.01-1') > 0 && ev.message.indexOf(version) > 0);
ev = G.evaluateGasVersion({ status: 'success' });
check('GAS เก่าที่ไม่รายงานเวอร์ชัน → "ต้องอัปเดต GAS"', ev.ok === false && /ต้องอัปเดต GAS/.test(ev.message) && /เก่า/.test(ev.message));
ev = G.evaluateGasVersion(null);
check('ไม่มีคำตอบ → ถือว่าต้องอัปเดต (ไม่พัง)', ev.ok === false);
// testConnection ผ่านการ postJSON จำลอง
(async () => {
  const orig = G.postJSON;
  G.postJSON = async () => ({ status: 'success', message: 'เชื่อมต่อ Google Sheet สำเร็จ: X' });
  let r = await G.testConnection('https://script.google.com/macros/s/AAA/exec');
  check('testConnection กับ GAS เก่า → success แต่ gasOutdated + ข้อความต้องอัปเดต GAS + บันทึกใน config', r.success && r.gasOutdated === true && /ต้องอัปเดต GAS/.test(r.message) && G.getConfig().gasOutdated === true);
  G.postJSON = async () => ({ status: 'success', message: 'ok', gasVersion: version });
  r = await G.testConnection('https://script.google.com/macros/s/AAA/exec');
  check('testConnection กับ GAS เวอร์ชันตรง → ไม่ outdated และล้างสถานะเตือน', r.success && r.gasOutdated === false && G.getConfig().gasOutdated === false && G.getConfig().gasVersion === version);
  G.postJSON = async () => { throw new Error('offline'); };
  r = await G.testConnection('https://script.google.com/macros/s/AAA/exec');
  check('ต่อไม่ได้ → ล้มเหลวตามปกติ (ไม่ตีความว่าเวอร์ชันผิด)', r.success === false);
  const calls = []; G.postJSON = async () => { calls.push(1); return { gasVersion: version }; };
  G.saveConfig({ webAppUrl: '' }); const none = await G.checkGasVersion();
  check('checkGasVersion ไม่ยิงเครือข่ายเมื่อยังไม่ตั้ง URL', none === null && calls.length === 0);
  G.postJSON = orig;
  check('ป้ายหัวแอปมีข้อความ "ต้องอัปเดต GAS" เมื่อ gasOutdated', /cfg\.gasOutdated[\s\S]{0,120}ต้องอัปเดต GAS/.test(sheetSrc));
  // workflow template + docs
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/gas_deploy.yml.template'), 'utf8');
  check('เทมเพลต workflow: เป็น .template, มี workflow_dispatch อย่างเดียว ไม่มี push/schedule/pull_request trigger', !fs.existsSync(path.join(ROOT, '.github/workflows/gas_deploy.yml')) && /workflow_dispatch:/.test(wf) && !/^\s*(push|schedule|pull_request|pull_request_target|release|workflow_run):/m.test(wf));
  check('เทมเพลต: ต้องพิมพ์ DEPLOY ยืนยัน, ใช้ secrets 3 ตัว, deploy ไป deployment เดิม, ไม่ฉีด input เข้า shell ตรง ๆ', /DEPLOY/.test(wf) && ['GAS_SCRIPT_ID', 'GAS_DEPLOYMENT_ID', 'CLASPRC_JSON'].every(s => wf.indexOf('secrets.' + s) > 0) && /clasp deploy --deploymentId/.test(wf) && !/run:[^\n]*\$\{\{\s*github\.event\.inputs/.test(wf) && /CONFIRM: \$\{\{ github\.event\.inputs\.confirm \}\}/.test(wf));
  check('เทมเพลต: ไม่ฝังค่า secret จริง และลบข้อมูลรับรองท้ายงาน', !/AKfycb[\w-]{10,}/.test(wf) && /rm -f "\$HOME\/\.clasprc\.json"/.test(wf) && /gas\/appsscript\.json/.test(wf));
  check('เทมเพลต: ตรวจ manifest และตรวจการซิงค์เทมเพลตก่อน push', /test -f gas\/appsscript\.json/.test(wf) && /sync_apps_script_template\.py --check/.test(wf));
  const doc = fs.readFileSync(path.join(ROOT, 'docs/GAS_AUTODEPLOY_TH.md'), 'utf8');
  check('คู่มือไทย: มีวิธีมือ + auto + secrets 3 ตัว + คำเตือนห้าม New deployment', ['ต้องอัปเดต GAS', 'GAS_SCRIPT_ID', 'GAS_DEPLOYMENT_ID', 'CLASPRC_JSON', 'ห้ามกด New deployment', 'gas_deploy.yml.template'].every(s => doc.indexOf(s) >= 0));
  const dep = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
  check('workflow deploy เว็บแอปปกติไม่แตะ GAS (ไม่มี clasp)', !/clasp/.test(dep));
  console.log('test_gas_version_check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
