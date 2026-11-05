/* ==========================================================================
   ScreenWakeLock — ตัวจัดการล็อคหน้าจอไม่ให้พัก/ดับอัตโนมัติขณะฝึกดนตรี (Screen Wake Lock API)
   กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี) • โรงเรียนพะเยาพิทยาคม
   ========================================================================== */
(function (root) {
  'use strict';

  var sentinel = null;
  var activeReasons = {}; // Map of active lock reasons e.g. { 'virtual-kalimba': true }
  var isSupported = (typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  var fallbackVideo = null;
  var visibilityBound = false;

  var ScreenWakeLock = {
    /**
     * ตรวจสอบว่าเบราว์เซอร์รองรับ Screen Wake Lock API หรือไม่
     */
    isSupported: function () {
      return isSupported;
    },

    /**
     * คืนค่าว่าระบบกำลังล็อคหน้าจอไว้หรือไม่
     */
    isActive: function () {
      return Object.keys(activeReasons).length > 0;
    },

    /**
     * คืนรายการเหตุผลที่กำลังล็อคหน้าจออยู่
     */
    getActiveReasons: function () {
      return Object.keys(activeReasons);
    },

    /**
     * ร้องขอล็อคหน้าจอไม่ให้ดับ โดยระบุเหตุผล (reason)
     * @param {string} reason เช่น 'virtual-kalimba', 'kalimba-media', 'audio-tools-metronome', 'music-visual-aids', 'rhythm-trainer'
     */
    request: function (reason) {
      reason = reason || 'general-practice';
      activeReasons[reason] = true;
      this._updateIndicators();
      return this._acquire();
    },

    /**
     * ปล่อยล็อคหน้าจอสำหรับเหตุผลนั้นๆ
     * หากไม่มีเหตุผลอื่นค้างอยู่ ระบบจะคืนสิทธิ์ให้หน้าจอดับตามปกติของ OS
     * @param {string} reason
     */
    release: function (reason) {
      reason = reason || 'general-practice';
      delete activeReasons[reason];
      this._updateIndicators();
      if (!this.isActive()) {
        this._drop();
      }
    },

    /**
     * บังคับปลดล็อคทุกรายการทันที
     */
    releaseAll: function () {
      activeReasons = {};
      this._updateIndicators();
      this._drop();
    },

    // --- Private Methods ---

    _acquire: function () {
      var self = this;
      if (!this.isActive()) return Promise.resolve(false);

      this._bindVisibilityChange();

      if (isSupported) {
        try {
          return navigator.wakeLock.request('screen').then(function (lock) {
            sentinel = lock;
            sentinel.addEventListener('release', function () {
              if (sentinel === lock) {
                sentinel = null;
              }
            });
            return true;
          }).catch(function () {
            // Fallback for low battery, OS policy restriction, or hidden state
            self._startFallback();
            return false;
          });
        } catch (e) {
          self._startFallback();
          return Promise.resolve(false);
        }
      } else {
        // Fallback for browsers without native Screen Wake Lock API (iOS Safari / older engines)
        this._startFallback();
        return Promise.resolve(false);
      }
    },

    _drop: function () {
      if (sentinel) {
        try {
          sentinel.release();
        } catch (e) {}
        sentinel = null;
      }
      this._stopFallback();
    },

    _bindVisibilityChange: function () {
      if (visibilityBound) return;
      visibilityBound = true;
      var self = this;
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible' && self.isActive()) {
            self._acquire();
          }
        });
      }
    },

    // iOS/WebKit Fallback: Hidden silent looping video keep-awake pattern
    _startFallback: function () {
      if (typeof document === 'undefined') return;
      if (!fallbackVideo) {
        try {
          fallbackVideo = document.createElement('video');
          fallbackVideo.setAttribute('playsinline', '');
          fallbackVideo.setAttribute('muted', '');
          fallbackVideo.setAttribute('loop', '');
          fallbackVideo.muted = true;
          fallbackVideo.style.position = 'fixed';
          fallbackVideo.style.top = '-9999px';
          fallbackVideo.style.left = '-9999px';
          fallbackVideo.style.width = '1px';
          fallbackVideo.style.height = '1px';
          fallbackVideo.style.opacity = '0.01';
          fallbackVideo.style.pointerEvents = 'none';
          // 1-pixel silent video loop base64
          fallbackVideo.src = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAADpmcmVlAAAALm1kYXQAAAHAAAYAgAAABbE634A999//5f/6v/8v/9//+/3//7/f/7v/4AAABzdGJsAAAA';
          document.body.appendChild(fallbackVideo);
        } catch (e) {}
      }
      if (fallbackVideo && fallbackVideo.paused) {
        try {
          var p = fallbackVideo.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      }
    },

    _stopFallback: function () {
      if (fallbackVideo) {
        try {
          fallbackVideo.pause();
        } catch (e) {}
      }
    },

    _updateIndicators: function () {
      if (typeof document === 'undefined') return;
      var active = this.isActive();
      var badges = document.querySelectorAll('.wake-lock-badge, #vk-wake-lock-badge');
      badges.forEach(function (badge) {
        if (active) {
          badge.style.display = 'inline-flex';
          badge.setAttribute('title', 'หน้าจอจะไม่ดับขณะฝึกดนตรี (Screen Wake Lock ทำงาน)');
        } else {
          badge.style.display = 'none';
        }
      });
    }
  };

  root.ScreenWakeLock = ScreenWakeLock;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenWakeLock;
  }
})(typeof window !== 'undefined' ? window : this);

