/* tools/tests/d2-integration.test.js — D2 на реальном index.html: рост, покупки, Схлопывание,
   связи с D1, дерево D2. Это интеграционный тест после сборки 9 задач.
   Запуск: NODE_PATH=<repo>/node_modules node tools/tests/d2-integration.test.js */
'use strict';
require('../_limit')(180);

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  return !!cond;
}
function section(t) { console.log('\n' + t); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadPage() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [];
  const re = /<script\s+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1].split('?')[0]);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
    url: 'http://localhost/', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole: vc
  });
  const win = dom.window;
  for (const src of srcs) {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) { errors.push('нет файла: ' + src); continue; }
    try { win.eval(fs.readFileSync(file, 'utf8')); }
    catch (e) { errors.push('скрипт ' + src + ': ' + e.message); }
  }
  return { dom, win, G: win.G, srcs, errors };
}

async function waitBoot(win, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (win.G && win.G.state && win.G.debug) return true;
    await sleep(25);
  }
  return false;
}

async function main() {
  section('1. Загрузка index.html');
  const page = loadPage();
  const dom = page.dom, win = page.win, G = page.G;
  try {
    check('скриптов найдено', page.srcs.length > 5, page.srcs.length + ' шт');
    check('ошибок при загрузке нет', page.errors.length === 0, page.errors.join(' | '));
    const booted = await waitBoot(win, 5000);
    check('boot() отработал', booted);
    if (!booted) return;
    const state = G.state;

    section('2. Открытие D2 и реальный контент');
    state.res.turns = 10;
    state.N = G.BN.fromLog10(10000); state.D = 10000;
    state.d2 = null;
    G.d2.ensure(state);
    check('D2 открыт', G.d2.unlocked(state) === true);
    check('8 осей в state', state.d2.axes.length === 8);
    check('8 осей в content', (G.content.d2.axes || []).length === 8);
    check('⌬ зарегистрирована как ресурс', !!G.registry.resource('essence'));

    section('3. Рост D2 не трогает D1');
    for (const a of state.d2.axes) { a.lvl = 1; a.amount = 0; }
    state.d2.D = 10;
    state.d2.N = G.BN.fromLog10(10);
    state.d2.res.axis = 1000;
    const d1Before = { D: state.D, N: G.BN.log10(state.N), energy: state.res.energy };
    const d2Before = G.d2.D(state);
    const xiBefore = state.d2.res.axis;
    const m2 = G.d2Growth.M2(state);
    const xiRate = G.d2Growth.xiRate(state);
    check('M₂ > 1', m2 >= 1, 'M₂=' + m2);
    check('Ξ/с > 0', xiRate > 0, 'Ξ/с=' + xiRate);
    G.d2Growth.tick(state, 1);
    check('D₂ вырос', G.d2.D(state) > d2Before, d2Before + ' → ' + G.d2.D(state));
    check('Ξ выросли', state.d2.res.axis > xiBefore, xiBefore + ' → ' + state.d2.res.axis);
    check('D1 D не изменился', state.D === d1Before.D);
    check('D1 N не изменился', Math.abs(G.BN.log10(state.N) - d1Before.N) < 1e-12);
    check('D1 энергия не изменилась', state.res.energy === d1Before.energy);

    section('4. Покупки осей и Boost');
    const axis0 = state.d2.axes[0];
    const lvlBefore = axis0.lvl;
    const bought = G.d2Growth.buyAxis(state, 0, '10');
    check('×10 купил уровни', bought > 0, 'куплено ' + bought);
    check('уровень оси вырос', axis0.lvl > lvlBefore, lvlBefore + ' → ' + axis0.lvl);
    const boostBefore = state.d2.boost;
    const boostBought = G.d2Growth.buyBoost(state);
    check('Boost куплен', boostBought > 0 && state.d2.boost > boostBefore, 'boost ' + state.d2.boost);

    section('5. Схлопывание');
    state.d2.D = 120;
    state.d2.N = G.BN.fromLog10(120);
    state.d2.res.axis = 500;
    state.d2.res.essence = 0;
    state.d2.stats.collapses = 0;
    const gain = G.d2Collapse.gain(state);
    check('⌬ за Схлопывание > 0', gain > 0, 'gain=' + gain);
    check('can(D2=120)', G.d2Collapse.can(state) === true);
    const d1D = state.D;
    const collapsesBefore = state.d2.stats.collapses;
    const got = G.d2Collapse.perform(state);
    check('Схлопывание начислило ⌬', got > 0 && state.d2.res.essence > 0,
      '⌬=' + state.d2.res.essence);
    check('collapses вырос', state.d2.stats.collapses === collapsesBefore + 1);
    check('оси/Ξ сброшены', state.d2.axes.every((a) => a.lvl === 0 && a.amount === 0) && state.d2.res.axis === 0);
    check('D₂ стартует выше 0', state.d2.D > 0, 'D₂=' + state.d2.D);
    check('D1 D не изменился', state.D === d1D);

    section('6. Апгрейды Схлопывания');
    state.d2.res.essence = 1000;
    const cost = G.d2Collapse.upgradeCost(state, 'd2_rate');
    check('цена d2_rate конечна', isFinite(cost) && cost > 0, 'cost=' + cost);
    const rateBefore = G.d2Growth.axisRate(state, 0);
    const upBought = G.d2Collapse.buyUpgrade(state, 'd2_rate');
    const rateAfter = G.d2Growth.axisRate(state, 0);
    check('апгрейд куплен', upBought === 1 && state.d2.upgrades.d2_rate === 1);
    check('d2_rate реально ускорил ось', rateAfter > rateBefore, rateBefore + ' → ' + rateAfter);

    section('7. Связи D1↔D2');
    state.d2.res.essence = 1000;
    const mBefore = G.d2Links.d1Mult(state);
    const lvlBought = G.d2Links.buyLink(state, 'link_m');
    const mAfter = G.d2Links.d1Mult(state);
    check('link_m куплен', lvlBought === true && state.d2.links.link_m === 1);
    check('d1Mult вырос', mAfter > mBefore, '×' + mBefore + ' → ×' + mAfter);
    check('d1Mult ограничен ×11', mAfter <= 11, '×' + mAfter);
    check('старт D2 от D1 конечен', isFinite(G.d2Links.d2StartBonus(state)) &&
      G.d2Links.d2StartBonus(state) > 0, 'бонус=' + G.d2Links.d2StartBonus(state));
    const d1Mech = G.registry.mechanic('d2links');
    check('d2links — механика с mult', !!d1Mech && typeof d1Mech.mult === 'function');
    check('mult механики = d1Mult', d1Mech.mult(state) === mAfter);

    section('8. Дерево D2');
    const tree = G.registry.upgradesOf('d2tree');
    check('16 узлов дерева', tree.length === 16, tree.length + ' узлов');
    check('дерево открыто после Схлопывания', !!G.d2Tree && G.d2Tree.unlocked(state) === true);
    state.d2.res.essence = 1000;
    const tUp = G.registry.upgrade('d2t_s1');
    const tLvl = G.lvl(state, 'd2t_s1');
    const tBought = G.d2Tree.buy(state, tUp);
    check('первый узел куплен', tBought && G.lvl(state, 'd2t_s1') === tLvl + 1,
      'уровень ' + G.lvl(state, 'd2t_s1'));
    check('⌬ в state.d2 уменьшилась', state.d2.res.essence < 1000, '⌬=' + state.d2.res.essence);

    section('9. Мусор');
    const text = (win.document.getElementById('board').textContent || '') +
      (win.document.getElementById('d2HeroN').textContent || '');
    check('в DOM нет NaN/Infinity/undefined', !/NaN|Infinity|undefined/.test(text));
    check('ошибок в логе нет', page.errors.length === 0, page.errors.join(' | '));
  } finally {
    try { dom.window.close(); } catch (e) { /* уже закрыт */ }
  }
  console.log('');
  console.log(fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК');
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
