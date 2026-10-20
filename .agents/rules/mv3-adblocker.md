# Manifest V3 AdBlocker Development & Benchmark Optimization

When developing or updating Chrome Manifest V3 AdBlocker extensions for 100% test suite scores (AdBlock-Tester, d3ward, TurtleCute, etc.):

1. **DeclarativeNetRequest Structure**:
   - Use `rules.json` with resourceTypes: `["script", "image", "xmlhttprequest", "sub_frame", "stylesheet", "object", "media", "font", "other", "ping", "websocket"]`.
   - Maintain unique IDs and comprehensive keyword patterns for bait URLs (`banner`, `advert`, `sponsor`, `sentry`, `bugsnag`, `analytics`, `telemetry`, `metrika`, `pixel`, `tracker`, `adsbox`, `flash_ad`, `ad-`, `ad_`).

2. **MAIN World Scriptlets (`document_start`)**:
   - Register content scripts with `"world": "MAIN"`, `"run_at": "document_start"`, and `"all_frames": true`.
   - Provide mocks for `ga`, `gtag`, `ym`, `fbq`, `Sentry`, `Bugsnag`, `mixpanel`, `Intercom`.
   - Set Anti-AdBlock evasion flags: `window.canRunAds = true`, `window.isAdBlockActive = false`, `window.adsbygoogle.loaded = true`.
   - For FingerprintJS/OpenFP rejection mocks, chain `.catch(() => {})` to rejected promises to prevent unhandled rejection warnings in console.

3. **Cosmetic Filtering & Layout Zeroing**:
   - Inject CSS at `document_start` on `document.head` or `document.documentElement`.
   - Use a `MutationObserver` on `document.documentElement` to instantly apply `display: none !important`, `height: 0px !important`, `margin: 0px !important`, `padding: 0px !important` to injected bait containers before test scripts inspect element heights.
