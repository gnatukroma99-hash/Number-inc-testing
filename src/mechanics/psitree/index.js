/* mechanics/psitree/index.js — механика «Ψ-дерево» (Ярус 3, v0.26.0).
   Логики нет: узлы — данные (content/psitree.js), покупка — общий systems/upgrades.js
   (res: 'psi'). Доска — тот же движок карты, что у «Дерева ◆». */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'psitree',
    order: 9.6,
    name: 'Ψ-дерево',
    short: 'Ψ-дерево',
    icon: 'facet',
    scope: 'meta',
    noBulk: true,          // у узлов дерева своя цена, массовая покупка не нужна
    fullscreen: true,      // доска занимает весь экран (карта, а не список)
    lockHint: 'нужен ПРОБОЙ и хотя бы 1 Ψ',
    hint: G.content.psitree.hint,

    isUnlocked(state) {
      return (state.res.psi || 0) > 0 || (state.meta.breaks || 0) > 0;
    },

    /* сколько узлов куплено (для бейджа и плиток) */
    bought(state) {
      let n = 0;
      for (const u of G.registry.upgradesOf('psitree')) if (G.lvl(state, u.id) > 0) n++;
      return n;
    },

    total() {
      return G.registry.upgradesOf('psitree').length;
    },

    vars(state) {
      let n = 0;
      for (const u of G.registry.upgradesOf('psitree')) if (G.lvl(state, u.id) > 0) n++;
      return { psiNodes: n };
    },

    status(state) {
      return 'Ψ ' + G.fmt.num(Math.floor(state.res.psi || 0));
    }
  });
})(window.G = window.G || {});
