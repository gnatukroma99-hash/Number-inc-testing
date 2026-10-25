/* tools/tests/patterns.test.js — редкие узоры мантиссы: змейка и джекпот.
   Запуск:  node tools/tests/patterns.test.js
   Что проверяет:
     1) scan() находит jackpot (7+ одинаковых цифр) и snake (пара, 3+ цикла);
     2) старые типы (triple/quad/run3/run4/pal) не сломаны и приоритеты соблюдены;
     3) в результате scan() нет повторов типов;
     4) перезарядка типа в tick(): тот же узор не ловится чаще cooldownSec;
     5) буфф джекпота сильнее обычного, оба числа конечные.

   DOM не нужен: src/ грузится в vm-песочницу, G.lvl/G.bus/G.growth — заглушки.
   Число state.N задаётся так, чтобы G.BN.digits() давал нужную строку цифр. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- песочница: только content/patterns.js + core/bignum.js + systems/patterns.js ---------- */
function boot() {
  const sandbox = { window: {}, console: console };
  vm.createContext(sandbox);
  const G = (sandbox.window.G = {});
  G.registry = { addUpgrades() {}, addUpgrade() {}, upgradesOf() { return []; }, addMechanic() {} };
  G.formula = { precompile() {} };
  G.lvl = () => 0;
  G.events = [];
  G.bus = { emit(name, e) { G.events.push({ name: name, e: e }); } };
  G.growth = { D: () => 1e10 };
  const load = (rel) => vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  load('src/content/patterns.js');
  load('src/core/bignum.js');
  load('src/systems/patterns.js');
  return G;
}

const G = boot();
const P = G.patterns;
const TYPES = G.content.patterns.types;

/* ---------- микро-отчёт ---------- */
let fails = 0;
function ok(name, extra) { console.log('  \u2713 ' + name + (extra ? '  — ' + extra : '')); }
function fail(name, extra) { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
function check(name, cond, extra) { (cond ? ok : fail)(name, extra); return cond; }
function section(t) { console.log('\n' + t); }

const typesOf = (str) => P.scan(str).map((h) => h.type);
const hitOf = (str, type) => P.scan(str).filter((h) => h.type === type)[0];

/* state для tick(): есть мантисса, механика и формат чисел */
function stateWith(N) {
  return { N: N, mech: {}, settings: { numberFormat: 'short' } };
}

/* ---------- 1. новые типы ---------- */
section('1. Поиск узоров (scan)');
{
  const hits = P.scan('7777777');
  check('7777777 → jackpot первым', hits.length > 0 && hits[0].type === 'jackpot', JSON.stringify(hits));
  check('7777777: джекпот не считается квадро', typesOf('7777777').indexOf('quad') < 0, typesOf('7777777').join(','));
  check('7777777: длина узора 7', !!hitOf('7777777', 'jackpot') && hitOf('7777777', 'jackpot').len === 7);

  const snakeHits = P.scan('12121212');
  const snake = hitOf('12121212', 'snake');
  check('12121212 → snake', !!snake, typesOf('12121212').join(','));
  check('12121212: длина узора 8', !!snake && snake.len === 8, snake && String(snake.text));
  check('121212: тоже snake (минимум 3 цикла)', typesOf('121212').indexOf('snake') >= 0, typesOf('121212').join(','));
  check('1212: snake нет — меньше 3 циклов', typesOf('1212').indexOf('snake') < 0, typesOf('1212').join(','));
  check('111111: snake нет — это ряд одинаковых цифр', typesOf('111111').indexOf('snake') < 0, typesOf('111111').join(','));
  check('122112: snake нет — повтор не по шагу пары', typesOf('122112').indexOf('snake') < 0, typesOf('122112').join(','));
  check('121234: snake нет — ABAB оборвался до 3 циклов', typesOf('121234').indexOf('snake') < 0, typesOf('121234').join(','));
}

/* ---------- 2. старые типы живы ---------- */
section('2. Старые узоры не сломаны');
check('777 → triple', typesOf('777').join(',') === 'triple', typesOf('777').join(','));
check('1111 → quad', typesOf('1111').join(',') === 'quad', typesOf('1111').join(','));
check('123 → run3', typesOf('123').join(',') === 'run3', typesOf('123').join(','));
check('1234 → run4', typesOf('1234').join(',') === 'run4', typesOf('1234').join(','));
check('12321 → pal (вместе с run3 — так было и раньше)', typesOf('12321').indexOf('pal') >= 0 && hitOf('12321', 'pal').len === 5,
  typesOf('12321').join(','));

/* ---------- 3. приоритеты и уникальность типов ---------- */
section('3. Приоритеты и отсутствие дублей');
{
  /* jackpot выше quad; snake ниже run4, но выше run3 и pal */
  const withRun4 = typesOf('4321121212');
  check('run4 выше snake', withRun4.indexOf('run4') >= 0 && withRun4.indexOf('run4') < withRun4.indexOf('snake'), withRun4.join(','));

  const withPal = typesOf('12121212');
  check('snake выше pal', withPal.indexOf('snake') >= 0 && withPal.indexOf('snake') < withPal.indexOf('pal'), withPal.join(','));

  const withRun3 = typesOf('121212234');
  check('snake выше run3', withRun3.indexOf('snake') >= 0 && withRun3.indexOf('snake') < withRun3.indexOf('run3'), withRun3.join(','));

  const samples = ['7777777', '12121212', '777', '1111', '123', '1234', '12321',
    '7777777121212', '111111234', '5555555', '4321121212', '121212234', '1111111'];
  let dupes = 0;
  let empty = 0;
  for (const s of samples) {
    const t = typesOf(s);
    if (new Set(t).size !== t.length) dupes++;
    if (!t.length) empty++;
  }
  check('в scan() нет дублей типов (' + samples.length + ' строк)', dupes === 0, 'дублей: ' + dupes);
  check('каждая строка даёт хотя бы один узор', empty === 0, 'пустых: ' + empty);
}

/* ---------- 4. перезарядка типа в tick() ---------- */
section('4. Перезарядка (cooldown) в tick()');
{
  /* мантисса 777777777777777 — джекпот каждые 0.25 с */
  const state = stateWith(G.BN.fromNumber(7.77777777777777));
  const digits = G.BN.digits(state.N).join('');
  check('мантисса для теста = 15 семёрок', digits === '777777777777777', digits);

  const d = P.data(state);
  const cool = P.buff(state).cooldown;

  P.tick(state, 0.3);
  const first = d.count.jackpot || 0;
  check('первый tick ловит джекпот', first === 1, 'поймано: ' + first);

  P.tick(state, 0.3);
  check('второй tick в пределах перезарядки не ловит снова', (d.count.jackpot || 0) === first,
    'clock=' + d.clock.toFixed(2) + ' · поймано: ' + (d.count.jackpot || 0));

  P.tick(state, cool + 0.5);
  check('после перезарядки джекпот ловится снова', (d.count.jackpot || 0) === first + 1,
    'clock=' + d.clock.toFixed(2) + ' · поймано: ' + (d.count.jackpot || 0));
}

/* ---------- 5. усиленный буфф джекпота ---------- */
section('5. Буфф: джекпот сильнее обычного');
{
  const state = stateWith(G.BN.fromNumber(7.77777777777777));
  const base = P.buff(state);
  const jack = P.buff(state, 'jackpot');
  const jackType = TYPES.filter((t) => t.id === 'jackpot')[0] || {};

  check('у джекпота буфф дольше', jack.sec > base.sec, base.sec + ' → ' + jack.sec);
  check('у джекпота буфф сильнее', jack.mult > base.mult, base.mult + ' → ' + jack.mult);
  check('усиление задано данными (buffSecX/buffMultX)', jackType.buffSecX === 1.5 && jackType.buffMultX === 1.25,
    'buffSecX=' + jackType.buffSecX + ' buffMultX=' + jackType.buffMultX);
  check('перезарядка от типа не зависит', jack.cooldown === base.cooldown, String(jack.cooldown));

  P.tick(state, 0.3);
  const d = P.data(state);
  const active = P.active(state);
  check('пойманный джекпот поднял множитель буффа', active.mult >= jack.mult,
    'active ×' + active.mult + ' · база ×' + base.mult);
  check('active.sec — длительность джекпота', active.sec === jack.sec, String(active.sec));
  check('буфф d.buffUntil в будущем', (d.buffUntil || 0) > d.clock, d.buffUntil + ' > ' + d.clock);

  const m = P.mult(state);
  check('mult(state) конечный и > 1', isFinite(m) && m > 1, String(m));
  const left = P.left(state);
  check('left(state) конечный и > 0', isFinite(left) && left > 0, String(left));
}

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК'));
process.exitCode = fails ? 1 : 0;
