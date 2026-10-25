/* tools/tests/d2-boards.test.js — доски D2 «Схлопывание» и «Связи» (jsdom).
   Запуск:  node tools/tests/d2-boards.test.js
   Грузит НАСТОЯЩИЕ ядро/components/icons и НАСТОЯЩИЕ доски
   src/mechanics/d2collapse/{index,board}.js и d2links/{index,board}.js,
   а системы D2 (G.d2 / G.d2Collapse / G.d2Links) и G.content.d2 подставляет фейками
   по контракту docs/DIMENSION2.md §10.2 — чтобы тест не зависел от чужих D2-модулей.
   Проверяем: регистрацию механик, кнопку «Схлопнуть» (+disabled), 6 карточек апгрейдов,
   4 карточки связей, покупки через свои API, отсутствие NaN/Infinity в тексте,
   и что update() не пересобирает DOM. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- мини-раннер ---------- */
let fails = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  \u2713 ' + name + (extra ? '  — ' + extra : '')); }
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
}
function section(t) { console.log('\n' + t); }
const BAD = /NaN|Infinity|undefined/;

/* ---------- данные D2 (копия docs/DIMENSION2.md §5.2) ---------- */
const D2_CONTENT = {
  id: 'd2',
  gate: { turns: 10 },
  collapse: {
    minD: 100,
    gainFormula: 'floor(pow(max(0, D - 100) / 10, 0.8) * (1 + 0.1 * collapses))',
    startFormula: '10 + 5 * essence + 20 * lvlLinkStart + 10 * lvlStart'
  },
  upgrades: [
    { id: 'd2_start', name: 'Стартовая ось', desc: 'старт D₂ +10·ур.', base: 1, growth: 2.0, max: 10, res: 'essence' },
    { id: 'd2_rate', name: 'Ускорение осей', desc: 'скорость осей ×1.5^ур.', base: 1, growth: 2.2, max: 8, res: 'essence' },
    { id: 'd2_xi', name: 'Плотность Ξ', desc: 'Ξ ×1.5^ур.', base: 1, growth: 2.4, max: 8, res: 'essence' },
    { id: 'd2_boost', name: 'Дешёвый Boost', desc: 'цена Boost ×0.8^ур.', base: 2, growth: 2.5, max: 6, res: 'essence' },
    { id: 'd2_collapse', name: 'Глубокий сброс', desc: '⌬ ×1.25^ур.', base: 3, growth: 2.6, max: 6, res: 'essence' },
    { id: 'd2_soft', name: 'Плоскость D2', desc: 'span софткапа ×1.5^ур.', base: 2, growth: 2.3, max: 5, res: 'essence' }
  ],
  links: [
    { id: 'link_start', name: 'Мост старта', desc: 'старт D₂ +20·ур.', base: 2, growth: 2.0, max: 5, res: 'essence' },
    { id: 'link_m', name: 'Отражение M', desc: 'M D1 ×(1 + 0.05·ур.)', base: 3, growth: 2.3, max: 6, res: 'essence' },
    { id: 'link_xi', name: 'Течение Ξ', desc: 'Ξ ×1.25^ур.', base: 2, growth: 2.2, max: 6, res: 'essence' },
    { id: 'link_collapse', name: 'Глубина связи', desc: '⌬ ×1.2^ур.', base: 4, growth: 2.5, max: 4, res: 'essence' }
  ]
};

/* ---------- страница + настоящие ядро/UI-компоненты ---------- */
const CORE = [
  'src/core/bignum.js', 'src/core/format.js', 'src/core/digits.js',
  'src/core/formula.js', 'src/core/registry.js', 'src/core/dom.js',
  'src/ui/icons.js', 'src/ui/components.js'
];
const BOARDS = [
  'src/mechanics/d2collapse/index.js', 'src/mechanics/d2collapse/board.js',
  'src/mechanics/d2links/index.js', 'src/mechanics/d2links/board.js'
];

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
for (const f of CORE) win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const G = win.G;

/* ---------- фейковые системы D2 (контракт §10.2) ---------- */
const byId = (list, id) => list.filter((x) => x.id === id)[0];
function essenceOf(s) { return s.d2.res.essence || 0; }
function upgLvl(s, id) { return s.d2.upgrades[id] || 0; }
function linkLvl(s, id) { return s.d2.links[id] || 0; }

G.content = G.content || {};
G.content.d2 = D2_CONTENT;

G.d2 = {
  unlocked(s) { return !!(s.d2 && s.d2.unlocked); },
  active(s) { return !!(s.d2 && s.d2.active); },
  D(s) { return s.d2.D; }
};

G.d2Collapse = {
  gain(s) {
    const d = G.d2.D(s);
    if (d < D2_CONTENT.collapse.minD) return 0;
    return Math.floor(Math.pow(Math.max(0, d - D2_CONTENT.collapse.minD) / 10, 0.8) *
      (1 + 0.1 * (s.d2.stats.collapses || 0)));
  },
  can(s) { return G.d2.D(s) >= D2_CONTENT.collapse.minD; },
  startD2(s) {
    return 10 + 5 * essenceOf(s) + 20 * linkLvl(s, 'link_start') + 10 * upgLvl(s, 'd2_start');
  },
  perform(s) {
    const gain = G.d2Collapse.gain(s);
    if (gain <= 0) return 0;
    s.d2.res.essence = essenceOf(s) + gain;
    s.d2.stats.collapses = (s.d2.stats.collapses || 0) + 1;
    s.d2.stats.bestD = Math.max(s.d2.stats.bestD || 0, G.d2.D(s));
    s.d2.axes.forEach((a) => { a.lvl = 0; a.amount = 0; });
    s.d2.res.axis = 0;
    s.d2.boost = 0;
    s.d2.D = G.d2Collapse.startD2(s);
    return gain;
  },
  upgradeCost(s, id) {
    const u = byId(D2_CONTENT.upgrades, id);
    return u.base * Math.pow(u.growth, upgLvl(s, id));
  },
  buyUpgrade(s, id) {
    const u = byId(D2_CONTENT.upgrades, id);
    if (!u || upgLvl(s, id) >= u.max) return false;
    const cost = G.d2Collapse.upgradeCost(s, id);
    if (!isFinite(cost) || cost > essenceOf(s)) return false;
    s.d2.res.essence = essenceOf(s) - cost;
    s.d2.upgrades[id] = upgLvl(s, id) + 1;
    return true;
  }
};

G.d2Links = {
  d1Mult(s) {
    if (!G.d2.unlocked(s)) return 1;
    const m = 1 + 0.05 * linkLvl(s, 'link_m') + 0.01 * Math.min(G.d2.D(s), 1000);
    return Math.min(11, m);
  },
  d2StartBonus(s) {
    return Math.min(50, 2 * Math.log10(1 + (s.d1D || 0)));
  },
  linkCost(s, id) {
    const l = byId(D2_CONTENT.links, id);
    return l.base * Math.pow(l.growth, linkLvl(s, id));
  },
  buyLink(s, id) {
    const l = byId(D2_CONTENT.links, id);
    if (!l || linkLvl(s, id) >= l.max) return false;
    const cost = G.d2Links.linkCost(s, id);
    if (!isFinite(cost) || cost > essenceOf(s)) return false;
    s.d2.res.essence = essenceOf(s) - cost;
    s.d2.links[id] = linkLvl(s, id) + 1;
    return true;
  }
};

/* тосты в jsdom-стабе: считаем вызовы, не строим разметку */
const toasts = [];
G.ui.toast = (text) => { toasts.push(text); };
/* анимации в тесте не нужны (tile/upd-флеши дёргают таймеры) — как настройкой игры */
G.animationsOff = () => true;

/* ---------- настоящие доски ---------- */
for (const f of BOARDS) win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const C = G.ui.components;
function mountBoard(id) {
  const root = win.document.createElement('div');
  win.document.getElementById('root').appendChild(root);
  const board = G.registry.mechanic(id).board.mount(root);
  return { root: root, board: board };
}

/* ---------- состояние ---------- */
function newState(opts) {
  const o = opts || {};
  return {
    settings: { numberFormat: 'short' },
    d1D: o.d1D === undefined ? 500 : o.d1D,
    d2: {
      v: 1,
      unlocked: o.unlocked === undefined ? true : o.unlocked,
      active: true,
      N: { m: 1, e: 0 },
      D: o.D === undefined ? 250 : o.D,
      res: { axis: 0, essence: o.essence === undefined ? 12 : o.essence },
      axes: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ lvl: 0, amount: 0 })),
      boost: 0,
      upgrades: o.upgrades || {},
      links: o.links || {},
      stats: { bestD: o.bestD === undefined ? 260 : o.bestD, collapses: o.collapses || 0, totalEssence: 0, playtime: 0, lastCollapse: 0 },
      lastSeen: 0
    }
  };
}
const cardsOf = (root) => Array.prototype.slice.call(root.querySelectorAll('.upg'));
const buyBtnOf = (card) => card.querySelector('.upg-buy');

/* ================= 1. регистрация механик ================= */
section('1. Регистрация механик');
const mCollapse = G.registry.mechanic('d2collapse');
const mLinks = G.registry.mechanic('d2links');
check('механика d2collapse зарегистрирована', !!mCollapse);
check('механика d2links зарегистрирована', !!mLinks);
check('обе под scope meta-d2', mCollapse.scope === 'meta-d2' && mLinks.scope === 'meta-d2',
  mCollapse.scope + ' / ' + mLinks.scope);
check('порядок доков: collapse раньше links', mCollapse.order < mLinks.order,
  mCollapse.order + ' < ' + mLinks.order);
check('d2collapse.isUnlocked следует за G.d2.unlocked',
  mCollapse.isUnlocked(newState()) === true && mCollapse.isUnlocked(newState({ unlocked: false })) === false);
check('d2links.isUnlocked следует за G.d2.unlocked',
  mLinks.isUnlocked(newState()) === true && mLinks.isUnlocked(newState({ unlocked: false })) === false);
check('d2collapse.status без state.d2 не падает', mCollapse.status({ settings: {} }) === '⌬ 0');
check('d2links.status при закрытом D2', mLinks.status(newState({ unlocked: false })) === 'мосты закрыты');
const stOpen = mCollapse.status(newState({ essence: 17, D: 260 }));
check('d2collapse.status показывает ⌬ и gain', stOpen.indexOf('⌬ 17') === 0 && stOpen.indexOf('+') > 0, stOpen);
const stLinks = mLinks.status(newState({ D: 250, links: { link_m: 2 } }));
check('d2links.status показывает множитель D1', stLinks === 'D1 ×' + G.fmt.num(G.d2Links.d1Mult(newState({ D: 250, links: { link_m: 2 } }))), stLinks);

/* ================= 2. доска «Схлопывание»: разметка ================= */
section('2. Доска «Схлопывание» — разметка');
let state = newState();
G.state = state;
const collapseBoard = mountBoard('d2collapse');
const cRoot = collapseBoard.root;
check('карточек апгрейдов = 6', cardsOf(cRoot).length === 6, String(cardsOf(cRoot).length));
check('id карточек совпадают с данными',
  cardsOf(cRoot).map((c) => c.dataset.upgrade).join(',') === D2_CONTENT.upgrades.map((u) => u.id).join(','));
check('кнопка «Схлопнуть» одна', cRoot.querySelectorAll('.d2-collapse-btn').length === 1);
check('плитки на месте (5)', cRoot.querySelectorAll('.tile').length === 5);
check('текст без NaN/Infinity/undefined', !BAD.test(cRoot.textContent), 'ok');

/* ================= 3. кнопка: disabled по can() ================= */
section('3. Кнопка «Схлопнуть»: can / disabled');
const cBtn = cRoot.querySelector('.d2-collapse-btn');
let sLow = newState({ D: 50, essence: 0 });
collapseBoard.board.update(sLow);
check('D₂ < minD → кнопка disabled', cBtn.disabled === true);
check('D₂ < minD → подпись про порог', /НУЖНО D₂ ≥ 100/.test(cBtn.textContent), cBtn.textContent);
check('D₂ < minD → gain 0 у API', G.d2Collapse.gain(sLow) === 0);

sLow.d2.D = 250;
collapseBoard.board.update(sLow);
const expectGain = G.d2Collapse.gain(sLow);
check('D₂ ≥ minD → кнопка активна', cBtn.disabled === false);
check('подпись содержит gain', cBtn.textContent.indexOf('+' + G.fmt.num(expectGain) + ' ⌬') > 0,
  cBtn.textContent + ' (gain ' + expectGain + ')');
check('класс can выставлен', cBtn.className.indexOf('can') >= 0 && cBtn.className.indexOf('cant') < 0, cBtn.className);

/* ================= 4. клик «Схлопнуть» ================= */
section('4. Клик «Схлопнуть»');
const beforeEss = sLow.d2.res.essence;
G.state = sLow;
cBtn.click();
check('perform вызван через API: ⌬ выросла', sLow.d2.res.essence === beforeEss + expectGain,
  beforeEss + ' → ' + sLow.d2.res.essence);
check('Схлопывание зачтено', sLow.d2.stats.collapses === 1, String(sLow.d2.stats.collapses));
check('оси и Ξ сброшены', sLow.d2.res.axis === 0 && sLow.d2.axes.every((a) => a.lvl === 0 && a.amount === 0));
check('D₂ переехал на стартовое значение', sLow.d2.D === G.d2Collapse.startD2(sLow),
  'D₂ = ' + sLow.d2.D);
check('тост о Схлопывании показан', toasts.length > 0 &&
  toasts[toasts.length - 1].indexOf('Схлопывание: +' + G.fmt.num(expectGain) + ' ⌬') === 0,
  toasts[toasts.length - 1]);
collapseBoard.board.update(sLow);
check('после клика D₂ < minD → кнопка снова disabled', cBtn.disabled === true);
check('после клика текст без NaN/Infinity/undefined', !BAD.test(cRoot.textContent));

/* ================= 5. покупка апгрейдов за ⌬ ================= */
section('5. Апгрейды Схлопывания: цена / уровень / покупка');
let sBuy = newState({ essence: 10 });
G.state = sBuy;
collapseBoard.board.update(sBuy);
const startCard = cardsOf(cRoot).filter((c) => c.dataset.upgrade === 'd2_start')[0];
const cost0 = G.d2Collapse.upgradeCost(sBuy, 'd2_start');
check('цена в карточке = upgradeCost', buyBtnOf(startCard).textContent.indexOf(G.fmt.num(cost0) + ' ⌬') >= 0,
  buyBtnOf(startCard).textContent + ' vs ' + cost0);
check('уровень 0 / max 10', startCard.querySelector('.upg-lvl').textContent === 'ур. 0 / 10',
  startCard.querySelector('.upg-lvl').textContent);
buyBtnOf(startCard).click();
check('клик → buyUpgrade поднял уровень', upgLvl(sBuy, 'd2_start') === 1, String(upgLvl(sBuy, 'd2_start')));
check('списалась ⌬', Math.abs(sBuy.d2.res.essence - (10 - cost0)) < 1e-9, String(sBuy.d2.res.essence));
const cost1 = G.d2Collapse.upgradeCost(sBuy, 'd2_start');
check('цена выросла по growth', cost1 === cost0 * 2, cost0 + ' → ' + cost1);
check('карточка обновилась без пересборки', cardsOf(cRoot).length === 6 &&
  startCard.querySelector('.upg-lvl').textContent === 'ур. 1 / 10',
  startCard.querySelector('.upg-lvl').textContent);
check('после покупки в тексте нет NaN/Infinity/undefined', !BAD.test(cRoot.textContent));

/* недоступная покупка: ⌬ нет */
sBuy.d2.res.essence = 0;
collapseBoard.board.update(sBuy);
check('⌬ = 0 → все кнопки апгрейдов disabled',
  cardsOf(cRoot).every((c) => buyBtnOf(c).disabled === true));

/* максимум: кнопка «макс» и disabled */
const maxedState = newState({ essence: 1e9, upgrades: { d2_start: 10 } });
G.state = maxedState;
collapseBoard.board.update(maxedState);
const maxedCard = cardsOf(cRoot).filter((c) => c.dataset.upgrade === 'd2_start')[0];
check('на максимуме — «макс»', buyBtnOf(maxedCard).textContent === 'макс', buyBtnOf(maxedCard).textContent);
check('на максимуме — disabled', buyBtnOf(maxedCard).disabled === true);
check('buyUpgrade сверх max возвращает false', G.d2Collapse.buyUpgrade(maxedState, 'd2_start') === false);

/* ================= 6. update() не пересобирает DOM ================= */
section('6. update() не пересобирает DOM');
const cardsBefore = cardsOf(cRoot).slice();
const firstChildBefore = cRoot.firstChild;
for (let i = 0; i < 5; i++) collapseBoard.board.update(newState({ D: 100 + i * 50, essence: i }));
const cardsAfter = cardsOf(cRoot);
check('карточки — те же узлы', cardsAfter.length === 6 && cardsAfter.every((c, i) => c === cardsBefore[i]));
check('корень доски не пересобирался', cRoot.firstChild === firstChildBefore);

/* ================= 7. доска «Связи»: разметка и бонусы ================= */
section('7. Доска «Связи» — разметка и бонусы');
let sLink = newState({ essence: 20, D: 300, d1D: 1000, links: { link_m: 1 } });
G.state = sLink;
const linksBoard = mountBoard('d2links');
const lRoot = linksBoard.root;
check('карточек связей = 4', cardsOf(lRoot).length === 4, String(cardsOf(lRoot).length));
check('id карточек совпадают с данными',
  cardsOf(lRoot).map((c) => c.dataset.link).join(',') === D2_CONTENT.links.map((l) => l.id).join(','));
check('плитки на месте (5)', lRoot.querySelectorAll('.tile').length === 5);
linksBoard.board.update(sLink);
const mult = G.d2Links.d1Mult(sLink);
const bonus = G.d2Links.d2StartBonus(sLink);
const tileVals = Array.prototype.slice.call(lRoot.querySelectorAll('.tile-val')).map((el) => el.textContent);
check('плитка M D1 = ×mult', tileVals.indexOf('×' + G.fmt.num(mult)) >= 0, tileVals.join(' | '));
check('плитка старта D₂ = +bonus', tileVals.indexOf('+' + G.fmt.num(bonus) + ' цифр') >= 0, tileVals.join(' | '));
check('плитка купленных связей 1 / 4', tileVals.indexOf('1 / 4') >= 0, tileVals.join(' | '));
check('текст без NaN/Infinity/undefined', !BAD.test(lRoot.textContent));

/* ================= 8. покупка связи ================= */
section('8. Связи: покупка за ⌬');
const linkCard = cardsOf(lRoot).filter((c) => c.dataset.link === 'link_start')[0];
const lCost0 = G.d2Links.linkCost(sLink, 'link_start');
check('цена связи в карточке', buyBtnOf(linkCard).textContent.indexOf(G.fmt.num(lCost0) + ' ⌬') >= 0,
  buyBtnOf(linkCard).textContent);
const essBeforeLink = sLink.d2.res.essence;
buyBtnOf(linkCard).click();
check('клик → buyLink поднял уровень', linkLvl(sLink, 'link_start') === 1, String(linkLvl(sLink, 'link_start')));
check('списалась ⌬', Math.abs(sLink.d2.res.essence - (essBeforeLink - lCost0)) < 1e-9, String(sLink.d2.res.essence));
check('стартовый бонус D1→D2 вырос после покупки',
  G.d2Collapse.startD2(sLink) > 10 + 5 * (essBeforeLink - lCost0),
  'startD2 = ' + G.d2Collapse.startD2(sLink));
check('карточка связи обновилась на месте', linkCard.querySelector('.upg-lvl').textContent === 'ур. 1 / 5',
  linkCard.querySelector('.upg-lvl').textContent);

sLink.d2.res.essence = 0;
linksBoard.board.update(sLink);
check('⌬ = 0 → все кнопки связей disabled',
  cardsOf(lRoot).every((c) => buyBtnOf(c).disabled === true));

/* ================= 9. механика d2links отдаёт mult для D1 ================= */
section('9. mult() механики d2links');
const mState = newState({ D: 250, links: { link_m: 3 } });
check('mult = d1Mult', mLinks.mult(mState) === G.d2Links.d1Mult(mState), String(mLinks.mult(mState)));
check('mult ограничен ×11', mLinks.mult(newState({ D: 1000, links: { link_m: 6 } })) <= 11,
  String(mLinks.mult(newState({ D: 1000, links: { link_m: 6 } }))));
const lockedState = newState({ unlocked: false, links: { link_m: 6 } });
check('до открытия D2 mult = 1', mLinks.mult(lockedState) === 1, String(mLinks.mult(lockedState)));

/* ================= 10. «плохое» состояние: нет NaN/Infinity в DOM ================= */
section('10. Плохое состояние — ни одного NaN/Infinity/undefined');
const emptyState = newState({ D: 0, essence: 0, bestD: 0, upgrades: {}, links: {} });
G.state = emptyState;
collapseBoard.board.update(emptyState);
linksBoard.board.update(emptyState);
check('collapse-доска чиста', !BAD.test(cRoot.textContent));
check('links-доска чиста', !BAD.test(lRoot.textContent));
const bigState = newState({ D: 1e6, essence: 1e12, bestD: 1e6 });
G.state = bigState;
collapseBoard.board.update(bigState);
linksBoard.board.update(bigState);
check('огромные числа форматируются', !BAD.test(cRoot.textContent) && !BAD.test(lRoot.textContent),
  cRoot.querySelectorAll('.tile-val')[0].textContent + ' · ' + lRoot.querySelectorAll('.tile-val')[3].textContent);

/* ---------- итог ---------- */
console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК') + ' — ' + passes + ' проверок');
process.exitCode = fails ? 1 : 0;
