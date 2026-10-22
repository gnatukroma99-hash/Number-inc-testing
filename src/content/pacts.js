/* content/pacts.js — СДЕЛКИ ✍ (Ярус 2, v0.15.0).
   Берёшь благословение ВМЕСТЕ с проклятием — и то и другое навсегда, пока не сменишь сделку.
   Активна одна сделка. Предложения случайные (из шаблонов), реролл за Δ.

   plus/minus — числовые поля, которые читает механика:
     M      — доля к M (0.4 = +40 %)
     energy — доля к ⌁
     speed  — прибавка к скорости
     dt     — множитель к ΔT (0.92 быстрее, 1.08 медленнее)
   Шаблоны задают «силу» (scale): итог = plus × scale × (0.85 + 0.3·random). */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.pacts = {
    id: 'pacts',
    offers: 3,          /* сколько предложений показывать */
    rerollCost: 2,      /* Δ за новые предложения */

    hint: 'Сделка — это благословение и проклятие сразу, и оба навсегда. Держать можно только одну: ' +
      'новая заменяет старую (и её проклятие тоже уходит). Предложения случайные — реролл за Δ.',

    list: [
      {
        id: 'p_greed', name: 'Скупой', icon: '◈',
        plus: { M: 0.6 }, minus: { energy: 0.3 }, scale: 1,
        text: 'M +60 % · ⌁ −30 %'
      },
      {
        id: 'p_haste', name: 'Гонщик', icon: 'fast',
        plus: { speed: 0.18 }, minus: { M: 0.2 }, scale: 1,
        text: 'скорость +0.18 · M −20 %'
      },
      {
        id: 'p_furnace', name: 'Топка', icon: 'bolt',
        plus: { energy: 0.9 }, minus: { dt: 1.12 }, scale: 1,
        text: '⌁ +90 % · ΔT ×1.12'
      },
      {
        id: 'p_vortex', name: 'Вихрь', icon: 'cycle',
        plus: { dt: 0.85 }, minus: { energy: 0.35 }, scale: 1,
        text: 'ΔT ×0.85 · ⌁ −35 %'
      },
      {
        id: 'p_balance', name: 'Меридиан', icon: 'target',
        plus: { M: 0.35, energy: 0.35 }, minus: { speed: 0.1 }, scale: 1,
        text: 'M +35 % · ⌁ +35 % · скорость −0.10'
      }
    ]
  };
})(window.G = window.G || {});
