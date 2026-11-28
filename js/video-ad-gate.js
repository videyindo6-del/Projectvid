/* BoxCellink 10-second video-ad gate for Watch and AutoLink Task 3. */
(() => {
  'use strict';
  if (window.BoxVideoAdGate) return;

  const VIDEO_SRC = '/assets/ads/57851.mp4?v=20261128-1';
  let overlay = null;
  let video = null;
  let closeButton = null;
  let onComplete = null;
  let maxPlayed = 0;
  let task3Shown = false;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('aside');
    overlay.id = 'boxVideoAdGate';
    overlay.className = 'box-video-ad-gate';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Iklan video');
    overlay.innerHTML = `
      <div class="box-video-ad-gate__stage">
        <video class="box-video-ad-gate__video" playsinline controls preload="none"
          controlsList="nodownload noplaybackrate" disablePictureInPicture
          aria-label="Putar iklan video">
          <source src="${VIDEO_SRC}" type="video/mp4">
          Browser Anda tidak mendukung pemutaran video.
        </video>
        <button type="button" class="box-video-ad-gate__close" aria-label="Tutup iklan" hidden>×</button>
        <p class="box-video-ad-gate__hint" aria-live="polite">Putar iklan sampai selesai untuk melanjutkan.</p>
      </div>`;
    document.body.appendChild(overlay);
    video = overlay.querySelector('video');
    closeButton = overlay.querySelector('.box-video-ad-gate__close');

    video.addEventListener('play', () => {
      overlay.classList.add('is-playing');
    });
    video.addEventListener('timeupdate', () => {
      const now = Number(video.currentTime || 0);
      if (now > maxPlayed) maxPlayed = now;
    });
    video.addEventListener('seeking', () => {
      const requested = Number(video.currentTime || 0);
      if (requested > maxPlayed + 0.35) {
        video.currentTime = maxPlayed;
      }
    });
    video.addEventListener('ratechange', () => {
      if (video.playbackRate !== 1) video.playbackRate = 1;
    });
    video.addEventListener('ended', () => {
      closeButton.hidden = false;
      overlay.classList.add('is-finished');
      const hint = overlay.querySelector('.box-video-ad-gate__hint');
      if (hint) hint.textContent = 'Iklan selesai. Tekan X untuk melanjutkan.';
      closeButton.focus();
    });
    video.addEventListener('error', () => {
      const hint = overlay.querySelector('.box-video-ad-gate__hint');
      if (hint) hint.textContent = 'Video iklan gagal dimuat. Periksa koneksi lalu muat ulang halaman.';
    });
    closeButton.addEventListener('click', () => {
      if (!video.ended) return;
      const done = onComplete;
      onComplete = null;
      video.pause();
      video.currentTime = 0;
      maxPlayed = 0;
      closeButton.hidden = true;
      overlay.classList.remove('is-playing', 'is-finished');
      overlay.hidden = true;
      document.body.classList.remove('box-video-ad-gate-open');
      if (typeof done === 'function') done();
    });
  }

  function show(onDone) {
    ensureOverlay();
    onComplete = typeof onDone === 'function' ? onDone : null;
    maxPlayed = 0;
    closeButton.hidden = true;
    overlay.classList.remove('is-playing', 'is-finished');
    const hint = overlay.querySelector('.box-video-ad-gate__hint');
    if (hint) hint.textContent = 'Putar iklan sampai selesai untuk melanjutkan.';
    video.pause();
    video.currentTime = 0;
    overlay.hidden = false;
    video.load();
    document.body.classList.add('box-video-ad-gate-open');
    // Keep focus inside the modal without forcing autoplay (mobile browsers require a user gesture).
    window.setTimeout(() => video?.focus?.(), 0);
  }

  function attachWatchPlayer(player) {
    if (!player || player.classList.contains('vip-preview-placeholder')) return;
    if (!player.querySelector('iframe,video,audio')) return;
    if (player.querySelector('.box-watch-ad-cover')) return;
    const cover = document.createElement('button');
    cover.type = 'button';
    cover.className = 'box-watch-ad-cover';
    cover.setAttribute('aria-label', 'Tonton iklan terlebih dahulu untuk melanjutkan');
    cover.innerHTML = '<span class="box-watch-ad-cover__play"><i class="fa-solid fa-play" aria-hidden="true"></i></span><span>Tonton iklan untuk melanjutkan</span>';
    cover.addEventListener('click', () => {
      show(() => cover.remove());
    });
    player.appendChild(cover);
  }

  function showTask3() {
    if (task3Shown) return;
    task3Shown = true;
    show();
  }

  window.BoxVideoAdGate = { attachWatchPlayer, showTask3 };
})();
