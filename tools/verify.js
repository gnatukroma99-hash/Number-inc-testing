/* tools/verify.js — все проверки ПАРАЛЛЕЛЬНО, одним отчётом.
   Запуск:  node tools/verify.js            (checkall + checkcontent + unit + domtest + sim)
            node tools/verify.js fast       (то же; режим оставлен для совместимости)
            node tools/verify.js bg         (в фоне, лог в .verify/verify.log)

   Зачем: domtest ~12 с, остальные проверки быстрые и НЕ зависят друг от друга.
   Последовательно это дольше, параллельно — столько же, сколько самый долгий прогон.

   Фон с телефона/Windows:
     node tools/verify.js > .verify/verify.log 2>&1 &    # и занимайся своими делами
     tail -f .verify/verify.log                          # посмотреть, как идёт
   Или на Windows: start /b node tools\verify.js          (откроется лог)

   Код возврата: 0 — всё зелёное, 1 — хоть одна проверка упала. */
'use strict';
require('./_limit')(1500);

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGS = path.join(ROOT, '.verify');
const mode = String(process.argv[2] || '').toLowerCase();

const JOBS = [
  { id: 'checkall', title: 'checkall', args: ['tools/checkall.js'] },
  { id: 'checkcontent', title: 'checkcontent', args: ['tools/checkcontent.js'] },
  { id: 'unit', title: 'unit (ядро)', args: ['tools/unit.js'] },
  { id: 'd2', title: 'd2 tests', args: ['tools/tests/run-d2.js'], heavy: true },
  /* при параллельном verify на телефоне jsdom получает меньше CPU: даём запас по перфу.
     CI запускает domtest отдельно с PERF_MS=40. */
  { id: 'domtest', title: 'domtest (jsdom)', args: ['tools/domtest.js'], env: { PERF_MS: process.env.PERF_MS || '120' }, heavy: true },
  { id: 'sim', title: 'sim 160 900', args: ['tools/sim.js', '160', '900'] },
  { id: 'simd2', title: 'sim-d2 60', args: ['tools/sim-d2.js', '60', '0.25'] }
];

/* что вытащить из лога в итоговую строку */
const PICK = {
  checkall: (t) => (/ВСЁ ОК/.test(t) ? 'версии и подключения OK' : (t.match(/[✗X] .*/) || ['провал'])[0].slice(0, 70)),
  domtest: (t) => {
    const ok = (t.match(/✓/g) || []).length;
    const bad = (t.match(/✗/g) || []).length;
    return ok + ' ✓' + (bad ? ', ' + bad + ' ✗' : '');
  },
  checkcontent: (t) => {
    const m = /ВСЁ ОК — (\d+) проверок/.exec(t);
    return m ? m[1] + ' проверок OK' : (t.match(/ПРОВАЛЕНО.*/) || ['провал'])[0].slice(0, 70);
  },
  unit: (t) => {
    const m = /ИТОГО: (\d+) проверок.*провалов (\d+)/.exec(t);
    return m ? m[1] + ' проверок, провалов ' + m[2] : (t.match(/ПРОВАЛЕНО.*/) || ['провал'])[0].slice(0, 70);
  },
  sim: (t) => {
    const m = /1e308 достигнуто на ([\d.]+) мин/.exec(t);
    return m ? '1e308 за ' + m[1] + ' мин' : 'цель 1e308 не достигнута';
  },
  d2: (t) => {
    const m = /D2-тестов: (\d+), провалено: (\d+)/.exec(t);
    return m ? m[1] + ' тестов, провалов ' + m[2] : (t.match(/ПРОВАЛЕНО.*/) || ['провал'])[0].slice(0, 70);
  },
  simd2: (t) => {
    const m = /D₂=100 впервые на ([\d.]+) мин/.exec(t);
    return m ? 'D₂=100 за ' + m[1] + ' мин' : 'D₂=100 не достигнуто';
  }
};

try { fs.mkdirSync(LOGS, { recursive: true }); } catch (e) { /* уже есть */ }

const started = Date.now();
const results = [];

function run(job) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const out = [];
    const child = spawn(process.execPath, job.args, {
      cwd: ROOT,
      env: Object.assign({}, process.env, { TOOL_LIMIT: process.env.TOOL_LIMIT || '900' }, job.env || {}),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (b) => out.push(b));
    child.stderr.on('data', (b) => out.push(b));
    child.on('close', (code) => {
      const text = Buffer.concat(out).toString('utf8');
      try { fs.writeFileSync(path.join(LOGS, job.id + '.log'), text); } catch (e) { /* не критично */ }
      const res = {
        id: job.id,
        title: job.title,
        code: code,
        ms: Date.now() - t0,
        note: PICK[job.id] ? PICK[job.id](text) : ''
      };
      results.push(res);
      console.log('  ' + (code === 0 ? '✓' : '✗') + ' ' + job.title.padEnd(18) +
        (res.ms / 1000).toFixed(1).padStart(6) + ' с   ' + res.note);
      resolve(res);
    });
  });
}

console.log('Проверки' + (mode === 'fast' ? ' (fast)' : '') + ':' +
  ' лёгкие — параллельно, тяжёлые (d2/domtest) — последовательно:');
const LIGHT = JOBS.filter((j) => !j.heavy);
/* тяжёлые — сначала domtest (на холодном телефоне), потом D2; иначе jsdom ловит троттлинг */
const HEAVY = JOBS.filter((j) => j.heavy).sort((a, b) => (a.id === 'domtest' ? -1 : b.id === 'domtest' ? 1 : 0));
(async () => {
  for (const j of HEAVY) await run(j);
  await Promise.all(LIGHT.map(run));
  const total = Date.now() - started;
  const seq = results.reduce((s, r) => s + r.ms, 0);
  const bad = results.filter((r) => r.code !== 0);
  console.log('');
  console.log('Итого: ' + (total / 1000).toFixed(1) + ' с' +
    ' · самый долгий шаг ' + (Math.max.apply(null, results.map((r) => r.ms)) / 1000).toFixed(1) + ' с');
  if (bad.length) {
    console.log('ПРОВАЛЕНО: ' + bad.map((r) => r.title).join(', ') + ' · логи в .verify/');
    process.exitCode = 1;
  } else {
    console.log('ВСЁ ОК');
  }
})();
