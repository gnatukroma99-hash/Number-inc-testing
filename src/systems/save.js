/* systems/save.js — сохранение, загрузка, миграции, оффлайн-прогресс, экспорт/импорт.
   Прямой JSON.stringify(state) запрещён правилами — только через serialize(). */
(function (G) {
  'use strict';

  const KEY = 'number_incremental_save_v1';
  const OFFLINE_CAP = 8 * 3600;   // сек
  const OFFLINE_EFF = 0.5;        // 50% эффективности оффлайн
  const OFFLINE_STEP = 10;        // цифр за шаг интегрирования софткапа
  const OFFLINE_STEPS_MAX = 40;   // предел шагов (10 × 40 = 400 цифр за оффлайн)

  /* D2 (Измерение 2) живёт в systems/d2.js. Сейв не должен падать без этого модуля:
     тогда просто отдаём/принимаем то, что уже есть в state.d2. */
  function ensureD2(state) {
    if (G.d2 && typeof G.d2.ensure === 'function') return G.d2.ensure(state);
    return state.d2 || null;
  }

  const S = {
    KEY: KEY,

    /* ---- сериализация ---- */
    /* ВАЖНО: отдаём СНИМОК, а не ссылки на живые объекты state. Раньше res/upg/mech
       уходили по ссылке, и правка state после serialize() меняла уже «сохранённые» данные. */
    serialize(state) {
      return JSON.parse(JSON.stringify({
        v: G.SAVE_VERSION,
        created: state.created,
        lastSeen: Date.now(),
        N: { m: state.N.m, e: state.N.e },
        res: state.res,
        upg: state.upg,
        mech: state.mech,
        stats: state.stats,
        settings: state.settings,
        meta: state.meta,
        d2: ensureD2(state)          // D2 тоже снимок (JSON.stringify ниже копирует)
      }));
    },

    deserialize(data) {
      const state = G.newState();
      if (!data || typeof data !== 'object') return state;

      if (data.N && typeof data.N.m === 'number') state.N = { m: data.N.m, e: data.N.e };
      if (data.created) state.created = data.created;
      if (data.lastSeen) state.lastSeen = data.lastSeen;
      if (data.res) Object.assign(state.res, data.res);
      if (data.upg) Object.assign(state.upg, data.upg);
      if (data.mech) Object.assign(state.mech, data.mech);
      if (data.stats) Object.assign(state.stats, data.stats);
      if (data.settings) Object.assign(state.settings, data.settings);
      if (data.meta) Object.assign(state.meta, data.meta);
      if (data.d2) state.d2 = data.d2;

      if (!G.BN.isValid(state.N)) state.N = G.BN.one();
      G.initResources(state);
      state.D = G.growth ? G.growth.D(state) : 0;
      S.migrate(state, data.v || 1);
      return state;
    },

    /* миграции между версиями сейва */
    migrate(state, from) {
      if (from < 2) {
        /* v2: ◆ Ядра и перерождение — новые поля, старые сейвы получают дефолты */
        if (typeof state.meta.totalRuns !== 'number') state.meta.totalRuns = 0;
        if (typeof state.meta.bestD !== 'number') state.meta.bestD = 0;
      }
      /* v0.10.1: рекорд ядер для узла «Ядра не сгорают» */
      if (typeof state.meta.coresBest !== 'number' || !isFinite(state.meta.coresBest)) {
        state.meta.coresBest = state.res.cores || 0;
      }
      /* v3: D2 живёт в state.d2 (в v2 и старше его нет — сейв получает дефолт).
         ensure нужен и для v3: он же чинит частично записанный/импортированный D2.
         Поля D1 (N, res, upg, mech, stats, settings, meta) не трогаются. */
      ensureD2(state);
      state.version = G.SAVE_VERSION;
      return state;
    },

    /* ---- localStorage ---- */
    saveLocal(state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(S.serialize(state)));
        return true;
      } catch (e) {
        console.warn('[save] не удалось сохранить', e);
        return false;
      }
    },

    loadLocal() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        return S.deserialize(JSON.parse(raw));
      } catch (e) {
        console.warn('[save] повреждённый сейв', e);
        return null;
      }
    },

    clearLocal() {
      try { localStorage.removeItem(KEY); } catch (e) { /* пусто */ }
    },

    /* ---- экспорт / импорт строкой ---- */
    exportString(state) {
      const json = JSON.stringify(S.serialize(state));
      return btoa(unescape(encodeURIComponent(json)));
    },

    importString(str) {
      try {
        const json = decodeURIComponent(escape(atob(str.trim())));
        return S.deserialize(JSON.parse(json));
      } catch (e) {
        console.warn('[save] импорт не удался', e);
        return null;
      }
    },

    /* ---- оффлайн: закрытая форма, без пошаговой симуляции ---- */

    /* Потолок оффлайн-прогресса: ближайшая НЕПРОЙДЕННАЯ стена из данных
       G.content.barriers (wall_308 / wall_1000 и любые будущие).
       Пройденная стена (её снимает БОЛЬШОЙ БУМ навсегда) оффлайн больше не держит.
       Раньше здесь стоял хардкод Math.min(d, 308) — и сейв с D > 308 откатывался
       до 1e308 при каждом возвращении в игру.
       Ниже текущего D потолок не опускается: оффлайн не уменьшает число. */
    offlineCap(state, before) {
      let cap = Infinity;
      for (const b of (G.content && G.content.barriers) || []) {
        if (G.growth.passed(state, b.id)) continue;
        if (typeof b.requires === 'function' && !b.requires(state)) continue;
        const wall = Number(b.wall);
        if (isFinite(wall) && wall < cap) cap = wall;
      }
      if (!isFinite(cap)) return Infinity;
      return Math.max(before, cap);
    },

    applyOffline(state) {
      const now = Date.now();
      const last = state.lastSeen || now;
      const elapsed = Math.min((now - last) / 1000, OFFLINE_CAP);
      state.lastSeen = now;
      if (elapsed < 30) return null;

      const M = G.growth.M(state);
      const dT = G.growth.dt(state);
      const steps = (elapsed / dT) * OFFLINE_EFF;
      const gainD = Math.max(0, Math.log10(M)) * steps;

      const before = G.BN.log10(state.N);
      const cap = S.offlineCap(state, before);

      /* невидимый софткап применяем к оффлайну тоже — шагами по 10 цифр */
      let d = before;
      let left = gainD;
      for (let i = 0; i < OFFLINE_STEPS_MAX && left > 1e-9 && d < cap; i++) {
        const f = G.growth.hiddenFactor(state, d);
        const step = Math.min(left, OFFLINE_STEP);
        d = Math.min(cap, d + step * f);
        left -= step;
      }
      /* оффлайн никогда не уменьшает D и не переходит непройденную стену */
      let after = Math.min(d, cap);
      if (!isFinite(after) || after < before) after = before;
      state.N = G.BN.fromLog10(after);
      state.disp = null;

      const energy = G.growth.energyRate(state) * elapsed * OFFLINE_EFF;
      state.res.energy = (state.res.energy || 0) + energy;

      state.D = G.growth.D(state);
      return { seconds: elapsed, gainedD: after - before, energy: energy };
    }
  };

  G.save = S;
})(window.G = window.G || {});
