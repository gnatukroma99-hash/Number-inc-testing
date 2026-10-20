/* ui/settings.js — модалка настроек: форматы чисел, позиция числа, автосейв, сейвы. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  let modal = null;
  let refs = {};

  function radioGroup(name, options, current, onChange) {
    const wrap = G.h('div', { class: 'radio-group' });
    const inputs = [];
    for (const o of options) {
      const id = name + '-' + o.value;
      const input = G.h('input', {
        type: 'radio', name: name, id: id, value: o.value,
        checked: current === o.value ? 'checked' : null
      });
      input.addEventListener('change', () => { if (input.checked) onChange(o.value); });
      inputs.push(input);
      wrap.appendChild(G.h('label', { class: 'radio', for: id }, [
        input,
        G.h('span', { class: 'radio-mark' }),
        G.h('span', { text: o.label })
      ]));
    }
    return wrap;
  }

  function toggle(label, checked, onChange) {
    const input = G.h('input', { type: 'checkbox', checked: checked ? 'checked' : null });
    input.addEventListener('change', () => onChange(input.checked));
    return G.h('label', { class: 'switch-row' }, [G.h('span', { text: label }), G.h('span', { class: 'switch' }, [input])]);
  }

  function previewFor(mode) {
    const sample = G.BN.fromNumber(124000000);
    return {
      short: G.fmt.bn(sample, 'short'),
      sci: G.fmt.bn(sample, 'sci'),
      full: G.fmt.bn(sample, 'full')
    }[mode] || '';
  }

  function build(state) {
    const s = state.settings;
    refs.preview = G.h('div', { class: 'preview' });
    refs.export = G.h('textarea', { class: 'save-area', rows: 3, spellcheck: 'false' });

    /* ---------- облако: строки ввода ---------- */
    refs.token = G.h('input', {
      class: 'text-input', type: 'password', placeholder: 'ghp_... (токен с правом gist)',
      autocomplete: 'off', spellcheck: 'false'
    });
    refs.token.value = G.cloud.getToken();

    refs.gist = G.h('input', {
      class: 'text-input', type: 'text', placeholder: 'id гиста (заполнится сам при первой отправке)',
      autocomplete: 'off', spellcheck: 'false'
    });
    refs.gist.value = G.cloud.getGistId();

    refs.gistUrl = G.h('div', { class: 'cloud-url' });
    refs.cloudStatus = G.h('div', { class: 'cloud-status' });

    const rememberConfig = () => {
      G.cloud.setToken(refs.token.value);
      G.cloud.setGistId(refs.gist.value);
    };
    refs.token.addEventListener('change', () => { rememberConfig(); updateCloudUI(); });
    refs.gist.addEventListener('change', () => { rememberConfig(); updateCloudUI(); });

    const tokenRow = G.h('div', { class: 'field-row' }, [
      refs.token,
      G.h('button', { class: 'btn', text: 'Проверить', onclick: async () => {
        rememberConfig();
        try {
          const login = await G.cloud.test();
          G.ui.toast('Токен рабочий: ' + login, 'good');
        } catch (e) {
          G.ui.toast('Ошибка: ' + e.message, 'warn', 5000);
        }
        updateCloudUI();
      } })
    ]);

    const gistRow = G.h('div', { class: 'field-row' }, [
      refs.gist,
      G.h('button', { class: 'btn', text: 'Отправить', onclick: async () => {
        rememberConfig();
        try {
          await G.cloud.upload(G.state);
          refs.gist.value = G.cloud.getGistId();
        } catch (e) { /* тост уже показан событием */ }
        updateCloudUI();
      } }),
      G.h('button', { class: 'btn', text: 'Скачать', onclick: async () => {
        rememberConfig();
        if (!confirm('Заменить текущий прогресс сейвом из облака?')) return;
        try {
          const st = await G.cloud.download();
          G.applyState(st);
          G.save.saveLocal(st);
          G.ui.toast('Сейв загружен из облака', 'good');
          close();
        } catch (e) { updateCloudUI(); }
      } })
    ]);

    const el = G.h('div', { class: 'modal' }, [
      G.h('div', { class: 'modal-card' }, [
        G.h('div', { class: 'modal-head' }, [
          G.h('h2', { text: 'Настройки' }),
          G.h('button', { class: 'icon-btn', text: '✕', onclick: () => close() })
        ]),

        G.h('div', { class: 'modal-body' }, [

          G.h('h3', { class: 'section-title', text: 'Формат числа' }),
          radioGroup('numfmt', [
            { value: 'short', label: 'Короткий — 124 M' },
            { value: 'sci', label: 'Научный — 1.24e8' },
            { value: 'full', label: 'Полный — 124 000 000' }
          ], s.numberFormat, (v) => {
            state.settings.numberFormat = v;
            updatePreview(state);
            G.ui.mainNumber.update(state);
          }),
          refs.preview,

          G.h('h3', { class: 'section-title', text: 'Где показывать число' }),
          radioGroup('numpos', [
            { value: 'top', label: 'Сверху (как сейчас)' },
            { value: 'bottom', label: 'Снизу' },
            { value: 'minimal', label: 'Только число (минимал)' }
          ], s.numberPosition, (v) => {
            state.settings.numberPosition = v;
            G.ui.mainNumber.applySettings(state);
          }),

          G.h('h3', { class: 'section-title', text: 'Интерфейс' }),
          toggle('Анимации', s.animations, (v) => {
            state.settings.animations = v;
            G.ui.mainNumber.applySettings(state);
          }),
          toggle('Показывать формулы механик', s.scientificHints, (v) => {
            state.settings.scientificHints = v;
            document.body.classList.toggle('hide-formulas', !v);
          }),

          G.h('h3', { class: 'section-title', text: 'Сохранение' }),
          toggle('Автосохранение', s.autosave, (v) => { state.settings.autosave = v; }),
          G.h('label', { class: 'select-row' }, [
            G.h('span', { text: 'Интервал автосейва' }),
            (function () {
              const sel = G.h('select', {});
              [5, 10, 30, 60].forEach((n) => {
                sel.appendChild(G.h('option', { value: n, selected: s.autosaveInterval === n ? 'selected' : null, text: n + ' с' }));
              });
              sel.addEventListener('change', () => { state.settings.autosaveInterval = Number(sel.value); });
              return sel;
            })()
          ]),

          G.h('div', { class: 'btn-row' }, [
            G.h('button', { class: 'btn', text: '💾 Сохранить сейчас', onclick: () => {
              G.save.saveLocal(state);
              G.ui.toast('Сохранено', 'good');
            } }),
            G.h('button', { class: 'btn', text: '⬇ Экспорт', onclick: () => {
              refs.export.value = G.save.exportString(state);
              refs.export.select();
              G.ui.toast('Строка сейва готова — скопируй', 'accent');
            } }),
            G.h('button', { class: 'btn', text: '⬆ Импорт', onclick: () => {
              const st = G.save.importString(refs.export.value);
              if (!st) { G.ui.toast('Не удалось прочитать сейв', 'warn'); return; }
              G.applyState(st);
              G.ui.toast('Сейв загружен', 'good');
              close();
            } })
          ]),
          refs.export,

          G.h('h3', { class: 'section-title', text: 'Облако (GitHub Gist)' }),
          G.h('p', { class: 'settings-hint', text:
            'Как получить токен: GitHub → Settings → Developer settings → Personal access tokens (classic) → ' +
            'Generate new token → галочка «gist» → скопировать. Токен хранится только в этом браузере и НЕ попадает в экспорт сейва.' }),
          tokenRow,
          gistRow,
          refs.gistUrl,
          toggle('Автосинхронизация с облаком', s.cloudAuto, (v) => { state.settings.cloudAuto = v; }),
          G.h('label', { class: 'select-row' }, [
            G.h('span', { text: 'Интервал автосинхронизации' }),
            (function () {
              const sel = G.h('select', {});
              [60, 120, 300, 900].forEach((n) => {
                sel.appendChild(G.h('option', { value: n, selected: (s.cloudInterval || 120) === n ? 'selected' : null, text: n >= 60 ? (n / 60) + ' мин' : n + ' с' }));
              });
              sel.addEventListener('change', () => { state.settings.cloudInterval = Number(sel.value); });
              return sel;
            })()
          ]),
          refs.cloudStatus,

          G.h('h3', { class: 'section-title', text: 'Статистика' }),
          G.h('div', { class: 'stats-box' }, [
            G.h('div', { text: 'Время в игре: ' + G.fmt.time(state.stats.playtime || 0) }),
            G.h('div', { text: 'Сэмплов: ' + (state.stats.samples || 0) }),
            G.h('div', { text: 'Простых разрядов найдено: ' + (state.stats.primesFound || 0) }),
            G.h('div', { text: 'Рекорд: ' + G.fmt.digitsLabel(state.stats.bestD || 0) })
          ]),

          G.h('h3', { class: 'section-title danger', text: 'Опасная зона' }),
          G.h('div', { class: 'btn-row' }, [
            G.h('button', { class: 'btn danger', text: '🗑 Сбросить всё', onclick: () => {
              if (!confirm('Удалить сейв и начать заново?')) return;
              G.save.clearLocal();
              G.applyState(G.newState());
              G.ui.toast('Начато заново', 'warn');
              close();
            } })
          ])
        ])
      ])
    ]);

    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    return el;
  }

  function updatePreview(state) {
    if (refs.preview) {
      refs.preview.textContent = 'Сейчас: ' + G.fmt.bn(G.BN.fromNumber(124000000), state.settings.numberFormat);
    }
  }

  /* ---------- статус облака ---------- */
  function updateCloudUI() {
    if (!refs.cloudStatus || !G.cloud) return;
    const c = G.cloud;
    const parts = [];
    parts.push(c.getToken() ? (c.state.login ? 'токен OK (' + c.state.login + ')' : 'токен задан') : 'токен не задан');
    parts.push(c.getGistId() ? 'gist: ' + c.getGistId().slice(0, 10) + '…' : 'gist не создан');
    if (c.state.busy) parts.push('⏳ обмен…');
    if (c.state.lastMessage) parts.push(c.state.lastMessage);
    if (c.state.lastError) parts.push('⚠ ' + c.state.lastError);
    refs.cloudStatus.textContent = parts.join(' · ');
    refs.cloudStatus.className = 'cloud-status' + (c.state.lastError ? ' err' : '');

    if (refs.gistUrl) {
      const url = c.gistUrl();
      refs.gistUrl.textContent = url || '';
    }
  }

  G.bus.on('cloud:status', updateCloudUI);

  function open(state) {
    if (modal) return;
    const root = document.getElementById('modal-root');
    modal = build(state);
    root.appendChild(modal);
    document.body.classList.add('modal-open');
    updatePreview(state);
    updateCloudUI();
  }

  function close() {
    if (!modal) return;
    modal.remove();
    modal = null;
    document.body.classList.remove('modal-open');
  }

  G.ui.settings = { open, close, updatePreview, isOpen: () => !!modal };
})(window.G = window.G || {});
