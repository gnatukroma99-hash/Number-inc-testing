/* mechanics/turntree/index.js — механика «Дерево ⧜» (Ярус 4, v0.31.0).
   Логики нет: узлы — данные (content/turntree.js), покупка — общий systems/upgrades.js
   (res: 'turns'), карта — общий mechanics/tree/engine.js. */
(function (G) {
  'use strict';

  const cfg = () => G.content.turntree;
  const list = () => G.registry.upgradesOf('turntree');

  G.registry.addMechanic({
    id: 'turntree',
    order: 9.7,
    name: 'Дерево ⧜',
    short: 'Дерево ⧜',
    icon: 'cycle',
    scope: 'meta',
    noBulk: true,          // у узлов дерева своя цена, массовая покупка не нужна
    fullscreen: true,      // карта на весь экран
    lockHint: 'нужен ОБОРОТ (Ярус 4)',
    hint: cfg().hint,

    isUnlocked(state) {
      return (state.res.turns || 0) > 0 || (G.turn && G.turn.tierOpen(state));
    },

    bought(state) {
      let n = 0;
      for (const u of list()) if (G.lvl(state, u.id) > 0) n++;
      return n;
    },

    total() { return list().length; },

    vars(state) {
      let n = 0;
      for (const u of list()) if (G.lvl(state, u.id) > 0) n++;
      return { turnNodes: n };
    },

    status(state) {
      return '⧜ ' + G.fmt.num(Math.floor(state.res.turns || 0));
    }
  });
})(window.G = window.G || {});
