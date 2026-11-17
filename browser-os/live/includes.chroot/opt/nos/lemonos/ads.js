(function () {
  function cfg() {
    return typeof CONFIG !== 'undefined' ? CONFIG : {};
  }

  function isConfigured() {
    const c = cfg();
    const client = String(c.adsenseId || '');
    const slot = String(c.adsenseSlot || '');
    return /^ca-pub-\d{6,}$/.test(client) && /^\d{6,}$/.test(slot) && !/^0+$/.test(slot);
  }

  function injectLoader(client) {
    if (document.querySelector('script[data-adsense], script[src*="adsbygoogle.js"]')) return;
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-adsense', client);
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    document.head.appendChild(s);
  }

  function fill() {
    const slots = document.querySelectorAll('.ad-slot');
    if (!slots.length) return;

    if (!isConfigured()) {
      slots.forEach((slot) => {
        slot.hidden = true;
        slot.setAttribute('data-filled', 'false');
        slot.setAttribute('aria-hidden', 'true');
      });
      return;
    }

    const c = cfg();
    injectLoader(c.adsenseId);
    slots.forEach((slot) => {
      if (slot.getAttribute('data-filled') === 'true') return;
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', c.adsenseId);
      ins.setAttribute('data-ad-slot', c.adsenseSlot);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      slot.textContent = '';
      slot.appendChild(ins);
      slot.setAttribute('data-filled', 'true');
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        /* ad blocker or network refusal */
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
  else fill();

  if (typeof window !== 'undefined') window.AdSlots = { fill, isConfigured };
})();
