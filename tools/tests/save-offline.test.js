/* tools/tests/save-offline.test.js — оффлайн-прогресс (systems/save.js, applyOffline).
   Запуск:  node tools/tests/save-offline.test.js

   Грузит РЕАЛЬНЫЕ скрипты src/ (список берётся из index.html), без DOM и UI —
   как в других Node-тестах: main.js, src/ui/* и доски механик не нужны.
   Проверяем то, что ломалось: хардкод Math.min(d, 308) откатывал сейв с D > 308
   до 1e308, а пройденная стена wall_308 продолжала держать оффлайн. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function filesFromIndex() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1].split('?')[0];
    if (src === 'src/main.js') continue;
    if (src.indexOf('src/ui/') === 0) continue;
    if (/^src\/mechanics\/[^/]+\/board\.js$/.test(src)) continue;
    out.push(src);
  }
  return out;
}

const sandbox = {
  window: {},
  console,
  performance: { now: () => Date.now() },
  Math, Date, isFinite, isNaN, Number, JSON
};
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
for (const f of filesFromIndex()) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const G = sandbox.window.G;

/* ---------- мини-тестовая обвязка ---------- */
let fails = 0;
function ok(name, cond, info) {
  if (cond) {
    console.log('  \u2713 ' + name + (info ? '  — ' + info : ''));
  } else {
    fails++;
    console.log('  \u2717 ' + name + (info ? '  — ' + info : ''));
  }
}

const HOUR = 3600;

/* ---------- состояние ---------- */
/* D — цифры (log10 N); passed — id снятых стен; hoursAgo — сколько «не играли» */
function makeState(D, passed, hoursAgo) {
  const state = G.newState();
  G.initResources(state);
  state.N = G.BN.fromLog10(D);
  state.D = D;
  state.meta.passedBarriers = passed.slice();
  state.lastSeen = Date.now() - (hoursAgo === undefined ? HOUR : hoursAgo) * 1000 * HOUR;
  state.res.energy = 0;
  return state;
}

function run(D, passed, hoursAgo) {
  const state = makeState(D, passed, hoursAgo);
  const report = G.save.applyOffline(state);
  return { state: state, report: report, after: G.BN.log10(state.N), before: D };
}

function finiteState(state) {
  return G.BN.isValid(state.N) && isFinite(state.D) && isFinite(state.res.energy) &&
    isFinite(G.BN.log10(state.N));
}

/* ---------- 1. пройденная стена 308 не откатывает D ---------- */
console.log('\n1. Потолок оффлайна — ближайшая НЕПРОЙДЕННАЯ стена (данные barriers)');
{
  const r = run(500, ['wall_308'], 2);
  ok('D=500 + пройдена wall_308 → after >= 500', r.after >= 500, 'after = ' + r.after.toFixed(3));
  ok('D=500 → after конечный (не 1e308 назад)', finiteState(r.state), 'N = ' + G.BN.raw(r.state.N));
  ok('gainedD = after − before', Math.abs(r.report.gainedD - (r.after - r.before)) < 1e-9,
    'gainedD = ' + r.report.gainedD.toFixed(3));
}
{
  /* даже «грязный» сейв, где D > стены, а стена не отмечена пройденной: не уменьшаем */
  const r = run(500, [], 2);
  ok('D=500 без отметки о стене → after >= 500 (не откат)', r.after >= 500,
    'after = ' + r.after.toFixed(3));
}

/* ---------- 2. непройденная стена 308 не пересекается ---------- */
{
  const r = run(300, [], 8);
  ok('D=300 без стен → after <= 308', r.after <= 308, 'after = ' + r.after.toFixed(3));
  ok('D=300 → рост есть (after > 300)', r.after > 300, 'after = ' + r.after.toFixed(3));
  ok('D=300 → конечный', finiteState(r.state));
}
{
  /* огромный M: без потолка улетели бы далеко за стену — упираемся ровно в 308 */
  const state = makeState(305, [], 8);
  state.upg.mult1 = 1e6;
  const report = G.save.applyOffline(state);
  const after = G.BN.log10(state.N);
  ok('D=305, огромный M → after === 308 (стена держит)', after === 308,
    'after = ' + after + ', gainedD = ' + report.gainedD.toFixed(2));
}

/* ---------- 3. 308 снята, 1000 ещё нет ---------- */
{
  const r = run(999, ['wall_308'], 8);
  ok('D=999 + wall_308 → after >= 999', r.after >= 999, 'after = ' + r.after.toFixed(4));
  ok('D=999 + wall_308 → after <= 1000', r.after <= 1000, 'after = ' + r.after.toFixed(4));
}
{
  /* ровно на стене 1000: оффлайн не сдвигает число и не переходит стену */
  const r = run(1000, ['wall_308'], 8);
  ok('D=1000 + wall_308 → after === 1000', r.after === 1000, 'after = ' + r.after);
  ok('D=1000 → конечный', finiteState(r.state));
}
{
  /* огромный M в 0.1 цифры от стены 1000 — всё равно упираемся в 1000, а не проскакиваем */
  const state = makeState(999.9, ['wall_308'], 8);
  state.upg.mult1 = 1e6;
  G.save.applyOffline(state);
  const after = G.BN.log10(state.N);
  ok('D=999.9, огромный M → after === 1000 (стена держит)', after === 1000, 'after = ' + after);
}
{
  /* все стены сняты — оффлайн больше не держит потолок */
  const r = run(999, ['wall_308', 'wall_1000'], 8);
  ok('D=999 + все стены → after > 999', r.after > 999, 'after = ' + r.after.toFixed(4));
}

/* ---------- 4. невидимый софткап (hiddenFactor) ---------- */
{
  const low = run(100, ['wall_308'], 8);
  const high = run(400, ['wall_308'], 8);
  const gainLow = low.after - low.before;
  const gainHigh = high.after - high.before;
  ok('hiddenFactor: на D=100 рост больше, чем на D=400', gainLow > gainHigh && gainHigh > 0,
    '+ ' + gainLow.toFixed(3) + ' цифр против + ' + gainHigh.toFixed(3));
}

/* ---------- 5. короткий перерыв: < 30 с → null ---------- */
{
  const state = makeState(120, [], 1);
  state.lastSeen = Date.now() - 29 * 1000;
  const report = G.save.applyOffline(state);
  ok('elapsed = 29 с → null', report === null, 'report = ' + report);
  ok('elapsed = 29 с → D не изменился', G.BN.log10(state.N) === 120, 'D = ' + G.BN.log10(state.N));
}

/* ---------- 6. лимит 8 ч и 50 % эффективности для ⌁ ---------- */
{
  const r = run(50, [], 48);
  ok('48 ч отсутствия → seconds = 8 ч', r.report.seconds === 8 * HOUR, 'seconds = ' + r.report.seconds);
  const rate = G.growth.energyRate(r.state);
  const expected = rate * 8 * HOUR * 0.5;
  const relErr = expected > 0 ? Math.abs(r.report.energy - expected) / expected : 1;
  ok('⌁ = energyRate · 8 ч · 50 %', relErr < 1e-9,
    'energy = ' + r.report.energy.toFixed(3) + ', ожидалось ' + expected.toFixed(3));
  ok('⌁ выросли (> 0)', r.state.res.energy > 0, '⌁ = ' + r.state.res.energy.toFixed(3));
  ok('⌁ конечны', isFinite(r.state.res.energy));
}

/* ---------- 7. lastSeen обновляется ---------- */
{
  const state = makeState(100, [], 3);
  const oldSeen = state.lastSeen;
  const t0 = Date.now();
  G.save.applyOffline(state);
  ok('lastSeen обновлён на «сейчас»', state.lastSeen >= t0 && state.lastSeen > oldSeen,
    'lastSeen = ' + state.lastSeen);
}

/* ---------- 8. сознательно сломанный вход: NaN/Infinity не рождаются ---------- */
{
  const state = makeState(400, ['wall_308'], 8);
  state.N = { m: 1, e: 400 };
  state.upg.mult1 = 1e6;           /* M переполнить нельзя, но база огромная */
  const report = G.save.applyOffline(state);
  ok('огромный M → результат конечный', finiteState(state),
    'N = ' + G.BN.raw(state.N) + ', D = ' + state.D.toFixed(3));
  ok('огромный M → gainedD конечный', isFinite(report.gainedD), 'gainedD = ' + report.gainedD);
}

/* ---------- 9. обычный tick не сломан ---------- */
{
  const state = makeState(10, [], 1);
  const dBefore = G.BN.log10(state.N);
  for (let i = 0; i < 100; i++) G.growth.tick(state, 0.05);
  const dAfter = G.BN.log10(state.N);
  ok('growth.tick растит D как раньше', dAfter > dBefore && isFinite(dAfter),
    dBefore + ' → ' + dAfter.toFixed(3));
  ok('growth.tick обновляет disp/stats', !!state.disp && state.stats.playtime > 0);
}

/* ---------- 10. совместимость сейва v2 ---------- */
{
  const state = makeState(500, ['wall_308'], 2);
  const raw = JSON.parse(JSON.stringify(G.save.serialize(state)));
  ok('serialize пишет v = SAVE_VERSION', raw.v === G.SAVE_VERSION, 'v = ' + raw.v);
  const back = G.save.deserialize(raw);
  ok('deserialize сохраняет D', Math.abs(G.BN.log10(back.N) - 500) < 1e-9,
    'D = ' + G.BN.log10(back.N).toFixed(3));
  ok('deserialize сохраняет пройденные стены',
    (back.meta.passedBarriers || []).indexOf('wall_308') >= 0);
}

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК'));
process.exitCode = fails ? 1 : 0;
