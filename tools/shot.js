/* tools/shot.js — СКРИНШОТЫ игры в настоящем браузере (headless Chrome/Edge).
   Запуск:  node tools/shot.js [доска ...]      (по умолчанию — все)
   Куда:    tools/shots/<доска>.png  (+ full-*.png для мобильного вида)
   Нужен:  npm i -D puppeteer-core  и установленный Chrome/Edge.
   Зачем: агент видит реальную вёрстку (jsdom её не рисует). */
'use strict';
require('./_limit')(300);

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CANDIDATES = [
  process.env.CHROME_PATH || '',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/root/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'shots');
const BOARDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['core', 'combo', 'digitsum', 'analysis', 'shop', 'primeranks', 'sieve', 'mirror', 'patterns', 'slot', 'prestige', 'tree',
    'bigbang', 'glyphs', 'challenges', 'pacts', 'duplicator', 'pacttree', 'echo', 'chrono', 'rift', 'constellations',
    'breakthrough', 'psitree', 'omega', 'achievements'];

function findBrowser() {
  /* CHROME_PATH первым: в CI браузер ставится скриптом и путь приходит из окружения */
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const p of CANDIDATES) {
    if (!p) continue;
    if (p.indexOf('*') >= 0) {
      const dir = path.dirname(p);
      const base = path.dirname(dir);
      try {
        for (const d of fs.readdirSync(base)) {
          const cand = p.replace('*', d);
          if (fs.existsSync(cand)) return cand;
        }
      } catch (e) { /* нет каталога — идём дальше */ }
      continue;
    }
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome/Edge не найден (задайте CHROME_PATH)');
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
  s.mech.spark = { nextIn: 30, left: 15, type: 'burst', caught: 7, buffs: [{ type: 'tempo', left: 12, total: 20, dt: 0.45 }], rush: { left: 14, streak: 3, spawned: 3 } };
  // Ярус 2: стена снята, есть Δ/Ω — чтобы снять новые доски
  s.meta.passedBarriers = ['wall_308'];
  s.meta.tier = 'tier2';
  s.meta.bangs = 3;
  s.res.delta = 260;
  s.meta.achievements = (G.achievements ? G.achievements.list().slice(0, 12).map((a) => a.id) : []);
  if (s.mech.omega) { s.mech.omega.omega = 12; s.mech.omega.rules = ['w_pity', 'w_spark']; }
  if (s.mech.glyphs) { s.mech.glyphs.slots = [{ id: 1, digit: 3, rarity: 'epic', profile: 'greed' }, { id: 2, digit: 7, rarity: 'legend', profile: 'kernel' }, null]; }
  if (s.mech.combo) s.mech.combo.combo = 8.4;
  if (s.mech.pacts) { s.mech.pacts.active = { tpl: 'p_greed', k: 1.1 }; }
  if (s.mech.echo) { s.mech.echo = { bought: true, on: true, gained: 12 }; }
  if (s.mech.duplicator) { s.mech.duplicator = { bought: true, on: true, shadow: 12.4, penalty: 0, merges: 2, best: 20 }; }
  if (s.mech.rift) { s.mech.rift = { left: 11, nextIn: 0, opened: 3, caught: 7, bestLeft: 30 }; }
  if (s.mech.challenges) { s.meta.challenges = ['ch_nosum']; }
  /* Ярус 3: стена 1e1000 снята — чтобы снять ПРОБОЙ и Ψ-дерево, и были Ψ на покупки */
  s.meta.passedBarriers.push('wall_1000');
  s.res.psi = 60;
  s.meta.breaks = 2;
  ['psi_start', 'psi_speed', 'psi_delta'].forEach((id) => { if (G.registry.upgrade(id)) buy(id, 1); });
  ['ps_freq', 'ps_cut', 'ps_yield', 'ps_boom1'].forEach((id) => { if (G.registry.upgrade(id)) buy(id, 1); });
  s.res.psi = 21;
  /* паттерны: коллекция и активный буфф, чтобы доска была «живой» */
  s.mech.patterns = {
    count: { triple: 2, quad: 1, run3: 1, run4: 1, pal: 0 }, total: 5,
    clock: 100, lastScan: 99.85, buffUntil: 106.5, streak: 3,
    lastClaim: 96, lastType: 'run4', lastText: '3210', bestLen: 4
  };
  G.state.stats.bestD = 308;
  G.ui.app.render(s);
  return 'ok';
})()`;

let browser = null;                       /* закрываем в finally: иначе Chrome висит и tool «зависает» */
(async () => {
  browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
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

  /* меню «Все доски» — главный экран навигации */
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    const back = Array.from(document.querySelectorAll('#docks .dock')).find((b) => b.dataset.id === 'core');
    if (back) back.click();
    if (window.G.ui.menu) window.G.ui.menu.open();
  });
  await new Promise((r) => setTimeout(r, 420));
  await page.screenshot({ path: path.join(OUT, 'menu.png') });
  console.log('  снято: tools/shots/menu.png');

  /* мобильный вид: доки + меню */
  await page.setViewport({ width: 420, height: 860, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 220));
  await page.screenshot({ path: path.join(OUT, 'mobile-menu.png') });
  console.log('  снято: tools/shots/mobile-menu.png');
  await page.evaluate(() => { if (window.G.ui.menu) window.G.ui.menu.close(); window.G.ui.app.render(window.G.state); });
  await new Promise((r) => setTimeout(r, 260));
  await page.screenshot({ path: path.join(OUT, 'mobile-core.png') });
  console.log('  снято: tools/shots/mobile-core.png');

  /* настройки: сначала выходим из полноэкранного дерева, иначе шапка скрыта */
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    const back = Array.from(document.querySelectorAll('#docks .dock')).find((b) => b.dataset.id === 'core');
    if (back) back.click();
    const btn = document.getElementById('btn-settings');
    if (btn) btn.click();                     /* click() работает и для скрытых кнопок */
    window.G.ui.app.render(window.G.state);
  });
  await new Promise((r) => setTimeout(r, 260));
  await page.screenshot({ path: path.join(OUT, 'settings.png') });
  console.log('  снято: tools/shots/settings.png');

  if (errors.length) {
    console.log('\nОШИБКИ В БРАУЗЕРЕ:');
    for (const e of errors.slice(0, 10)) console.log('  ' + e);
    process.exitCode = 1;
  } else {
    console.log('\nошибок в консоли нет');
  }

})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exitCode = 1;
}).finally(async () => {
  try { if (browser) await browser.close(); } catch (err) { /* уже закрыт */ }
});
