/* easy-split — pure calculation logic (browser global `EasySplit` / CommonJS) */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EasySplit = api;
})(this, function () {
  'use strict';

  // Largest-remainder allocation in whole `unit` steps. Weights must be integers
  // so that exact shares are computed without floating-point drift.
  // On equal remainders, `preferIdx` gets the extra unit first.
  function allocate(total, weights, unit, preferIdx) {
    const units = Math.floor(total / unit);
    const remainder = total - units * unit;
    const sumW = weights.reduce((a, b) => a + b, 0);
    const exact = weights.map(w => (units * w) / sumW);
    const base = exact.map(Math.floor);
    const left = units - base.reduce((a, b) => a + b, 0);
    exact
      .map((e, i) => [e - base[i], i])
      .sort((a, b) => b[0] - a[0] || (b[1] === preferIdx) - (a[1] === preferIdx) || a[1] - b[1])
      .slice(0, left)
      .forEach(([, i]) => { base[i]++; });
    return { amounts: base.map(u => u * unit), remainder };
  }

  // Pick a unit that keeps ~2 significant digits of the average share.
  function autoUnit(amount, count) {
    const avg = amount / count;
    if (avg >= 10000) return 1000;
    if (avg >= 1000) return 100;
    if (avg >= 100) return 10;
    return 1;
  }

  function isNonNegInt(n) {
    return Number.isInteger(n) && n >= 0;
  }

  function computeSplit(opts) {
    const total = opts.total;
    const excluded = opts.excluded || 0;
    const people = opts.people || [];
    const organizerId = opts.organizerId;
    const fixed = opts.organizerFixedAmount;
    const unitOpt = opts.unit === undefined ? 'auto' : opts.unit;

    if (!isNonNegInt(total) || total === 0) return { error: '合計金額を入力してください。' };
    if (!isNonNegInt(excluded)) return { error: '割り勘対象外の金額が正しくありません。' };
    if (excluded >= total) return { error: '割り勘対象外の金額が合計金額以上になっています。' };
    if (people.length === 0) return { error: '参加者を1人以上追加してください。' };

    const splittable = total - excluded;
    const organizer = people.find(p => p.id === organizerId) || null;
    const isFixed = fixed !== null && fixed !== undefined;

    let payers = people;
    let pool = splittable;

    if (isFixed) {
      if (!organizer) return { error: '幹事を選択してください。' };
      if (people.length < 2) return { error: '幹事の支払い額を固定するには参加者が2人以上必要です。' };
      if (!isNonNegInt(fixed)) return { error: '幹事の支払い額が正しくありません。' };
      if (fixed > splittable) {
        return { error: '幹事の支払い額（' + fixed.toLocaleString() + '円）が割り勘対象額（' + splittable.toLocaleString() + '円）を超えています。' };
      }
      payers = people.filter(p => p.id !== organizerId);
      pool = splittable - fixed;
    }

    const unit = unitOpt === 'auto' ? autoUnit(pool, payers.length) : unitOpt;
    if (!Number.isInteger(unit) || unit < 1) return { error: '集金単位が正しくありません。' };

    const weights = payers.map(p => Math.round(p.weight * 10));

    // The organizer collects the money, so they absorb the odd remainder.
    // If their amount is fixed, the heaviest-weighted payer absorbs it instead.
    let absorberIdx = isFixed || !organizer ? -1 : payers.indexOf(organizer);
    if (absorberIdx < 0) {
      absorberIdx = 0;
      weights.forEach((w, i) => { if (w > weights[absorberIdx]) absorberIdx = i; });
    }

    const { amounts, remainder } = allocate(pool, weights, unit, absorberIdx);
    amounts[absorberIdx] += remainder;

    const byId = new Map(payers.map((p, i) => [p.id, amounts[i]]));
    const results = people.map(p => ({
      id: p.id,
      name: p.name,
      amount: byId.has(p.id) ? byId.get(p.id) : fixed,
      isOrganizer: organizer !== null && p.id === organizer.id
    }));

    return { results, unit, remainder, absorberId: payers[absorberIdx].id, splittable };
  }

  return { allocate, autoUnit, computeSplit };
});
