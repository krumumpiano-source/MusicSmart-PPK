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

async function putResearch(env, p) {
  const className = reqStr(p.class_name, 'class_name', 60);
  const sid = normSid(p.student_id);
  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw bad('คะแนนต้องอยู่ระหว่าง 0-100');
    return n;
  };
  await env.DB.prepare(
    `INSERT INTO research_scores (class_name, student_id, pre, post, formative, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (class_name, student_id) DO UPDATE SET
       pre = excluded.pre, post = excluded.post, formative = excluded.formative, updated_at = excluded.updated_at`
  )
    .bind(className, sid, num(p.pre), num(p.post), num(p.formative), nowIso())
    .run();
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
  if (b.ops.length > MAX_SYNC_OPS) throw bad(`ส่งครั้งละไม่เกิน ${MAX_SYNC_OPS} รายการ`);

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

async function setDueDate(env, p) {
  const className = reqStr(p.class_name, 'class_name', 60);
  const period = validPeriod(p.period);
  const dueRaw = p.due_at === undefined || p.due_at === null ? '' : String(p.due_at).trim();
  if (!dueRaw) {
    await env.DB.prepare('DELETE FROM due_dates WHERE class_name = ? AND period = ?').bind(className, period).run();
    return { ok: true, deleted: true };
  }
  const ms = Date.parse(dueRaw);
  if (!Number.isFinite(ms)) throw bad('due_at ไม่ถูกต้อง', 'bad_due');
  await env.DB.prepare(
    `INSERT INTO due_dates (class_name, period, due_at, title, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (class_name, period) DO UPDATE SET
       due_at = excluded.due_at, title = excluded.title, updated_at = excluded.updated_at`
  )
    .bind(className, period, new Date(ms).toISOString(), optText(p.title, 200), nowIso())
    .run();
  return { ok: true };
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
  let posted = 0;
  const errors = [];
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
    const st = await env.DB.prepare('SELECT class_name FROM students WHERE student_id = ?').bind(sid).first();
    if (!st) {
      errors.push(`${sid}: ไม่พบนักเรียน`);
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
    await env.DB.prepare(
      `INSERT INTO notices (id, student_id, class_name, ref, kind, message, score, teacher, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), sid, st.class_name, optText(it.ref, 120), kind, message, score, optText(it.teacher, 120) || 'คุณครู', nowIso())
      .run();
    posted++;
  }
  return { ok: true, posted, errors };
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
async function syncBatch(request, env, auth) {
  const b = await readJson(request);
  if (!Array.isArray(b.items)) throw bad('ต้องส่ง items เป็นรายการ');
  if (b.items.length > MAX_SYNC_OPS) throw bad(`ส่งครั้งละไม่เกิน ${MAX_SYNC_OPS} รายการ`);
  const results = [];
  for (const it of b.items) {
    const id = typeof it?.id === 'string' ? it.id.slice(0, 120) : '';
    if (!id) {
      results.push({ id: null, status: 'error', message: 'ไม่มี id' });
      continue;
    }
    const seen = await env.DB.prepare('SELECT 1 AS x FROM sync_archive WHERE item_id = ?').bind(id).first();
    if (seen) {
      results.push({ id, status: 'duplicate' });
      continue;
    }
    const type = String(it.type || '').slice(0, 60);
    const data = isPlainObject(it.data) ? it.data : {};
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 100 * 1024) {
      results.push({ id, status: 'error', message: 'ข้อมูลใหญ่เกินไป' });
      continue;
    }
    try {
      let status = 'archived';
      if (type === 'set_due_date') {
        await setDueDate(env, {
          class_name: data.className,
          period: data.period,
          due_at: data.dueAt,
          title: data.title
        });
        status = 'applied';
      } else if (type === 'research_car') {
        await putResearch(env, {
          class_name: data.className,
          student_id: data.studentId,
          pre: data.pre,
          post: data.post,
          formative: data.formative
        });
        status = 'applied';
      }
      await env.DB.prepare(
        'INSERT OR IGNORE INTO sync_archive (item_id, type, data, received_at, received_by) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(id, type, dataStr, nowIso(), auth.sub)
        .run();
      results.push({ id, status });
    } catch (e) {
      if (e instanceof HttpError) results.push({ id, status: 'error', message: e.message });
      else throw e;
    }
  }
  return json({ results });
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
