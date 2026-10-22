/* tools/bump.js — поднять версию проекта ОДНОЙ командой во всех местах сразу.
   Запуск:
     node tools/bump.js            патч по умолчанию: 0.12.2 -> 0.12.3
     node tools/bump.js minor      минор:            0.12.2 -> 0.13.0
     node tools/bump.js major      мажор:            0.12.2 -> 1.0.0
     node tools/bump.js 0.13.5     явная версия
     node tools/bump.js --print    только показать текущую

   Меняет ровно те 5 мест, которые проверяет tools/checkall.js:
     VERSION · G.VERSION в src/systems/state.js · ?v=… в index.html ·
     version в package.json · version в package-lock.json
   НЕ трогает docs/CHANGELOG.md и CONTEXT.md — их пишет человек/агент.
   Проверка после бампа: node tools/checkall.js */
'use strict';
require('./_limit')(60);

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);

const rawVersion = read('VERSION');
const cur = rawVersion.trim().replace(/^v/i, '');
const arg = String(process.argv[2] || 'patch').trim().toLowerCase();

if (arg === '--print' || arg === '-p' || arg === 'print') {
  console.log(cur);
  process.exit(0);
}

function nextVersion(from, mode) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(from);
  if (!m) throw new Error('VERSION не похож на x.y.z: "' + from + '"');
  const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
  if (mode === 'patch') return a + '.' + b + '.' + (c + 1);
  if (mode === 'minor') return a + '.' + (b + 1) + '.0';
  if (mode === 'major') return (a + 1) + '.0.0';
  if (/^\d+\.\d+\.\d+$/.test(mode)) return mode;
  throw new Error('неизвестный режим: "' + mode + '" (patch | minor | major | x.y.z)');
}

let nv;
try {
  nv = nextVersion(cur, arg);
} catch (e) {
  console.error('[bump] ' + e.message);
  process.exit(1);
}
if (nv === cur) {
  console.error('[bump] версия не меняется: ' + cur);
  process.exit(1);
}

const done = [];

/* 1) VERSION — сохраняем наличие/отсутствие завершающего перевода строки */
write('VERSION', nv + (/\n$/.test(rawVersion) ? '\n' : ''));
done.push('VERSION');

/* 2) src/systems/state.js — G.VERSION */
const statePath = 'src/systems/state.js';
const stateSrc = read(statePath);
if (!/G\.VERSION\s*=\s*'[^']*'/.test(stateSrc)) {
  console.error('[bump] в ' + statePath + ' не нашёл G.VERSION = \'…\'');
  process.exit(1);
}
write(statePath, stateSrc.replace(/G\.VERSION\s*=\s*'[^']*'/, "G.VERSION = '" + nv + "'"));
done.push(statePath);

/* 3) index.html — все ?v=… (скрипты и CSS) */
const htmlPath = 'index.html';
const html = read(htmlPath);
const refs = (html.match(/\?v=[0-9][0-9A-Za-z.\-]*/g) || []).length;
if (!refs) {
  console.error('[bump] в ' + htmlPath + ' не нашёл ни одного ?v=…');
  process.exit(1);
}
write(htmlPath, html.replace(/(\?v=)[0-9][0-9A-Za-z.\-]*/g, '$1' + nv));
done.push(htmlPath + ' (?v= ×' + refs + ')');

/* 4) package.json */
const pkg = JSON.parse(read('package.json'));
pkg.version = nv;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
done.push('package.json');

/* 5) package-lock.json — версия в корне и в packages[""] */
const lock = JSON.parse(read('package-lock.json'));
lock.version = nv;
if (lock.packages && lock.packages['']) lock.packages[''].version = nv;
write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
done.push('package-lock.json');

console.log('[bump] ' + cur + ' -> ' + nv);
for (const d of done) console.log('  ✓ ' + d);
console.log('[bump] дальше: node tools/checkall.js, затем docs/CHANGELOG.md и CONTEXT.md');
