/* systems/spark.js — логика «золотой искры» ✦.
   Спавн по таймеру, эффекты по данным content.spark.types, буффы живут в state.mech.spark.
   Система не знает про UI: она только ведёт состояние и события, кнопку рисует ui/spark.js. */
(function (G) {
  'use strict';

  function cfg() {
    return (G.content && G.content.spark) || { types: [], minGap: 90, maxGap: 180, lifetime: 15 };
  }

  function data(state) {
    const m = state.mech || (state.mech = {});
    if (!m.spark) {
      m.spark = { nextIn: 40, left: 0, type: null, caught: 0, buffs: [] };
    }
    return m.spark;
  }

  function pick(list) {
    let total = 0;
    for (const t of list) total += (t.weight || 1);
    let roll = Math.random() * total;
    for (const t of list) {
      roll -= (t.weight || 1);
      if (roll <= 0) return t;
    }
    return list[list.length - 1];
  }

  const S = {
    data: data,
    types() { return cfg().types || []; },

    /* сколько секунд до следующей искры */
    nextIn(state) { return Math.max(0, data(state).nextIn); },
    /* искра сейчас на экране? */
    visible(state) {
      const d = data(state);
      return !!d.type && d.left > 0;
    },
    /* тип искры на экране (для UI) */
    current(state) {
      const d = data(state);
      if (!d.type || d.left <= 0) return null;
      for (const t of S.types()) if (t.id === d.type) return t;
      return null;
    },

    /* суммарный временный множитель к M */
    mult(state) {
      const d = data(state);
      let m = 1;
      for (const b of d.buffs) if (b.mult) m *= b.mult;
      return isFinite(m) && m > 0 ? m : 1;
    },

    /* суммарный временный множитель к ΔT */
    dtMult(state) {
      const d = data(state);
      let m = 1;
      for (const b of d.buffs) if (b.dt) m *= b.dt;
      return isFinite(m) && m > 0 ? m : 1;
    },

    /* активные буффы для доски: [{id,name,icon,left,text}] */
    active(state) {
      const d = data(state);
      const out = [];
      for (const b of d.buffs) {
        const t = S.types().find((x) => x.id === b.type) || {};
        out.push({ id: b.type, name: t.name || b.type, icon: t.icon || '✦', left: b.left, text: b.text || '' });
      }
      return out;
    },

    /* поймать искру: применить эффект, поставить следующий таймер */
    catchSpark(state) {
      const d = data(state);
      if (!d.type || d.left <= 0) return null;
      const t = S.types().find((x) => x.id === d.type);
      d.type = null;
      d.left = 0;
      d.caught += 1;
      d.nextIn = cfg().minGap + Math.random() * Math.max(1, cfg().maxGap - cfg().minGap);
      if (!t) return null;

      if (t.mult || t.dtMult) {
        const buff = { type: t.id, left: t.dur || 20, total: t.dur || 20 };
        if (t.mult) buff.mult = t.mult;
        if (t.dtMult) buff.dt = t.dtMult;
        d.buffs.push(buff);
      }
      if (t.energySec) {
        state.res.energy = (state.res.energy || 0) + G.growth.energyRate(state) * t.energySec;
      }
      if (t.cores) {
        state.res.cores = (state.res.cores || 0) + t.cores;
        state.meta.coresBest = Math.max(state.meta.coresBest || 0, state.res.cores);
      }
      if (t.prime) {
        state.res.prime = (state.res.prime || 0) + t.prime;
      }

      G.bus.emit('spark:caught', { type: t });
      return t;
    },

    /* тик: таймеры спавна и буффов (механика вызывает это сама) */
    tick(state, dt) {
      const d = data(state);
      const c = cfg();

      /* буффы тикают всегда */
      for (let i = d.buffs.length - 1; i >= 0; i--) {
        d.buffs[i].left -= dt;
        if (d.buffs[i].left <= 0) d.buffs.splice(i, 1);
      }

      if (d.type && d.left > 0) {
        d.left -= dt;
        if (d.left <= 0) {
          d.type = null;
          d.left = 0;
          d.nextIn = c.minGap + Math.random() * Math.max(1, c.maxGap - c.minGap);
          G.bus.emit('spark:missed', {});
        }
        return;
      }

      d.nextIn -= dt;
      if (d.nextIn <= 0) {
        const t = pick(S.types());
        d.type = t.id;
        d.left = c.lifetime;
        G.bus.emit('spark:spawned', { type: t });
      }
    },

    onReset(state) {
      state.mech.spark = { nextIn: 30, left: 0, type: null, caught: 0, buffs: [] };
    }
  };

  G.spark = S;
})(window.G = window.G || {});
