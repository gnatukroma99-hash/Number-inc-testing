/* systems/state.js — состояние игры и УНИВЕРСАЛЬНЫЙ сброс по scope.
   scope: 'run'  — сбрасывается любым престижем
          'tier' — сбрасывается переходом на следующий ярус
          'meta' — не сбрасывается НИКОГДА
   Никаких ручных списков «что обнулить» — движок идёт по реестру. */
(function (G) {
  'use strict';

  G.SAVE_VERSION = 2;
  G.VERSION = '0.12.3';

  const DEFAULT_SETTINGS = {
    numberFormat: 'short',     // short | sci | full
    numberPosition: 'top',     // top | bottom | minimal
    animations: true,
    autosave: true,
    autosaveInterval: 10,      // сек
    scientificHints: true,
    buyMode: '1',
    buyFilter: false,          // показывать только доступные апгрейды
    buySort: 'price',          // 'price' | 'level' | 'name'              // '1' | '10' | '100' | 'max' — сколько покупать за клик
    sound: true,               // звук покупок/перерождения (WebAudio, без файлов)
    devMode: false,            // режим разработчика: ускорение всей игры
    devSpeed: 1,               // 1..100 (см. systems/timescale.js)
    cloudAuto: false,           // автосинхронизация с GitHub Gist
    cloudInterval: 120          // сек
  };

  G.newState = function () {
    return {
      version: G.SAVE_VERSION,
      created: Date.now(),
      lastSeen: Date.now(),

      /* ядро */
      N: G.BN.one(),
      tickAcc: 0,              // накопитель до следующего умножения
      D: 0,                    // кэш log10(N)
      disp: null,              // плавное отображение {from,to,t0,dur}

      /* ресурсы (значения по умолчанию берутся из реестра) */
      res: {},

      /* уровни апгрейдов */
      upg: {},

      /* приватные данные механик */
      mech: {},

      /* сэмпл цифровых статистик */
      sample: null,

      stats: {
        bestD: 0,
        playtime: 0,
        samples: 0,
        primesFound: 0,
        boomTime: 0               // когда достигли первого барьера (для будущего)
      },

      settings: Object.assign({}, DEFAULT_SETTINGS),

      /* мета-прогресс: никогда не сбрасывается */
      meta: {
        achievements: [],
        unlockedMechanics: [],
        autoOptimizers: {},
        totalRuns: 0,
        bestD: 0,
        coresBest: 0            // рекорд ядер (для узла «Ядра не сгорают»)
      }
    };
  };

  /* заполнить ресурсы значениями по умолчанию */
  G.initResources = function (state) {
    for (const r of G.registry.allResources()) {
      if (typeof state.res[r.id] !== 'number' || !isFinite(state.res[r.id])) {
        state.res[r.id] = r.value || 0;
      }
    }
  };

  /**
   * Сбросить всё, что имеет один из перечисленных scope.
   * G.resetScopes(state, ['run'])            — обычное перерождение
   * G.resetScopes(state, ['run','tier'])     — переход на следующий ярус
   */
  G.resetScopes = function (state, scopes) {
    const hit = (scope) => scopes.indexOf(scope || 'run') >= 0;

    for (const r of G.registry.allResources()) {
      if (hit(r.scope)) state.res[r.id] = r.value || 0;
    }
    for (const u of G.registry.allUpgrades()) {
      if (hit(u.scope)) state.upg[u.id] = 0;
    }
    for (const m of G.registry.mechanics()) {
      if (hit(m.scope)) {
        delete state.mech[m.id];
        if (typeof m.onReset === 'function') m.onReset(state);
      }
    }

    state.N = G.BN.one();
    state.D = 0;
    state.tickAcc = 0;
    state.sample = null;
    state.disp = null;

    G.bus.emit('state:reset', { scopes: scopes });
  };

  /* анимации включены? (настройка + быстрый доступ для компонентов) */
  G.animationsOff = function () {
    const s = (G.state && G.state.settings) || {};
    return s.animations === false || (typeof document !== 'undefined' &&
      document.body && document.body.classList.contains('no-anim'));
  };

  /* безопасный геттер уровня */
  G.lvl = function (state, id) {
    const v = state.upg[id];
    return typeof v === 'number' && isFinite(v) ? v : 0;
  };
})(window.G = window.G || {});
