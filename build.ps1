$domains = @(
  # Amazon
  'adtago.s3.amazonaws.com', 'analyticsengine.s3.amazonaws.com', 'analytics.s3.amazonaws.com', 'advice-ads.s3.amazonaws.com', 'amazon-adsystem.com', 'aax.amazon-adsystem.com',
  # Google & DoubleClick & AdManager
  'pagead2.googlesyndication.com', 'adservice.google.com', 'pagead2.googleadservices.com', 'afs.googlesyndication.com', 'googlesyndication.com', 'googleadservices.com', 'googleads.g.doubleclick.net',
  'doubleclick.net', 'stats.g.doubleclick.net', 'ad.doubleclick.net', 'static.doubleclick.net', 'm.doubleclick.net', 'mediavisor.doubleclick.net', 'securepubads.g.doubleclick.net', 'pubads.g.doubleclick.net',
  # Mobile Ads (AppLovin, IronSource, Unity, AdColony, Vungle, InMobi, Chartboost, Mintegral, Fyber, Tapjoy, Pangle, StartApp, Flurry)
  'applovin.com', 'applvn.com', 'd.applovin.com', 'a.applovin.com', 'assets.applovin.com',
  'ironsrc.com', 'is.com', 'init.supersonicads.com', 'supersonicads.com', 'platform.ironsrc.com',
  'adcolony.com', 'ads30.adcolony.com', 'adc3-launch.adcolony.com', 'events3alt.adcolony.com', 'wd.adcolony.com',
  'vungle.com', 'liftoff.io', 'api.vungle.com', 'ads.vungle.com',
  'inmobi.com', 'config.inmobi.com', 'sdkm.inmobi.com',
  'chartboost.com', 'live.chartboost.com',
  'mintegral.com', 'mintegral.net',
  'fyber.com', 'digitalturbine.com', 'inner-active.mobi',
  'tapjoy.com', 'tapjoyads.com', 'rpc.tapjoy.com',
  'pangle.io', 'pangolin-sdk-toutiao.com', 'pangolin.snssdk.com',
  'startappservice.com', 'start.io', 'startapp.com',
  'flurry.com', 'data.flurry.com',
  # Audio Ads (AdsWizz, Spotify Ads, Pandora, Soundcloud, Triton, Acast, Megaphone)
  'adswizz.com', 'delivery.adswizz.com', 'synchrobox.adswizz.com',
  'ads-fa.spotify.com', 'audio-ak-spotify-com.akamaized.net',
  'tritondigital.com', 'acast.com', 'megaphone.fm', 'omny.fm', 'ads.tunein.com',
  # Video Ads (Teads, Vidazoo, Connatix, Primis, JW Player Ads, Brightcove, Aniview, Playwire)
  'teads.tv', 'a.teads.tv',
  'vidazoo.com', 'static.vidazoo.com',
  'connatix.com', 'cdm.connatix.com',
  'primis.tech', 'live.primis.tech',
  'jwpltx.com', 'jwplayer.com',
  'metrics.brightcove.com',
  'aniview.com', 'goview.aniview.com',
  'playwire.com', 'config.playwire.com',
  # Programmatic Ads (Rubicon/Magnite, Index Exchange, PubMatic, OpenX, AppNexus/Xandr, Smart/Equativ, Sovrn, TripleLift, Yieldmo, ShareThrough)
  'rubiconproject.com', 'magnite.com', 'fastlane.rubiconproject.com',
  'indexww.com', 'casalemedia.com',
  'pubmatic.com', 'image2.pubmatic.com', 'showads.pubmatic.com',
  'openx.net', 'delivery.openx.net',
  'adnxs.com', 'ib.adnxs.com', 'xandr.com',
  'smartadserver.com', 'equativ.com',
  'sovrn.com', 'lijit.com',
  'triplelift.com', 'ib.3lift.com',
  'yieldlab.net', 'yieldmo.com',
  'sharethrough.com',
  # Cross-Site Tracking (BlueKai, LiveRamp, Lotame, Conversant, Neustar, Trade Desk, Tapad, ID5, Parrable)
  'bluekai.com', 'bkrtx.com',
  'liveramp.com', 'rlcdn.com',
  'lotame.com', 'crwdcntrl.net',
  'conversantmedia.com', 'fastclick.net',
  'agkn.com',
  'thetradedesk.com', 'adsrvr.org',
  'tapad.com',
  'id5-sync.com',
  'parrable.com',
  # Media.net & Networks
  'media.net', 'static.media.net', 'adservetx.media.net',
  'taboola.com', 'trc.taboola.com', 'outbrain.com', 'widgets.outbrain.com',
  'criteo.com', 'criteo.net', 'popads.net', 'popcash.net', 'popmyads.com',
  'adsterra.com', 'adsterratech.com', 'exoclick.com', 'exosrv.com', 'propellerads.com',
  'coinhive.com', 'coin-hive.com', 'crypto-loot.com', 'authedmine.com',
  'scorecardresearch.com', 'quantserve.com', 'adform.net', 'moatads.com', 'an-ad-network.com', 'adroll.com',
  # Analytics & Error Trackers
  'analytics.google.com', 'click.googleanalytics.com', 'google-analytics.com', 'ssl.google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'hotjar.com', 'hotjar.io', 'adm.hotjar.com', 'identify.hotjar.com', 'insights.hotjar.com', 'script.hotjar.com', 'surveys.hotjar.com', 'careers.hotjar.com', 'events.hotjar.io',
  'mouseflow.com', 'cdn.mouseflow.com', 'o2.mouseflow.com', 'gtm.mouseflow.com', 'api.mouseflow.com', 'tools.mouseflow.com', 'cdn-test.mouseflow.com',
  'freshmarketer.com', 'claritybt.freshmarketer.com', 'fwtracks.freshmarketer.com',
  'luckyorange.com', 'luckyorange.net', 'api.luckyorange.com', 'realtime.luckyorange.com', 'cdn.luckyorange.com', 'w1.luckyorange.com', 'upload.luckyorange.net', 'cs.luckyorange.net', 'settings.luckyorange.net',
  'stats.wp.com',
  'fingerprint.com', 'fingerprintjs.com', 'fpjs.io', 'api.fpjs.io', 'openfpcdn.io', 'fpjscdn.net', 'fpjs.sh',
  'mixpanel.com', 'cdn.mxpnl.com', 'api-js.mixpanel.com',
  'bugsnag.com', 'notify.bugsnag.com', 'sessions.bugsnag.com', 'api.bugsnag.com', 'app.bugsnag.com',
  'sentry.io', 'browser.sentry-cdn.com', 'app.getsentry.com',
  'clarity.ms', 'segment.com', 'segment.io', 'amplitude.com', 'heap.io', 'matomo.org', 'piwik.pro', 'posthog.com', 'countly.com',
  # Social Media (Facebook, Twitter, LinkedIn, Pinterest, Reddit, TikTok, Snap, Quora, VK/MyTarget)
  'pixel.facebook.com', 'an.facebook.com', 'connect.facebook.net',
  'static.ads-twitter.com', 'ads-api.twitter.com', 'ads.twitter.com', 'platform.twitter.com', 'cdn.syndication.twimg.com',
  'ads.linkedin.com', 'analytics.pointdrive.linkedin.com', 'snap.licdn.com',
  'ads.pinterest.com', 'log.pinterest.com', 'analytics.pinterest.com', 'trk.pinterest.com', 'ct.pinterest.com', 'assets.pinterest.com', 's.pinimg.com',
  'events.reddit.com', 'events.redditmedia.com',
  'ads.youtube.com',
  'ads-api.tiktok.com', 'analytics.tiktok.com', 'ads-sg.tiktok.com', 'analytics-sg.tiktok.com', 'business-api.tiktok.com', 'ads.tiktok.com', 'log.byteoversea.com', 'analytics.byteoversea.com',
  'tr.snapchat.com', 'sc-static.net',
  'q.quora.com',
  'top-fwz1.mail.ru', 'target.my.com', 'counter.yadro.ru',
  # Yahoo & Yandex & Unity
  'ads.yahoo.com', 'analytics.yahoo.com', 'geo.yahoo.com', 'udc.yahoo.com', 'udcm.yahoo.com', 'analytics.query.yahoo.com', 'partnerads.ysm.yahoo.com', 'log.fc.yahoo.com', 'gemini.yahoo.com', 'adtech.yahooinc.com',
  'extmaps-api.yandex.net', 'appmetrica.yandex.ru', 'adfstat.yandex.ru', 'metrika.yandex.ru', 'offerwall.yandex.net', 'adfox.yandex.ru', 'mc.yandex.ru', 'yandex.ru/metrika',
  'auction.unityads.unity3d.com', 'webview.unityads.unity3d.com', 'config.unityads.unity3d.com', 'adserver.unityads.unity3d.com', 'unityads.unity3d.com',
  # Intercom & Drift & HubSpot & Annoyances
  'widget.intercom.io', 'js.intercomcdn.com', 'api-iam.intercom.io', 'intercom.io', 'intercomcdn.com',
  'drift.com', 'js.driftt.com', 'hubspot.com', 'js.hs-scripts.com', 'js.hsanalytics.net',
  # OEMs
  'iot-eu-logser.realme.com', 'iot-logser.realme.com', 'bdapi-ads.realmemobile.com', 'bdapi-in-ads.realmemobile.com',
  'api.ad.xiaomi.com', 'data.mistat.xiaomi.com', 'data.mistat.india.xiaomi.com', 'data.mistat.rus.xiaomi.com', 'sdkconfig.ad.xiaomi.com', 'sdkconfig.ad.intl.xiaomi.com', 'tracking.rus.miui.com',
  'adsfs.oppomobile.com', 'adx.ads.oppomobile.com', 'ck.ads.oppomobile.com', 'data.ads.oppomobile.com',
  'metrics.data.hicloud.com', 'metrics2.data.hicloud.com', 'grs.hicloud.com', 'logservice.hicloud.com', 'logservice1.hicloud.com', 'logbak.hicloud.com',
  'click.oneplus.cn', 'open.oneplus.net',
  'samsungads.com', 'smetrics.samsung.com', 'nmetrics.samsung.com', 'samsung-com.112.2o7.net', 'analytics-api.samsunghealthcn.com',
  'iadsdk.apple.com', 'metrics.icloud.com', 'metrics.mzstatic.com', 'api-adservices.apple.com', 'books-analytics-events.apple.com', 'weather-analytics-events.apple.com', 'notes-analytics-events.apple.com'
)

$patterns = @(
  'banner', 'advert', 'sponsor', 'sentry', 'bugsnag', 'analytics', 'telemetry', 'metrika', 'pixel', 'tracker', 'metrics',
  'adsbox', 'flash_ad', 'google-ad', 'doubleclick', 'textad', 'text-ad', 'textAd', 'ad-', 'ad_', 'ads.js', 'ad.js', 'adframe',
  'show_ads', 'popads', 'popcash', 'coinhive', 'intercom', 'drift', 'hubspot', 'clarity', 'matomo', 'piwik',
  'fingerprint', 'fpjs', 'fp.min.js', 'fp.sdk.js', 'Fingerprint2', 'mixpanel', 'pinit.js', 'widgets.js',
  'audio-ad', 'video-ad', 'vast', 'vpaid', 'preroll', 'midroll', 'postroll', 'outstream', 'instream', 'mobile-ad', 'app-ad'
)

$resourceTypes = @('script', 'image', 'xmlhttprequest', 'sub_frame', 'stylesheet', 'object', 'media', 'font', 'other', 'ping', 'websocket')

$rules = @()
$id = 1

foreach ($d in ($domains | Select-Object -Unique)) {
  $rules += @{
    id = $id
    priority = 1
    action = @{ type = 'block' }
    condition = @{
      urlFilter = $d
      resourceTypes = $resourceTypes
    }
  }
  $id++
}

foreach ($p in ($patterns | Select-Object -Unique)) {
  $rules += @{
    id = $id
    priority = 1
    action = @{ type = 'block' }
    condition = @{
      urlFilter = $p
      resourceTypes = $resourceTypes
    }
  }
  $id++
}

$rules += @{
  id = $id
  priority = 2
  action = @{
    type = 'redirect'
    redirect = @{
      transform = @{
        queryTransform = @{
          removeNullParams = $true
          queryKeyToFilter = @('utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'msclkid')
        }
      }
    }
  }
  condition = @{
    resourceTypes = @('main_frame')
  }
}

$json = ConvertTo-Json -InputObject $rules -Depth 10
[System.IO.File]::WriteAllText('c:\Users\HomePC\Desktop\my adblock\rules.json', $json, [System.Text.Encoding]::UTF8)
Write-Host "Generated $($rules.Count) rules in rules.json"
