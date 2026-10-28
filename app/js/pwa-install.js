// ==========================================================================
// MusicSmart • แนะนำให้ติดตั้งแอปลงมือถือ (PWA Install Banner)
// Android/Chrome: ใช้ beforeinstallprompt • iPhone/iPad Safari: แสดงวิธี "เพิ่มไปยังหน้าจอโฮม"
// ไม่แสดงเมื่อเปิดจากแอปที่ติดตั้งแล้ว (standalone) และปิดได้ (จำไว้ 7 วัน)
// ==========================================================================
const PwaInstall = {
  DISMISS_KEY: 'ppk_pwa_banner_dismissed_at',
  DISMISS_DAYS: 7,
  deferred: null,
  env: null, // สำหรับทดสอบ: { ua, standalone }

  _ua() { return (this.env && this.env.ua) || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''; },
  isIos() { return /iPad|iPhone|iPod/.test(this._ua()) || (/Macintosh/.test(this._ua()) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1); },
  isMobile() { return /Android|iPhone|iPad|iPod|Mobile/i.test(this._ua()) || this.isIos(); },
  isStandalone() {
    if (this.env && typeof this.env.standalone === 'boolean') return this.env.standalone;
    try {
      return (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof navigator !== 'undefined' && navigator.standalone === true);
    } catch (e) { return false; }
  },
  isDismissed() {
    try {
      const t = Number(localStorage.getItem(this.DISMISS_KEY) || 0);
      return t > 0 && (Date.now() - t) < this.DISMISS_DAYS * 86400000;
    } catch (e) { return false; }
  },
  dismiss() {
    try { localStorage.setItem(this.DISMISS_KEY, String(Date.now())); } catch (e) { /* ignore */ }
    this.hide();
  },
  shouldShow() {
    if (this.isStandalone() || this.isDismissed()) return false;
    return !!this.deferred || this.isIos() || this.isMobile();
  },

  init() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e;
      this.render();
    });
    window.addEventListener('appinstalled', () => { this.deferred = null; this.hide(); });
    const ready = () => this.render();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
  },

  hide() {
    if (typeof document === 'undefined') return;
    const b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
    const old = document.getElementById('student-pwa-banner');
    if (old) old.style.display = 'none';
  },

  render() {
    if (typeof document === 'undefined' || !document.body) return;
    if (!this.shouldShow()) { this.hide(); return; }
    let b = document.getElementById('pwa-install-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'pwa-install-banner';
      b.setAttribute('role', 'dialog');
      b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:100010;background:linear-gradient(135deg,#0284c7,#1e3a8a);color:#fff;border-radius:14px;padding:0.85rem 1rem;box-shadow:0 10px 30px rgba(0,0,0,0.35);font-size:0.88rem;max-width:560px;margin:0 auto;';
      document.body.appendChild(b);
    }
    const ios = this.isIos() && !this.deferred;
    b.innerHTML = `
      <div style="display:flex;gap:0.75rem;align-items:flex-start;">
        <span style="font-size:1.6rem;line-height:1;">📲</span>
        <div style="flex:1;">
          <div style="font-weight:800;font-size:0.95rem;">ติดตั้งแอป MusicSmart ลงบนมือถือ</div>
          <div style="opacity:0.92;margin-top:2px;line-height:1.5;">${ios
            ? 'บน iPhone/iPad: แตะปุ่ม <strong>แชร์</strong> (กล่องมีลูกศรขึ้น ⬆️) ใน Safari แล้วเลือก <strong>“เพิ่มไปยังหน้าจอโฮม”</strong> จากนั้นแตะ <strong>เพิ่ม</strong>'
            : (this.deferred ? 'เปิดเรียนได้เต็มจอเหมือนแอป ไม่ต้องพิมพ์ลิงก์ทุกครั้ง' : 'เปิดเมนู ⋮ ของเบราว์เซอร์ แล้วเลือก <strong>“ติดตั้งแอป”</strong> หรือ <strong>“เพิ่มลงในหน้าจอหลัก”</strong>')}</div>
          <div style="display:flex;gap:0.5rem;margin-top:0.6rem;">
            ${this.deferred ? '<button type="button" id="pwa-install-btn" style="background:#fff;color:#0369a1;border:none;border-radius:8px;padding:0.45rem 0.9rem;font-weight:800;cursor:pointer;">ติดตั้งเลย</button>' : ''}
            <button type="button" id="pwa-install-later" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.6);border-radius:8px;padding:0.45rem 0.9rem;font-weight:600;cursor:pointer;">ไว้ทีหลัง</button>
          </div>
        </div>
        <button type="button" id="pwa-install-close" aria-label="ปิด" style="background:transparent;border:none;color:rgba(255,255,255,0.8);font-size:1.1rem;cursor:pointer;">✕</button>
      </div>`;
    const btn = b.querySelector('#pwa-install-btn');
    if (btn) btn.onclick = () => this.install();
    b.querySelector('#pwa-install-later').onclick = () => this.dismiss();
    b.querySelector('#pwa-install-close').onclick = () => this.dismiss();
  },

  async install() {
    if (this.isStandalone()) { alert('📱 คุณเปิดใช้งานผ่านแอปที่ติดตั้งแล้ว'); return 'standalone'; }
    if (this.deferred) {
      const ev = this.deferred;
      this.deferred = null;
      ev.prompt();
      const choice = await ev.userChoice;
      if (choice && choice.outcome === 'accepted') this.hide(); else this.render();
      return choice ? choice.outcome : 'dismissed';
    }
    if (this.isIos()) {
      alert('📲 วิธีติดตั้งบน iPhone / iPad (ใช้ Safari):\n1. แตะปุ่ม "แชร์" (กล่องมีลูกศรขึ้น)\n2. เลือก "เพิ่มไปยังหน้าจอโฮม"\n3. แตะ "เพิ่ม"');
      return 'ios-instructions';
    }
    alert('📲 Chrome/Edge: แตะเมนู ⋮ มุมขวาบน แล้วเลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"');
    return 'menu-instructions';
  }
};

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.addEventListener) PwaInstall.init();
if (typeof module !== 'undefined' && module.exports) module.exports = PwaInstall;
