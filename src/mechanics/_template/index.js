/* mechanics/_template/index.js — ШАБЛОН механики. Скопируй папку и переименуй.
   Шаги: 1) id везде заменить  2) добавить <script> в index.html  3) записать в docs/MECHANICS.md */
(function (G) {
  'use strict';

  /* --- апгрейды этой механики (данные, формулы строками) --- */
  G.registry.addUpgrades([
    {
      id: 'tpl_power', mech: 'template', name: 'Имя апгрейда', res: 'energy',
      base: 100, growth: 2.0, max: 10,
      formula: '1 + 0.1 * lvl', fmt: 'x',
      note: 'M ×= 1 + 0.1·lvl'
    }
  ]);

  /* --- сама механика --- */
  G.registry.addMechanic({
    id: 'template',
    order: 99,
    name: 'Шаблон механики',
    short: 'Шаблон',
    icon: '?',
    scope: 'run',
    hint: 'Описание для игрока.',

    isUnlocked(state) {
      return G.growth.D(state) >= 3;
    },

    /* множитель к M_total */
    mult(state) {
      const lvl = G.lvl(state, 'tpl_power');
      if (!lvl) return 1;
      const v = G.formula('1 + 0.1 * lvl', { lvl: lvl });
      return isFinite(v) && v > 0 ? v : 1;
    },

    /* приватное состояние механики */
    data(state) {
      if (!state.mech.template) state.mech.template = { counter: 0 };
      return state.mech.template;
    },

    tick(state, dt) {
      const d = this.data(state);
      d.counter += dt;
    },

    onReset(state) {
      state.mech.template = { counter: 0 };
    },

    status(state) {
      return 'ур.' + G.lvl(state, 'tpl_power');
    }
  });
})(window.G = window.G || {});
