/* tools/layout.js — ИЗМЕРЕНИЕ РАСКЛАДКИ в настоящем браузере (v0.23.2).
   Запуск:  CHROME_PATH=/path/chrome node tools/layout.js
   Зачем: jsdom не считает layout, поэтому «не прокручивается» ловится только здесь.
   Что проверяет (мобильный вид 420×860 и десктоп 1440×900):
     • доки активного слоя реально прокручиваются вправо (scrollWidth > clientWidth,
       и scrollLeft меняется после присваивания);
     • ряд «слоёв» (пилюли) тоже прокручивается;
     • последняя доска слоя достижима прокруткой (её правый край внутри контейнера);
     • доска #board не схлопнута (высота > 200 px);
     • рейл не съедает больше половины экрана.
  Результат печатается JSON-ом и пишется в tools/shots/layout.json (уезжает в ветку shots). */
'use strict';
require('./_limit')(240);

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'shots');

const CANDIDATES = [
  process.env.CHROME_PATH || '',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
];

function findBrowser() {
  for (const p of CANDIDATES) if (p && fs.existsSync(p)) return p;
  throw new Error('Chrome/Edge не найден (задайте CHROME_PATH)');
}

const PREP = `
(() => {
  const G = window.G;
  if (!G || !G.state) return 'no_state';
  const s = G.state;
  s.res.energy = 1e18; s.res.prime = 1e6; s.res.cores = 1200; s.res.delta = 300;
  s.meta.passedBarriers = ['wall_308']; s.meta.tier = 'tier2'; s.meta.bangs = 3;
  G.debug.setD(140);
  G.ui.app.render(s);
  return 'ok';
})()`;

function measure() {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      clientW: el.clientWidth, scrollW: el.scrollWidth,
      canScroll: el.scrollWidth > el.clientWidth + 2,
      top: Math.round(r.top), right: Math.round(r.right)
    };
  };

  const items = document.querySelector('.dock-group-items.open');
  const pills = document.querySelector('.dock-pills');
  const out = {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    docks: box('#docks'),
    pills: box('.dock-pills'),
    items: box('.dock-group-items.open'),
    board: box('#board'),
    itemsScrollWorks: false,
    pillsScrollWorks: false,
    lastDockReachable: false,
    itemDocks: 0
  };

  if (items) {
    out.itemDocks = items.querySelectorAll('.dock').length;
    items.scrollLeft = 9999;
    out.itemsScrollWorks = items.scrollLeft > 4;
    out.itemsScrollLeft = items.scrollLeft;

    const docks = items.querySelectorAll('.dock');
    if (docks.length) {
      const last = docks[docks.length - 1].getBoundingClientRect();
      const ir = items.getBoundingClientRect();
      out.lastDockReachable = last.right <= ir.right + 2 && last.left >= ir.left - 2;
    }
  }
  if (pills) {
    pills.scrollLeft = 9999;
    out.pillsScrollWorks = pills.scrollLeft > 4;
  }
  return out;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const report = {};

  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

    /* --- мобильный вид --- */
    await page.setViewport({ width: 420, height: 860, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction('window.G && window.G.state', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(PREP);
    /* открываем доску Яруса 2 — самый длинный слой (11 досок) */
    await page.evaluate(() => { window.G.ui.docks.select('omega'); window.G.ui.app.render(window.G.state); });
    await new Promise((r) => setTimeout(r, 350));
    report.mobile = await page.evaluate(measure);

    /* --- десктоп --- */
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => { window.G.ui.docks.select('core'); window.G.ui.app.render(window.G.state); });
    await new Promise((r) => setTimeout(r, 300));
    report.desktop = await page.evaluate(measure);

    report.consoleErrors = errors.slice(0, 5);
  } finally {
    try { await browser.close(); } catch (e) { /* уже закрыт */ }
  }

  const text = JSON.stringify(report, null, 2);
  console.log(text);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'layout.json'), text);
  } catch (e) { console.log('не смог записать layout.json:', e.message); }

  const m = report.mobile || {};
  const bad = [];
  if (!(m.items && m.items.canScroll)) bad.push('доки слоя не переполнены (нет прокрутки)');
  if (!m.itemsScrollWorks) bad.push('scrollLeft не меняется у дока слоя');
  if (!m.lastDockReachable) bad.push('последняя доска слоя недостижима');
  if (!(m.board && m.board.h > 200)) bad.push('#board схлопнута');
  if (m.docks && m.docks.h > m.viewport.h * 0.5) bad.push('рейл съедает больше половины экрана');
  if (bad.length) {
    console.log('\nПРОБЛЕМЫ РАСКЛАДКИ:');
    for (const b of bad) console.log('  ✗ ' + b);
    process.exitCode = 1;
  } else {
    console.log('\nРАСКЛАДКА ОК');
  }
})().catch((e) => {
  console.error('FATAL:', e.message);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify({ fatal: String(e && e.message || e) }, null, 2));
  } catch (e2) { /* уже всё плохо */ }
  process.exitCode = 1;
});
