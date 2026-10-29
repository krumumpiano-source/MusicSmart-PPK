// MusicSmart PPK • Cloudflare Worker API (D1)
// ทำงานบน Cloudflare Workers แผนฟรี (ไม่ต้องใช้บัตรเครดิต) ฐานข้อมูลคือ D1 (ผูกชื่อ DB)
// Secrets ที่ต้องตั้งค่า (ไม่เก็บในโค้ด):
//   SESSION_SECRET   คีย์เซ็นโทเค็นล็อกอิน
//   PASSWORD_PEPPER  คีย์ลับผสมก่อนแฮชรหัสผ่าน/PIN (ถ้าฐานข้อมูลหลุด ยังไม่สามารถไล่แฮชได้โดยไม่มีคีย์นี้)
//   LEGACY_PIN_PEPPER  PIN_PEPPER จาก Apps Script ใช้ตรวจ PIN เดิมของนักเรียนตอนย้ายข้อมูล (ลบได้หลังอัปเกรดครบ)
//   SETUP_TOKEN      รหัสใช้ครั้งเดียวสำหรับตั้งรหัสผ่านครูครั้งแรก (ใช้แล้วจะปิดตัวเองอัตโนมัติ)

const PW_SCHEME = 'hmac-sha256-v1';
const TEACHER_TTL_SEC = 8 * 3600;
const STUDENT_TTL_SEC = 12 * 3600;
const LOCK_WINDOW_SEC = 15 * 60;
const LOCK_MAX_FAILS = 5;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_SESSION_BYTES = 200 * 1024;
const MAX_SYNC_OPS = 200;
const MAX_SYNC_OPS_PER_CALL = 15;
const MAX_BATCH_ITEMS = 100;
const MIN_TEACHER_PASSWORD = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function bad(message, code = 'invalid_input') {
  return new HttpError(400, code, message);
}

function nowIso() {
  return new Date().toISOString();
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ---------- ยูทิลิตี้ encode / crypto ----------

function bytesToB64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function strToB64url(str) {
  return bytesToB64url(enc.encode(str));
}

function b64urlToStr(str) {
  return dec.decode(b64urlToBytes(str));
}

function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

async function hmacBytes(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

function safeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function safeEqualStr(a, b) {
  return safeEqualBytes(enc.encode(String(a)), enc.encode(String(b)));
}

// ---------- แฮชรหัสผ่าน / PIN ----------

async function hashSecret(env, secret) {
  const salt = bytesToB64url(randomBytes(16));
  const digest = await hmacBytes(env.PASSWORD_PEPPER, salt + '|' + secret);
  return `${PW_SCHEME}$${salt}$${bytesToB64url(digest)}`;
}

async function verifySecret(env, stored, secret) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== PW_SCHEME) return false;
  const digest = await hmacBytes(env.PASSWORD_PEPPER, parts[1] + '|' + secret);
  return safeEqualBytes(digest, b64urlToBytes(parts[2]));
}

// ---------- โทเค็นล็อกอิน (HMAC-signed, มีวันหมดอายุ) ----------

async function signToken(env, payload) {
  const body = strToB64url(JSON.stringify(payload));
  const sig = bytesToB64url(await hmacBytes(env.SESSION_SECRET, body));
  return `${body}.${sig}`;
}

async function verifyToken(env, token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expected = await hmacBytes(env.SESSION_SECRET, body);
    if (!safeEqualBytes(expected, b64urlToBytes(sig))) return null;
    const p = JSON.parse(b64urlToStr(body));
    if (typeof p.exp !== 'number' || p.exp < nowSec()) return null;
    return p;
  } catch {
    return null;
  }
}

async function requireAuth(request, env, roles) {
  const m = /^Bearer\s+(\S+)$/.exec(request.headers.get('Authorization') || '');
  const p = m ? await verifyToken(env, m[1]) : null;
  if (!p) throw new HttpError(401, 'unauthorized', 'ต้องเข้าสู่ระบบใหม่');
  if (roles && !roles.includes(p.role)) throw new HttpError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
  return p;
}

function requireRole(auth, role) {
  if (auth.role !== role) throw new HttpError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
}

// ---------- ตรวจสอบข้อมูลนำเข้า ----------

function reqStr(v, name, max) {
  if (typeof v !== 'string') throw bad(`${name} ต้องเป็นข้อความ`);
  const s = v.trim();
  if (!s) throw bad(`กรุณากรอก ${name}`);
  if (s.length > max) throw bad(`${name} ยาวเกินไป`);
  return s;
}

// ข้อความไม่บังคับ: ว่าง/ไม่มี = null, ตัดให้ไม่เกิน max ตัวอักษร
function optText(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
}

function optInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw bad('ตัวเลขไม่ถูกต้อง');
  return n;
}

function normSid(v) {
  const s = String(v ?? '').trim();
  if (!/^[A-Za-z0-9._-]{1,20}$/.test(s)) throw bad('รหัสนักเรียนไม่ถูกต้อง', 'bad_student_id');
  return s;
}

function normEmail(v) {
  const s = reqStr(v, 'อีเมล', 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('รูปแบบอีเมลไม่ถูกต้อง');
  return s;
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ลิงก์วิดีโอที่นักเรียนส่ง: ต้องเป็น https และไม่มีรหัสผ่านฝังอยู่ในลิงก์
function validateVideoUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s.length > 500) throw bad('กรุณาวางลิงก์วิดีโอ (ไม่เกิน 500 ตัวอักษร)', 'invalid_url');
  let u;
  try {
    u = new URL(s);
  } catch {
    throw bad('ลิงก์วิดีโอไม่ถูกต้อง', 'invalid_url');
  }
  if (u.protocol !== 'https:') throw bad('ลิงก์วิดีโอต้องขึ้นต้นด้วย https://', 'invalid_url');
  if (u.username || u.password) throw bad('ลิงก์ห้ามมีชื่อผู้ใช้/รหัสผ่านฝังอยู่', 'invalid_url');
  return u.toString();
}

async function readJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'ข้อมูลใหญ่เกินไป');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'ข้อมูลใหญ่เกินไป');
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    return isPlainObject(v) ? v : {};
  } catch {
    throw bad('รูปแบบ JSON ไม่ถูกต้อง', 'bad_json');
  }
}

// ---------- บันทึกล็อก + กันเดารหัส ----------

async function audit(env, actor, action, target = '') {
  await env.DB.prepare('INSERT INTO audit_log (actor, action, target, created_at) VALUES (?, ?, ?, ?)')
    .bind(actor, action, target, nowIso())
    .run();
}

async function isLocked(env, actor) {
  const since = new Date(Date.now() - LOCK_WINDOW_SEC * 1000).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM audit_log WHERE actor = ? AND action = 'login_fail' AND created_at >= ?"
  )
    .bind(actor, since)
    .first();
  return (row?.n || 0) >= LOCK_MAX_FAILS;
}

// ---------- การตอบกลับ ----------

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (u.protocol === 'https:' && u.hostname.endsWith('.github.io')) return true;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    return false;
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

// ---------- ยืนยันตัวตนครู ----------

// ตั้งรหัสผ่านครูครั้งแรก (แทนรหัส PBKDF2 เดิมที่ Worker แผนฟรีคำนวณไม่ไหว)
// ใช้ได้ครั้งเดียว: เมื่อมีบัญชีครูแบบใหม่แล้วจะปฏิเสธทันที
async function authSetup(request, env) {
  const b = await readJson(request);
  if (!env.SETUP_TOKEN || !safeEqualStr(String(b.setupToken ?? ''), env.SETUP_TOKEN)) {
    throw new HttpError(403, 'forbidden', 'รหัสตั้งค่าไม่ถูกต้อง');
  }
  const existing = await env.DB.prepare('SELECT COUNT(*) AS n FROM teachers WHERE auth_scheme = ?')
    .bind(PW_SCHEME)
    .first();
  if ((existing?.n || 0) > 0) throw new HttpError(409, 'already_setup', 'ตั้งค่าบัญชีครูแล้ว');

  const email = normEmail(b.email);
  const name = reqStr(b.name ?? 'ครูผู้สอน', 'ชื่อ', 100);
  const password = String(b.password ?? '');
  if (password.length < MIN_TEACHER_PASSWORD || password.length > 200) {
    throw bad(`รหัสผ่านต้องมีอย่างน้อย ${MIN_TEACHER_PASSWORD} ตัวอักษร`, 'weak_password');
  }
  // ลบบัญชีรูปแบบเก่าที่ใช้ไม่ได้แล้ว แล้วบันทึกบัญชีใหม่
  await env.DB.prepare('DELETE FROM teachers WHERE auth_scheme <> ?').bind(PW_SCHEME).run();
  const hash = await hashSecret(env, password);
  await env.DB.prepare(
    'INSERT INTO teachers (email, name, auth_scheme, auth_hash, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(email, name, PW_SCHEME, hash, nowIso())
    .run();
  await audit(env, 'setup', 'teacher_setup', email);
  return json({ ok: true });
}

async function authLogin(request, env) {
  const b = await readJson(request);
  const email = normEmail(b.email);
  const password = String(b.password ?? '');
  const actor = 'login:' + email;
  if (await isLocked(env, actor)) {
    throw new HttpError(429, 'locked', 'ผิดพลาดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่');
  }
  const row = await env.DB.prepare('SELECT * FROM teachers WHERE email = ? AND auth_scheme = ?')
    .bind(email, PW_SCHEME)
    .first();
  const ok = row ? await verifySecret(env, row.auth_hash, password) : false;
  if (!ok) {
    await audit(env, actor, 'login_fail');
    throw new HttpError(401, 'invalid_credentials', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
  await audit(env, actor, 'login_ok');
  const token = await signToken(env, {
    sub: 'teacher:' + email,
    role: 'teacher',
    exp: nowSec() + TEACHER_TTL_SEC
  });
  return json({ token, role: 'teacher', name: row.name, expires_in: TEACHER_TTL_SEC });
}

// ---------- ยืนยันตัวตนนักเรียน (รหัสนักเรียน + PIN 6 หลัก) ----------

// ---------- PIN เดิมจาก Google Sheet (ย้ายแฮชมาใช้ต่อ) ----------
// สูตรเดิมของ google_apps_script.js: value = salt:sid:pin:PIN_PEPPER, แฮช SHA-256 ซ้ำ 100 รอบ (ต่อ hex เป็นอินพุตรอบถัดไป)
const LEGACY_PIN_SCHEME = 'gas-sha256x100';

async function legacyPinHash(env, sid, pin, salt) {
  const value = `${salt}:${sid}:${pin}:${env.LEGACY_PIN_PEPPER}`;
  let h = '';
  for (let i = 0; i < 100; i++) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(h + value));
    h = Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return h;
}

// ตรวจ PIN: ถ้าเป็นแฮชเดิมจาก GAS จะตรวจด้วยสูตรเดิม แล้วอัปเกรดเป็นสูตรใหม่ทันทีที่ล็อกอินสำเร็จ
async function verifyStudentPin(env, s, sid, pin) {
  if (s.pin_scheme !== LEGACY_PIN_SCHEME) return verifySecret(env, s.pin_hash, pin);
  if (!env.LEGACY_PIN_PEPPER || !s.pin_salt) return false;
  const h = await legacyPinHash(env, sid, pin, s.pin_salt);
  if (!safeEqualStr(h, String(s.pin_hash))) return false;
  const now = nowIso();
  const upgraded = await hashSecret(env, pin);
  await env.DB.prepare(
    'UPDATE students SET pin_hash = ?, pin_scheme = NULL, pin_salt = NULL, pin_updated_at = ?, updated_at = ? WHERE student_id = ? AND pin_scheme = ?'
  )
    .bind(upgraded, now, now, sid, LEGACY_PIN_SCHEME)
    .run();
  await audit(env, 'pin:' + sid, 'pin_upgraded');
  return true;
}

function publicStudent(s) {
  return {
    student_id: s.student_id,
    class_name: s.class_name,
    no: s.no,
    prefix: s.prefix,
    first_name: s.first_name,
    last_name: s.last_name,
    nickname: s.nickname
  };
}

async function studentLogin(request, env) {
  const b = await readJson(request);
  const sid = normSid(b.student_id);
  const pin = String(b.pin ?? '');
  if (!/^\d{6}$/.test(pin)) throw bad('รหัส PIN ต้องเป็นตัวเลข 6 หลัก', 'bad_pin');
  const actor = 'pin:' + sid;
  if (await isLocked(env, actor)) {
    throw new HttpError(429, 'locked', 'ผิดพลาดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่');
  }
  const s = await env.DB.prepare('SELECT * FROM students WHERE student_id = ?').bind(sid).first();
  if (!s || s.status !== 'active') {
    await audit(env, actor, 'login_fail');
    throw new HttpError(401, 'invalid_credentials', 'รหัสนักเรียนหรือ PIN ไม่ถูกต้อง');
  }

  let created = false;
  if (!s.pin_hash) {
    // ครั้งแรก: ตั้ง PIN ใหม่ (เหมือนพฤติกรรมเดิมของระบบ)
    const h = await hashSecret(env, pin);
    const now = nowIso();
    const r = await env.DB.prepare(
      'UPDATE students SET pin_hash = ?, pin_scheme = NULL, pin_salt = NULL, pin_updated_at = ?, updated_at = ? WHERE student_id = ? AND pin_hash IS NULL'
    )
      .bind(h, now, now, sid)
      .run();
    if (r.meta.changes !== 1) throw new HttpError(409, 'retry', 'กรุณาลองใหม่อีกครั้ง');
    created = true;
    await audit(env, actor, 'pin_set');
  } else {
    const ok = await verifyStudentPin(env, s, sid, pin);
    if (!ok) {
      await audit(env, actor, 'login_fail');
      throw new HttpError(401, 'invalid_credentials', 'รหัสนักเรียนหรือ PIN ไม่ถูกต้อง');
    }
  }
  await audit(env, actor, 'login_ok');
  const token = await signToken(env, {
    sub: 'student:' + sid,
    role: 'student',
    sid,
    class_name: s.class_name,
    exp: nowSec() + STUDENT_TTL_SEC
  });
  return json({
    token,
    role: 'student',
    pin_created: created,
    student: publicStudent(s),
    expires_in: STUDENT_TTL_SEC
  });
}

// ค้นหาชื่อจากเลขประจำตัว (ก่อนกรอก PIN) จำกัดจำนวนครั้งต่อ IP กันการไล่เลขรายชื่อ
const LOOKUP_WINDOW_SEC = 15 * 60;
const LOOKUP_MAX_PER_WINDOW = 60;

async function studentLookup(request, env) {
  const b = await readJson(request);
  const sid = normSid(b.student_id);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const actor = 'lookup:' + ip;
  const since = new Date(Date.now() - LOOKUP_WINDOW_SEC * 1000).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM audit_log WHERE actor = ? AND action = 'lookup' AND created_at >= ?"
  )
    .bind(actor, since)
    .first();
  if ((row?.n || 0) >= LOOKUP_MAX_PER_WINDOW) {
    throw new HttpError(429, 'rate_limited', 'ค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
  }
  await audit(env, actor, 'lookup');
  const s = await env.DB.prepare('SELECT * FROM students WHERE student_id = ?').bind(sid).first();
  if (!s || s.status !== 'active') throw new HttpError(404, 'not_found', 'ไม่พบเลขประจำตัวนี้ในระบบ');
  // ซ่อนชื่อเหมือนระบบเดิม (อักษรตัวแรก + •••) ชื่อเต็มจะส่งหลังล็อกอินสำเร็จเท่านั้น
  const first = String(s.first_name || '');
  return json({
    student: { student_id: s.student_id, class_name: s.class_name, display_name: (first ? first.charAt(0) : '') + '•••' },
    has_pin: !!s.pin_hash,
    locked: await isLocked(env, 'pin:' + sid)
  });
}

// ---------- รายชื่อนักเรียน (ครู) ----------

async function listStudents(env, url) {
  const cls = url.searchParams.get('class');
  const stmt = cls
    ? env.DB.prepare(
        'SELECT student_id, class_name, no, prefix, first_name, last_name, nickname, status, (pin_hash IS NOT NULL) AS has_pin FROM students WHERE class_name = ? ORDER BY no'
      ).bind(cls)
    : env.DB.prepare(
        'SELECT student_id, class_name, no, prefix, first_name, last_name, nickname, status, (pin_hash IS NOT NULL) AS has_pin FROM students ORDER BY class_name, no'
      );
  const { results } = await stmt.all();
  return json({ students: results });
}

async function resetPin(env, auth, sid) {
  const r = await env.DB.prepare(
    'UPDATE students SET pin_hash = NULL, pin_scheme = NULL, pin_salt = NULL, pin_updated_at = NULL, updated_at = ? WHERE student_id = ?'
  )
    .bind(nowIso(), sid)
    .run();
  if (r.meta.changes !== 1) throw new HttpError(404, 'not_found', 'ไม่พบนักเรียน');
  await audit(env, auth.sub, 'pin_reset', sid);
  return json({ ok: true });
}

// ---------- บันทึกคาบเรียน (เก็บเป็น JSON ต่อคาบ พร้อมตรวจเวอร์ชัน) ----------

function rowToSession(r) {
  let data = {};
  try {
    data = JSON.parse(r.data);
  } catch {
    data = {};
  }
  return { ...r, data };
}

async function putSession(env, auth, p) {
  const key = reqStr(p.session_key, 'session_key', 200);
  const className = reqStr(p.class_name, 'class_name', 60);
  const period = optInt(p.period);
  if (!isPlainObject(p.data)) throw bad('data ต้องเป็นออบเจ็กต์');
  const dataStr = JSON.stringify(p.data);
  if (dataStr.length > MAX_SESSION_BYTES) throw new HttpError(413, 'too_large', 'ข้อมูลคาบเรียนใหญ่เกินไป');
  const base = Number.isInteger(p.base_version) ? p.base_version : null;
  if (base === null || base < 0) throw bad('ต้องระบุ base_version');
  const now = nowIso();

  if (base === 0) {
    const r = await env.DB.prepare(
      'INSERT OR IGNORE INTO sessions (session_key, class_name, period, data, version, updated_at, updated_by) VALUES (?, ?, ?, ?, 1, ?, ?)'
    )
      .bind(key, className, period, dataStr, now, auth.sub)
      .run();
    if (r.meta.changes === 1) return { ok: true, version: 1 };
  } else {
    const r = await env.DB.prepare(
      'UPDATE sessions SET class_name = ?, period = ?, data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE session_key = ? AND version = ?'
    )
      .bind(className, period, dataStr, now, auth.sub, key, base)
      .run();
    if (r.meta.changes === 1) return { ok: true, version: base + 1 };
  }
  const cur = await env.DB.prepare('SELECT version FROM sessions WHERE session_key = ?').bind(key).first();
  return { conflict: true, current_version: cur ? cur.version : 0 };
}

async function listSessions(env, url) {
  const cls = url.searchParams.get('class');
  const stmt = cls
    ? env.DB.prepare('SELECT * FROM sessions WHERE class_name = ? ORDER BY session_key').bind(cls)
    : env.DB.prepare('SELECT * FROM sessions ORDER BY session_key');
  const { results } = await stmt.all();
  return json({ sessions: results.map(rowToSession) });
}

// ---------- การส่งงาน (ลิงก์วิดีโอ) ----------

async function putSubmission(env, auth, p) {
  const sid = auth.role === 'student' ? auth.sid : normSid(p.student_id);
  const st = await env.DB.prepare('SELECT student_id, class_name FROM students WHERE student_id = ? AND status = ?')
    .bind(sid, 'active')
    .first();
  if (!st) throw new HttpError(404, 'not_found', 'ไม่พบนักเรียน');
  const assignment = reqStr(p.assignment_key, 'assignment_key', 120);
  const clip = p.clip_no === undefined || p.clip_no === null ? 1 : p.clip_no;
  if (!Number.isInteger(clip) || clip < 1 || clip > 20) throw bad('clip_no ต้องเป็นตัวเลข 1-20');
  const group = optInt(p.group_no);
  const period = optInt(p.period);
  const url = validateVideoUrl(p.video_url);
  const title = optText(p.title, 200);
  const note = optText(p.note, 5000);
  const subType = optText(p.submission_type, 60);
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO submissions (id, student_id, class_name, period, assignment_key, group_no, clip_no, video_url, title, note, submission_type, link_status, submitted_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unchecked', ?, ?)
     ON CONFLICT (student_id, assignment_key, clip_no) DO UPDATE SET
       video_url = excluded.video_url,
       title = excluded.title,
       note = excluded.note,
       submission_type = excluded.submission_type,
       link_status = 'unchecked',
       submitted_at = excluded.submitted_at,
       updated_at = excluded.updated_at`
  )
    .bind(crypto.randomUUID(), st.student_id, st.class_name, period, assignment, group, clip, url, title, note, subType, now, now)
    .run();
  const row = await env.DB.prepare(
    'SELECT * FROM submissions WHERE student_id = ? AND assignment_key = ? AND clip_no = ?'
  )
    .bind(st.student_id, assignment, clip)
    .first();
  return { ok: true, submission: row };
}

async function listSubmissions(env, url) {
  const cls = url.searchParams.get('class');
  const assignment = url.searchParams.get('assignment');
  let sql = 'SELECT * FROM submissions WHERE 1=1';
  const params = [];
  if (cls) {
    sql += ' AND class_name = ?';
    params.push(cls);
  }
  if (assignment) {
    sql += ' AND assignment_key = ?';
    params.push(assignment);
  }
  sql += ' ORDER BY class_name, student_id, assignment_key, clip_no';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ submissions: results });
}

async function patchSubmission(env, id, p) {
  const fields = [];
  const vals = [];
  if ('score' in p) {
    if (p.score !== null && (typeof p.score !== 'number' || !Number.isFinite(p.score) || p.score < 0 || p.score > 100)) {
      throw bad('คะแนนต้องอยู่ระหว่าง 0-100');
    }
    fields.push('score = ?');
    vals.push(p.score);
  }
  if ('feedback' in p) {
    fields.push('feedback = ?');
    vals.push(String(p.feedback ?? '').slice(0, 2000));
  }
  if ('link_status' in p) {
    if (!['unchecked', 'ok', 'invalid'].includes(p.link_status)) throw bad('link_status ไม่ถูกต้อง');
    fields.push('link_status = ?');
    vals.push(p.link_status);
  }
  if (!fields.length) throw bad('ไม่มีข้อมูลที่จะแก้ไข');
  fields.push('updated_at = ?');
  vals.push(nowIso());
  vals.push(id);
  const r = await env.DB.prepare(`UPDATE submissions SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  if (r.meta.changes !== 1) throw new HttpError(404, 'not_found', 'ไม่พบรายการส่งงาน');
  return env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
}

// ตรวจว่าลิงก์เปิดได้จริงหรือไม่ (HEAD ก่อน ถ้าไม่ได้ลอง GET ช่วงข้อมูลสั้น ๆ)
async function checkLink(env, id) {
  const row = await env.DB.prepare('SELECT video_url FROM submissions WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'not_found', 'ไม่พบรายการส่งงาน');
  let httpStatus = 0;
  let ok = false;
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(row.video_url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
        headers:
          method === 'GET'
            ? { Range: 'bytes=0-0', 'User-Agent': 'MusicSmart-LinkCheck/1.0' }
            : { 'User-Agent': 'MusicSmart-LinkCheck/1.0' }
      });
      httpStatus = res.status;
      try {
        await res.body?.cancel();
      } catch {
        // ไม่ต้องทำอะไรเพิ่ม
      }
      if (res.status < 400) {
        ok = true;
        break;
      }
    } catch {
      httpStatus = 0;
    }
  }
  const linkStatus = ok ? 'ok' : 'invalid';
  await env.DB.prepare('UPDATE submissions SET link_status = ?, updated_at = ? WHERE id = ?')
    .bind(linkStatus, nowIso(), id)
    .run();
  return { link_status: linkStatus, http_status: httpStatus };
}

async function mySubmissions(env, auth) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM submissions WHERE student_id = ? ORDER BY assignment_key, clip_no'
  )
    .bind(auth.sid)
    .all();
  return json({ submissions: results });
}

// ---------- งานวิจัย CAR ----------

function researchStmt(env, p) {
  const className = reqStr(p.class_name, 'class_name', 60);
  const sid = normSid(p.student_id);
  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw bad('คะแนนต้องอยู่ระหว่าง 0-100');
    return n;
  };
  return env.DB.prepare(
    `INSERT INTO research_scores (class_name, student_id, pre, post, formative, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (class_name, student_id) DO UPDATE SET
       pre = excluded.pre, post = excluded.post, formative = excluded.formative, updated_at = excluded.updated_at`
  ).bind(className, sid, num(p.pre), num(p.post), num(p.formative), nowIso());
}

async function putResearch(env, p) {
  await researchStmt(env, p).run();
  return { ok: true };
}

async function listResearch(env, url) {
  const cls = url.searchParams.get('class');
  const stmt = cls
    ? env.DB.prepare('SELECT * FROM research_scores WHERE class_name = ?').bind(cls)
    : env.DB.prepare('SELECT * FROM research_scores');
  const { results } = await stmt.all();
  return json({ research: results });
}

// ---------- ส่งข้อมูลจากคิวออฟไลน์ (idempotent) ----------

async function applyOp(env, auth, op) {
  const payload = isPlainObject(op.payload) ? op.payload : {};
  switch (op.kind) {
    case 'session.put':
      requireRole(auth, 'teacher');
      return putSession(env, auth, payload);
    case 'submission.put':
      return putSubmission(env, auth, payload);
    case 'research.put':
      requireRole(auth, 'teacher');
      return putResearch(env, payload);
    default:
      throw bad('ไม่รู้จักประเภทข้อมูล: ' + String(op.kind), 'unknown_kind');
  }
}

async function syncOps(request, env) {
  const auth = await requireAuth(request, env, ['teacher', 'student']);
  const b = await readJson(request);
  if (!Array.isArray(b.ops)) throw bad('ต้องส่ง ops เป็นรายการ');
  if (b.ops.length > MAX_SYNC_OPS_PER_CALL) throw bad(`ส่งครั้งละไม่เกิน ${MAX_SYNC_OPS_PER_CALL} รายการ`);

  const results = [];
  for (const op of b.ops) {
    const opId = typeof op?.op_id === 'string' ? op.op_id.slice(0, 100) : '';
    if (!opId) {
      results.push({ op_id: null, status: 'error', message: 'ไม่มี op_id' });
      continue;
    }
    const seen = await env.DB.prepare('SELECT 1 AS x FROM sync_ops WHERE op_id = ?').bind(opId).first();
    if (seen) {
      results.push({ op_id: opId, status: 'duplicate' });
      continue;
    }
    try {
      const r = await applyOp(env, auth, op);
      if (r && r.conflict) {
        // ไม่บันทึก op_id เพื่อให้ฝั่งแอปนำไปให้ครูตัดสินใจเองได้
        results.push({ op_id: opId, status: 'conflict', current_version: r.current_version });
        continue;
      }
      await env.DB.prepare('INSERT OR IGNORE INTO sync_ops (op_id, kind, created_at) VALUES (?, ?, ?)')
        .bind(opId, String(op.kind), nowIso())
        .run();
      results.push({ op_id: opId, status: 'applied' });
    } catch (e) {
      if (e instanceof HttpError) {
        results.push({ op_id: opId, status: 'error', code: e.code, message: e.message });
      } else {
        throw e;
      }
    }
  }
  return json({ results });
}

// ---------- วันกำหนดส่งงานรายคาบ ----------

function validPeriod(v) {
  const n = optInt(v);
  if (n === null || n < 1 || n > 40) throw bad('คาบเรียนต้องอยู่ระหว่าง 1-40', 'bad_period');
  return n;
}

function dueDateStmt(env, p) {
  const className = reqStr(p.class_name, 'class_name', 60);
  const period = validPeriod(p.period);
  const dueRaw = p.due_at === undefined || p.due_at === null ? '' : String(p.due_at).trim();
  if (!dueRaw) {
    return env.DB.prepare('DELETE FROM due_dates WHERE class_name = ? AND period = ?').bind(className, period);
  }
  const ms = Date.parse(dueRaw);
  if (!Number.isFinite(ms)) throw bad('due_at ไม่ถูกต้อง', 'bad_due');
  return env.DB.prepare(
    `INSERT INTO due_dates (class_name, period, due_at, title, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (class_name, period) DO UPDATE SET
       due_at = excluded.due_at, title = excluded.title, updated_at = excluded.updated_at`
  ).bind(className, period, new Date(ms).toISOString(), optText(p.title, 200), nowIso());
}

async function setDueDate(env, p) {
  await dueDateStmt(env, p).run();
  return { ok: true };
}

// ค้นหาค่าที่มีอยู่แล้วทีละไม่เกิน 90 ค่า (D1 จำกัด 100 พารามิเตอร์ต่อ query); table/col เป็นค่าคงที่ภายในเท่านั้น
async function existingValues(env, table, col, values) {
  const out = new Map();
  const uniq = [...new Set(values)];
  for (let i = 0; i < uniq.length; i += 90) {
    const chunk = uniq.slice(i, i + 90);
    const { results } = await env.DB.prepare(
      `SELECT * FROM ${table} WHERE ${col} IN (${chunk.map(() => '?').join(',')})`
    )
      .bind(...chunk)
      .all();
    results.forEach((r) => out.set(r[col], r));
  }
  return out;
}

// แผนฟรีของ D1 จำกัด 50 query ต่อการเรียก Worker; batch() นับเป็น 1 query
async function runBatch(env, stmts) {
  for (let i = 0; i < stmts.length; i += 500) await env.DB.batch(stmts.slice(i, i + 500));
}

async function listDueDates(env, auth, url) {
  let rows;
  if (auth.role === 'student') {
    rows = await env.DB.prepare('SELECT * FROM due_dates WHERE class_name = ?').bind(auth.class_name || '').all();
  } else {
    const cls = url.searchParams.get('class');
    rows = cls
      ? await env.DB.prepare('SELECT * FROM due_dates WHERE class_name = ?').bind(cls).all()
      : await env.DB.prepare('SELECT * FROM due_dates').all();
  }
  return json({ due_dates: rows.results });
}

// ---------- การแจ้งเตือนจากครูถึงนักเรียน ----------

const NOTICE_KINDS = ['reminder', 'feedback'];

async function postNotices(env, auth, items) {
  if (!Array.isArray(items)) throw bad('items ต้องเป็นรายการ');
  if (items.length > MAX_SYNC_OPS) throw bad(`ส่งครั้งละไม่เกิน ${MAX_SYNC_OPS} รายการ`);
  const errors = [];
  const valid = [];
  for (const it of items) {
    if (!isPlainObject(it)) {
      errors.push('รายการไม่ถูกต้อง');
      continue;
    }
    let sid;
    try {
      sid = normSid(it.studentId ?? it.student_id);
    } catch (e) {
      errors.push('รหัสนักเรียนไม่ถูกต้อง');
      continue;
    }
    const kind = NOTICE_KINDS.includes(it.kind) ? it.kind : null;
    if (!kind) {
      errors.push(`${sid}: kind ไม่ถูกต้อง`);
      continue;
    }
    let score = null;
    if (it.score !== null && it.score !== undefined && it.score !== '') {
      const n = Number(it.score);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        errors.push(`${sid}: คะแนนไม่ถูกต้อง`);
        continue;
      }
      score = n;
    }
    const message = optText(it.message, 2000) || (kind === 'feedback' ? '(ให้คะแนนแล้ว)' : '');
    if (!message) {
      errors.push(`${sid}: ไม่มีข้อความ`);
      continue;
    }
    valid.push({ sid, kind, score, message, ref: optText(it.ref, 120), teacher: optText(it.teacher, 120) || 'คุณครู' });
  }
  const students = await existingValues(env, 'students', 'student_id', valid.map((v) => v.sid));
  const now = nowIso();
  const stmts = [];
  for (const v of valid) {
    const st = students.get(v.sid);
    if (!st) {
      errors.push(`${v.sid}: ไม่พบนักเรียน`);
      continue;
    }
    stmts.push(
      env.DB.prepare(
        `INSERT INTO notices (id, student_id, class_name, ref, kind, message, score, teacher, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), v.sid, st.class_name, v.ref, v.kind, v.message, v.score, v.teacher, now)
    );
  }
  if (stmts.length) await runBatch(env, stmts);
  return { ok: true, posted: stmts.length, errors };
}

async function myNotices(env, auth, url) {
  let sinceMs = Number(url.searchParams.get('since')) || 0;
  if (!Number.isFinite(sinceMs) || sinceMs < 0) sinceMs = 0;
  const { results } = await env.DB.prepare(
    'SELECT * FROM notices WHERE student_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 100'
  )
    .bind(auth.sid, new Date(sinceMs).toISOString())
    .all();
  const notices = results.reverse().map((r) => ({
    id: r.id,
    kind: r.kind,
    ref: r.ref,
    message: r.message,
    score: r.score,
    teacher: r.teacher,
    createdMs: Date.parse(r.created_at)
  }));
  return json({ notices });
}

// ---------- คิวซิงค์ของครู (รับจากแอป แล้วบันทึกให้ครบ) ----------

// รายการที่มีตารางเฉพาะแล้วจะถูกนำไปใช้ทันที ส่วนอื่นเก็บลง sync_archive (idempotent ด้วย id)
// ทั้งหมดเขียนใน batch เดียว เพื่อไม่ให้เกินเพดาน query ต่อการเรียก Worker
async function syncBatch(request, env, auth) {
  const b = await readJson(request);
  if (!Array.isArray(b.items)) throw bad('ต้องส่ง items เป็นรายการ');
  if (b.items.length > MAX_BATCH_ITEMS) throw bad(`ส่งครั้งละไม่เกิน ${MAX_BATCH_ITEMS} รายการ`);
  const ids = b.items.map((it) => (typeof it?.id === 'string' ? it.id.slice(0, 120) : ''));
  const seen = await existingValues(env, 'sync_archive', 'item_id', ids.filter(Boolean));
  const inBatch = new Set();
  const stmts = [];
  const results = [];
  const now = nowIso();
  b.items.forEach((it, i) => {
    const id = ids[i];
    if (!id) {
      results.push({ id: null, status: 'error', message: 'ไม่มี id' });
      return;
    }
    if (seen.has(id) || inBatch.has(id)) {
      results.push({ id, status: 'duplicate' });
      return;
    }
    const type = String(it.type || '').slice(0, 60);
    const data = isPlainObject(it.data) ? it.data : {};
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 100 * 1024) {
      results.push({ id, status: 'error', message: 'ข้อมูลใหญ่เกินไป' });
      return;
    }
    try {
      let status = 'archived';
      if (type === 'set_due_date') {
        stmts.push(dueDateStmt(env, { class_name: data.className, period: data.period, due_at: data.dueAt, title: data.title }));
        status = 'applied';
      } else if (type === 'research_car') {
        stmts.push(
          researchStmt(env, {
            class_name: data.className,
            student_id: data.studentId,
            pre: data.pre,
            post: data.post,
            formative: data.formative
          })
        );
        status = 'applied';
      }
      stmts.push(
        env.DB.prepare(
          'INSERT OR IGNORE INTO sync_archive (item_id, type, data, received_at, received_by) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, type, dataStr, now, auth.sub)
      );
      inBatch.add(id);
      results.push({ id, status });
    } catch (e) {
      if (e instanceof HttpError) results.push({ id, status: 'error', message: e.message });
      else throw e;
    }
  });
  if (stmts.length) await runBatch(env, stmts);
  return json({ results });
}

// ---------- แบบทดสอบรายหน่วย (ตรวจบนเซิร์ฟเวอร์ ไม่ส่งเฉลยให้นักเรียน) ----------

const MAX_PRACTICE_ATTEMPTS = 100;

function validUnit(v) {
  const n = optInt(v);
  if (n === null || n < 1 || n > 40) throw bad('หน่วยการเรียนรู้ไม่ถูกต้อง', 'bad_unit');
  return n;
}

function parseJson(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

async function putQuizBank(env, b) {
  if (!Array.isArray(b.units)) throw bad('ต้องส่ง units เป็นรายการ');
  const stmts = [env.DB.prepare('DELETE FROM quiz_bank')];
  const units = new Set();
  let questions = 0;
  for (const u of b.units) {
    if (!isPlainObject(u)) continue;
    const unitNo = validUnit(u.unit_no);
    const title = optText(u.title, 200);
    const qs = Array.isArray(u.questions) ? u.questions : [];
    qs.forEach((q, i) => {
      if (!isPlainObject(q)) return;
      const id = optText(q.id, 40);
      const correct = optText(q.correct, 4);
      if (!id || !correct) return;
      const choices = (Array.isArray(q.choices) ? q.choices : [])
        .slice(0, 10)
        .map((c) => ({ key: String(c?.key ?? '').slice(0, 4), text: String(c?.text ?? '').slice(0, 500) }));
      stmts.push(
        env.DB.prepare(
          `INSERT OR REPLACE INTO quiz_bank (unit_no, q_id, ord, title, question, choices, correct, explanation, bloom)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(unitNo, id, i, title, String(q.question ?? '').slice(0, 1000), JSON.stringify(choices), correct, optText(q.explanation, 1000), optText(q.bloom, 40))
      );
      units.add(unitNo);
      questions++;
    });
  }
  if (!questions) throw bad('ไม่มีข้อสอบที่มีเฉลย');
  // batch เดียว = แทนที่คลังทั้งหมดแบบ all-or-nothing
  await env.DB.batch(stmts);
  return { status: 'success', questions, units: units.size };
}

async function quizRows(env, unitNo) {
  const { results } = await env.DB.prepare('SELECT * FROM quiz_bank WHERE unit_no = ? ORDER BY ord').bind(unitNo).all();
  return results;
}

async function getQuiz(env, unitNo) {
  const rows = await quizRows(env, unitNo);
  if (!rows.length) throw new HttpError(404, 'no_quiz', 'ครูยังไม่ได้อัปโหลดแบบทดสอบหน่วยนี้');
  return json({
    unitNo,
    title: rows[0].title || '',
    questions: rows.map((r) => ({ id: r.q_id, question: r.question, bloom: r.bloom || '', choices: parseJson(r.choices, []) }))
  });
}

async function submitQuiz(env, auth, unitNo, b) {
  const clientId = reqStr(b.client_id, 'client_id', 100);
  const practice = !!b.practice;
  if (!isPlainObject(b.answers)) throw bad('answers ต้องเป็นออบเจ็กต์');
  const keys = Object.keys(b.answers);
  if (keys.length > 100) throw bad('คำตอบมากเกินไป');
  for (const k of keys) {
    if (k.length > 40 || String(b.answers[k]).length > 4) throw bad('คำตอบไม่ถูกต้อง');
  }
  const sid = auth.sid;
  const prev = await env.DB.prepare('SELECT * FROM quiz_attempts WHERE student_id = ? AND client_id = ?').bind(sid, clientId).first();
  if (prev) {
    return json({ duplicate: true, score: prev.score, total: prev.total, percentage: prev.percentage, practice: !!prev.practice });
  }
  const rows = await quizRows(env, unitNo);
  if (!rows.length) throw new HttpError(404, 'no_quiz', 'ครูยังไม่ได้อัปโหลดแบบทดสอบหน่วยนี้');
  const c = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM quiz_attempts WHERE student_id = ? AND unit_no = ? AND practice = 0) AS used,
       (SELECT COUNT(*) FROM quiz_attempts WHERE student_id = ? AND unit_no = ? AND practice = 1) AS practiced,
       (SELECT COALESCE(SUM(extra), 0) FROM quiz_grants WHERE student_id = ? AND unit_no = ?) AS extra`
  )
    .bind(sid, unitNo, sid, unitNo, sid, unitNo)
    .first();
  if (!practice && Number(c.used) >= 1 + Number(c.extra)) {
    throw new HttpError(409, 'duplicate_quiz', 'ส่งแบบทดสอบหน่วยนี้ไปแล้ว ไม่สามารถส่งซ้ำได้');
  }
  if (practice && Number(c.practiced) >= MAX_PRACTICE_ATTEMPTS) {
    throw new HttpError(409, 'practice_limit', 'ทำแบบฝึกหน่วยนี้ครบจำนวนครั้งแล้ว');
  }
  let score = 0;
  rows.forEach((r) => {
    if (String(b.answers[r.q_id] ?? '') === r.correct) score++;
  });
  const total = rows.length;
  const percentage = Math.round((score / total) * 100);
  const timeSpent = Math.max(0, Math.min(86400, Math.round(Number(b.time_spent) || 0)));
  await env.DB.prepare(
    `INSERT OR IGNORE INTO quiz_attempts
       (id, student_id, class_name, client_id, unit_no, practice, score, total, percentage, time_spent, answers, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), sid, auth.class_name || null, clientId, unitNo, practice ? 1 : 0, score, total, percentage, timeSpent, JSON.stringify(b.answers), nowIso())
    .run();
  return json({ score, total, percentage, practice, title: rows[0].title || '' });
}

async function listQuizAttempts(env, url) {
  const cls = url.searchParams.get('class');
  const cols = 'id, student_id, class_name, unit_no, score, total, percentage, time_spent, created_at';
  const stmt = cls
    ? env.DB.prepare(`SELECT ${cols} FROM quiz_attempts WHERE practice = 0 AND class_name = ? ORDER BY created_at`).bind(cls)
    : env.DB.prepare(`SELECT ${cols} FROM quiz_attempts WHERE practice = 0 ORDER BY created_at`);
  const { results } = await stmt.all();
  return json({ attempts: results });
}

async function grantQuiz(env, b) {
  const sid = normSid(b.student_id);
  const unitNo = validUnit(b.unit_no);
  const extra = optInt(b.extra ?? 1);
  if (extra === null || extra < 1 || extra > 5) throw bad('จำนวนสิทธิ์เพิ่มต้องอยู่ระหว่าง 1-5');
  await env.DB.prepare(
    `INSERT INTO quiz_grants (student_id, unit_no, extra, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (student_id, unit_no) DO UPDATE SET extra = quiz_grants.extra + excluded.extra, updated_at = excluded.updated_at`
  )
    .bind(sid, unitNo, extra, nowIso())
    .run();
  return { ok: true };
}

// ---------- ห้องสอบกลางภาค/ปลายภาค (สลับข้อ/ตัวเลือกต่อคน ตรวจบนเซิร์ฟเวอร์) ----------

const EXAM_KINDS = ['midterm', 'final'];
const EXAM_KEYS = ['ก', 'ข', 'ค', 'ง', 'จ'];
const EXAM_GRACE_MS = 15000;
const EXAM_MAX_POINTS = 10;
const EXAM_DEFAULT_MINUTES = 25;

function examKind(v) {
  if (!EXAM_KINDS.includes(v)) throw bad('ชนิดข้อสอบไม่ถูกต้อง (midterm/final)', 'bad_kind');
  return v;
}

function toMs(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== '') return n;
  const d = Date.parse(v);
  return Number.isFinite(d) ? d : 0;
}

function shuffle(arr) {
  const a = arr.slice();
  const rnd = new Uint32Array(Math.max(1, a.length));
  crypto.getRandomValues(rnd);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function examLevel(correct, items) {
  const p = items ? correct / items : 0;
  return p >= 0.8 ? 4 : p >= 0.7 ? 3 : p >= 0.5 ? 2 : 1;
}

function examState(s, now) {
  if (s.closed_ms && s.closed_ms <= now) return 'closed';
  if (now < s.open_ms) return 'scheduled';
  if (now < s.close_ms) return 'open';
  return 'ended';
}

function examClose(s) {
  return s.closed_ms ? Math.min(s.close_ms, s.closed_ms) : s.close_ms;
}

async function examBank(env, kind) {
  const { results } = await env.DB.prepare('SELECT q_id, question, choices, correct FROM exam_bank WHERE kind = ? ORDER BY ord').bind(kind).all();
  return results.map((r) => ({ ...r, choices: parseJson(r.choices, []) }));
}

async function putExamBank(env, b) {
  const kind = examKind(b.kind);
  const items = b.items;
  if (!Array.isArray(items) || !items.length) throw bad('ไม่พบข้อสอบ');
  if (items.length > 60) throw bad('ข้อสอบมากเกิน 60 ข้อ', 'too_many');
  const now = Date.now();
  const open = await env.DB.prepare(
    'SELECT 1 AS x FROM exam_sessions WHERE kind = ? AND (closed_ms IS NULL OR closed_ms = 0) AND close_ms > ? LIMIT 1'
  )
    .bind(kind, now)
    .first();
  if (open) throw new HttpError(409, 'session_open', 'มีห้องสอบที่ยังไม่ปิด กรุณาปิดห้องสอบก่อนเปลี่ยนคลังข้อสอบ');
  const seen = new Set();
  const stmts = [env.DB.prepare('DELETE FROM exam_bank WHERE kind = ?').bind(kind)];
  items.forEach((raw, i) => {
    const q = isPlainObject(raw) ? raw : {};
    const id = optText(q.id, 40);
    const text = optText(q.question, 1000);
    const ch = Array.isArray(q.choices) ? q.choices : [];
    if (!id || !text || seen.has(id)) throw bad(`ข้อที่ ${i + 1} ไม่ครบหรือรหัสซ้ำ`);
    if (ch.length < 3 || ch.length > EXAM_KEYS.length) throw bad(`ข้อที่ ${i + 1} ต้องมี 3-5 ตัวเลือก`);
    const texts = ch.map((c) => String(c && c.text !== undefined ? c.text : c ?? '').trim().slice(0, 500));
    const ci = Number(q.correctIndex);
    if (!(Number.isInteger(ci) && ci >= 0 && ci < texts.length) || texts.some((t) => !t)) {
      throw bad(`ข้อที่ ${i + 1} เฉลย/ตัวเลือกไม่ถูกต้อง`);
    }
    seen.add(id);
    stmts.push(
      env.DB.prepare(
        `INSERT INTO exam_bank (kind, q_id, ord, question, choices, correct, explanation, src_period, src_objective, difficulty, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        kind, id, i, text,
        JSON.stringify(texts.map((t, k) => ({ key: EXAM_KEYS[k], text: t }))),
        EXAM_KEYS[ci], optText(q.explanation, 1000), optText(q.srcPeriod, 20), optText(q.srcObjective, 300), optText(q.difficulty, 20), optText(q.status, 60)
      )
    );
  });
  await env.DB.batch(stmts);
  return { kind, items: items.length };
}

async function openExam(env, b) {
  const kind = examKind(b.kind);
  const cls = optText(b.className, 60);
  if (!cls) throw bad('ห้อง/ชนิดข้อสอบไม่ถูกต้อง');
  const now = Date.now();
  const openMs = b.openAt ? toMs(b.openAt) : now;
  const closeMs = toMs(b.closeAt);
  if (!openMs || !closeMs || closeMs <= openMs) throw bad('ช่วงเวลาเปิด-ปิดสอบไม่ถูกต้อง');
  if (closeMs <= now) throw bad('เวลาปิดสอบผ่านไปแล้ว');
  const minutes = Math.max(5, Math.min(180, Math.round(Number(b.durationMin) || EXAM_DEFAULT_MINUTES)));
  const attempts = Math.max(1, Math.min(3, Math.round(Number(b.maxAttempts) || 1)));
  const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM exam_bank WHERE kind = ?').bind(kind).first();
  const items = Number(c.n);
  if (!items) throw new HttpError(409, 'no_bank', 'ยังไม่ได้อัปโหลดคลังข้อสอบชนิดนี้');
  const id = 'EX' + now.toString(36) + crypto.randomUUID().slice(0, 4);
  // ห้อง+ชนิดเดียวกัน เปิดได้ทีละรอบ: ปิดรอบเก่าที่ยังค้าง
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE exam_sessions SET closed_ms = ? WHERE kind = ? AND class_name = ? AND (closed_ms IS NULL OR closed_ms = 0) AND close_ms > ?'
    ).bind(now, kind, cls, now),
    env.DB.prepare(
      `INSERT INTO exam_sessions (session_id, kind, class_name, open_ms, close_ms, duration_min, max_attempts, closed_ms, created_ms, max_points, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    ).bind(id, kind, cls, openMs, closeMs, minutes, attempts, now, EXAM_MAX_POINTS, items)
  ]);
  return { sessionId: id, kind, className: cls, openMs, closeMs, durationMin: minutes, maxAttempts: attempts, items };
}

async function closeExamSession(env, id) {
  const s = await env.DB.prepare('SELECT closed_ms FROM exam_sessions WHERE session_id = ?').bind(id).first();
  if (!s) throw new HttpError(404, 'not_found', 'ไม่พบห้องสอบ');
  let closedMs = s.closed_ms;
  if (!closedMs) {
    closedMs = Date.now();
    await env.DB.prepare('UPDATE exam_sessions SET closed_ms = ? WHERE session_id = ?').bind(closedMs, id).run();
  }
  return { sessionId: id, closedMs };
}

async function listExamSessions(env, url) {
  const now = Date.now();
  const cls = url.searchParams.get('class');
  const sql = `SELECT s.*,
      (SELECT COUNT(*) FROM exam_attempts a WHERE a.session_id = s.session_id AND a.status = 'submitted') AS submitted,
      (SELECT COUNT(*) FROM exam_attempts a WHERE a.session_id = s.session_id AND a.status = 'in_progress') AS in_progress
    FROM exam_sessions s ${cls ? 'WHERE s.class_name = ?' : ''} ORDER BY s.created_ms`;
  const stmt = cls ? env.DB.prepare(sql).bind(cls) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({
    serverNow: now,
    sessions: results.map((s) => ({
      sessionId: s.session_id, kind: s.kind, className: s.class_name, openMs: s.open_ms, closeMs: s.close_ms,
      closedMs: s.closed_ms || 0, durationMin: s.duration_min, maxAttempts: s.max_attempts, items: s.items,
      state: examState(s, now), submitted: Number(s.submitted), inProgress: Number(s.in_progress)
    }))
  });
}

async function examResults(env, url) {
  const where = [];
  const params = [];
  for (const [param, col] of [['kind', 'kind'], ['class', 'class_name'], ['sessionId', 'session_id']]) {
    const v = url.searchParams.get(param);
    if (v) {
      where.push(`${col} = ?`);
      params.push(v);
    }
  }
  const sql = `SELECT * FROM exam_attempts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY started_ms`;
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({
    attempts: results.map((a) => ({
      attemptId: a.attempt_id, sessionId: a.session_id, kind: a.kind, className: a.class_name, studentId: a.student_id,
      name: a.student_name || '', no: a.no, attemptNo: a.attempt_no, startedMs: a.started_ms, submittedMs: a.submitted_ms || 0,
      status: a.status, correct: a.correct, items: a.items, points: a.points, level: a.level, late: !!a.late
    }))
  });
}

async function grantExam(env, b) {
  const sid = normSid(b.studentId ?? b.student_id);
  const extra = Math.max(1, Math.min(2, Math.round(Number(b.extra) || 1)));
  const id = String(b.sessionId || '').slice(0, 60);
  const st = await env.DB.prepare('SELECT class_name FROM students WHERE student_id = ?').bind(sid).first();
  if (!st) throw new HttpError(404, 'not_found', 'ไม่พบนักเรียน');
  const qm = /^(?:quiz_u|u)?(\d+)$/.exec(id) || (!id && b.unitNo ? [null, String(b.unitNo)] : null);
  if (qm) {
    await grantQuiz(env, { student_id: sid, unit_no: Number(qm[1]), extra });
    return { sessionId: 'quiz_u' + Number(qm[1]), studentId: sid, extra };
  }
  const sess = await env.DB.prepare('SELECT class_name FROM exam_sessions WHERE session_id = ?').bind(id).first();
  if (!sess) throw new HttpError(404, 'not_found', 'ไม่พบห้องสอบ');
  if (sess.class_name !== st.class_name) throw new HttpError(409, 'not_in_room', 'นักเรียนไม่อยู่ในห้องที่สอบ');
  await env.DB.prepare('INSERT INTO exam_grants (session_id, student_id, extra, granted_ms) VALUES (?, ?, ?, ?)')
    .bind(id, sid, extra, Date.now())
    .run();
  return { sessionId: id, studentId: sid, extra };
}

// มุมมองของนักเรียน: ห้องสอบที่เปิดอยู่ของห้องตัวเอง (ห้องอื่นไม่เห็น) + ความพยายามที่ผ่านมา
async function examView(env, auth, now) {
  const sess = await env.DB.prepare(
    `SELECT * FROM exam_sessions
     WHERE class_name = ? AND open_ms <= ? AND close_ms > ? AND (closed_ms IS NULL OR closed_ms = 0 OR closed_ms > ?)
     ORDER BY created_ms DESC LIMIT 1`
  )
    .bind(auth.class_name || '', now, now, now)
    .first();
  if (!sess) return { sess: null };
  await env.DB.prepare(
    "UPDATE exam_attempts SET status = 'expired' WHERE session_id = ? AND student_id = ? AND status = 'in_progress' AND deadline_ms + ? < ?"
  )
    .bind(sess.session_id, auth.sid, EXAM_GRACE_MS, now)
    .run();
  const { results: mine } = await env.DB.prepare('SELECT * FROM exam_attempts WHERE session_id = ? AND student_id = ? ORDER BY attempt_no')
    .bind(sess.session_id, auth.sid)
    .all();
  const g = await env.DB.prepare('SELECT COALESCE(SUM(extra), 0) AS extra FROM exam_grants WHERE session_id = ? AND student_id = ?')
    .bind(sess.session_id, auth.sid)
    .first();
  let used = 0;
  let running = null;
  let last = null;
  for (const a of mine) {
    if (a.status === 'in_progress') running = a;
    else used++;
    if (a.status === 'submitted') last = a;
  }
  const allowed = Number(sess.max_attempts) + Number(g.extra);
  return { sess, used, running, last, left: Math.max(0, allowed - used) };
}

async function examStatus(env, auth) {
  const now = Date.now();
  const v = await examView(env, auth, now);
  if (!v.sess) return json({ open: false });
  const live = !!v.running && v.running.deadline_ms > now;
  const r = {
    open: true, kind: v.sess.kind, closeMs: examClose(v.sess), durationMin: v.sess.duration_min, items: v.sess.items,
    attemptsLeft: v.left, canStart: v.left > 0 || live, inProgress: live, serverNow: now
  };
  if (v.last) r.last = { points: v.last.points, maxPoints: v.sess.max_points, correct: v.last.correct, items: v.last.items };
  return json(r);
}

function examQuestions(bank, order) {
  const byId = new Map(bank.map((q) => [q.q_id, q]));
  const out = [];
  for (const o of order) {
    const q = byId.get(o.id);
    if (!q) continue;
    out.push({ id: q.q_id, question: q.question, choices: o.p.map((idx, k) => ({ key: EXAM_KEYS[k], text: String(q.choices[idx]?.text ?? '') })) });
  }
  return out;
}

async function examStart(env, auth) {
  const now = Date.now();
  const v = await examView(env, auth, now);
  if (!v.sess) throw new HttpError(409, 'not_open', 'ยังไม่เปิดสอบ');
  const sess = v.sess;
  const bank = await examBank(env, sess.kind);
  if (!bank.length) throw new HttpError(409, 'not_open', 'ยังไม่เปิดสอบ');
  let att = v.running && v.running.deadline_ms > now ? v.running : null;
  let order = att ? parseJson(att.order_json, null) : null;
  if (!att) {
    if (v.left <= 0) throw new HttpError(409, 'no_attempts', 'ใช้สิทธิ์สอบครบแล้ว');
    order = shuffle(bank).map((q) => ({ id: q.q_id, p: shuffle(q.choices.map((_, k) => k)) }));
    const deadline = Math.min(examClose(sess), now + sess.duration_min * 60000);
    const st = await env.DB.prepare('SELECT prefix, first_name, last_name, no FROM students WHERE student_id = ?').bind(auth.sid).first();
    const name = st ? `${st.prefix || ''}${st.first_name || ''} ${st.last_name || ''}`.trim() : '';
    const attemptId = 'AT' + now.toString(36) + crypto.randomUUID().slice(0, 6);
    await env.DB.prepare(
      `INSERT INTO exam_attempts (attempt_id, session_id, kind, class_name, student_id, student_name, no, attempt_no,
         started_ms, deadline_ms, submitted_ms, status, order_json, correct, items, points, level, late)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'in_progress', ?, NULL, ?, NULL, NULL, 0)`
    )
      .bind(attemptId, sess.session_id, sess.kind, sess.class_name, auth.sid, name, st ? st.no : null, v.used + 1, now, deadline, JSON.stringify(order), order.length)
      .run();
    att = { attempt_id: attemptId, deadline_ms: deadline };
  }
  if (!order) throw new HttpError(500, 'error', 'เริ่มสอบไม่สำเร็จ กรุณาแจ้งครู');
  return json({
    attemptId: att.attempt_id, kind: sess.kind, deadlineMs: att.deadline_ms, serverNow: now,
    items: order.length, maxPoints: sess.max_points, questions: examQuestions(bank, order)
  });
}

async function examSubmit(env, auth, b) {
  const now = Date.now();
  const id = reqStr(b.attemptId, 'attemptId', 60);
  const att = await env.DB.prepare('SELECT * FROM exam_attempts WHERE attempt_id = ? AND student_id = ?').bind(id, auth.sid).first();
  if (!att) throw new HttpError(404, 'bad_attempt', 'ไม่พบการสอบนี้');
  const sess = await env.DB.prepare('SELECT * FROM exam_sessions WHERE session_id = ?').bind(att.session_id).first();
  const maxPts = sess ? sess.max_points : EXAM_MAX_POINTS;
  if (att.status === 'submitted') {
    // ส่งซ้ำ (เครือข่ายสะดุด) = ตอบผลเดิม ไม่ตรวจใหม่
    return json({ submitted: true, correct: att.correct, items: att.items, points: att.points, maxPoints: maxPts, level: att.level, duplicate: true });
  }
  if (att.status !== 'in_progress') throw new HttpError(409, 'closed', 'การสอบครั้งนี้สิ้นสุดแล้ว');
  let limit = att.deadline_ms;
  if (sess) limit = Math.min(limit, examClose(sess));
  if (now > limit + EXAM_GRACE_MS) {
    await env.DB.prepare("UPDATE exam_attempts SET status = 'late_rejected', submitted_ms = ?, late = 1 WHERE attempt_id = ?").bind(now, id).run();
    throw new HttpError(409, 'late', 'หมดเวลาสอบแล้ว ระบบไม่รับคำตอบ');
  }
  const answers = isPlainObject(b.answers) ? b.answers : {};
  if (Object.keys(answers).length > 100) throw bad('คำตอบมากเกินไป');
  const order = parseJson(att.order_json, []);
  const byId = new Map((await examBank(env, att.kind)).map((q) => [q.q_id, q]));
  let correct = 0;
  for (const o of order) {
    const q = byId.get(o.id);
    if (!q) continue;
    const picked = EXAM_KEYS.indexOf(String(answers[o.id] ?? ''));
    if (picked < 0 || picked >= o.p.length) continue;
    if (String(q.choices[o.p[picked]]?.key) === q.correct) correct++;
  }
  const items = order.length;
  const points = items ? Math.round((correct / items) * maxPts * 100) / 100 : 0;
  const level = examLevel(correct, items);
  await env.DB.prepare(
    `UPDATE exam_attempts SET status = 'submitted', submitted_ms = ?, correct = ?, items = ?, points = ?, level = ?, late = ?
     WHERE attempt_id = ? AND status = 'in_progress'`
  )
    .bind(now, correct, items, points, level, now > limit ? 1 : 0, id)
    .run();
  return json({ submitted: true, correct, items, points, maxPoints: maxPts, level });
}

// ---------- เส้นทาง (router) ----------

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = request.method;

  if (path === '/api/health' && m === 'GET') {
    return json({ ok: true, service: 'musicsmart-api', time: nowIso() });
  }
  if (path === '/api/auth/setup' && m === 'POST') return authSetup(request, env);
  if (path === '/api/auth/login' && m === 'POST') return authLogin(request, env);
  if (path === '/api/auth/student' && m === 'POST') return studentLogin(request, env);
  if (path === '/api/auth/student-lookup' && m === 'POST') return studentLookup(request, env);

  if (path === '/api/me' && m === 'GET') {
    const a = await requireAuth(request, env, ['teacher', 'student']);
    return json({ role: a.role, sub: a.sub, class_name: a.class_name || null, student_id: a.sid || null });
  }

  if (path === '/api/students' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listStudents(env, url);
  }
  const rp = /^\/api\/teacher\/students\/([^/]+)\/reset-pin$/.exec(path);
  if (rp && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher']);
    return resetPin(env, a, normSid(decodeURIComponent(rp[1])));
  }

  if (path === '/api/sessions' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listSessions(env, url);
  }
  const sp = /^\/api\/sessions\/([^/]+)$/.exec(path);
  if (sp && m === 'PUT') {
    const a = await requireAuth(request, env, ['teacher']);
    const b = await readJson(request);
    const r = await putSession(env, a, { ...b, session_key: decodeURIComponent(sp[1]) });
    if (r.conflict) {
      return json({ error: 'version_conflict', message: 'ข้อมูลถูกแก้ไขจากที่อื่นแล้ว', current_version: r.current_version }, 409);
    }
    return json(r);
  }

  if (path === '/api/submissions' && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher', 'student']);
    return json(await putSubmission(env, a, await readJson(request)));
  }
  if (path === '/api/submissions' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listSubmissions(env, url);
  }
  if (path === '/api/submissions/mine' && m === 'GET') {
    const a = await requireAuth(request, env, ['student']);
    return mySubmissions(env, a);
  }
  const sub = /^\/api\/submissions\/([^/]+)$/.exec(path);
  if (sub && m === 'PATCH') {
    await requireAuth(request, env, ['teacher']);
    return json({ ok: true, submission: await patchSubmission(env, sub[1], await readJson(request)) });
  }
  const chk = /^\/api\/submissions\/([^/]+)\/check$/.exec(path);
  if (chk && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json({ ok: true, ...(await checkLink(env, chk[1])) });
  }

  if (path === '/api/research' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listResearch(env, url);
  }
  if (path === '/api/research' && m === 'PUT') {
    await requireAuth(request, env, ['teacher']);
    return json(await putResearch(env, await readJson(request)));
  }

  if (path === '/api/sync' && m === 'POST') return syncOps(request, env);

  if (path === '/api/due-dates' && m === 'GET') {
    const a = await requireAuth(request, env, ['teacher', 'student']);
    return listDueDates(env, a, url);
  }
  if (path === '/api/due-dates' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await setDueDate(env, await readJson(request)));
  }
  if (path === '/api/notices' && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher']);
    const b = await readJson(request);
    return json(await postNotices(env, a, b.items));
  }
  if (path === '/api/notices/mine' && m === 'GET') {
    const a = await requireAuth(request, env, ['student']);
    return myNotices(env, a, url);
  }
  if (path === '/api/sync/batch' && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher']);
    return syncBatch(request, env, a);
  }

  const qu = /^\/api\/quiz\/units\/(\d+)$/.exec(path);
  if (qu && m === 'GET') {
    await requireAuth(request, env, ['teacher', 'student']);
    return getQuiz(env, validUnit(qu[1]));
  }
  const qs = /^\/api\/quiz\/units\/(\d+)\/submit$/.exec(path);
  if (qs && m === 'POST') {
    const a = await requireAuth(request, env, ['student']);
    return submitQuiz(env, a, validUnit(qs[1]), await readJson(request));
  }
  if (path === '/api/quiz/bank' && m === 'PUT') {
    await requireAuth(request, env, ['teacher']);
    return json(await putQuizBank(env, await readJson(request)));
  }
  if (path === '/api/quiz/attempts' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listQuizAttempts(env, url);
  }
  if (path === '/api/quiz/grants' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await grantQuiz(env, await readJson(request)));
  }

  if (path === '/api/exams/bank' && m === 'PUT') {
    await requireAuth(request, env, ['teacher']);
    return json(await putExamBank(env, await readJson(request)));
  }
  if (path === '/api/exams/sessions' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listExamSessions(env, url);
  }
  if (path === '/api/exams/sessions' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await openExam(env, await readJson(request)));
  }
  const ec = /^\/api\/exams\/sessions\/([^/]+)\/close$/.exec(path);
  if (ec && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await closeExamSession(env, decodeURIComponent(ec[1]).slice(0, 60)));
  }
  if (path === '/api/exams/results' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return examResults(env, url);
  }
  if (path === '/api/exams/grants' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await grantExam(env, await readJson(request)));
  }
  if (path === '/api/exams/status' && m === 'GET') {
    return examStatus(env, await requireAuth(request, env, ['student']));
  }
  if (path === '/api/exams/start' && m === 'POST') {
    return examStart(env, await requireAuth(request, env, ['student']));
  }
  if (path === '/api/exams/submit' && m === 'POST') {
    const a = await requireAuth(request, env, ['student']);
    return examSubmit(env, a, await readJson(request));
  }

  return json({ error: 'not_found', message: 'ไม่พบเส้นทาง' }, 404);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(request, env);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: e.code, message: e.message }, e.status, cors);
      }
      console.error('server_error', e && e.stack ? e.stack : String(e));
      return json({ error: 'server_error', message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' }, 500, cors);
    }
  }
};
