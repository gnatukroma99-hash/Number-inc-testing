/* tools/sim.js — офлайн-симулятор баланса. Запуск:  node tools/sim.js [минут]
   Повторяет формулы из src/ без DOM, чтобы проверить кривую D(t).
   Если node нет — файл просто лежит, игра от него не зависит. */
'use strict';

const MINUTES = Number(process.argv[2] || 120);

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
const countPrimesUpTo = (x) => primes.filter((p) => p <= Math.floor(x)).length;

/* ---------- детерминированный рандом ---------- */
let seed = 12345;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

/* ---------- состояние ---------- */
const S = {
  D: 0,
  energy: 0,
  prime: 0,
  primeEarned: 0,
  primeIdx: 0,
  lvl: {
    mult1: 0, speed1: 0, energy1: 0,
    sd: 0, sd_stab: 0,
    pq: 0, pq_jack: 0,
    pm_base: 0, pm_speed: 0
  },
  // сэмпл
  Ssum: 67,
  q: 6,
  sampleLeft: 4
};

const UPG = {
  mult1:    { res: 'energy', base: 8,     growth: 1.55, max: Infinity },
  speed1:   { res: 'energy', base: 5,     growth: 1.65, max: Infinity },
  energy1:  { res: 'energy', base: 40,    growth: 1.8,  max: Infinity },
  sd:       { res: 'energy', base: 60,    growth: 1.9,  max: 20 },
  sd_stab:  { res: 'energy', base: 300,   growth: 2.5,  max: 10 },
  pq:       { res: 'energy', base: 500,   growth: 2.0,  max: 15 },
  pq_jack:  { res: 'energy', base: 5000,  growth: 3.2,  max: 5 },
  pm_base:  { res: 'prime',  base: 1,     growth: 2.0,  max: 25 },
  pm_speed: { res: 'prime',  base: 2,     growth: 2.4,  max: 15 }
};

const cost = (id) => {
  const u = UPG[id];
  return u.base * Math.pow(u.growth, S.lvl[id]);
};

/* ---------- формулы ---------- */
const period = () => 4 + 2 * S.lvl.sd_stab;

function resample() {
  let sum = 0, q = 0;
  for (let i = 0; i < 15; i++) {
    const d = Math.floor(rnd() * 10);
    sum += d;
    if (d === 2 || d === 3 || d === 5 || d === 7) q++;
  }
  S.Ssum = sum;
  S.q = q;
}

function M() {
  const base = 2 + S.lvl.mult1;
  const mSd = 1 + 0.005 * S.Ssum * S.lvl.sd;
  let mPq = 1 + 0.12 * S.q * S.lvl.pq;
  if (S.q === 15 && S.lvl.pq_jack) mPq *= 1 + 2 * S.lvl.pq_jack;
  const pbase = 1.25 + 0.03 * S.lvl.pm_base;
  const mPr = Math.pow(pbase, S.primeEarned);
  return base * (mSd || 1) * (mPq || 1) * (mPr || 1);
}

function dt() {
  const bonus = 0.1 * S.lvl.speed1;
  const mult = Math.pow(0.95, S.lvl.pm_speed);
  return Math.max(0.033, (60 / (1 + bonus)) * mult);
}

function energyRate() {
  const D = S.D;
  const l = D < 15 ? Math.log10(Math.pow(10, D) + 10) : D;
  return 0.4 * Math.pow(1 + l, 2) * Math.pow(1.25, S.lvl.energy1);
}

/* ---------- покупка: покупаем самое дешёвое доступное ---------- */
const ORDER = ['speed1', 'mult1', 'sd', 'pq', 'pm_base', 'sd_stab', 'energy1', 'pq_jack', 'pm_speed'];

function buyAll() {
  for (let guard = 0; guard < 200; guard++) {
    let best = null, bestCost = Infinity;
    for (const id of ORDER) {
      const u = UPG[id];
      if (S.lvl[id] >= u.max) continue;
      const c = cost(id);
      const pool = u.res === 'energy' ? S.energy : S.prime;
      if (c <= pool && c < bestCost) { best = id; bestCost = c; }
    }
    if (!best) return;
    const u = UPG[best];
    if (u.res === 'energy') S.energy -= bestCost; else S.prime -= bestCost;
    S.lvl[best]++;
  }
}

/* ---------- симуляция ---------- */
const STEP = 0.05;
let t = 0;
let tickAcc = 0;
let nextReport = 0;

console.log('мин   D      M            ΔT     E/с      ❖   апгрейды');
console.log('---------------------------------------------------------------');

while (t < MINUTES * 60) {
  t += STEP;

  /* сэмпл */
  S.sampleLeft -= STEP;
  if (S.sampleLeft <= 0) { resample(); S.sampleLeft = period(); }

  /* рост */
  tickAcc += STEP;
  const dT = dt(), m = M();
  while (tickAcc >= dT) { tickAcc -= dT; S.D += Math.log10(m); }

  /* ❖ */
  const idx = countPrimesUpTo(S.D);
  if (idx > S.primeIdx) { S.prime += idx - S.primeIdx; S.primeEarned += idx - S.primeIdx; S.primeIdx = idx; }

  /* энергия */
  S.energy += energyRate() * STEP;

  buyAll();

  if (t >= nextReport) {
    nextReport += 300;
    console.log(
      String(Math.round(t / 60)).padStart(4) + '  ' +
      S.D.toFixed(1).padStart(5) + '  ' +
      ('x' + m.toExponential(1)).padEnd(12) + '  ' +
      dT.toFixed(3).padStart(5) + '  ' +
      energyRate().toExponential(1).padStart(7) + '  ' +
      String(S.primeEarned).padStart(2) + '   ' +
      Object.entries(S.lvl).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' ')
    );
    if (S.D >= 308) { console.log('\nБарьер 1e308 достигнут на ' + (t / 60).toFixed(1) + ' мин'); break; }
  }
}

if (S.D < 308) console.log('\nЗа ' + MINUTES + ' мин достигнуто D = ' + S.D.toFixed(1) + ' (цель 308)');
