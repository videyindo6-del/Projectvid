/* ProjectVID universal embed resolver.
 * Accepts direct media URLs, provider share URLs, and pasted iframe snippets.
 * A provider can still refuse framing because of its own privacy/CSP settings.
 */
(() => {
  'use strict';
  const hostIs = (host, domain) => host === domain || host.endsWith('.' + domain);
  const safeUrl = value => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url : null;
    } catch { return null; }
  };
  const extract = value => {
    let raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/<(?:iframe|video|audio|source|img)\b/i.test(raw)) {
      try {
        const doc = new DOMParser().parseFromString(raw, 'text/html');
        const node = doc.querySelector('iframe[src],video[src],audio[src],source[src],img[src]');
        raw = node?.getAttribute('src') || '';
      } catch { return ''; }
    }
    if (raw.startsWith('//')) raw = 'https:' + raw;
    return raw;
  };
  function parse(value) {
    const wasIframe = /<iframe\b/i.test(String(value ?? ''));
    const original = extract(value);
    const u = safeUrl(original);
    if (!u) return null;
    const host = u.hostname.toLowerCase();
    const path = u.pathname;
    const fileExt = (path.match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase() || '';
    const make = (type, src, provider, extra = {}) => ({ type, src, original: u.href, provider, ...extra });

    // Dropbox direct media links need raw=1 before generic file-extension handling.
    if (hostIs(host, 'dropbox.com') && ['mp4','m4v','webm','mov','mp3','m4a','jpg','jpeg','png','gif','webp'].includes(fileExt)) {
      const direct = new URL(u.href); direct.searchParams.delete('dl'); direct.searchParams.set('raw', '1');
      if (['mp4','m4v','webm','mov'].includes(fileExt)) return make('video', direct.href, 'Dropbox');
      if (['mp3','m4a'].includes(fileExt)) return make('audio', direct.href, 'Dropbox');
      return make('image', direct.href, 'Dropbox');
    }

    // Direct media files.
    if (['mp4','m4v','webm','ogv','mov','m3u8','mpd'].includes(fileExt)) return make('video', u.href, 'Direct video');
    if (['mp3','m4a','aac','ogg','wav','flac'].includes(fileExt)) return make('audio', u.href, 'Direct audio');
    if (['jpg','jpeg','png','gif','webp','avif','bmp','svg'].includes(fileExt)) return make('image', u.href, 'Direct image');

    // Google Drive / Docs.
    if (hostIs(host, 'drive.google.com') || hostIs(host, 'docs.google.com')) {
      const id = path.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([^/]+)/i)?.[1] || u.searchParams.get('id');
      if (id && hostIs(host, 'drive.google.com')) return make('iframe', `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`, 'Google Drive', { thumbnail: `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200` });
      return make('iframe', u.href, 'Google Workspace');
    }

    // Dropbox shared links: raw=1 serves a browser media asset when the file type allows it.
    if (hostIs(host, 'dropbox.com')) {
      const direct = new URL(u.href);
      direct.searchParams.set('raw', '1');
      const ext = (direct.pathname.match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase() || '';
      if (['mp4','m4v','webm','mov','mp3','m4a','jpg','jpeg','png','gif','webp'].includes(ext)) {
        if (['mp4','m4v','webm','mov'].includes(ext)) return make('video', direct.href, 'Dropbox');
        if (['mp3','m4a'].includes(ext)) return make('audio', direct.href, 'Dropbox');
        return make('image', direct.href, 'Dropbox');
      }
      return make('iframe', u.href, 'Dropbox');
    }

    // OneDrive: native embed URLs and pasted iframe code are supported. Share URLs remain usable as links.
    if (hostIs(host, 'onedrive.live.com') || hostIs(host, '1drv.ms') || hostIs(host, 'sharepoint.com')) {
      if (wasIframe || /\/embed(?:\/|$)/i.test(path) || u.searchParams.has('resid') || u.searchParams.has('embed')) return make('iframe', u.href, 'OneDrive');
      return make('link', u.href, 'OneDrive', { needsEmbedCode: true });
    }

    // MEGA embeds.
    if (hostIs(host, 'mega.nz') || hostIs(host, 'mega.co.nz')) {
      if (/^\/file\//.test(path)) u.pathname = path.replace(/^\/file\//, '/embed/');
      if (/^\/embed\//.test(u.pathname)) return make('iframe', u.href, 'MEGA');
      return make('link', u.href, 'MEGA', { needsEmbedCode: true });
    }

    // Telegram public post widget. Private/invite-only posts cannot be embedded publicly.
    if (hostIs(host, 't.me') || hostIs(host, 'telegram.me')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[0] !== 's') {
        const embed = new URL(u.href);
        embed.searchParams.set('embed', '1');
        embed.searchParams.set('mode', 'tme');
        return make('iframe', embed.href, 'Telegram');
      }
      if (parts.length >= 3 && parts[0] === 's') {
        const embed = new URL(`https://t.me/${parts[1]}/${parts[2]}`);
        embed.searchParams.set('embed', '1');
        return make('iframe', embed.href, 'Telegram');
      }
      return make('link', u.href, 'Telegram');
    }

    // YouTube.
    if (hostIs(host, 'youtube.com') || host === 'youtu.be' || hostIs(host, 'youtube-nocookie.com')) {
      let id = host === 'youtu.be' ? path.split('/').filter(Boolean)[0] : u.searchParams.get('v');
      id ||= path.match(/\/(?:embed|shorts|live)\/([^/?]+)/i)?.[1] || '';
      if (id) return make('iframe', `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`, 'YouTube');
    }
    // Vimeo.
    if (hostIs(host, 'vimeo.com')) {
      const id = path.match(/\/(?:video\/)?(\d+)/)?.[1];
      if (id) return make('iframe', `https://player.vimeo.com/video/${id}`, 'Vimeo');
    }
    // Dailymotion.
    if (hostIs(host, 'dailymotion.com') || host === 'dai.ly') {
      const id = path.match(/\/(?:video|embed\/video)\/([^_/?]+)/)?.[1] || (host === 'dai.ly' ? path.slice(1) : '');
      if (id) return make('iframe', `https://www.dailymotion.com/embed/video/${encodeURIComponent(id)}`, 'Dailymotion');
    }
    // Streamable.
    if (hostIs(host, 'streamable.com')) {
      const id = path.split('/').filter(Boolean).pop();
      if (id) return make('iframe', `https://streamable.com/e/${encodeURIComponent(id)}`, 'Streamable');
    }
    // Loom.
    if (hostIs(host, 'loom.com')) {
      const id = path.match(/\/(?:share|embed)\/([^/?]+)/)?.[1];
      if (id) return make('iframe', `https://www.loom.com/embed/${encodeURIComponent(id)}`, 'Loom');
    }
    // Wistia.
    if (hostIs(host, 'wistia.com') || hostIs(host, 'wistia.net')) {
      const id = path.match(/(?:medias|embed)\/([^/?]+)/)?.[1];
      if (id) return make('iframe', `https://fast.wistia.net/embed/iframe/${encodeURIComponent(id)}`, 'Wistia');
    }
    // Twitch video or channel.
    if (hostIs(host, 'twitch.tv')) {
      const id = path.match(/\/videos\/(\d+)/)?.[1];
      if (id) return make('iframe', `https://player.twitch.tv/?video=${id}&parent=${encodeURIComponent(location.hostname)}`, 'Twitch');
    }
    // Facebook and TikTok: use their public embed endpoints when identifiable.
    if (hostIs(host, 'facebook.com') || hostIs(host, 'fb.watch')) return make('iframe', `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false`, 'Facebook');
    if (hostIs(host, 'tiktok.com')) {
      const id = path.match(/\/video\/(\d+)/)?.[1];
      if (id) return make('iframe', `https://www.tiktok.com/player/v1/${id}`, 'TikTok');
    }

    // Common hosts whose public player URL is directly frameable.
    if (/(^|\.)(videy\.co|doodstream\.com|dood\.to|streamtape\.com|mixdrop\.co|mixdrop\.to|filemoon\.sx|voe\.sx|upstream\.to|mp4upload\.com|vidhide\.com)$/i.test(host)) return make('iframe', u.href, host);
    // Provider-supplied embed URLs and arbitrary pasted iframe snippets.
    if (wasIframe || /\/(?:embed|player|e)\/(?:|[^/]+)/i.test(path) || /[?&](?:embed|player)=/i.test(u.search)) return make('iframe', u.href, host);
    return make('link', u.href, host);
  }
  function provider(value) { return parse(value)?.provider || 'External'; }
  function normalize(value) { const info = parse(value); return info?.src || ''; }
  window.ProjectVIDEmbed = Object.freeze({ parse, provider, normalize, extract });
})();
