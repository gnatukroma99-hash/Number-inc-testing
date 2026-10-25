/* tools/tests/core.test.js — юнит-тесты ядра: BN, formula, digits, fmt, registry.
   Загружается из tools/unit.js: register(t, G), где t — утверждения раннера,
   G — песочница window.G с src/core/*.js (без DOM). Значения — из реального кода. */
'use strict';

module.exports = function (t, G) {
  bnTests(t, G.BN);
  formulaTests(t, G);
  digitsTests(t, G);
  fmtTests(t, G);
  registryTests(t, G);
};

/* ---------- G.BN ---------- */
function bnTests(t, BN) {
  t.section('G.BN — число {m,e} = m·10^e', function () {
    t.eq('one() = {m:1,e:0}', BN.one(), { m: 1, e: 0 });
    t.eq('zero() = {m:0,e:0}', BN.zero(), { m: 0, e: 0 });

    const src = { m: 2, e: 5 };
    const copy = BN.clone(src);
    t.ok('clone() — новый объект с теми же m,e', copy !== src && copy.m === 2 && copy.e === 5);

    t.eq('fromNumber(1000) = {m:1,e:3}', BN.fromNumber(1000), { m: 1, e: 3 });
    t.eq('fromNumber(0.001) = {m:1,e:-3}', BN.fromNumber(0.001), { m: 1, e: -3 });
    t.eq('fromNumber(0) = {m:0,e:0}', BN.fromNumber(0), { m: 0, e: 0 });
    t.eq('fromNumber(-42) = {m:-4.2,e:1} (знак в мантиссе)', BN.fromNumber(-42), { m: -4.2, e: 1 });
    t.eq('fromNumber(1e308) = {m:1,e:308}', BN.fromNumber(1e308), { m: 1, e: 308 });
    t.eq('fromNumber(1.5e308) = {m:1.5,e:308}', BN.fromNumber(1.5e308), { m: 1.5, e: 308 });
    t.eq('fromNumber(Infinity) — заглушка {m:1,e:308}', BN.fromNumber(Infinity), { m: 1, e: 308 });
    t.eq('fromNumber(NaN) — та же заглушка {m:1,e:308}', BN.fromNumber(NaN), { m: 1, e: 308 });

    t.eq('fromLog10(0) = {m:1,e:0}', BN.fromLog10(0), { m: 1, e: 0 });
    t.eq('fromLog10(3) = {m:1,e:3}', BN.fromLog10(3), { m: 1, e: 3 });
    t.eq('fromLog10(-1) = {m:1,e:-1}', BN.fromLog10(-1), { m: 1, e: -1 });
    t.eq('fromLog10(308) = {m:1,e:308} (граница)', BN.fromLog10(308), { m: 1, e: 308 });
    t.eq('fromLog10(308.5): e = 308', BN.fromLog10(308.5).e, 308);
    t.near('fromLog10(308.5): m = корень из 10', BN.fromLog10(308.5).m, 3.1622776601683795, 1e-12);
    t.eq('fromLog10(Infinity) = {m:0,e:0}', BN.fromLog10(Infinity), { m: 0, e: 0 });
    for (const l of [0, 1.5, 12.3, 100, 307.9]) {
      t.near('log10(fromLog10(' + l + ')) = ' + l, BN.log10(BN.fromLog10(l)), l, 1e-9);
    }

    t.eq('log10({m:1,e:3}) = 3', BN.log10({ m: 1, e: 3 }), 3);
    t.near('log10({m:2,e:5}) = 5 + log10(2)', BN.log10({ m: 2, e: 5 }), 5.301029995663981, 1e-12);
    t.eq('log10(zero) = 0', BN.log10(BN.zero()), 0);
    t.eq('log10(null) = 0', BN.log10(null), 0);
    t.eq('log10(отрицательная мантисса) = 0', BN.log10({ m: -1, e: 5 }), 0);

    t.eq('digits(1.2345678912345) — 15 цифр мантиссы',
      BN.digits({ m: 1.2345678912345, e: 20 }),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 0]);
    const fifteen = BN.digits({ m: 1, e: 3 });
    t.eq('digits(1e3) — длина 15 (SIG)', fifteen.length, 15);
    t.eq('digits(1e3) — хвост нулями', fifteen.slice(1).every((d) => d === 0), true);
    t.eq('digits(zero) = [0]', BN.digits(BN.zero()), [0]);
    t.eq('digits(null) = [0]', BN.digits(null), [0]);

    t.eq('isValid({m:1,e:0})', BN.isValid({ m: 1, e: 0 }), true);
    t.eq('isValid(zero)', BN.isValid(BN.zero()), true);
    t.eq('isValid(null)', BN.isValid(null), false);
    t.eq('isValid({m:NaN,e:0})', BN.isValid({ m: NaN, e: 0 }), false);
    t.eq('isValid({m:1,e:Infinity})', BN.isValid({ m: 1, e: Infinity }), false);
    t.eq('isZero(zero)', BN.isZero(BN.zero()), true);
    t.eq('isZero(one)', BN.isZero(BN.one()), false);

    t.eq('mul(1e308, 1e308) = {m:1,e:616} — степень не упирается в 308',
      BN.mul(BN.fromNumber(1e308), BN.fromNumber(1e308)), { m: 1, e: 616 });
    t.eq('mul(9, 9) нормализуется в {m:8.1,e:1}', BN.mul({ m: 9, e: 0 }, { m: 9, e: 0 }), { m: 8.1, e: 1 });
    t.eq('mulNum(one, 1e101) идёт через fromLog10', BN.mulNum(BN.one(), 1e101), { m: 1, e: 101 });
    t.eq('mulNum(one, 0) = zero (нулевой множитель)', BN.mulNum(BN.one(), 0), { m: 0, e: 0 });
    t.eq('mulNum(one, -5) = zero (отрицательный множитель)', BN.mulNum(BN.one(), -5), { m: 0, e: 0 });
    t.eq('divNum(fromNumber(100), 4) = {m:2.5,e:1}', BN.divNum(BN.fromNumber(100), 4), { m: 2.5, e: 1 });
    t.eq('divNum(one, 0) = zero', BN.divNum(BN.one(), 0), { m: 0, e: 0 });
    const p1024 = BN.powNum(BN.fromNumber(2), 10);
    t.eq('powNum(2, 10): e = 3', p1024.e, 3);
    t.near('powNum(2, 10) = 1024', BN.log10(p1024), Math.log10(1024), 1e-9);
    t.eq('powNum(zero, 5) = zero', BN.powNum(BN.zero(), 5), { m: 0, e: 0 });

    t.eq('toNumber({m:1,e:400}) = Infinity — допустимо для вывода', BN.toNumber({ m: 1, e: 400 }), Infinity);
    t.eq('toNumber(fromNumber(1e308)) = 1e308', BN.toNumber(BN.fromNumber(1e308)), 1e308);
    t.eq('raw({m:1.5,e:3}) — 15 знаков мантиссы', BN.raw({ m: 1.5, e: 3 }), '1.50000000000000e3');
    t.eq('raw(null) = "0"', BN.raw(null), '0');
  });
}

/* ---------- G.formula ---------- */
function formulaTests(t, G) {
  const F = G.formula;

  t.section('G.formula — строки-формулы (хелперы log10/log/clamp/lerp/taper + Math)', function () {
    t.eq('приоритет: 2 + 3 * 4 = 14', F('2 + 3 * 4'), 14);
    t.eq('приоритет: (2 + 3) * 4 = 20', F('(2 + 3) * 4'), 20);
    t.eq('степень: 2 ** 10 = 1024', F('2 ** 10'), 1024);
    t.eq('pow(2, 10) = 1024', F('pow(2, 10)'), 1024);
    t.eq('вложенный pow(2, pow(2, 3)) = 256', F('pow(2, pow(2, 3))'), 256);
    t.eq('log10(1000) = 3', F('log10(1000)'), 3);
    t.eq('log10 от переменной: log10(N) при N = 1e6', F('log10(N)', { N: 1e6 }), 6);
    t.eq('clamp выше потолка', F('clamp(15, 0, 10)'), 10);
    t.eq('clamp ниже пола', F('clamp(-5, 0, 10)'), 0);
    t.eq('clamp внутри диапазона', F('clamp(5, 0, 10)'), 5);
    t.near('lerp(10, 20, 0.25) = 12.5', F('lerp(10, 20, 0.25)'), 12.5, 1e-12);
    t.eq('taper(90, 100, 20) = 1 (далеко от стены)', F('taper(90, 100, 20)'), 1);
    t.eq('taper(110, 100, 20) = 0.5 (середина затухания)', F('taper(110, 100, 20)'), 0.5);
    t.eq('taper(120, 100, 20) = 0 (у стены)', F('taper(120, 100, 20)'), 0);
    t.eq('taper(130, 100, 20) = 0 (за стеной, не отрицательный)', F('taper(130, 100, 20)'), 0);
    t.eq('taper(0, 100, 20) = 1 (нижняя граница)', F('taper(0, 100, 20)'), 1);
    t.eq('Math доступен: sqrt(4) = 2', F('sqrt(4)'), 2);

    t.eq('vars подставляются: 1 + 0.005*S*lvl при S=42, lvl=3', F('1 + 0.005 * S * lvl', { S: 42, lvl: 3 }), 1.63);
    t.eq('vars перекрывают дефолт: lvl + S при S=5', F('lvl + S', { S: 5 }), 5);
    t.eq('дефолты чисел: lvl + D + S + q + z = 0', F('lvl + D + S + q + z'), 0);
    t.eq('дефолт d1 = 1', F('d1'), 1);
    t.eq('дефолт rho = 1', F('rho'), 1);
    t.eq('дефолт prime = 0', F('prime'), 0);
    t.eq('дефолт t = 0', F('t'), 0);
    t.eq('vars перекрывают дефолт d1', F('d1', { d1: 7 }), 7);

    t.eq('число вместо строки возвращается как есть', F(42), 42);
    t.eq('пустая строка = 0', F(''), 0);
    t.eq('null = 0', F(null), 0);

    t.eq('Infinity внутри формулы зануляется: 1/0', F('1/0'), 0);
    t.eq('переполнение 10 ** 400 зануляется', F('10 ** 400'), 0);
    t.eq('ошибка синтаксиса = 0', t.quiet(() => F('1 +')), 0);
    t.eq('неизвестная переменная = 0', t.quiet(() => F('no_such_var * 2')), 0);
    t.eq('не-число на выходе = 0', t.quiet(() => F('"abc"')), 0);

    F.precompile('1 + 1');
    t.eq('после precompile результат тот же', F('1 + 1'), 2);
    t.eq('precompile("") безопасен', F.precompile(''), undefined);
    t.eq('precompile(123) безопасен', F.precompile(123), undefined);
  });
}

/* ---------- G.digits ---------- */
function digitsTests(t, G) {
  const D = G.digits;

  t.section('G.digits — статистики значащих цифр', function () {
    const st = D.stats({ m: 1.2345678912345, e: 20 });
    t.eq('digits(1.2345678912345) — 15 цифр', st.digits, [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 0]);
    t.eq('S = 60 (сумма цифр)', st.S, 60);
    t.eq('q = 7 (простые цифры 2,3,5,7)', st.q, 7);
    t.eq('z = 1 (один ноль)', st.z, 1);
    t.eq('d1 = 1 (первая цифра)', st.d1, 1);
    t.eq('rho = 6 (цифровой корень 60)', st.rho, 6);
    t.eq('len = 15', st.len, 15);

    const flat = D.stats({ m: 1, e: 3 });
    t.eq('1e3: S = 1, z = 14', [flat.S, flat.z], [1, 14]);
    t.eq('1e3: q = 0 (нули и единица не простые)', flat.q, 0);
    t.eq('1e3: rho = 1', flat.rho, 1);

    const zero = D.stats({ m: 0, e: 0 });
    t.eq('zero: digits = [0]', zero.digits, [0]);
    t.eq('zero: rho = 9 (цифровой корень нуля в этой схеме)', zero.rho, 9);

    t.eq('паттерн "палиндром" (12344 321…)', D.pattern(D.stats({ m: 1.2344321, e: 5 })), 'palindrome');
    t.eq('палиндром проверяется раньше "ровного" (99999999…)',
      D.pattern(D.stats({ m: 9.9999999, e: 3 })), 'palindrome');
    t.eq('паттерн "все простые" (2223333355577233)', D.pattern(D.stats({ m: 2.22333355577233, e: 5 })), 'allprime');
    t.eq('"все простые" раньше "ровного" (S = 63, не палиндром)',
      D.pattern(D.stats({ m: 5.55333333555555, e: 5 })), 'allprime');
    t.eq('паттерн "ровный" (S = 9 кратно 9)', D.pattern(D.stats({ m: 1.8, e: 5 })), 'even');
    t.eq('без узора → null', D.pattern(st), null);

    t.eq('describe: палиндром', D.describe('palindrome'), 'Палиндром');
    t.eq('describe: все простые', D.describe('allprime'), 'Все простые');
    t.eq('describe: ровный', D.describe('even'), 'Ровный');
    t.eq('describe: неизвестный узор', D.describe('nope'), '—');

    t.eq('PRIME_DIGITS: 2,3,5,7 помечены',
      [D.PRIME_DIGITS[2], D.PRIME_DIGITS[3], D.PRIME_DIGITS[5], D.PRIME_DIGITS[7]], [1, 1, 1, 1]);
    t.eq('PRIME_DIGITS: 0 и 1 не простые',
      [D.PRIME_DIGITS[0], D.PRIME_DIGITS[1]], [undefined, undefined]);
  });
}

/* ---------- G.fmt ---------- */
function fmtTests(t, G) {
  const M = G.fmt;
  const modes = [undefined, 'short', 'sci', 'full'];

  t.section('G.fmt — форматы short / sci / full', function () {
    t.eq('short: 1 → "1.00"', M.bn({ m: 1, e: 0 }), '1.00');
    t.eq('short: 5.678 → "5.68"', M.bn({ m: 5.678, e: 0 }), '5.68');
    t.eq('short: 12.3 → "12.3"', M.bn({ m: 1.23, e: 1 }), '12.3');
    t.eq('short: 50 → "50.0"', M.bn({ m: 5, e: 1 }), '50.0');
    t.eq('short: 1e3 → "1.00 K"', M.bn({ m: 1, e: 3 }), '1.00 K');
    t.eq('short: 1.5e6 → "1.50 M"', M.bn({ m: 1.5, e: 6 }), '1.50 M');
    t.eq('short: 1e15 → "1.00 Qa"', M.bn({ m: 1, e: 15 }), '1.00 Qa');
    t.eq('short: 1.5e15 → "1.50 Qa"', M.bn({ m: 1.5, e: 15 }), '1.50 Qa');
    t.eq('short: с 1e100 уходит в sci', M.bn({ m: 1, e: 100 }), '1.00e100');

    t.eq('sci: 1e3 группируется → "1 000"', M.bn({ m: 1, e: 3 }, 'sci'), '1 000');
    t.eq('sci: 1.5e6 → "1.50e6"', M.bn({ m: 1.5, e: 6 }, 'sci'), '1.50e6');
    t.eq('sci: экспонента 1234 группируется пробелом', M.bn({ m: 1.234, e: 1234 }, 'sci'), '1.23e1 234');

    t.eq('full: 1e3 → "1 000"', M.bn({ m: 1, e: 3 }, 'full'), '1 000');
    t.eq('full: 1.5e6 → "1 500 000"', M.bn({ m: 1.5, e: 6 }, 'full'), '1 500 000');
    t.eq('full: с 1e15 переходит в sci', M.bn({ m: 1, e: 15 }, 'full'), '1.00e15');

    t.eq('меньше единицы → "0"', M.bn({ m: 1, e: -1 }), '0');
    t.eq('null → "0"', M.bn(null), '0');
    t.ok('режим по умолчанию = short', M.bn({ m: 1, e: 3 }) === M.bn({ m: 1, e: 3 }, 'short'));

    const bad = [];
    for (let e = -300; e <= 400; e += 7) {
      for (const m of [1, 1.5, 9.99]) {
        for (const mode of modes) {
          const out = M.bn({ m: m, e: e }, mode);
          if (typeof out !== 'string' || !out || out.indexOf('NaN') >= 0 || out.indexOf('Infinity') >= 0) {
            bad.push(m + 'e' + e + ' [' + mode + '] → ' + out);
          }
        }
      }
    }
    t.ok('bn: ни NaN, ни Infinity на e ∈ [-300, 400] × 3 мантиссы × 4 режима',
      bad.length === 0, bad.slice(0, 3).join(' | '));

    t.eq('num: 1234 → "1 234"', M.num(1234), '1 234');
    t.eq('num: 12345 → "12.3 K"', M.num(12345), '12.3 K');
    t.eq('num: 5.678 → "5.68"', M.num(5.678), '5.68');
    t.eq('num: 0 → "0"', M.num(0), '0');
    t.eq('num: 1e15 → "1.00 Qa"', M.num(1e15), '1.00 Qa');
    t.eq('num: sci у мелкого числа — группировка', M.num(1234, 'sci'), '1 234');
    t.eq('num: sci у 1234567 → "1.23e6"', M.num(1234567, 'sci'), '1.23e6');
    t.eq('num(Infinity) = "∞"', M.num(Infinity), '∞');
    t.eq('num(NaN) = "∞"', M.num(NaN), '∞');
    t.eq('num(не число) = "∞"', M.num('5'), '∞');

    const badNum = [];
    for (const n of [0, 1, 0.5, 999.5, 12345, 1e6, 1e15, -1234, -0.5, 1e-9]) {
      for (const mode of modes) {
        const out = M.num(n, mode);
        if (typeof out !== 'string' || !out || out.indexOf('NaN') >= 0) badNum.push(n + ' [' + mode + '] → ' + out);
      }
    }
    t.ok('num: ни NaN на обычных величинах × 4 режима', badNum.length === 0, badNum.slice(0, 3).join(' | '));

    t.eq('pct(0.5) = "50.0%"', M.pct(0.5), '50.0%');
    t.eq('pct(1) = "100%"', M.pct(1), '100%');
    t.eq('pct(0.037) = "3.7%"', M.pct(0.037), '3.7%');

    t.eq('digitsLabel(137) = "137 цифр"', M.digitsLabel(137), '137 цифр');
    t.eq('digitsLabel(1) = "1 цифра"', M.digitsLabel(1), '1 цифра');
    t.eq('digitsLabel(21) = "21 цифра"', M.digitsLabel(21), '21 цифра');
    t.eq('digitsLabel(12) = "12 цифр"', M.digitsLabel(12), '12 цифр');
    t.eq('digitsLabel(0) = "0 цифр"', M.digitsLabel(0), '0 цифр');

    t.eq('time(5) = "5.0 с"', M.time(5), '5.0 с');
    t.eq('time(90) = "1 мин 30 с"', M.time(90), '1 мин 30 с');
    t.eq('time(3700) = "1 ч 1 мин"', M.time(3700), '1 ч 1 мин');
    t.eq('time(-5) = "0.0 с" (не отрицательное)', M.time(-5), '0.0 с');
  });
}

/* ---------- G.registry ---------- */
function registryTests(t, G) {
  const R = G.registry;

  t.section('G.registry — реестр контента', function () {
    const base = R.summary();

    R.addMechanic({ id: 'unit-mech-a' });
    R.addMechanic({ id: 'unit-mech-b', order: 5, scope: 'meta' });
    const a = R.mechanic('unit-mech-a');
    const b = R.mechanic('unit-mech-b');
    t.eq('addMechanic: дефолты order/scope/autoLevel', [a.order, a.scope, a.autoLevel], [100, 'run', 0]);
    t.eq('addMechanic: данные сохраняются', [b.order, b.scope], [5, 'meta']);
    t.eq('mechanic(id) возвращает объект', a.id, 'unit-mech-a');
    t.eq('mechanic(неизвестный) = undefined', R.mechanic('unit-nope'), undefined);

    const mechIds = R.mechanics().map((m) => m.id);
    t.ok('mechanics() сортирует по order: unit-mech-b(5) раньше unit-mech-a(100)',
      mechIds.indexOf('unit-mech-b') >= 0 && mechIds.indexOf('unit-mech-b') < mechIds.indexOf('unit-mech-a'));

    t.throws('addMechanic({}) бросает', () => R.addMechanic({}));
    t.throws('addMechanic() без аргумента бросает', () => R.addMechanic());

    R.addUpgrade({ id: 'unit-up-1', mech: 'unit-mech-a', formula: '1 + 0.5 * lvl' });
    const u = R.upgrade('unit-up-1');
    t.eq('addUpgrade: дефолты scope/max/res/autoBuy', [u.scope, u.max, u.res, u.autoBuy], ['run', Infinity, 'energy', true]);
    t.eq('addUpgrade: формула хранится строкой', u.formula, '1 + 0.5 * lvl');
    t.eq('addUpgrade: формула компилируется общим парсером', G.formula(u.formula, { lvl: 4 }), 3);
    t.eq('upgradesOf(mech) фильтрует по mech', R.upgradesOf('unit-mech-a').map((x) => x.id), ['unit-up-1']);
    t.ok('allUpgrades() содержит добавленный', R.allUpgrades().some((x) => x.id === 'unit-up-1'));

    R.addResource({ id: 'unit-res' });
    t.eq('addResource: дефолты scope/value', [R.resource('unit-res').scope, R.resource('unit-res').value], ['run', 0]);
    t.ok('allResources() содержит ресурс', R.allResources().some((r) => r.id === 'unit-res'));

    R.addTier({ id: 'unit-tier' });
    t.eq('addTier/tier возвращает ярус', R.tier('unit-tier').id, 'unit-tier');
    t.ok('allTiers() содержит ярус', R.allTiers().some((x) => x.id === 'unit-tier'));

    t.eq('summary() прибавил ровно добавленное', R.summary(), {
      mechanics: base.mechanics + 2,
      upgrades: base.upgrades + 1,
      resources: base.resources + 1,
      tiers: base.tiers + 1
    });
  });
}
