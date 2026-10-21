/* tools/shot.js — СКРИНШОТЫ игры в настоящем браузере (headless Chrome/Edge).
   Запуск:  node tools/shot.js [доска ...]      (по умолчанию — все)
   Куда:    tools/shots/<доска>.png  (+ full-*.png для мобильного вида)
   Нужен:  npm i -D puppeteer-core  и установленный Chrome/Edge.
   Зачем: агент видит реальную вёрстку (jsdom её не рисует). */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'shots');
const BOARDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['core', 'digitsum', 'analysis', 'shop', 'primeranks', 'sieve', 'mirror', 'prestige', 'tree'];

function findBrowser() {
  for (const p of CANDIDATES) if (fs.existsSync(p)) return p;
  throw new Error('Chrome/Edge не найден');
}

/* подготовка состояния: всё открыто, ядер/энергии хватает */
const PREP = `
(() => {
  const G = window.G;
  if (!G || !G.state) return 'no_state';
  const s = G.state;
  s.res.energy = 1e18;
  s.res.prime = 1e6;
  s.res.cores = 420;
  G.debug.setD(140);
  // покупаем часть дерева, чтобы было видно разные состояния узлов
  const buy = (id, n) => { const u = G.registry.upgrade(id); for (let i = 0; i < (n || 1); i++) G.upgrades.buy(s, u); };
  ['tree_headstart','tree_tempo','tree_softcap','tree_base','tree_core','tree_battery','tree_auto_all','tree_sieve','tree_mirror'].forEach((id) => buy(id, 2));
  // немного апгрейдов на досках
  ['sd','pq','pm_base','bfd','rho_root','zero_leak','shop_battery','sv_rate','sv_power','mr_deep','mr_power','sv_yield','mr_echo'].forEach((id) => buy(id, 3));
  s.res.cores = 118;
  s.mech.sieve = { idx: 34, found: 148, acc: 0.62 };
  s.mech.mirror = { sym: 3, grain: 41, bestSym: 4, pairs: 5, lastSample: -1 };
  // искра на экране — чтобы было видно плавающую кнопку
  s.mech.spark = { nextIn: 30, left: 15, type: 'burst', caught: 3, buffs: [{ type: 'tempo', left: 12, total: 20, dt: 0.45 }] };
  G.state.stats.bestD = 308;
  G.ui.app.render(s);
  return 'ok';
})()`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1']
  });
  fs.mkdirSync(OUT, { recursive: true });

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.G && window.G.debug && window.G.state', { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));
  const prep = await page.evaluate(PREP);
  console.log('подготовка состояния:', prep);

  for (const id of BOARDS) {
    await page.evaluate((boardId) => {
      const btn = Array.from(document.querySelectorAll('#docks .dock')).find((b) => b.dataset.id === boardId);
      if (btn) btn.click();
      window.G.ui.app.render(window.G.state);
    }, id);
    await page.evaluate(() => {
      /* скриншоты без всплывающих тостов — чтобы видеть чистое меню */
      document.querySelectorAll('#toasts .toast').forEach((t) => t.remove());
    });
    await new Promise((r) => setTimeout(r, 260));
    const file = path.join(OUT, id + '.png');
    await page.screenshot({ path: file });
    console.log('  снято:', path.relative(ROOT, file));
  }

  /* дерево в приближении (проверка зума) */
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('#docks .dock')).find((b) => b.dataset.id === 'tree');
    if (btn) btn.click();
    const zin = document.querySelector('#board .tree-zoom-btn');
    if (zin) { zin.click(); zin.click(); zin.click(); }
  });
  await new Promise((r) => setTimeout(r, 260));
  await page.screenshot({ path: path.join(OUT, 'tree-zoom.png') });
  console.log('  снято: tools/shots/tree-zoom.png');

  /* мобильный вид */
  await page.setViewport({ width: 420, height: 860, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('#docks .dock')).find((b) => b.dataset.id === 'tree');
    if (btn) btn.click();
    window.G.ui.app.render(window.G.state);
  });
  await new Promise((r) => setTimeout(r, 260));
  await page.screenshot({ path: path.join(OUT, 'mobile-tree.png'), fullPage: false });
  console.log('  снято: tools/shots/mobile-tree.png');

  /* настройки */
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.click('#btn-settings');
  await new Promise((r) => setTimeout(r, 220));
  await page.screenshot({ path: path.join(OUT, 'settings.png') });
  console.log('  снято: tools/shots/settings.png');

  if (errors.length) {
    console.log('\nОШИБКИ В БРАУЗЕРЕ:');
    for (const e of errors.slice(0, 10)) console.log('  ' + e);
    process.exitCode = 1;
  } else {
    console.log('\nошибок в консоли нет');
  }

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exitCode = 1;
});
