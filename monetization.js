(function () {
  const cfg = window.WMT_CONFIG || {};
  const client = (cfg.adsenseClient || '').trim();
  const slots = cfg.adSlots || {};

  function loadAdSense() {
    if (!client || document.querySelector('script[data-wmt-adsense]')) return;
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.dataset.wmtAdsense = 'true';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(s);
  }

  function hydrateAd(el) {
    const slotKey = el.dataset.adSlotKey;
    const slot = (slots[slotKey] || '').trim();
    if (!client || !slot) return;

    el.classList.add('ad-slot-live');
    el.innerHTML = '';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = client;
    ins.dataset.adSlot = slot;
    ins.dataset.adFormat = el.dataset.adFormat || 'auto';
    ins.dataset.fullWidthResponsive = 'true';
    el.appendChild(ins);

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.warn('AdSense slot could not initialize.', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const adEls = [...document.querySelectorAll('[data-ad-slot-key]')];
    if (!adEls.length) return;
    if (client) loadAdSense();

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            hydrateAd(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '300px 0px' });
      adEls.forEach((el) => io.observe(el));
    } else {
      adEls.forEach(hydrateAd);
    }
  });
})();
