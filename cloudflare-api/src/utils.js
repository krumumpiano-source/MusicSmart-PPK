// Shared crypto, validation, CORS, audit, and D1 helpers for MusicSmart PPK Worker API

export const PW_SCHEME = 'pbkdf2-sha256-v1';
export const LEGACY_HMAC_SCHEME = 'hmac-sha256-v1';
export const PBKDF2_ITERATIONS = 100000;

export const TEACHER_TTL_SEC = 8 * 3600;
export const STUDENT_TTL_SEC = 12 * 3600;
export const LOCK_WINDOW_SEC = 15 * 60;
export const LOCK_MAX_FAILS = 5;
export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_SESSION_BYTES = 200 * 1024;
export const MAX_SYNC_OPS = 200;
export const MAX_SYNC_OPS_PER_CALL = 15;
export const MAX_BATCH_ITEMS = 100;
export const MIN_TEACHER_PASSWORD = 12;

const AUDIT_RETENTION_DAYS = 30;
const enc = new TextEncoder();
const dec = new TextDecoder();

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function bad(message, code = 'invalid_input') {
  return new HttpError(400, code, message);
}

export function nowIso() {
  return new Date().toISOString();
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ---------- Encoding & crypto utilities ----------

export function bytesToB64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToBytes(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function strToB64url(str) {
  return bytesToB64url(enc.encode(str));
}

export function b64urlToStr(str) {
  return dec.decode(b64urlToBytes(str));
}

export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export async function hmacBytes(secret, message) {
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

export function safeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function safeEqualStr(a, b) {
  return safeEqualBytes(enc.encode(String(a)), enc.encode(String(b)));
}

// ---------- Password / PIN hashing (PBKDF2-SHA256 + legacy HMAC-SHA256 verification) ----------

async function pbkdf2Derive(env, secret, saltBytes, iterations) {
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(env.PASSWORD_PEPPER || '') + '\0' + String(secret)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    material,
    256
  );
  return new Uint8Array(bits);
}

export async function hashSecret(env, secret) {
  const saltBytes = randomBytes(16);
  const digest = await pbkdf2Derive(env, secret, saltBytes, PBKDF2_ITERATIONS);
  return `${PW_SCHEME}$${PBKDF2_ITERATIONS}$${bytesToB64url(saltBytes)}$${bytesToB64url(digest)}`;
}

export async function verifySecret(env, stored, secret) {
  const parts = String(stored || '').split('$');
  try {
    if (parts.length === 4 && parts[0] === PW_SCHEME) {
      const iters = Number(parts[1]);
      if (!Number.isInteger(iters) || iters < 1000 || iters > PBKDF2_ITERATIONS) return false;
      const digest = await pbkdf2Derive(env, secret, b64urlToBytes(parts[2]), iters);
      return safeEqualBytes(digest, b64urlToBytes(parts[3]));
    }
    if (parts.length === 3 && parts[0] === LEGACY_HMAC_SCHEME) {
      const digest = await hmacBytes(env.PASSWORD_PEPPER, parts[1] + '|' + secret);
      return safeEqualBytes(digest, b64urlToBytes(parts[2]));
    }
  } catch {
    return false;
  }
  return false;
}

export function needsRehash(stored) {
  return !String(stored || '').startsWith(PW_SCHEME + '$');
}

// ---------- Login tokens (HMAC-signed, bounded expiry) ----------

export async function signToken(env, payload) {
  const body = strToB64url(JSON.stringify(payload));
  const sig = bytesToB64url(await hmacBytes(env.SESSION_SECRET, body));
  return `${body}.${sig}`;
}

export async function verifyToken(env, token) {
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

// ---------- Input validation & SSRF protection ----------

export function reqStr(v, name, max) {
  if (typeof v !== 'string') throw bad(`${name} ต้องเป็นข้อความ`);
  const s = v.trim();
  if (!s) throw bad(`กรุณากรอก ${name}`);
  if (s.length > max) throw bad(`${name} ยาวเกินไป`);
  return s;
}

export function optText(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
}

export function optInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw bad('ตัวเลขไม่ถูกต้อง');
  return n;
}

export function validPeriod(v) {
  const n = optInt(v);
  if (n === null || n < 1 || n > 40) throw bad('คาบเรียนต้องอยู่ระหว่าง 1-40', 'bad_period');
  return n;
}

export function normSid(v) {
  const s = String(v ?? '').trim();
  if (!/^[A-Za-z0-9._-]{1,20}$/.test(s)) throw bad('รหัสนักเรียนไม่ถูกต้อง', 'bad_student_id');
  return s;
}

export function normEmail(v) {
  const s = reqStr(v, 'อีเมล', 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('รูปแบบอีเมลไม่ถูกต้อง');
  return s;
}

export function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseJson(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

export function isBlockedHost(hostname) {
  const h = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.startsWith('[') && h.endsWith(']')) {
    const inner = h.slice(1, -1);
    if (
      inner === '::' ||
      inner === '::1' ||
      inner.startsWith('fe8') || inner.startsWith('fe9') || inner.startsWith('fea') || inner.startsWith('feb') ||
      inner.startsWith('fc') || inner.startsWith('fd') ||
      inner.includes('::ffff:') ||
      inner.startsWith('0:0:0:0:0:0:0:')
    ) return true;
    return false;
  }
  if (/^(0x[0-9a-f]+|\d+)$/i.test(h)) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const [a, b, c, d] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }
  return false;
}

export function validateVideoUrl(raw) {
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
  if (isBlockedHost(u.hostname)) throw bad('ลิงก์ไม่อนุญาตให้ชี้ไปยังเครือข่ายภายใน', 'invalid_url');
  return u.toString();
}

export async function readJson(request) {
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

// ---------- Audit log + rate lockouts ----------

export function clientIp(request) {
  return String(request?.headers?.get('CF-Connecting-IP') || 'unknown').slice(0, 64);
}

export async function audit(env, actor, action, target = '') {
  await env.DB.prepare('INSERT INTO audit_log (actor, action, target, created_at) VALUES (?, ?, ?, ?)')
    .bind(actor, action, target, nowIso())
    .run();
  if (action === 'login_ok' || Math.random() < 0.02) {
    try {
      const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 86400000).toISOString();
      await env.DB.prepare('DELETE FROM audit_log WHERE created_at < ?').bind(cutoff).run();
    } catch {
      // Do not fail primary flow if log retention prune fails
    }
  }
}

export async function isLocked(env, actor) {
  const since = new Date(Date.now() - LOCK_WINDOW_SEC * 1000).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM audit_log WHERE actor = ? AND action = 'login_fail' AND created_at >= ?"
  )
    .bind(actor, since)
    .first();
  return (row?.n || 0) >= LOCK_MAX_FAILS;
}

// ---------- HTTP responses & CORS ----------

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const normalized = `${u.protocol}//${u.host}`.toLowerCase();
    if (normalized === 'https://krumumpiano-source.github.io') return true;
    const extra = String(env?.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (extra.includes(normalized)) return true;
    if (env?.ALLOW_LOCALHOST !== '0' && u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    return false;
  } catch {
    return false;
  }
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!isAllowedOrigin(origin, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

// ---------- D1 batch helpers ----------

export async function existingValues(env, table, col, values) {
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

export async function runBatch(env, stmts) {
  for (let i = 0; i < stmts.length; i += 500) await env.DB.batch(stmts.slice(i, i + 500));
}
