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
  { id: 'domtest', title: 'domtest (jsdom)', args: ['tools/domtest.js'] },
  { id: 'sim', title: 'sim 160 900', args: ['tools/sim.js', '160', '900'] }
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
      env: Object.assign({}, process.env, { TOOL_LIMIT: process.env.TOOL_LIMIT || '900' }),
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

console.log('Параллельные проверки' + (mode === 'fast' ? ' (fast)' : '') + ':');
Promise.all(JOBS.map(run)).then(() => {
  const total = Date.now() - started;
  const seq = results.reduce((s, r) => s + r.ms, 0);
  const bad = results.filter((r) => r.code !== 0);
  console.log('');
  console.log('Итого: ' + (total / 1000).toFixed(1) + ' с параллельно' +
    ' (последовательно было бы ' + (seq / 1000).toFixed(1) + ' с)' +
    ' · сэкономлено ' + ((seq - total) / 1000).toFixed(1) + ' с');
  if (bad.length) {
    console.log('ПРОВАЛЕНО: ' + bad.map((r) => r.title).join(', ') + ' · логи в .verify/');
    process.exitCode = 1;
  } else {
    console.log('ВСЁ ОК');
  }
});
