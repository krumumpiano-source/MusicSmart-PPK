/* legacy-polyfills.js — ES5 · เติมเฉพาะ API ที่ขาดบนมือถือ/WebView เก่า (ไม่ทับของเดิม)
 * โหลดเป็นสคริปต์แรกใน index.html · ตัวแปลงไวยากรณ์ (tools/build/build_legacy.js) จัดการ ?. ?? ฯลฯ แต่ไม่เติม API ให้ */
(function (g) {
  'use strict';
  function def(obj, name, fn) { if (!obj[name]) { try { Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); } catch (e) { obj[name] = fn; } } }
  def(Object, 'entries', function (o) { var k = Object.keys(o), i = k.length, r = new Array(i); while (i--) r[i] = [k[i], o[k[i]]]; return r; });
  def(Object, 'values', function (o) { var k = Object.keys(o), i = k.length, r = new Array(i); while (i--) r[i] = o[k[i]]; return r; });
  def(Object, 'fromEntries', function (it) { var o = {}, i; var a = Array.prototype.slice.call(it); for (i = 0; i < a.length; i++) o[a[i][0]] = a[i][1]; return o; });
  def(Object, 'assign', function (t) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; } return t; });
  def(String.prototype, 'padStart', function (n, p) { var s = String(this); p = p === undefined ? ' ' : String(p); if (s.length >= n || !p) return s; var f = ''; while (f.length < n - s.length) f += p; return f.slice(0, n - s.length) + s; });
  def(String.prototype, 'padEnd', function (n, p) { var s = String(this); p = p === undefined ? ' ' : String(p); if (s.length >= n || !p) return s; var f = ''; while (f.length < n - s.length) f += p; return s + f.slice(0, n - s.length); });
  def(String.prototype, 'includes', function (x, i) { return this.indexOf(x, i || 0) !== -1; });
  def(String.prototype, 'startsWith', function (x, i) { i = i || 0; return this.substr(i, x.length) === x; });
  def(String.prototype, 'endsWith', function (x, l) { var s = String(this); if (l === undefined || l > s.length) l = s.length; return s.substring(l - x.length, l) === x; });
  def(String.prototype, 'replaceAll', function (a, b) { if (a instanceof RegExp) return this.replace(a, b); return this.split(String(a)).join(typeof b === 'function' ? b(a) : b); });
  def(Array.prototype, 'includes', function (x, from) { var a = Object(this), n = a.length >>> 0, i = from | 0; if (i < 0) i = Math.max(n + i, 0); for (; i < n; i++) { if (a[i] === x || (x !== x && a[i] !== a[i])) return true; } return false; });
  def(Array.prototype, 'find', function (fn, t) { for (var i = 0; i < this.length; i++) if (fn.call(t, this[i], i, this)) return this[i]; return undefined; });
  def(Array.prototype, 'findIndex', function (fn, t) { for (var i = 0; i < this.length; i++) if (fn.call(t, this[i], i, this)) return i; return -1; });
  def(Array.prototype, 'flat', function (d) { d = d === undefined ? 1 : d; var out = []; (function f(a, k) { for (var i = 0; i < a.length; i++) { if (Array.isArray(a[i]) && k > 0) f(a[i], k - 1); else out.push(a[i]); } })(this, d); return out; });
  def(Array.prototype, 'flatMap', function (fn, t) { return Array.prototype.map.call(this, fn, t).flat(1); });
  def(Array, 'from', function (x, fn) { var a = [], i; if (x && typeof x.length === 'number') { for (i = 0; i < x.length; i++) a.push(x[i]); } else if (x && typeof x.forEach === 'function') { x.forEach(function (v) { a.push(v); }); } return fn ? a.map(fn) : a; });
  def(Number, 'isFinite', function (v) { return typeof v === 'number' && isFinite(v); });
  def(Number, 'isInteger', function (v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; });
  if (g.Promise && !g.Promise.prototype['finally']) {
    g.Promise.prototype['finally'] = function (f) { var P = this.constructor || g.Promise; return this.then(function (v) { return P.resolve(f()).then(function () { return v; }); }, function (e) { return P.resolve(f()).then(function () { throw e; }); }); };
  }
  if (g.Element && !g.Element.prototype.matches) g.Element.prototype.matches = g.Element.prototype.msMatchesSelector || g.Element.prototype.webkitMatchesSelector;
  if (g.Element && !g.Element.prototype.closest) g.Element.prototype.closest = function (s) { var e = this; while (e && e.nodeType === 1) { if (e.matches(s)) return e; e = e.parentElement || e.parentNode; } return null; };
})(typeof window !== 'undefined' ? window : this);
