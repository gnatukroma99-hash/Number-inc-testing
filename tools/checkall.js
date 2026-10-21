/* tools/checkall.js — быстрый «линт» без зависимостей.
   Запуск: node tools/checkall.js
   Проверяет:
     1) синтаксис всех .js (в src/ и tools/) — парсером Node;
     2) VERSION ↔ G.VERSION ↔ ?v=… в index.html;
     3) все <script src> из index.html реально существуют;
     4) каждый механика-файл из src/mechanics/* подключён в index.html (и наоборот);
     5) отсутствие ESM (import/export) и запрещённого знака ^ в формулах-строках. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let fails = 0;
const okS = (n, e) => console.log('  \u2713 ' + n + (e ? '  — ' + e : ''));
const bad = (n, e) => { fails++; console.log('  \u2717 ' + n + (e ? '  — ' + e : '')); };
const check = (n, c, e) => (c ? okS : bad)(n, e);

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(path.join(ROOT, 'src'), []).concat(walk(path.join(ROOT, 'tools'), []));

console.log('\n1. Синтаксис (' + files.length + ' файлов)');
let syntaxFails = 0;
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  try {
    new vm.Script(code, { filename: f });
  } catch (e) {
    syntaxFails++;
    bad(path.relative(ROOT, f), e.message);
  }
}
if (!syntaxFails) okS('все файлы парсятся');

console.log('\n2. Версии');
const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const stateSrc = fs.readFileSync(path.join(ROOT, 'src/systems/state.js'), 'utf8');
const gv = (stateSrc.match(/G\.VERSION\s*=\s*'([^']+)'/) || [])[1];
check('VERSION = ' + version, !!version);
check('G.VERSION совпадает', gv === version, 'G.VERSION = ' + gv);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
check('package.json version', pkg.version === version, pkg.version);

console.log('\n3. index.html');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcs = [];
let m;
const re = /<script\s+src="([^"]+)"/g;
while ((m = re.exec(html))) srcs.push(m[1]);
const badV = srcs.filter((s) => s.indexOf('?v=' + version) < 0);
check('у всех скриптов ?v=' + version, badV.length === 0, badV.join(', '));
const missing = srcs
  .map((s) => s.split('?')[0])
  .filter((s) => !fs.existsSync(path.join(ROOT, s)));
check('все файлы скриптов на месте', missing.length === 0, missing.join(', '));

const mechanicFiles = walk(path.join(ROOT, 'src/mechanics'), [])
  .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
  .filter((f) => !f.includes('/_template/'));
const notLinked = mechanicFiles.filter((f) => html.indexOf(f) < 0);
check('все файлы механик подключены', notLinked.length === 0, notLinked.join(', '));

console.log('\n4. Правила кода');
const esm = files.filter((f) => /^\s*(import|export)\s/m.test(fs.readFileSync(f, 'utf8')));
check('нет ESM (import/export)', esm.length === 0, esm.map((f) => path.relative(ROOT, f)).join(', '));
const exponent = [];
const FORMULA_KEYS = /(formula|costFormula|addM|powM|dtMult|energyMult|Mmult|spanMult|costD|taper|gainFormula|coreMultFormula)\s*:\s*'([^']*)'/g;
for (const f of walk(path.join(ROOT, 'src/content'), []).concat(walk(path.join(ROOT, 'src/mechanics'), []))) {
  const code = fs.readFileSync(f, 'utf8');
  code.split('\n').forEach((line, i) => {
    FORMULA_KEYS.lastIndex = 0;
    let mm;
    while ((mm = FORMULA_KEYS.exec(line))) {
      if (mm[2].indexOf('^') >= 0) {
        exponent.push(path.relative(ROOT, f) + ':' + (i + 1) + ' (' + mm[1] + ')');
      }
    }
  });
}
check('нет ^ в формулах-строках (только **)', exponent.length === 0, exponent.join(', '));

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК'));
process.exitCode = fails ? 1 : 0;
