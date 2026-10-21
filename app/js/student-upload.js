// ==========================================================================
// อัปโหลดไฟล์/คลิปจากมือถือนักเรียน → Google Drive ครู (แบ่งชิ้น 2 MB, หยุด/ทำต่อได้, ส่งซ้ำไม่ซ้ำซ้อน)
// ไฟล์ที่รออัปโหลดเก็บใน IndexedDB ของเครื่อง จึงทำต่อได้แม้ปิดแอป/เน็ตหลุด
// ==========================================================================

const StudentUpload = {
  KEY: 'ppk_upload_jobs',
  CHUNK: 2 * 1024 * 1024,
  MAX_BYTES: 50 * 1024 * 1024,      // ค่าเริ่มต้นเท่ากับเซิร์ฟเวอร์ (UPLOAD_MAX_MB) — เซิร์ฟเวอร์เป็นตัวตัดสินสุดท้าย
  BIG_VIDEO_BYTES: 15 * 1024 * 1024,
  MAX_RETRY: 4,
  TYPES: {
    jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'], webp: ['image/webp'], heic: ['image/heic', 'image/heif'], heif: ['image/heic', 'image/heif'],
    mp3: ['audio/mpeg', 'audio/mp3'], m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'], aac: ['audio/aac', 'audio/x-aac'],
    wav: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'], ogg: ['audio/ogg', 'application/ogg'],
    mp4: ['video/mp4'], mov: ['video/quicktime'], webm: ['video/webm', 'audio/webm'], pdf: ['application/pdf']
  },
  ACCEPT: 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,audio/*,.m4a,.aac,video/mp4,video/quicktime,video/webm,application/pdf,.pdf',
  STATUS_TEXT: {
    queued: 'รอคิวอัปโหลด', uploading: 'กำลังอัปโหลด', paused: 'หยุดชั่วคราว', offline: 'รอสัญญาณอินเทอร์เน็ต (จะทำต่ออัตโนมัติ)',
    finishing: 'กำลังรวมไฟล์ใน Google Drive ครู…', done: 'อัปโหลดสำเร็จ ✅', failed: 'อัปโหลดไม่สำเร็จ — กดลองใหม่',
    rejected: 'ไฟล์ไม่ถูกต้อง ❌', missing_file: 'ไม่พบไฟล์ในเครื่องแล้ว — กรุณาเลือกไฟล์ใหม่', needs_login: 'กรุณากรอก PIN อีกครั้งแล้วกดทำต่อ'
  },
  picked: null,
  running: {},
  _mem: {},

  // ---------- ตรวจไฟล์ฝั่งเครื่อง ----------
  ext(name) { const m = /\.([A-Za-z0-9]{2,5})$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; },
  check(file) {
    if (!file) return { ok: false, message: 'ยังไม่ได้เลือกไฟล์' };
    const ext = this.ext(file.name);
    const mimes = this.TYPES[ext];
    if (!mimes) return { ok: false, message: 'ไม่รองรับไฟล์ชนิดนี้ (รับ รูป jpg/png/heic/webp • เสียง mp3/m4a/aac/wav/ogg • วิดีโอ mp4/mov/webm • pdf)' };
    const type = String(file.type || '').toLowerCase();
    if (type && mimes.indexOf(type) === -1) return { ok: false, message: 'นามสกุลไฟล์ไม่ตรงกับชนิดไฟล์ กรุณาเลือกไฟล์ใหม่' };
    if (!file.size) return { ok: false, message: 'ไฟล์ว่างเปล่า' };
    if (file.size > this.MAX_BYTES) return { ok: false, message: `ไฟล์ใหญ่ ${(file.size / 1048576).toFixed(1)} MB เกิน ${Math.round(this.MAX_BYTES / 1048576)} MB — ตัดคลิปให้สั้นลง หรืออัปโหลดเองแล้วส่งเป็นลิงก์` };
    const isVideo = /^(mp4|mov|webm)$/.test(ext);
    const warn = isVideo && file.size > this.BIG_VIDEO_BYTES
      ? `คลิปขนาด ${(file.size / 1048576).toFixed(1)} MB อาจใช้เวลาอัปโหลดนาน แนะนำให้ต่อ Wi-Fi (หยุด/ทำต่อได้)` : '';
    return { ok: true, ext, mime: mimes.indexOf(type) !== -1 ? type : mimes[0], warn };
  },

  // ---------- เก็บไฟล์ใน IndexedDB ----------
  _db() {
    if (this._dbp) return this._dbp;
    if (typeof indexedDB === 'undefined') return (this._dbp = Promise.resolve(null));
    this._dbp = new Promise(res => {
      try {
        const rq = indexedDB.open('musicsmart_uploads', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('files');
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return this._dbp;
  },
  async putFile(id, blob) {
    this._mem[id] = blob;
    const db = await this._db();
    if (!db) return;
    await new Promise(res => { try { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(blob, id); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } });
  },
  async getFile(id) {
    if (this._mem[id]) return this._mem[id];
    const db = await this._db();
    if (!db) return null;
    return new Promise(res => { try { const rq = db.transaction('files').objectStore('files').get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch (e) { res(null); } });
  },
  async dropFile(id) {
    delete this._mem[id];
    const db = await this._db();
    if (db) { try { db.transaction('files', 'readwrite').objectStore('files').delete(id); } catch (e) { /* ignore */ } }
  },

  // ---------- งานอัปโหลด ----------
  jobs() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; } },
  saveJobs(j) { localStorage.setItem(this.KEY, JSON.stringify(j)); },
  job(id) { return this.jobs().find(j => j.id === id) || null; },
  patch(id, fields) {
    const all = this.jobs();
    const j = all.find(x => x.id === id);
    if (!j) return null;
    Object.assign(j, fields, { updatedAt: Date.now() });
    this.saveJobs(all);
    this.render();
    return j;
  },
  newId() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); },

  /** เพิ่มงานอัปโหลด: purpose 'assignment' (แนบกับงานคาบ) หรือ 'recording' (คลิปฝึกซ้อม) */
  async add(file, opts = {}) {
    const c = this.check(file);
    if (!c.ok) return { success: false, message: c.message };
    const u = StudentOutbox.currentStudent();
    if (!u) return { success: false, message: 'กรุณาเข้าสู่ระบบนักเรียนก่อน' };
    const id = this.newId();
    await this.putFile(id, file);
    const job = { id, name: String(file.name).slice(0, 80), size: file.size, mime: c.mime, ext: c.ext, period: Number(opts.period) || 1,
      purpose: opts.purpose === 'recording' ? 'recording' : 'assignment', className: opts.className || u.studentClass || '',
      content: String(opts.content || '').slice(0, opts.purpose === 'recording' ? 1000 : 5000), url: String(opts.url || '').slice(0, 500),
      status: 'queued', sent: 0, total: Math.ceil(file.size / this.CHUNK), attempts: 0, createdAt: Date.now() };
    this.saveJobs(this.jobs().concat([job]));
    if (job.purpose === 'assignment') StudentOutbox.setStatus(StudentOutbox.assignmentKey(job.className, job.period), 'pending');
    this.render();
    const p = this.run(id);
    return { success: true, id, warn: c.warn, done: p };
  },

  pause(id) { this.patch(id, { status: 'paused' }); },
  resume(id) { const j = this.patch(id, { status: 'queued', attempts: 0, error: '' }); return j ? this.run(id) : null; },
  retry(id) { return this.resume(id); },
  async cancel(id) { this.saveJobs(this.jobs().filter(j => j.id !== id)); await this.dropFile(id); this.render(); },

  async _b64(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  },
  _post(body) { return StudentAuth._post(body); },
  _offline() { return typeof navigator !== 'undefined' && navigator.onLine === false; },

  async run(id) {
    if (this.running[id]) return this.running[id];
    this.running[id] = this._run(id).finally(() => { delete this.running[id]; });
    return this.running[id];
  },

  async _run(id) {
    let j = this.job(id);
    if (!j || j.status === 'done' || j.status === 'rejected' || j.status === 'paused') return j;
    const u = StudentOutbox.currentStudent();
    if (!u || !StudentOutbox.sessionValid(u)) return this.patch(id, { status: 'needs_login' });
    if (this._offline()) return this.patch(id, { status: 'offline' });
    const file = await this.getFile(id);
    if (!file) return this.patch(id, { status: 'missing_file' });
    const fail = (e, permanent) => {
      const attempts = (this.job(id) || {}).attempts + 1;
      if (permanent) return this.patch(id, { status: 'rejected', error: e });
      if (this._offline()) return this.patch(id, { status: 'offline', error: '' });
      return this.patch(id, { status: attempts >= this.MAX_RETRY ? 'failed' : 'queued', attempts, error: e });
    };
    try {
      this.patch(id, { status: 'uploading' });
      let r = await this._post({ action: 'studentUploadStart', sessionToken: u.sessionToken, uploadId: id, fileName: j.name, mimeType: j.mime,
        size: j.size, period: j.period, purpose: j.purpose });
      if (r.status !== 'success') return this._serverError(id, r, fail);
      if (!r.done) {
        const have = new Set(r.received || []);
        const cs = r.upload.chunkSize || this.CHUNK;
        const total = r.upload.totalChunks;
        this.patch(id, { total, sent: have.size });
        for (let i = 0; i < total; i++) {
          if (have.has(i)) continue;
          j = this.job(id);
          if (!j || j.status === 'paused') return j;              // ผู้ใช้กดหยุด
          if (this._offline()) return this.patch(id, { status: 'offline' });
          const data = await this._b64(file.slice(i * cs, Math.min(j.size, (i + 1) * cs)));
          const c = await this._post({ action: 'studentUploadChunk', sessionToken: u.sessionToken, uploadId: id, index: i, data });
          if (c.status !== 'success') return this._serverError(id, c, fail);
          have.add(i);
          this.patch(id, { sent: have.size });
        }
        this.patch(id, { status: 'finishing' });
        r = await this._post({ action: 'studentUploadFinish', sessionToken: u.sessionToken, uploadId: id });
        if (r.status !== 'success') {
          if (r.code === 'missing_chunks') return fail('ยังส่งไม่ครบ จะส่งชิ้นที่ขาดใหม่');
          return this._serverError(id, r, fail);
        }
      }
      j = this.patch(id, { status: 'done', sent: r.upload.totalChunks, fileUrl: r.upload.fileUrl, error: '' });
      await this.dropFile(id);
      this._attach(j);
      return j;
    } catch (e) {
      return fail('เชื่อมต่อไม่ได้');
    } finally {
      const cur = this.job(id);
      if (cur && cur.status === 'queued' && (cur.attempts || 0) > 0 && (cur.attempts || 0) < this.MAX_RETRY && !this._offline()) {
        const delay = Math.min(30000, 1000 * Math.pow(2, cur.attempts));
        const t = setTimeout(() => this.run(id), delay);
        if (t && t.unref) t.unref();
      }
    }
  },

  _serverError(id, r, fail) {
    const code = r.code || '';
    if (code === 'session_expired' || code === 'bad_session') return this.patch(id, { status: 'needs_login' });
    const permanent = ['bad_type', 'type_mismatch', 'too_large', 'quota', 'bad_size', 'bad_period', 'upload_rejected', 'upload_id_conflict', 'upload_expired', 'no_upload'];
    return fail(r.message || 'อัปโหลดไม่สำเร็จ', permanent.indexOf(code) !== -1);
  },

  // เมื่ออัปโหลดเสร็จ ผูกไฟล์กับงานคาบ/คลิปฝึกซ้อม ผ่านคิวส่งงานเดิม (studentSubmit ตรวจว่าไฟล์เป็นของนักเรียนคนนี้)
  _attach(j) {
    if (j.attached) return;
    if (j.purpose === 'recording') {
      StudentOutbox.enqueue('recording', `r:${j.className}_p${j.period}_${j.id}`, { period: j.period, uploadId: j.id, url: j.url || '',
        content: j.content, submissionType: 'คลิปฝึกซ้อม (ไฟล์)', title: j.name });
    } else {
      StudentOutbox.enqueue('assignment', StudentOutbox.assignmentKey(j.className, j.period), { period: j.period, uploadId: j.id,
        content: j.content, url: j.url || '', submissionType: 'file_upload', title: j.name });
    }
    this.patch(j.id, { attached: true });
  },

  /** ทำต่อทุกงานที่ค้าง (เปิดแอป / กลับมาออนไลน์ / หลังกรอก PIN) */
  resumeAll() {
    return Promise.all(this.jobs().filter(j => ['queued', 'offline', 'uploading', 'finishing', 'needs_login'].indexOf(j.status) !== -1)
      .map(j => { this.patch(j.id, { status: 'queued' }); return this.run(j.id); }));
  },
  init() {
    if (typeof window === 'undefined' || this._init) return;
    this._init = true;
    if (window.addEventListener) {
      window.addEventListener('online', () => this.resumeAll());
      window.addEventListener('offline', () => this.jobs().forEach(j => { if (j.status === 'uploading') this.patch(j.id, { status: 'offline' }); }));
    }
    setTimeout(() => this.resumeAll(), 2500);
  },

  // ---------- UI ----------
  /** เลือกไฟล์จากช่องเลือก/กล้อง/ไมค์ */
  pick(input, previewId) {
    const f = input && input.files && input.files[0];
    const pv = typeof document !== 'undefined' ? document.getElementById(previewId || 'student-file-preview') : null;
    if (!f) { this.picked = null; if (pv) pv.style.display = 'none'; return null; }
    const c = this.check(f);
    if (!c.ok) { alert('⚠️ ' + c.message); input.value = ''; this.picked = null; if (pv) pv.style.display = 'none'; return c; }
    this.picked = f;
    if (pv) {
      pv.style.display = 'block';
      const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      pv.innerHTML = `✅ เลือกไฟล์: <strong>${e(f.name)}</strong> (${(f.size / 1048576).toFixed(2)} MB) • จะอัปโหลดเข้า Google Drive ครู (ส่วนตัว)` +
        (c.warn ? `<div style="color:#b45309;margin-top:2px;">⏳ ${e(c.warn)}</div>` : '');
    }
    return c;
  },
  html(filter) {
    const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const list = this.jobs().filter(filter || (() => true)).slice(-8).reverse();
    if (!list.length) return '';
    return list.map(j => {
      const pct = j.status === 'done' ? 100 : Math.round(100 * (j.sent || 0) / Math.max(1, j.total || 1));
      const btn = (label, fn) => `<button class="btn-nav-action" style="padding:2px 8px;font-size:0.75rem;" onclick="StudentUpload.${fn}('${j.id}')">${label}</button>`;
      const acts = j.status === 'uploading' ? btn('⏸ หยุด', 'pause')
        : ['paused', 'offline', 'needs_login', 'queued'].indexOf(j.status) !== -1 ? btn('▶️ ทำต่อ', 'resume') + btn('✕ ยกเลิก', 'cancel')
        : j.status === 'failed' ? btn('🔁 ลองใหม่', 'retry') + btn('✕ ยกเลิก', 'cancel')
        : (j.status === 'rejected' || j.status === 'missing_file' || j.status === 'done') ? btn('✕ ลบรายการ', 'cancel') : '';
      return `<div class="upload-job" data-upload-id="${e(j.id)}" style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;margin-top:6px;font-size:0.8rem;">
        <div style="display:flex;justify-content:space-between;gap:6px;"><span>${j.purpose === 'recording' ? '🎧' : '📎'} ${e(j.name)} • คาบ ${j.period}</span><span>${pct}%</span></div>
        <div style="background:#e2e8f0;border-radius:4px;height:6px;margin:4px 0;"><div style="width:${pct}%;height:6px;border-radius:4px;background:${j.status === 'done' ? '#16a34a' : j.status === 'failed' || j.status === 'rejected' ? '#dc2626' : '#2563eb'};"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;"><span>${e(this.STATUS_TEXT[j.status] || j.status)}${j.error && j.status !== 'done' ? ' — ' + e(j.error) : ''}</span><span>${acts}</span></div></div>`;
    }).join('');
  },
  render() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const box = document.getElementById('student-upload-list');
    if (box) box.innerHTML = this.html();
  }
};

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.addEventListener) StudentUpload.init();
if (typeof module !== 'undefined' && module.exports) module.exports = { StudentUpload };
