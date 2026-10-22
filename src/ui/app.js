/* ui/app.js — сборка приложения и подписка на смену состояния. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  /* Применить новое состояние (старт / импорт / сброс) */
  G.applyState = function (state) {
    G.state = state;
    G.initResources(state);
    state.D = G.growth.D(state);
    if (!G.ui.mainNumber) return;
    G.ui.mainNumber.applySettings(state);
    document.body.classList.toggle('hide-formulas', !state.settings.scientificHints);
    if (G.ui.docks) G.ui.docks.refresh(state);
    G.bus.emit('state:applied', state);
  };

  const App = {
    init(state) {
      G.applyState(state);

      /* инициализация UI */
      G.ui.mainNumber.init();
      G.ui.mainNumber.applySettings(state);
      G.ui.docks.init(state);
      if (G.ui.spark) G.ui.spark.mount();
      if (G.ui.rift) G.ui.rift.mount();

      document.getElementById('btn-settings').addEventListener('click', () => {
        if (G.ui.settings.isOpen()) G.ui.settings.close();
        else G.ui.settings.open(G.state);
      });

      /* Escape закрывает модалку */
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') G.ui.settings.close();
        if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') {
          if (document.body.classList.contains('modal-open')) return;
          G.save.saveLocal(G.state);
          G.ui.toast('Сохранено', 'good', 1200);
        }
      });

      /* сохраняем при уходе со страницы */
      window.addEventListener('beforeunload', () => G.save.saveLocal(G.state));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) G.save.saveLocal(G.state);
      });
    },

    render(state) {
      G.ui.mainNumber.update(state);
      if (G.ui.spark) G.ui.spark.update(state);
      if (G.ui.rift) G.ui.rift.update(state);
      G.ui.docks.update(state);
      if (G.ui.settings.isOpen()) {
        /* лёгкое обновление превью формата */
        G.ui.settings.updatePreview(state);
      }
    }
  };

  G.ui.app = App;
})(window.G = window.G || {});
