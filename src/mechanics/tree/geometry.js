/* mechanics/tree/geometry.js — круговая геометрия карты-созвездия (v0.35.0).
   Только числа и чистые функции: ни DOM, ни состояния, ни G.state.
   Карту собирает engine.js, карточку узла — node.js; оба берут координаты здесь,
   чтобы тест (tools/tests/tree-engine.test.js) и domtest.js считали ТЕ ЖЕ точки.
     Ветвь = угол (branch.angle), глубина = радиус (R0 + depth·RSTEP),
     плюс синусоидальный дрейф угла по глубине — карта не выглядит линейкой. */
(function (G) {
  'use strict';

  const SIZE = 2200;   /* сторона карты, px */
  const HUB = SIZE / 2;/* центр: там хаб с валютой */
  const R0 = 210;      /* радиус первого кольца глубины */
  const RSTEP = 138;   /* шаг между кольцами глубины */
  const DRIFT = 5;     /* дрейф угла по глубине, градусы */
  const LABEL_PAD = 96;/* подпись ветви — на столько px дальше её последнего узла */

  const DEG = Math.PI / 180;

  /* угол узла, градусы: база ветви + дрейф по глубине + развилка (u.angleOffset) */
  function nodeAngle(branchAngle, branchIndex, depth, angleOffset) {
    const base = Number(branchAngle) || 0;
    const off = Number(angleOffset) || 0;
    return base + Math.sin((depth || 0) * 0.8 + (branchIndex || 0) * 1.9) * DRIFT + off;
  }

  /* радиус кольца глубины, px */
  function radius(depth) {
    return R0 + (depth || 0) * RSTEP;
  }

  /* точка карты по углу (градусы) и радиусу */
  function point(angleDeg, rad) {
    const a = angleDeg * DEG;
    return { x: HUB + Math.cos(a) * rad, y: HUB + Math.sin(a) * rad };
  }

  /* позиция узла на карте */
  function nodePos(branchAngle, branchIndex, depth, angleOffset) {
    return point(nodeAngle(branchAngle, branchIndex, depth, angleOffset), radius(depth));
  }

  /* позиция подписи ветви — за её последним узлом */
  function labelPos(branchAngle, depth) {
    return point(Number(branchAngle) || 0, radius(depth) + LABEL_PAD);
  }

  G.treeGeometry = {
    SIZE: SIZE,
    HUB: HUB,
    R0: R0,
    RSTEP: RSTEP,
    DRIFT: DRIFT,
    LABEL_PAD: LABEL_PAD,
    nodeAngle: nodeAngle,
    radius: radius,
    point: point,
    nodePos: nodePos,
    labelPos: labelPos
  };
})(window.G = window.G || {});
