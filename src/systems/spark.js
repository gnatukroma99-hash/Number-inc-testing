/* systems/spark.js — логика «золотой искры» ✦ и «искрового ража».
   Спавн по таймеру, эффекты по данным content.spark.types, буффы живут в state.mech.spark.
   Узлы дерева ◆ растягивают искру (sparkLife), учащают (sparkGap), усиливают (sparkPower)
   и удваивают эффект (sparkDouble) — все поля читаются из данных, движок про них не знает.
   Система не знает про UI: кнопку рисует ui/spark.js. */
(function (G) {
  'use strict';

  function cfg() {
    return (G.content && G.content.spark) || { types: [], minGap: 90, maxGap: 180, lifetime: 15 };
  }
  function rushCfg() {
    const c = cfg().rush || {};
    return {
      every: c.every || 5, dur: c.dur || 20, gap: c.gap || 2.5,
      need: c.need || 5, corePer: c.corePer || 1, multPer: c.multPer || 0.5, multDur: c.multDur || 30
    };
  }

  function data(state) {
    const m = state.mech || (state.mech = {});
    if (!m.spark) {
      m.spark = { nextIn: 40, left: 0, type: null, caught: 0, buffs: [], rush: { left: 0, streak: 0, spawned: 0 } };
    }
    if (!m.spark.rush) m.spark.rush = { left: 0, streak: 0, spawned: 0 };
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

  /* --- бонусы из дерева ◆ (данные-поля апгрейдов) --- */
  function treeBonus(state) {
    let life = 0;
    let gap = 1;
    let power = 1;
    let double = false;
    if (G.growth) {
      life = G.growth.upgSum(state, 'sparkLife') || 0;
      gap = G.growth.upgProduct(state, 'sparkGap');
      power = G.growth.upgProduct(state, 'sparkPower');
      double = G.growth.upgSum(state, 'sparkDouble') > 0;
    }
    if (!isFinite(gap) || gap <= 0) gap = 1;
    if (!isFinite(power) || power <= 0) power = 1;
    return { life: life, gap: gap, power: power, double: double };
  }

  const S = {
    data: data,
    types() { return cfg().types || []; },
    bonus(state) { return treeBonus(state); },

    lifetime(state) {
      const c = cfg();
      return Math.max(5, (c.lifetime || 15) + treeBonus(state).life);
    },
    gapFor(state) {
      const c = cfg();
      const k = treeBonus(state).gap;
      return { min: (c.minGap || 90) * k, max: (c.maxGap || 180) * k };
    },

    nextIn(state) { return Math.max(0, data(state).nextIn); },
    visible(state) {
      const d = data(state);
      return !!d.type && d.left > 0;
    },
    current(state) {
      const d = data(state);
      if (!d.type || d.left <= 0) return null;
      for (const t of S.types()) if (t.id === d.type) return t;
      return null;
    },

    /* раж активен? */
    rush(state) {
      const r = data(state).rush;
      const c = rushCfg();
      return { active: r.left > 0, left: r.left, streak: r.streak, need: c.need, cfg: c };
    },

    mult(state) {
      const d = data(state);
      let m = 1;
      for (const b of d.buffs) if (b.mult) m *= b.mult;
      return isFinite(m) && m > 0 ? m : 1;
    },

    dtMult(state) {
      const d = data(state);
      let m = 1;
      for (const b of d.buffs) if (b.dt) m *= b.dt;
      return isFinite(m) && m > 0 ? m : 1;
    },

    active(state) {
      const d = data(state);
      const out = [];
      for (const b of d.buffs) {
        const t = S.types().find((x) => x.id === b.type) || {};
        out.push({ id: b.type, name: t.name || b.type, icon: t.icon || '✦', left: b.left, text: b.text || '' });
      }
      return out;
    },

    /* применить эффект одного типа */
    applyType(state, t) {
      const d = data(state);
      const power = treeBonus(state).power;
      if (t.mult || t.dtMult) {
        const buff = { type: t.id, left: t.dur || 20, total: t.dur || 20 };
        if (t.mult) buff.mult = 1 + (t.mult - 1) * power;      // сила буффа растёт от дерева
        if (t.dtMult) buff.dt = 1 / (1 + (1 / t.dtMult - 1) * power);
        d.buffs.push(buff);
      }
      if (t.energySec) state.res.energy = (state.res.energy || 0) + G.growth.energyRate(state) * t.energySec * power;
      if (t.cores) {
        state.res.cores = (state.res.cores || 0) + t.cores;
        state.meta.coresBest = Math.max(state.meta.coresBest || 0, state.res.cores);
      }
      if (t.prime) state.res.prime = (state.res.prime || 0) + Math.round(t.prime * power);
    },

    /* поймать искру */
    catchSpark(state) {
      const d = data(state);
      if (!d.type || d.left <= 0) return null;
      const t = S.types().find((x) => x.id === d.type);
      const b = treeBonus(state);
      d.type = null;
      d.left = 0;
      d.caught += 1;
      if (!t) return null;

      S.applyType(state, t);
      /* «удвоение» из дерева: второй случайный эффект */
      if (b.double) {
        const t2 = pick(S.types());
        if (t2 && t2.id !== t.id) S.applyType(state, t2);
      }

      /* раж: серия поимок */
      const r = d.rush;
      const rc = rushCfg();
      if (r.left > 0) {
        r.streak += 1;
        if (r.streak >= rc.need) S.finishRush(state);
      } else if (d.caught % rc.every === 0) {
        S.startRush(state);
      }

      /* следующий спавн */
      const gap = S.gapFor(state);
      d.nextIn = r.left > 0 ? rc.gap : (gap.min + Math.random() * Math.max(1, gap.max - gap.min));

      G.bus.emit('spark:caught', { type: t, rush: r.left > 0 });
      return t;
    },

    startRush(state) {
      const d = data(state);
      const rc = rushCfg();
      d.rush = { left: rc.dur, streak: 0, spawned: 0 };
      d.nextIn = rc.gap;
      G.bus.emit('spark:rush', { dur: rc.dur });
    },

    /* конец ража: награды по серии */
    finishRush(state) {
      const d = data(state);
      const rc = rushCfg();
      const streak = d.rush.streak;
      d.rush = { left: 0, streak: 0, spawned: 0 };
      d.nextIn = 15;

      if (streak <= 0) {
        G.bus.emit('spark:rushEnd', { streak: 0, cores: 0, mult: 1 });
        return { streak: 0, cores: 0, mult: 1 };
      }

      const cores = streak * rc.corePer;
      if (cores > 0) {
        state.res.cores = (state.res.cores || 0) + cores;
        state.meta.coresBest = Math.max(state.meta.coresBest || 0, state.res.cores);
      }
      const mult = 1 + rc.multPer * streak;
      d.buffs.push({ type: 'rush', left: rc.multDur, total: rc.multDur, mult: mult });

      G.bus.emit('spark:rushEnd', { streak: streak, cores: cores, mult: mult });
      return { streak: streak, cores: cores, mult: mult };
    },

    /* тик: таймеры спавна, буффов и ража */
    tick(state, dt) {
      const d = data(state);
      const rc = rushCfg();

      for (let i = d.buffs.length - 1; i >= 0; i--) {
        d.buffs[i].left -= dt;
        if (d.buffs[i].left <= 0) d.buffs.splice(i, 1);
      }

      if (d.rush.left > 0) {
        d.rush.left -= dt;
        if (d.rush.left <= 0) S.finishRush(state);
      }

      if (d.type && d.left > 0) {
        d.left -= dt;
        if (d.left <= 0) {
          d.type = null;
          d.left = 0;
          if (d.rush.left > 0) d.nextIn = rc.gap;
          else {
            const gap = S.gapFor(state);
            d.nextIn = gap.min + Math.random() * Math.max(1, gap.max - gap.min);
          }
          G.bus.emit('spark:missed', {});
        }
        return;
      }

      d.nextIn -= dt;
      if (d.nextIn <= 0) {
        const t = pick(S.types());
        d.type = t.id;
        d.left = d.rush.left > 0 ? Math.max(3, S.lifetime(state) * 0.5) : S.lifetime(state);
        G.bus.emit('spark:spawned', { type: t, rush: d.rush.left > 0 });
      }
    },

    onReset(state) {
      state.mech.spark = { nextIn: 30, left: 0, type: null, caught: 0, buffs: [], rush: { left: 0, streak: 0, spawned: 0 } };
    }
  };

  G.spark = S;
})(window.G = window.G || {});
