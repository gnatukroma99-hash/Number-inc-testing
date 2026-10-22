// Secondary scriptlet initialization
(function() {
  window.canRunAds = true;
  window.isAdBlockActive = false;
  window.showAds = true;
  if (!window.ga) window.ga = function() {};
  if (!window.gtag) window.gtag = function() {};
  if (!window.adsbygoogle) {
    window.adsbygoogle = [];
    window.adsbygoogle.loaded = true;
  }
})();