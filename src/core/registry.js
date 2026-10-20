/* core/registry.js — реестр всего контента.
   Движок НЕ знает имён механик: он обходит реестр.
   Новая механика = вызов addMechanic() в её index.js. Никаких правок здесь. */
(function (G) {
  'use strict';

  const mechanics = new Map();
  const upgrades = new Map();
  const resources = new Map();
  const tiers = new Map();

  G.registry = {
    /* --- механики (доски) --- */
    addMechanic(m) {
      if (!m || !m.id) throw new Error('mechanic без id');
      mechanics.set(m.id, Object.assign({ order: 100, scope: 'run', autoLevel: 0 }, m));
      return m;
    },
    mechanic(id) { return mechanics.get(id); },
    mechanics() { return Array.from(mechanics.values()).sort((a, b) => a.order - b.order); },

    /* --- апгрейды --- */
    addUpgrade(u) {
      if (!u || !u.id) throw new Error('upgrade без id');
      upgrades.set(u.id, Object.assign({ scope: 'run', max: Infinity, res: 'energy' }, u));
      if (u.formula) G.formula.precompile(u.formula);
      return u;
    },
    addUpgrades(list) { (list || []).forEach((u) => this.addUpgrade(u)); },
    upgrade(id) { return upgrades.get(id); },
    upgradesOf(mechId) {
      return Array.from(upgrades.values()).filter((u) => u.mech === mechId);
    },
    allUpgrades() { return Array.from(upgrades.values()); },

    /* --- ресурсы --- */
    addResource(r) {
      resources.set(r.id, Object.assign({ scope: 'run', value: 0 }, r));
      return r;
    },
    resource(id) { return resources.get(id); },
    allResources() { return Array.from(resources.values()); },

    /* --- ярусы (метаданные, для будущих переходов) --- */
    addTier(t) { tiers.set(t.id, t); return t; },
    tier(id) { return tiers.get(id); },
    allTiers() { return Array.from(tiers.values()); },

    /* --- отладочная сводка --- */
    summary() {
      return {
        mechanics: mechanics.size,
        upgrades: upgrades.size,
        resources: resources.size,
        tiers: tiers.size
      };
    }
  };
})(window.G = window.G || {});
