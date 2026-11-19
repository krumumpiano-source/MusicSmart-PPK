// ==========================================================================
// Accessible Non-Blocking UI Notifications & Dialog/Keyboard Enhancements
// ==========================================================================

(function (root) {
  const UiDialogs = {
    _maxToasts: 4,
    _escBound: false,

    _region() {
      if (typeof document === 'undefined' || !document.body) return null;
      let el = document.getElementById('ms-toast-region');
      if (!el) {
        el = document.createElement('div');
        el.id = 'ms-toast-region';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'false');
        document.body.appendChild(el);
      }
      return el;
    },

    toast(message, type = 'info', durationMs = 4200) {
      const text = String(message || '').trim();
      if (!text) return null;
      const region = this._region();
      if (!region) {
        if (typeof alert === 'function' && typeof window !== 'undefined') alert(text);
        else if (typeof console !== 'undefined') console.log(`[${type}]`, text);
        return null;
      }

      while (region.children.length >= this._maxToasts) {
        region.removeChild(region.firstElementChild);
      }

      const kind = ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info';
      const item = document.createElement('div');
      item.className = `ms-toast ms-toast-${kind}`;
      if (kind === 'error') item.setAttribute('role', 'alert');

      const span = document.createElement('span');
      span.className = 'ms-toast-msg';
      span.textContent = text;

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'ms-toast-close';
      closeBtn.setAttribute('aria-label', 'ปิดการแจ้งเตือน');
      closeBtn.textContent = '×';

      let timerId = null;
      const dismiss = () => {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        if (item.parentNode) item.parentNode.removeChild(item);
      };
      closeBtn.onclick = dismiss;

      item.appendChild(span);
      item.appendChild(closeBtn);
      region.appendChild(item);

      if (durationMs > 0) {
        timerId = setTimeout(dismiss, durationMs);
      }
      return item;
    },

    notify(message, type = 'info', durationMs = 4200) {
      return this.toast(message, type, durationMs);
    },

    enhanceAccessibility(container) {
      if (typeof document === 'undefined') return;
      const scope = container || document;

      if (scope.querySelectorAll) {
        scope.querySelectorAll('.modal-overlay').forEach((m) => {
          if (!m.getAttribute('role')) m.setAttribute('role', 'dialog');
          if (!m.getAttribute('aria-modal')) m.setAttribute('aria-modal', 'true');
        });

        scope.querySelectorAll('div[onclick]').forEach((el) => {
          if (!el.getAttribute('role')) el.setAttribute('role', 'button');
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
          if (el.dataset && !el.dataset.a11yBound) {
            el.dataset.a11yBound = '1';
            el.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                el.click();
              }
            });
          }
        });
      }

      if (!this._escBound && document.addEventListener) {
        this._escBound = true;
        document.addEventListener('keydown', (e) => {
          if (e.key !== 'Escape') return;
          const activeModals = Array.from(document.querySelectorAll('.modal-overlay.active'));
          if (!activeModals.length) return;
          const top = activeModals[activeModals.length - 1];
          // Do not let Escape dismiss mandatory login/auth gates
          if (top.id === 'modal-auth' || top.id === 'student-login-modal') return;
          const closeBtn = top.querySelector('.modal-close, [data-modal-close]');
          if (closeBtn && typeof closeBtn.click === 'function') {
            closeBtn.click();
          } else {
            top.classList.remove('active');
          }
        });
      }
    }
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => UiDialogs.enhanceAccessibility());
    } else {
      UiDialogs.enhanceAccessibility();
    }
  }

  if (root) root.UiDialogs = UiDialogs;
  if (typeof module !== 'undefined' && module.exports) module.exports = UiDialogs;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
