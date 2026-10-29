// MusicSmart PPK • ชั้นเชื่อมต่อกับ Cloudflare Worker API (แทน Google Apps Script)
// ใช้ได้ทั้งในเบราว์เซอร์ (window.CloudApi) และใน Node สำหรับทดสอบ (module.exports)
(function (root) {
  'use strict';

  const DEFAULT_BASE = 'https://musicsmart-api.krumum-piano.workers.dev';
  const TOKEN_KEY = 'ppk_cloud_token';
  const BASE_KEY = 'ppk_cloud_api_base';

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function baseUrl() {
    const s = storage();
    const custom = s ? (s.getItem(BASE_KEY) || '').trim() : '';
    return (custom || DEFAULT_BASE).replace(/\/+$/, '');
  }

  function readSession() {
    const s = storage();
    if (!s) return null;
    try {
      const raw = s.getItem(TOKEN_KEY);
      if (!raw) return null;
      const sess = JSON.parse(raw);
      if (!sess || !sess.token || !sess.expiresAt || Date.now() >= sess.expiresAt) {
        s.removeItem(TOKEN_KEY);
        return null;
      }
      return sess;
    } catch (e) {
      return null;
    }
  }

  function saveSession(data) {
    const s = storage();
    const sess = {
      token: data.token,
      role: data.role,
      student: data.student || null,
      name: data.name || '',
      // เผื่อเวลาคลาดเคลื่อนเล็กน้อย: ถือว่าหมดอายุก่อนจริง 60 วินาที
      expiresAt: Date.now() + (Number(data.expires_in) || 0) * 1000 - 60000
    };
    if (s) s.setItem(TOKEN_KEY, JSON.stringify(sess));
    return sess;
  }

  function clearSession() {
    const s = storage();
    if (s) s.removeItem(TOKEN_KEY);
  }

  class CloudApiError extends Error {
    constructor(status, code, message) {
      super(message || 'เกิดข้อผิดพลาด');
      this.status = status;
      this.code = code || 'error';
    }
  }

  // เรียก API: ถ้ามี token จะแนบให้อัตโนมัติ, ถ้าเครือข่ายขัดข้องจะโยน CloudApiError(status=0)
  async function request(method, path, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (!opts.anonymous) {
      const sess = readSession();
      if (sess) headers.Authorization = 'Bearer ' + sess.token;
    }
    let res;
    try {
      res = await fetch(baseUrl() + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      throw new CloudApiError(0, 'network', offline ? 'ออฟไลน์ จะส่งใหม่เมื่อกลับมาออนไลน์' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      if (res.status === 401 && !opts.anonymous) clearSession();
      throw new CloudApiError(res.status, data && data.error, data && data.message);
    }
    return data;
  }

  const Auth = {
    async teacherLogin(email, password) {
      const data = await request('POST', '/api/auth/login', { email, password }, { anonymous: true });
      return saveSession(data);
    },
    async studentLogin(studentId, pin) {
      const data = await request('POST', '/api/auth/student', { student_id: studentId, pin }, { anonymous: true });
      const sess = saveSession(data);
      return { ...sess, pinCreated: !!data.pin_created };
    },
    // ค้นหาชื่อ/ห้องจากเลขประจำตัว (ไม่ต้องมี PIN) คืน { student, has_pin, locked }
    async studentLookup(studentId) {
      return request('POST', '/api/auth/student-lookup', { student_id: studentId }, { anonymous: true });
    },
    logout() {
      clearSession();
    },
    session() {
      return readSession();
    },
    isTeacher() {
      const s = readSession();
      return !!s && s.role === 'teacher';
    },
    isStudent() {
      const s = readSession();
      return !!s && s.role === 'student';
    }
  };

  const Submissions = {
    // นักเรียนส่งลิงก์วิดีโอของตัวเอง (ไม่ต้องระบุ student_id: เซิร์ฟเวอร์ใช้จากโทเค็น)
    async submitVideo(item) {
      const data = await request('POST', '/api/submissions', item);
      return data.submission;
    },
    async mine() {
      const data = await request('GET', '/api/submissions/mine');
      return data.submissions || [];
    },
    // ครู: ดูงานของห้อง (กรองตามงานได้) — ไม่ระบุห้อง = ดึงทุกห้อง
    async listForClass(className, assignmentKey) {
      const q = new URLSearchParams();
      if (className) q.set('class', className);
      if (assignmentKey) q.set('assignment', assignmentKey);
      const data = await request('GET', '/api/submissions?' + q.toString());
      return data.submissions || [];
    },
    async grade(id, patch) {
      const data = await request('PATCH', '/api/submissions/' + encodeURIComponent(id), patch);
      return data.submission;
    },
    async checkLink(id) {
      return request('POST', '/api/submissions/' + encodeURIComponent(id) + '/check');
    }
  };

  const Sessions = {
    async list(className) {
      const data = await request('GET', '/api/sessions?class=' + encodeURIComponent(className));
      return data.sessions || [];
    },
    // บันทึกคาบ: baseVersion = 0 สำหรับคาบใหม่, หรือเวอร์ชันที่โหลดมาล่าสุด
    async save(sessionKey, className, period, data, baseVersion) {
      const res = await request('PUT', '/api/sessions/' + encodeURIComponent(sessionKey), {
        class_name: className,
        period,
        data,
        base_version: baseVersion
      });
      return res;
    }
  };

  // ส่งคิว offline ทีละชุด (idempotent ด้วย op_id) คืนผลรายรายการ
  async function sync(ops) {
    const data = await request('POST', '/api/sync', { ops });
    return data.results || [];
  }

  const CloudApi = {
    baseUrl,
    request,
    Auth,
    Submissions,
    Sessions,
    sync,
    CloudApiError,
    _readSession: readSession,
    _saveSession: saveSession,
    _clearSession: clearSession
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CloudApi;
  if (root) root.CloudApi = CloudApi;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
