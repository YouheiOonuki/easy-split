/* easy-split — 結果の棒（yorozu-plans QUEUE Q-454）。額は computeMulti の結果をそのまま使い、棒の長さから額を作らない
   browser global `EasySplitBars` / CommonJS */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EasySplitBars = api;
})(this, function () {
  'use strict';

  // 係数の欄（range）の範囲と刻み。欄と棒の印の両方がここを読む
  const WEIGHT = { min: 0.5, max: 2.0, step: 0.1 };

  const DIGITS = (String(WEIGHT.step).split('.')[1] || '').length;

  // 係数を k 歩（± step）動かした値。範囲の外へは出さない
  function stepWeight(w, k) {
    const n = Math.round((w - WEIGHT.min) / WEIGHT.step) + k;
    const max = Math.round((WEIGHT.max - WEIGHT.min) / WEIGHT.step);
    return Number((WEIGHT.min + Math.min(max, Math.max(0, n)) * WEIGHT.step).toFixed(DIGITS));
  }

  // 引いた横の距離 dx（px）を歩数に。棒の枠の幅 = 範囲の全部
  function stepsFromDrag(dx, trackWidth) {
    const span = Math.round((WEIGHT.max - WEIGHT.min) / WEIGHT.step);
    if (!(trackWidth > 0)) return 0;
    return Math.round(dx / (trackWidth / span));
  }

  // 結果の 1 人に 1 本。長さは額 ÷ いちばん多い額（%）。固定の人は動かせない
  function barRows(result) {
    const max = Math.max(0, ...result.results.map(x => x.amount));
    return result.results.map(x => ({
      id: x.id,
      amount: x.amount,
      pct: max > 0 ? (x.amount / max) * 100 : 0,
      movable: !x.isFixed
    }));
  }

  return { WEIGHT, stepWeight, stepsFromDrag, barRows };
});
