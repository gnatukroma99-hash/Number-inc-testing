/* content/tree.js — ДЕРЕВО ЯДЕР ◆ (v0.6.1: ветви, как настоящее дерево).
   Узлы — обычные апгрейды с res:'cores' и scope:'meta' (ядра не сбрасываются),
   поэтому новых полей в сейве НЕ нужно: уровни живут в state.upg.

   Как добавить узел: одна строка в addUpgrades().
     branch    — ветвь (id из G.content.tree.branches): это колонка на доске
     depth     — глубина в ветви (0 — корень, 1 — следующий...)
     requires  — массив id узлов-предков; пока предок не куплен, узел СКРЫТ
     tier      — ярус по цене (бейдж на карточке): t1 / t2 / t3
     эффект    — данные-поле, которое движок уже читает:
                 addM / Mmult / powM / dtMult / energyMult / spanMult
     formula   — что показывать игроку (для узлов dtMult — «скорость», а не ΔT)
*/
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.tree = {
    res: 'cores',
    hint: '◆ Ядра тратятся только здесь. Четыре ветви: каждая — своя цепочка. ' +
          'Следующий узел ветви виден только после покупки предыдущего.',
    branches: [
      { id: 'start', name: 'Рывок', icon: '🚀', color: '#8ada6a', note: 'как начинается забег', dir: 'left', lane: 'up' },
      { id: 'tempo', name: 'Темп', icon: '⏩', color: '#2bb5ff', note: 'скорость и софткап', dir: 'right', lane: 'up' },
      { id: 'mult', name: 'Множитель', icon: '◈', color: '#ffd166', note: 'плоские × к M', dir: 'left', lane: 'down' },
      { id: 'auto', name: 'Автоматизация', icon: '🤖', color: '#ff9de2', note: 'авто и новые механики', dir: 'right', lane: 'down' }
    ],
    tiers: [
      { id: 't1', name: 'I' },
      { id: 't2', name: 'II' },
      { id: 't3', name: 'III' }
    ]
  };

  G.registry.addUpgrades([
    /* ================= ветвь «Рывок» ================= */
    {
      id: 'tree_headstart', mech: 'tree', branch: 'start', depth: 0, tier: 't1',
      scope: 'meta', res: 'cores',
      name: 'Стартовый рывок', icon: '🚀',
      base: 1, growth: 1.90, max: 8,
      formula: '2 * lvl', fmt: 'num',
      note: 'После перерождения N = 10^(2·lvl)',
      desc: 'Каждый забег начинается не с 1, а с готовых цифр.'
    },
    {
      id: 'tree_headstart2', mech: 'tree', branch: 'start', depth: 1, tier: 't3',
      scope: 'meta', res: 'cores',
      name: 'Рывок II', icon: '🚀',
      base: 90, growth: 2.20, max: 4,
      formula: '10 * lvl', fmt: 'num',
      requires: ['tree_headstart'],
      note: '+10 стартовых цифр за уровень',
      desc: 'Старт забега сразу в глубоком диапазоне.'
    },

    /* ================= ветвь «Темп» ================= */
    {
      id: 'tree_tempo', mech: 'tree', branch: 'tempo', depth: 0, tier: 't1',
      scope: 'meta', res: 'cores',
      name: 'Вечный разгон', icon: '⏩',
      base: 2, growth: 1.70, max: 6,
      formula: '1 / (0.97 ** lvl)', fmt: 'x', dtMult: '0.97 ** lvl',
      note: 'ΔT ×= 0.97^lvl (быстрее)',
      desc: 'Интервал между умножениями короче. Складывается со «Разгоном».'
    },
    {
      id: 'tree_softcap', mech: 'tree', branch: 'tempo', depth: 1, tier: 't2',
      scope: 'meta', res: 'cores',
      name: 'Слом софткапа', icon: '🪓',
      base: 6, growth: 1.85, max: 6,
      formula: '1.12 ** lvl', fmt: 'x', spanMult: '1.12 ** lvl',
      requires: ['tree_tempo'],
      note: 'невидимый софткап: span ×= 1.12^lvl',
      desc: 'Тормоз роста отодвигается. Самое сильное вложение в темп.'
    },
    {
      id: 'tree_pow', mech: 'tree', branch: 'tempo', depth: 2, tier: 't2',
      scope: 'meta', res: 'cores',
      name: 'Показатель', icon: '^',
      base: 10, growth: 2.00, max: 5,
      formula: '1.03 ** lvl', fmt: 'x', powM: '1.03 ** lvl',
      requires: ['tree_softcap'],
      note: 'бонус механик ^ (1.03^lvl), степень ≤ 1.5',
      desc: 'Степень над бонусом механик — умножает всё, что дают доски.'
    },
    {
      id: 'tree_span2', mech: 'tree', branch: 'tempo', depth: 3, tier: 't3',
      scope: 'meta', res: 'cores',
      name: 'Слом софткапа II', icon: '🪓',
      base: 60, growth: 2.00, max: 5,
      formula: '1.15 ** lvl', fmt: 'x', spanMult: '1.15 ** lvl',
      requires: ['tree_pow'],
      note: 'span ×= 1.15^lvl (складывается с первым сломом)',
      desc: 'Второй слой тормоза отодвигается.'
    },

    /* ================= ветвь «Множитель» ================= */
    {
      id: 'tree_base', mech: 'tree', branch: 'mult', depth: 0, tier: 't1',
      scope: 'meta', res: 'cores',
      name: 'Плотность', icon: '▪',
      base: 1, growth: 1.55, max: 12,
      formula: '40 * lvl', fmt: 'num', addM: '40 * lvl',
      note: 'M_base += 40·lvl',
      desc: 'Флэт-плюс к базовому множителю. Работает везде и всегда.'
    },
    {
      id: 'tree_core', mech: 'tree', branch: 'mult', depth: 1, tier: 't2',
      scope: 'meta', res: 'cores',
      name: 'Плотное ядро', icon: '◈',
      base: 4, growth: 1.90, max: 8,
      formula: '1.6 ** lvl', fmt: 'x', Mmult: '1.6 ** lvl',
      requires: ['tree_base'],
      note: 'M ×= 1.6^lvl',
      desc: 'Плоский множитель к M_total поверх всех механик.'
    },
    {
      id: 'tree_core2', mech: 'tree', branch: 'mult', depth: 2, tier: 't3',
      scope: 'meta', res: 'cores',
      name: 'Сверхплотное ядро', icon: '◈',
      base: 120, growth: 2.10, max: 6,
      formula: '2.5 ** lvl', fmt: 'x', Mmult: '2.5 ** lvl',
      requires: ['tree_core'],
      note: 'M ×= 2.5^lvl',
      desc: 'Большой плоский множитель — продолжение ветви.'
    },

    /* ================= ветвь «Автоматизация» ================= */
    {
      id: 'tree_battery', mech: 'tree', branch: 'auto', depth: 0, tier: 't1',
      scope: 'meta', res: 'cores',
      name: 'Ядро-батарейка', icon: '⚡',
      base: 2, growth: 2.20, max: 6,
      formula: '3 ** lvl', fmt: 'x', energyMult: '3 ** lvl',
      note: '⚡ ×= 3^lvl',
      desc: 'Энергия навсегда. Быстрее раскупоривается вся доска «Рост».'
    },
    {
      id: 'tree_auto_all', mech: 'tree', branch: 'auto', depth: 1, tier: 't2',
      scope: 'meta', res: 'cores',
      name: 'Главный автоматизатор', icon: '🤖',
      base: 25, growth: 1, max: 1,
      formula: 'lvl', fmt: 'pct',
      requires: ['tree_battery'],
      note: 'Авто-покупка сама покупает авто всех досок',
      desc: 'Навсегда разрешает автоматизации покупать другие автоматизации.'
    },
    {
      id: 'tree_sieve', mech: 'tree', branch: 'auto', depth: 2, tier: 't3',
      scope: 'meta', res: 'cores',
      name: 'Решето', icon: '⌗',
      base: 80, growth: 1, max: 1,
      formula: 'lvl', fmt: 'pct',
      requires: ['tree_auto_all'],
      note: 'открывает новую доску «Решето»',
      desc: 'Новая механика: решето само находит простые — ❖ и множитель.'
    },
    {
      id: 'tree_mirror', mech: 'tree', branch: 'auto', depth: 3, tier: 't3',
      scope: 'meta', res: 'cores',
      name: 'Зеркало', icon: '⧗',
      base: 150, growth: 1, max: 1,
      formula: 'lvl', fmt: 'pct',
      requires: ['tree_sieve'],
      note: 'открывает новую доску «Зеркало»',
      desc: 'Симметрия мантиссы: множитель за удачу и накопитель.'
    }
  ]);
})(window.G = window.G || {});
