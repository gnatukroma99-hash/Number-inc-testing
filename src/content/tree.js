/* content/tree.js — ДЕРЕВО ЯДЕР ◆ (v0.10.0: 6 ветвей, 30 узлов).
   Узлы — обычные апгрейды с res:'cores' и scope:'meta' (ядра не сбрасываются),
   поэтому новых полей в сейве НЕ нужно: уровни живут в state.upg.

   Как добавить узел: одна строка в addUpgrades().
     branch    — ветвь (id из G.content.tree.branches)
     depth     — глубина в ветви (0 — корень)
     lane      — номер «полосы» (число, 0 = центр): -1 вверх, +1 вниз
     requires  — предки; пока не куплены, узел СКРЫТ
     tier      — ярус по цене (бейдж): t1 / t2 / t3
     эффект    — поле, которое читает движок:
                 addM / Mmult / powM / dtMult / energyMult / spanMult /
                 coreGainMult / coreGainAdd / autoStepMult / shopCostMult / primeGainMult
*/
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.tree = {
    res: 'cores',
    hint: '◆ Ядра тратятся только здесь. Шесть ветвей: каждая — своя цепочка. ' +
          'Следующий узел ветви виден только после покупки предыдущего.',
    branches: [
      { id: 'start', name: 'Рывок', icon: '🚀', color: '#8ada6a', note: 'старт забега сильнее', dir: 'left', lane: -1 },
      { id: 'tempo', name: 'Темп', icon: '⏩', color: '#2bb5ff', note: 'скорость и софткап', dir: 'right', lane: -1 },
      { id: 'mult', name: 'Множитель', icon: '◈', color: '#ffd166', note: 'плоские × к M', dir: 'left', lane: 0 },
      { id: 'auto', name: 'Автоматизация', icon: '🤖', color: '#ff9de2', note: 'авто и механики', dir: 'right', lane: 0 },
      { id: 'cores', name: 'Ядра', icon: '◆', color: '#ffb14d', note: 'больше ◆ за перерождение', dir: 'left', lane: 1 },
      { id: 'income', name: 'Доход', icon: '❖', color: '#6ee7f9', note: 'энергия, ❖, цены', dir: 'right', lane: 1 }
    ],
    tiers: [
      { id: 't1', name: 'I' },
      { id: 't2', name: 'II' },
      { id: 't3', name: 'III' }
    ]
  };

  G.registry.addUpgrades([
    /* ================= 🚀 ветвь «Рывок» ================= */
    {
      id: 'tree_headstart', mech: 'tree', branch: 'start', depth: 0, lane: -1, tier: 't1',
      scope: 'meta', res: 'cores', icon: '🚀',
      name: 'Стартовый рывок', base: 1, growth: 1.90, max: 8,
      formula: '2 * lvl', fmt: 'num',
      note: 'после P1 N = 10^(2·lvl)',
      desc: 'Каждый забег начинается не с 1, а с готовых цифр.'
    },
    {
      id: 'tree_headstart2', mech: 'tree', branch: 'start', depth: 1, lane: -1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '🚀',
      name: 'Рывок II', base: 90, growth: 2.20, max: 4,
      formula: '10 * lvl', fmt: 'num',
      requires: ['tree_headstart'],
      note: '+10 стартовых цифр за уровень',
      desc: 'Старт забега сразу в глубоком диапазоне.'
    },
    {
      id: 'tree_headstart3', mech: 'tree', branch: 'start', depth: 2, lane: -1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '🚀',
      name: 'Рывок III', base: 400, growth: 2.40, max: 3,
      formula: '40 * lvl', fmt: 'num',
      requires: ['tree_headstart2'],
      note: '+40 стартовых цифр за уровень',
      desc: 'Забег начинается почти с прошлой вершины.'
    },

    /* ================= ⏩ ветвь «Темп» ================= */
    {
      id: 'tree_tempo', mech: 'tree', branch: 'tempo', depth: 0, lane: -1, tier: 't1',
      scope: 'meta', res: 'cores', icon: '⏩',
      name: 'Вечный разгон', base: 2, growth: 1.70, max: 6,
      formula: '1 / (0.97 ** lvl)', fmt: 'x', dtMult: '0.97 ** lvl',
      note: 'ΔT ×= 0.97^lvl',
      desc: 'Интервал между умножениями короче.'
    },
    {
      id: 'tree_softcap', mech: 'tree', branch: 'tempo', depth: 1, lane: -1, tier: 't2',
      scope: 'meta', res: 'cores', icon: '🪓',
      name: 'Слом софткапа', base: 6, growth: 1.85, max: 6,
      formula: '1.12 ** lvl', fmt: 'x', spanMult: '1.12 ** lvl',
      requires: ['tree_tempo'],
      note: 'span ×= 1.12^lvl',
      desc: 'Невидимый тормоз роста отодвигается.'
    },
    {
      id: 'tree_pow', mech: 'tree', branch: 'tempo', depth: 2, lane: -1, tier: 't2',
      scope: 'meta', res: 'cores', icon: '^',
      name: 'Показатель', base: 10, growth: 2.00, max: 5,
      formula: '1.03 ** lvl', fmt: 'x', powM: '1.03 ** lvl',
      requires: ['tree_softcap'],
      note: 'бонус механик ^ (1.03^lvl), степень ≤ 1.5',
      desc: 'Степень над бонусом механик — умножает всё, что дают доски.'
    },
    {
      id: 'tree_span2', mech: 'tree', branch: 'tempo', depth: 3, lane: -1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '🪓',
      name: 'Слом софткапа II', base: 60, growth: 2.00, max: 5,
      formula: '1.15 ** lvl', fmt: 'x', spanMult: '1.15 ** lvl',
      requires: ['tree_pow'],
      note: 'span ×= 1.15^lvl',
      desc: 'Второй слой тормоза отодвигается.'
    },
    {
      id: 'tree_span3', mech: 'tree', branch: 'tempo', depth: 4, lane: -1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '🪓',
      name: 'Слом софткапа III', base: 250, growth: 2.10, max: 4,
      formula: '1.18 ** lvl', fmt: 'x', spanMult: '1.18 ** lvl',
      requires: ['tree_span2'],
      note: 'span ×= 1.18^lvl',
      desc: 'Третий слой. Для тех, кто уже видел 1e308 не раз.'
    },
    {
      id: 'tree_tempo2', mech: 'tree', branch: 'tempo', depth: 5, lane: -1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '⏩',
      name: 'Разгон II', base: 500, growth: 2.20, max: 4,
      formula: '1 / (0.96 ** lvl)', fmt: 'x', dtMult: '0.96 ** lvl',
      requires: ['tree_span3'],
      note: 'ΔT ×= 0.96^lvl',
      desc: 'Ещё короче интервал — рост почти непрерывный.'
    },
    /* ================= ◈ ветвь «Множитель» ================= */
    {
      id: 'tree_base', mech: 'tree', branch: 'mult', depth: 0, lane: 0, tier: 't1',
      scope: 'meta', res: 'cores', icon: '▪',
      name: 'Плотность', base: 1, growth: 1.55, max: 12,
      formula: '40 * lvl', fmt: 'num', addM: '40 * lvl',
      note: 'M_base += 40·lvl',
      desc: 'Флэт-плюс к базовому множителю.'
    },
    {
      id: 'tree_core', mech: 'tree', branch: 'mult', depth: 1, lane: 0, tier: 't2',
      scope: 'meta', res: 'cores', icon: '◈',
      name: 'Плотное ядро', base: 4, growth: 1.90, max: 8,
      formula: '1.6 ** lvl', fmt: 'x', Mmult: '1.6 ** lvl',
      requires: ['tree_base'],
      note: 'M ×= 1.6^lvl',
      desc: 'Плоский множитель к M_total поверх всех механик.'
    },
    {
      id: 'tree_core2', mech: 'tree', branch: 'mult', depth: 2, lane: 0, tier: 't3',
      scope: 'meta', res: 'cores', icon: '◈',
      name: 'Сверхплотное ядро', base: 120, growth: 2.10, max: 6,
      formula: '2.5 ** lvl', fmt: 'x', Mmult: '2.5 ** lvl',
      requires: ['tree_core'],
      note: 'M ×= 2.5^lvl',
      desc: 'Большой плоский множитель.'
    },
    {
      id: 'tree_core3', mech: 'tree', branch: 'mult', depth: 3, lane: 0, tier: 't3',
      scope: 'meta', res: 'cores', icon: '◈',
      name: 'Плотное ядро III', base: 350, growth: 2.20, max: 5,
      formula: '3 ** lvl', fmt: 'x', Mmult: '3 ** lvl',
      requires: ['tree_core2'],
      note: 'M ×= 3^lvl',
      desc: 'Третий слой множителя.'
    },
    {
      id: 'tree_core4', mech: 'tree', branch: 'mult', depth: 4, lane: 0, tier: 't3',
      scope: 'meta', res: 'cores', icon: '◈',
      name: 'Плотное ядро IV', base: 1000, growth: 2.40, max: 4,
      formula: '4 ** lvl', fmt: 'x', Mmult: '4 ** lvl',
      requires: ['tree_core3'],
      note: 'M ×= 4^lvl',
      desc: 'Вершина ветви множителя.'
    },
    {
      id: 'tree_base2', mech: 'tree', branch: 'mult', depth: 5, lane: 0, tier: 't3',
      scope: 'meta', res: 'cores', icon: '▪',
      name: 'Плотность II', base: 700, growth: 2.30, max: 8,
      formula: '5000 * lvl', fmt: 'num', addM: '5000 * lvl',
      requires: ['tree_core4'],
      note: 'M_base += 5000·lvl',
      desc: 'Жирный флэт — работает даже без механик.'
    },

    /* ================= 🤖 ветвь «Автоматизация» ================= */
    {
      id: 'tree_battery', mech: 'tree', branch: 'auto', depth: 0, lane: 0, tier: 't1',
      scope: 'meta', res: 'cores', icon: '⚡',
      name: 'Ядро-батарейка', base: 2, growth: 2.20, max: 6,
      formula: '3 ** lvl', fmt: 'x', energyMult: '3 ** lvl',
      note: '⚡ ×= 3^lvl',
      desc: 'Энергия навсегда: быстрее раскупоривается «Рост».'
    },
    {
      id: 'tree_auto_all', mech: 'tree', branch: 'auto', depth: 1, lane: 0, tier: 't2',
      scope: 'meta', res: 'cores', icon: '🤖',
      name: 'Главный автоматизатор', base: 25, growth: 1, max: 1,
      formula: 'lvl', fmt: 'pct',
      requires: ['tree_battery'],
      note: 'авто-покупка сама покупает авто всех досок',
      desc: 'Навсегда разрешает автоматизации покупать другие автоматизации.'
    },
    {
      id: 'tree_sieve', mech: 'tree', branch: 'auto', depth: 2, lane: 0, tier: 't3',
      scope: 'meta', res: 'cores', icon: '⌗',
      name: 'Решето', base: 80, growth: 1, max: 1,
      formula: 'lvl', fmt: 'pct',
      requires: ['tree_auto_all'],
      note: 'открывает доску «Решето»',
      desc: 'Механика: решето само находит простые — ❖ и множитель.'
    },
    {
      id: 'tree_mirror', mech: 'tree', branch: 'auto', depth: 3, lane: 0, tier: 't3',
      scope: 'meta', res: 'cores', icon: '⧗',
      name: 'Зеркало', base: 150, growth: 1, max: 1,
      formula: 'lvl', fmt: 'pct',
      requires: ['tree_sieve'],
      note: 'открывает доску «Зеркало»',
      desc: 'Механика: симметрия мантиссы — множитель и накопитель.'
    },
    {
      id: 'tree_autofast', mech: 'tree', branch: 'auto', depth: 4, lane: 0, tier: 't3',
      scope: 'meta', res: 'cores', icon: '⚙',
      name: 'Авто-ускоритель', base: 220, growth: 2.00, max: 3,
      formula: '1.5 ** lvl', fmt: 'x', autoStepMult: '1.5 ** lvl',
      requires: ['tree_mirror'],
      note: 'автопокупки в 1.5^lvl быстрее',
      desc: 'Автоматизация щёлкает покупки заметно чаще.'
    },

    /* ================= ◆ ветвь «Ядра» (больше ◆ за забег) ================= */
    {
      id: 'tree_coregain', mech: 'tree', branch: 'cores', depth: 0, lane: 1, tier: 't1',
      scope: 'meta', res: 'cores', icon: '◆',
      name: 'Щедрость ядер', base: 3, growth: 1.70, max: 8,
      formula: '1.10 ** lvl', fmt: 'x', coreGainMult: '1.10 ** lvl',
      note: '◆ за перерождение ×= 1.10^lvl',
      desc: 'Каждое перерождение даёт больше ядер — снежный ком.'
    },
    {
      id: 'tree_coregain2', mech: 'tree', branch: 'cores', depth: 1, lane: 1, tier: 't2',
      scope: 'meta', res: 'cores', icon: '◆',
      name: 'Щедрость ядер II', base: 40, growth: 1.90, max: 6,
      formula: '1.15 ** lvl', fmt: 'x', coreGainMult: '1.15 ** lvl',
      requires: ['tree_coregain'],
      note: '◆ ×= 1.15^lvl',
      desc: 'Второй слой множителя ядер.'
    },
    {
      id: 'tree_coregain3', mech: 'tree', branch: 'cores', depth: 2, lane: 1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '◆',
      name: 'Щедрость ядер III', base: 250, growth: 2.00, max: 5,
      formula: '1.25 ** lvl', fmt: 'x', coreGainMult: '1.25 ** lvl',
      requires: ['tree_coregain2'],
      note: '◆ ×= 1.25^lvl',
      desc: 'Третий слой — ядра идут пачками.'
    },
    {
      id: 'tree_coregain4', mech: 'tree', branch: 'cores', depth: 3, lane: 1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '◆',
      name: 'Щедрость ядер IV', base: 1200, growth: 2.20, max: 4,
      formula: '1.30 ** lvl', fmt: 'x', coreGainMult: '1.30 ** lvl',
      requires: ['tree_coregain3'],
      note: '◆ ×= 1.30^lvl',
      desc: 'Вершина ветви ядер.'
    },
    {
      id: 'tree_coremin', mech: 'tree', branch: 'cores', depth: 4, lane: 1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '◆',
      name: 'Гарантированные ядра', base: 600, growth: 2.10, max: 8,
      formula: '2 * lvl', fmt: 'num', coreGainAdd: '2 * lvl',
      requires: ['tree_coregain4'],
      note: '◆ += 2·lvl за перерождение',
      desc: 'Флэт-бонус: даже короткий забег приносит ядра.'
    },

    /* ================= ❖ ветвь «Доход» ================= */
    {
      id: 'tree_shop', mech: 'tree', branch: 'income', depth: 0, lane: 1, tier: 't1',
      scope: 'meta', res: 'cores', icon: '🛒',
      name: 'Скидка магазина', base: 5, growth: 1.80, max: 6,
      formula: '0.96 ** lvl', fmt: 'x', shopCostMult: '0.96 ** lvl',
      note: 'цена магазина ×= 0.96^lvl',
      desc: 'Товары за цифры дешевеют — больше баффов за тот же D.'
    },
    {
      id: 'tree_shop2', mech: 'tree', branch: 'income', depth: 1, lane: 1, tier: 't2',
      scope: 'meta', res: 'cores', icon: '🛒',
      name: 'Скидка магазина II', base: 45, growth: 2.00, max: 6,
      formula: '0.93 ** lvl', fmt: 'x', shopCostMult: '0.93 ** lvl',
      requires: ['tree_shop'],
      note: 'цена магазина ×= 0.93^lvl',
      desc: 'Скидки складываются.'
    },
    {
      id: 'tree_energy2', mech: 'tree', branch: 'income', depth: 2, lane: 1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '⚡',
      name: 'Энергия II', base: 180, growth: 2.00, max: 8,
      formula: '5 ** lvl', fmt: 'x', energyMult: '5 ** lvl',
      requires: ['tree_shop2'],
      note: '⚡ ×= 5^lvl',
      desc: 'Мощный источник энергии для дорогих досок.'
    },
    {
      id: 'tree_prime2', mech: 'tree', branch: 'income', depth: 3, lane: 1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '❖',
      name: 'Прайм-доход', base: 500, growth: 2.10, max: 6,
      formula: '1.5 ** lvl', fmt: 'x', primeGainMult: '1.5 ** lvl',
      requires: ['tree_energy2'],
      note: '❖ за простой разряд ×= 1.5^lvl',
      desc: 'Больше ❖ с простых разрядов и решета.'
    },
    {
      id: 'tree_energy3', mech: 'tree', branch: 'income', depth: 4, lane: 1, tier: 't3',
      scope: 'meta', res: 'cores', icon: '⚡',
      name: 'Энергия III', base: 900, growth: 2.20, max: 6,
      formula: '4 ** lvl', fmt: 'x', energyMult: '4 ** lvl',
      requires: ['tree_prime2'],
      note: '⚡ ×= 4^lvl',
      desc: 'Вершина ветви дохода.'
    }
  ]);
})(window.G = window.G || {});
