/* tools/sim.js — офлайн-симулятор баланса. Запуск:  node tools/sim.js [минут]
   Повторяет формулы из src/ без DOM, чтобы проверить кривую D(t).
   Учитывает: линейную энергию, одноразовые ×2, магазин за цифры,
   невидимый софткап и барьер 1e308.
   Если node нет — файл просто лежит, игра от него не зависит. */
'use strict';

const MINUTES = Number(process.argv[2] || 120);
const REPORT = Number(process.argv[3] || 300);

/* ---------- простые ---------- */
const primes = (() => {
  const out = [];
  for (let i = 2; i <= 2000; i++) {
    let ok = true;
    for (let j = 2; j * j <= i; j++) if (i % j === 0) { ok = false; break; }
    if (ok) out.push(i);
  }
  return out;
})();
const countPrimesUpTo = (x) => {
  let n = 0;
  for (const p of primes) { if (p <= Math.floor(x)) n++; else break; }
  return n;
};

/* ---------- детерминированный рандом ---------- */
let seed = Number(process.env.SEED || 12345);
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

/* ---------- состояние ---------- */
const S = {
  D: 0,
  N: 1,
  energy: 0,
  prime: 0,
  primeEarned: 0,
  primeIdx: 0,
  lvl: {},
  Ssum: 67,
  q: 6,
  d1: 1,
  rho: 1,
  z: 0,
  sampleLeft: 4,
  nextShop: 0,
  nextReport: 0
};

const UPG = {
  mult1:    { res: 'energy', base: 8,     growth: 1.55, max: Infinity },
  speed1:   { res: 'energy', base: 5,     growth: 1.65, max: Infinity },
  energy1:  { res: 'energy', base: 40,    growth: 1.8,  max: Infinity },
  energy_x2_1: { res: 'energy', base: 150, growth: 1, max: 1, energyMult: 2 },
  energy_x2_2: { res: 'energy', base: 900, growth: 1, max: 1, energyMult: 2 },
  energy_x2_3: { res: 'energy', base: 5e3, growth: 1, max: 1, energyMult: 2 },
  energy_x2_4: { res: 'energy', base: 3e4, growth: 1, max: 1, energyMult: 2 },
  energy_x2_5: { res: 'energy', base: 2e5, growth: 1, max: 1, energyMult: 2 },
  energy_x2_6: { res: 'energy', base: 1.5e6, growth: 1, max: 1, energyMult: 2 },
  energy_x2_7: { res: 'energy', base: 1e7, growth: 1, max: 1, energyMult: 2 },
  energy_x2_8: { res: 'energy', base: 8e7, growth: 1, max: 1, energyMult: 2 },
  sd:       { res: 'energy', base: 60,    growth: 1.9,  max: 20 },
  bfd:      { res: 'energy', base: 800,   growth: 2.0,  max: 15 },
  rho_root: { res: 'energy', base: 1200,  growth: 2.1,  max: 15 },
  zero_leak:{ res: 'energy', base: 2500,  growth: 2.2,  max: 10 },
  sd_stab:  { res: 'energy', base: 300,   growth: 2.5,  max: 10 },
  pq:       { res: 'energy', base: 500,   growth: 2.0,  max: 15 },
  pq_jack:  { res: 'energy', base: 5000,  growth: 3.2,  max: 5 },
  pm_base:  { res: 'prime',  base: 1,     growth: 2.0,  max: 25 },
  pm_speed: { res: 'prime',  base: 2,     growth: 2.4,  max: 15 },
  /* магазин: цена в цифрах */
  shop_battery: { res: 'number', costD: 0.30, growthD: 1.8, minD: 8,  max: 6, kind: 'energy', val: 1.5 },
  shop_plus:    { res: 'number', costD: 0.80, growthD: 1.8, minD: 18, max: 6, kind: 'addM',   val: 500 },
  shop_tempo:   { res: 'number', costD: 1.00, growthD: 1.9, minD: 30, max: 8, kind: 'dt',     val: 0.95 },
  shop_pow:     { res: 'number', costD: 1.00, growthD: 1.6, minD: 60, max: 6, kind: 'pow',    val: 1.05 }
};

const HIDDEN = {
  knee: Number(process.env.HK || 5),
  span: Number(process.env.HS || 17.5),
  power: Number(process.env.HP || 1.5)
};

const lvl = (id) => S.lvl[id] || 0;
const cost = (id) => {
  const u = UPG[id];
  return u.base * Math.pow(u.growth, lvl(id));
};
const costD = (id) => UPG[id].costD * Math.pow(UPG[id].growthD, lvl(id));

/* ---------- формулы ---------- */
const period = () => 4 + 2 * lvl('sd_stab');

function resample() {
  let sum = 0, q = 0, z = 0;
  let d1 = 1;
  for (let i = 0; i < 15; i++) {
    const d = Math.floor(rnd() * 10);
    if (i === 0) d1 = d || 1;
    sum += d;
    if (d === 0) z++;
    if (d === 2 || d === 3 || d === 5 || d === 7) q++;
  }
  S.Ssum = sum;
  S.q = q;
  S.d1 = d1;
  S.z = z;
  S.rho = 1 + ((sum - 1 + 900) % 9);
}

function shopProduct(kind) {
  let p = 1;
  for (const id in UPG) {
    if (UPG[id].kind !== kind) continue;
    const l = lvl(id);
    if (!l) continue;
    const u = UPG[id];
    if (kind === 'energy' || kind === 'pow' || kind === 'dt') p *= Math.pow(u.val, l);
  }
  return p;
}

function baseM() {
  let b = 2 + lvl('mult1');
  b += 500 * lvl('shop_plus');
  return b;
}

function M() {
  const sSd = 1 + 0.005 * S.Ssum * lvl('sd');
  let mPq = 1 + 0.12 * S.q * lvl('pq');
  if (S.q >= 15 && lvl('pq_jack')) mPq *= 1 + 2 * lvl('pq_jack');
  const pbase = 1.25 + 0.03 * lvl('pm_base');
  const mPr = Math.pow(pbase, S.primeEarned);
  let mBf = 1, mRho = 1, mZ = 1;
  if (lvl('bfd')) mBf = 1 + 0.5 * lvl('bfd') * Math.log10(1 + 1 / S.d1) / Math.log10(2);
  if (lvl('rho_root')) mRho = 1 + 0.06 * S.rho * lvl('rho_root');
  if (lvl('zero_leak')) mZ = 1 + 0.03 * S.z * lvl('zero_leak');
  const mech = sSd * mPq * mPr * mBf * mRho * mZ;
  let exp = shopProduct('pow');
  if (!isFinite(exp) || exp < 1) exp = 1;
  exp = Math.min(exp, 1.5);
  return baseM() * Math.pow(mech, exp);
}

function dt() {
  const bonus = 0.1 * lvl('speed1');
  const mult = Math.pow(0.95, lvl('pm_speed')) * shopProduct('dt');
  return Math.max(0.033, (60 / (1 + bonus)) * Math.max(0.02, mult));
}

function energyMult() {
  let m = Math.pow(1.25, lvl('energy1'));
  for (const id in UPG) if (UPG[id].energyMult && lvl(id)) m *= UPG[id].energyMult;
  return m * shopProduct('energy');
}

function energyRate() {
  return 1 * (1 + S.D) * energyMult();
}

function hiddenFactor(D) {
  return 1 / (1 + Math.pow(Math.max(0, D - HIDDEN.knee) / HIDDEN.span, HIDDEN.power));
}

function wall308(D) {
  return Math.max(0, Math.min(1, (308 + 10 - D) / 10));
}

function barrier(D) {
  return hiddenFactor(D) * wall308(D);
}

/* ---------- покупки ---------- */
function buyCore() {
  for (let guard = 0; guard < 300; guard++) {
    let best = null, bestCost = Infinity;
    for (const id in UPG) {
      const u = UPG[id];
      if (u.res !== 'energy') continue;
      if (lvl(id) >= u.max) continue;
      const c = cost(id);
      if (c <= S.energy && c < bestCost) { best = id; bestCost = c; }
    }
    if (!best) return;
    S.energy -= bestCost;
    S.lvl[best] = lvl(best) + 1;
  }
}

function buyPrime() {
  for (let guard = 0; guard < 100; guard++) {
    let best = null, bestCost = Infinity;
    for (const id in UPG) {
      const u = UPG[id];
      if (u.res !== 'prime') continue;
      if (lvl(id) >= u.max) continue;
      const c = cost(id);
      if (c <= S.prime && c < bestCost) { best = id; bestCost = c; }
    }
    if (!best) return;
    S.prime -= bestCost;
    S.lvl[best] = lvl(best) + 1;
  }
}

/* магазин: раз в 20 с берём самый дешёвый доступный товар */
function buyShop(t) {
  if (process.env.NOSHOP) return;
  if (t < S.nextShop) return;
  S.nextShop = t + 20;
  let order = ['shop_battery', 'shop_tempo', 'shop_plus', 'shop_pow'];
  if (process.env.SKIP) order = order.filter((id) => id !== process.env.SKIP);
  for (const id of order) {
    const u = UPG[id];
    if (lvl(id) >= u.max) continue;
    const p = costD(id);
    if (S.D - p >= u.minD) {
      S.D -= p;
      S.N = Math.pow(10, S.D);
      S.lvl[id] = lvl(id) + 1;
      return;
    }
  }
}

/* ---------- симуляция ---------- */
const STEP = 0.05;
let t = 0;
let tickAcc = 0;

console.log('мин   D      M            ΔT     E/с        ❖   апгрейды');
console.log('---------------------------------------------------------------');

while (t < MINUTES * 60) {
  t += STEP;

  /* сэмпл */
  S.sampleLeft -= STEP;
  if (S.sampleLeft <= 0) { resample(); S.sampleLeft = period(); }

  /* рост */
  tickAcc += STEP;
  const dT = dt();
  const m = M();
  let steps = 0;
  while (tickAcc >= dT) {
    tickAcc -= dT;
    const b = barrier(S.D);
    if (b > 0) S.D += Math.log10(m) * b;
    steps++;
    if (steps > 2000) break;
  }

  /* ❖ */
  const idx = countPrimesUpTo(S.D);
  if (idx > S.primeIdx) { S.prime += idx - S.primeIdx; S.primeEarned += idx - S.primeIdx; S.primeIdx = idx; }

  /* энергия */
  S.energy += energyRate() * STEP;

  buyCore();
  buyPrime();
  buyShop(t);

  if (S.D >= 308) {
    console.log('' + '1e308 достигнуто на ' + (t / 60).toFixed(1) + ' мин');
    break;
  }

  if (t >= S.nextReport) {
    S.nextReport += REPORT;
    console.log(
      String(Math.round(t / 60)).padStart(4) + '  ' +
      S.D.toFixed(1).padStart(5) + '  ' +
      ('x' + m.toExponential(1)).padEnd(12) + '  ' +
      dT.toFixed(3).padStart(5) + '  ' +
      energyRate().toExponential(1).padStart(7) + '  ' +
      String(S.primeEarned).padStart(2) + '   ' +
      Object.entries(S.lvl).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' ')
    );
    if (S.D >= 308) {
      console.log('\n1e308 достигнуто на ' + (t / 60).toFixed(1) + ' мин');
      break;
    }
  }
}

if (S.D < 308) console.log('\nЗа ' + MINUTES + ' мин достигнуто D = ' + S.D.toFixed(1) + ' (цель 308)');
