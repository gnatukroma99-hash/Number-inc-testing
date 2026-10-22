// MAIN world scriptlet execution & anti-adblock evasion
(function initAdBlockScriptlets() {
  const noop = function() {};
  const noopObj = new Proxy({}, { get: () => noop });

  // 1. Google Analytics & Tag Manager Mocks
  window.ga = window.ga || noop;
  window.gtag = window.gtag || noop;
  window.dataLayer = window.dataLayer || [];

  // 2. Google Ads / AdSense Mocks
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.loaded = true;
  window.adsbygoogle.push = function(obj) {
    if (obj && typeof obj === 'object') {
      try {
        if (typeof obj.onload === 'function') obj.onload();
      } catch (e) {}
    }
  };

  // 3. Anti-AdBlock evasion flags
  window.canRunAds = true;
  window.isAdBlockActive = false;
  window.showAds = true;
  window.adBlockDetected = false;
  window.__adblocker = false;

  // 4. Analytics & Tracking & Widget Mocks
  window.ym = window.ym || noop;
  window.Metrika = window.Metrika || noop;
  window.fbq = window.fbq || noop;
  window._fbq = window._fbq || noop;
  window.twq = window.twq || noop;
  window.ttq = window.ttq || noop;
  window.twttr = window.twttr || { widgets: { load: noop, createShareButton: noop } };
  window.PDK = window.PDK || { me: noop };
  window.Intercom = window.Intercom || noop;
  
  // FingerprintJS Mocking (v2, v3, v4 & OpenFP) with clean promise rejection handling
  window.FingerprintJS = window.FingerprintJS || {
    load: function() {
      const p = Promise.reject(new Error("Blocked by AdBlocker"));
      p.catch(() => {});
      return p;
    }
  };
  window.Fingerprint2 = window.Fingerprint2 || {
    get: function(cb) {
      if (typeof cb === 'function') cb([], []);
    }
  };
  
  const fpP = Promise.reject(new Error("Blocked by AdBlocker"));
  fpP.catch(() => {});
  window.fpPromise = fpP;

  window.mixpanel = window.mixpanel || { init: noop, track: noop, identify: noop, people: { set: noop } };

  // 5. Error & Performance Monitoring Mocks (Sentry, Bugsnag, Hotjar)
  window.Sentry = window.Sentry || {
    init: noop,
    captureException: noop,
    captureMessage: noop,
    withScope: noop,
    configureScope: noop
  };
  window.Bugsnag = window.Bugsnag || { start: noop, notify: noop, getPlugin: () => noopObj };
  window.hj = window.hj || noop;

  // Comprehensive cosmetic stylesheet injection for ALL CSS Bait classes & IDs
  const css = `
    .advert, .google-ad, .adsbygoogle, .doubleclick-ad, .textAd, .text-ad, .textad,
    .ad-banner, .adsbox, .advertisement, .ad-container, .ad-unit, .ad-box, .ad_unit,
    .sponsored-content, .banner-advertisement, .adHeader, .ad-header, .ad_header,
    .ad-title, .ad_title, .adSlot, .ad-slot, .ad_slot, .adWrapper, .ad-wrapper, .ad_wrapper,
    .adText, .ad-text, .ad_text, .adImage, .ad-image, .ad_image, .adLink, .ad-link, .ad_link,
    .banner, .sponsor, .sponsored, .ad_box, .ad_frame, .adframe,
    [class*="ad-"], [id*="ad-"], [class*="-ad"], [id*="-ad"],
    [class*="ad_"], [id*="ad_"], [class*="_ad"], [id*="_ad"],
    [class*="advert"], [id*="advert"],
    [class*="banner"], [id*="banner"],
    [class*="sponsored"], [id*="sponsored"],
    [class*="adsbygoogle"], [id*="adsbygoogle"],
    [class*="doubleclick"], [id*="doubleclick"],
    [class*="textad"], [id*="textad"], [class*="textAd"], [id*="textAd"],
    iframe[src*="ads"], iframe[src*="banner"], iframe[src*="doubleclick"], iframe[src*="ad-"], iframe[src*="advert"],
    ins.adsbygoogle, ins[class*="adsbygoogle"], ins[id*="adsbygoogle"],
    img[src*="banner"], img[src*="ad-"], img[src*="ad_"], img[src*="advert"], img[src*="sponsor"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      width: 0 !important;
      min-width: 0 !important;
      max-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      pointer-events: none !important;
    }
  `;

  function injectStyle() {
    if (!document.getElementById('abp-style')) {
      const style = document.createElement('style');
      style.id = 'abp-style';
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  if (document.head || document.documentElement) {
    injectStyle();
  } else {
    document.addEventListener('DOMContentLoaded', injectStyle);
  }

  const hideElement = (el) => {
    if (el && el.style && el.id !== 'abp-style') {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('height', '0px', 'important');
      el.style.setProperty('width', '0px', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('margin', '0px', 'important');
      el.style.setProperty('padding', '0px', 'important');
    }
  };

  const selector = `
    .advert, .google-ad, .adsbygoogle, .doubleclick-ad, .textAd, .text-ad, .textad,
    .ad-banner, .adsbox, .advertisement, .ad-container, .ad-unit, .ad-box, .ad_unit,
    .sponsored-content, .banner-advertisement, .banner, .sponsor, .sponsored,
    [class*="ad-"], [id*="ad-"], [class*="ad_"], [id*="ad_"], [class*="advert"], [id*="advert"],
    [class*="banner"], [id*="banner"], [class*="sponsored"], [id*="sponsored"],
    ins.adsbygoogle, iframe[src*="ads"], img[src*="banner"], img[src*="ad"]
  `;

  const cleanAds = () => {
    document.querySelectorAll(selector).forEach(hideElement);
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.matches && node.matches(selector)) {
            hideElement(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll(selector).forEach(hideElement);
          }
        }
      }
    }
  });

  const root = document.documentElement || document;
  observer.observe(root, { childList: true, subtree: true });

  setInterval(cleanAds, 50);
})();