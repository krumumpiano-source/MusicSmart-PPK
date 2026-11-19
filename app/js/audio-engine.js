// ==========================================================================
// Shared Web Audio Engine (Singleton AudioContext)
// Prevents iOS/Safari AudioContext hardware slot exhaustion across tools
// ==========================================================================

(function (root) {
  const AudioEngine = {
    _ctx: null,
    _unlockBound: false,

    _getAudioContextClass() {
      const g = root || (typeof window !== 'undefined' ? window : globalThis);
      return (g && (g.AudioContext || g.webkitAudioContext)) || null;
    },

    getContext() {
      const CtxClass = this._getAudioContextClass();
      if (!CtxClass) return null;
      if (!this._ctx || this._ctx.state === 'closed') {
        this._ctx = new CtxClass();
      }
      if (this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
        try {
          const p = this._ctx.resume();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
      this._bindUnlock();
      return this._ctx;
    },

    async resume() {
      const ctx = this.getContext();
      if (!ctx) return null;
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try { await ctx.resume(); } catch (e) {}
      }
      return ctx;
    },

    getState() {
      return this._ctx ? this._ctx.state : 'uninitialized';
    },

    _bindUnlock() {
      if (this._unlockBound || typeof document === 'undefined' || !document.addEventListener) return;
      this._unlockBound = true;
      const unlock = () => {
        if (this._ctx && this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
          try {
            const p = this._ctx.resume();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch (e) {}
        }
      };
      document.addEventListener('pointerdown', unlock, { passive: true });
      document.addEventListener('keydown', unlock, { passive: true });
    }
  };

  if (root) root.AudioEngine = AudioEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = AudioEngine;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
