/* systems/cloud.js — облачный сейв через GitHub Gist.
   Токен и id гиста хранятся ОТДЕЛЬНО от сейва (localStorage), чтобы не утечь в экспорт строки.
   Логика не знает про UI: статусы отдаются событиями cloud:* */
(function (G) {
  'use strict';

  const TOKEN_KEY = 'chislo_gh_token';
  const GIST_KEY = 'chislo_gh_gist';
  const FILE_NAME = 'chislo-save.json';
  const API = 'https://api.github.com';

  function lsGet(k) {
    try { return localStorage.getItem(k) || ''; } catch (e) { return ''; }
  }
  function lsSet(k, v) {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch (e) { /* приватный режим */ }
  }

  const C = {
    TOKEN_KEY: TOKEN_KEY,
    GIST_KEY: GIST_KEY,
    FILE_NAME: FILE_NAME,

    /* статус для UI */
    state: {
      busy: false,
      lastError: null,
      lastMessage: '',
      lastSync: 0,
      login: ''
    },

    /* ---------- конфиг ---------- */
    getToken() { return lsGet(TOKEN_KEY); },
    setToken(t) { lsSet(TOKEN_KEY, (t || '').trim()); },
    getGistId() { return lsGet(GIST_KEY); },
    setGistId(id) { lsSet(GIST_KEY, (id || '').trim()); },
    forget() { this.setToken(''); this.setGistId(''); this.state.login = ''; },

    isConfigured() { return !!this.getToken() && !!this.getGistId(); },
    canUpload() { return !!this.getToken(); },

    /* ссылка на гист для другого устройства */
    gistUrl() {
      const id = this.getGistId();
      return id ? 'https://gist.github.com/' + id : '';
    },

    /* ---------- HTTP ---------- */
    async request(method, path, body) {
      const headers = {
        'Accept': 'application/vnd.github+json'
      };
      const token = this.getToken();
      if (token) headers['Authorization'] = 'token ' + token;
      if (body) headers['Content-Type'] = 'application/json';

      let res;
      try {
        res = await fetch(API + path, {
          method: method,
          headers: headers,
          body: body ? JSON.stringify(body) : undefined
        });
      } catch (e) {
        throw new Error('Нет связи с GitHub (проверь интернет / блокировщики)');
      }

      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }

      if (!res.ok) {
        let msg;
        if (res.status === 401) msg = 'Неверный токен GitHub';
        else if (res.status === 404) msg = 'Гист не найден или нет доступа';
        else if (res.status === 403) msg = 'GitHub отклонил запрос (права токена или лимит)';
        else if (res.status === 422) msg = 'GitHub не принял данные гиста';
        else msg = (data && data.message) || ('HTTP ' + res.status);
        throw new Error(msg);
      }
      return data;
    },

    /* ---------- операции ---------- */

    /* проверка токена: возвращает логин */
    async test() {
      const me = await this.request('GET', '/user');
      this.state.login = (me && me.login) || '';
      this.state.lastError = null;
      G.bus.emit('cloud:status');
      return this.state.login;
    },

    /* создать новый гист и запомнить его id */
    async createGist(state) {
      const content = JSON.stringify(G.save.serialize(state));
      const files = {};
      files[FILE_NAME] = { content: content };
      const data = await this.request('POST', '/gists', {
        description: 'ЧИСЛО — облачный сейв',
        public: false,
        files: files
      });
      if (data && data.id) this.setGistId(data.id);
      G.bus.emit('cloud:status');
      return data;
    },

    /* залить сейв (создаст гист, если id ещё нет) */
    async upload(state) {
      if (this.state.busy) return null;
      if (!this.getToken()) throw new Error('Сначала вставь токен GitHub');

      this.state.busy = true;
      G.bus.emit('cloud:status');
      try {
        let data;
        const gid = this.getGistId();
        if (!gid) {
          data = await this.createGist(state);
        } else {
          const content = JSON.stringify(G.save.serialize(state));
          const files = {};
          files[FILE_NAME] = { content: content };
          data = await this.request('PATCH', '/gists/' + gid, { files: files });
        }
        this.state.lastSync = Date.now();
        this.state.lastError = null;
        this.state.lastMessage = 'Загружено в ' + new Date().toLocaleTimeString();
        G.bus.emit('cloud:uploaded', { id: this.getGistId() });
        return data;
      } catch (e) {
        this.state.lastError = e.message;
        G.bus.emit('cloud:error', { message: e.message });
        throw e;
      } finally {
        this.state.busy = false;
        G.bus.emit('cloud:status');
      }
    },

    /* скачать сейв и вернуть новое состояние */
    async download() {
      if (this.state.busy) throw new Error('Уже идёт обмен с облаком');
      const gid = this.getGistId();
      if (!gid) throw new Error('Нет id гиста — сначала загрузи сейв или вставь id');

      this.state.busy = true;
      G.bus.emit('cloud:status');
      try {
        const data = await this.request('GET', '/gists/' + gid);
        const file = data && data.files && data.files[FILE_NAME];
        if (!file) throw new Error('В гисте нет файла ' + FILE_NAME);

        let content = file.content;
        if (!content && file.truncated && file.raw_url) {
          const raw = await fetch(file.raw_url);
          content = await raw.text();
        }
        if (!content) throw new Error('Пустой файл в гисте');

        const parsed = JSON.parse(content);
        const state = G.save.deserialize(parsed);
        this.state.lastError = null;
        this.state.lastMessage = 'Скачано в ' + new Date().toLocaleTimeString();
        G.bus.emit('cloud:downloaded', {});
        return state;
      } catch (e) {
        this.state.lastError = e.message;
        G.bus.emit('cloud:error', { message: e.message });
        throw e;
      } finally {
        this.state.busy = false;
        G.bus.emit('cloud:status');
      }
    },

    /* автосинхронизация — вызывается из главного цикла */
    maybeAuto(state, dt) {
      if (!state.settings.cloudAuto) return;
      if (this.state.busy) return;
      if (!this.getToken()) return;
      const iv = Math.max(30, state.settings.cloudInterval || 60) * 1000;
      const now = Date.now();
      if (now - (this.state.lastSync || 0) < iv) return;
      this.state.lastSync = now;              // не спамим при ошибках
      this.upload(state).catch(() => { /* ошибка уже в статусе */ });
    }
  };

  G.cloud = C;

  /* тосты на события облака */
  G.bus.on('cloud:error', (e) => {
    if (G.ui && G.ui.toast) G.ui.toast('Облако: ' + e.message, 'warn', 5000);
  });
  G.bus.on('cloud:uploaded', () => {
    if (G.ui && G.ui.toast) G.ui.toast('Сейв отправлен в облако', 'good', 2000);
  });
})(window.G = window.G || {});
