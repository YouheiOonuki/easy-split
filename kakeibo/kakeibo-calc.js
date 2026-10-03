/**
 * 家計簿テンプレート（kakeibo/）の計算。画面に依存しない。Node（テスト）では module.exports、ブラウザでは window.Kakeibo
 *
 * - 月の日付と曜日（グレゴリオ暦）
 * - 2 人の負担の割合: 折半・収入の比・割合を入れる。% は合計 100 になるよう最大剰余法で整数に
 * - 共通費の按分: 合計を割合で分け、単位（1・10・100 円）に丸める。合計は必ず一致し、単位に満たない端数は決めた人が持つ
 * - 精算: 負担すべき額と払った額の差から「誰が誰にいくら渡すか」
 */
(function (root) {
  'use strict';

  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const DEFAULT_CATS = ['食費', '日用品', '交通', '医療', '交際', 'その他'];
  const MAX_CATS = 8;
  const UNITS = [1, 10, 100];

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  /** その月の日と曜日（0 = 日曜） */
  function monthDays(y, m) {
    const n = daysInMonth(y, m);
    const out = [];
    for (let d = 1; d <= n; d++) {
      const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      out.push({ d, w, wd: WD[w] });
    }
    return out;
  }

  /** 費目の文字列（読点・カンマ・改行区切り）→ 配列（空と重複を除き、8 個まで、各 8 字まで） */
  function parseCats(text) {
    const seen = new Set();
    const out = [];
    String(text || '').split(/[、,，\n]/).map((s) => s.trim().slice(0, 8)).forEach((s) => {
      if (s && !seen.has(s) && out.length < MAX_CATS) { seen.add(s); out.push(s); }
    });
    return out;
  }

  /** 整数の重みを合計 total の整数に分ける（最大剰余法。同じ剰余なら前の人に） */
  function largestRemainder(total, weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return weights.map(() => 0);
    const raw = weights.map((w) => (total * w) / sum);
    const base = raw.map((x) => Math.floor(x));
    let left = total - base.reduce((a, b) => a + b, 0);
    const order = raw.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
    for (let k = 0; left > 0; k = (k + 1) % order.length, left--) base[order[k].i]++;
    return base;
  }

  /**
   * 負担の割合（%、整数、合計 100）
   * @param {'half'|'income'|'percent'} method
   * @param {number[]} values income なら 2 人の収入、percent なら A の %（B は 100 − A）
   * @returns {number[]|null} 決められないとき null
   */
  function shareRatio(method, values) {
    if (method === 'half') return [50, 50];
    const blank = (v) => v === '' || v === null || v === undefined;
    if (method === 'percent') {
      if (blank(values[0])) return null;
      const a = Math.round(Number(values[0]));
      if (!(a >= 0 && a <= 100)) return null;
      return [a, 100 - a];
    }
    if (method === 'income') {
      if (blank(values[0]) || blank(values[1])) return null;
      const a = Number(values[0]);
      const b = Number(values[1]);
      if (!(a >= 0) || !(b >= 0) || a + b <= 0) return null;
      // 収入を 1 円単位の整数で扱い、割合は 1% 単位
      return largestRemainder(100, [Math.round(a), Math.round(b)]);
    }
    return null;
  }

  /**
   * 共通費の按分。合計 total を割合で分け、unit 円単位に丸める。単位に満たない端数は holder（0 か 1）が持つ
   * @returns {number[]} 2 人の負担額（合計は total と一致）
   */
  function splitShared(total, ratio, unit, holder) {
    total = Math.round(Number(total));
    if (!(total >= 0) || !ratio) return null;
    unit = UNITS.includes(unit) ? unit : 1;
    const units = Math.floor(total / unit);
    const amounts = largestRemainder(units, ratio).map((u) => u * unit);
    amounts[holder === 1 ? 1 : 0] += total - units * unit;
    return amounts;
  }

  /**
   * 精算: 2 人が払った額と、負担すべき額（splitShared の結果）から
   * @returns {{from:number, to:number, amount:number}|null} amount 0 なら精算なし（from・to は -1）
   */
  function settle(paid, owe) {
    const a = Math.round(Number(paid[0]) || 0);
    const b = Math.round(Number(paid[1]) || 0);
    if (!owe) return null;
    const diffA = a - owe[0]; // A が多く払った分（負なら足りない）
    if (diffA === 0) return { from: -1, to: -1, amount: 0 };
    return diffA > 0 ? { from: 1, to: 0, amount: diffA } : { from: 0, to: 1, amount: -diffA };
  }

  function clampInt(v, lo, hi, dflt) {
    const x = Math.round(Number(v));
    return Number.isFinite(x) && v !== '' && v !== null ? Math.max(lo, Math.min(hi, x)) : dflt;
  }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }

  /** 保存・読み込みの値を直す */
  function normalize(raw, today) {
    const s = {
      type: 'month', y: today.y, m: today.m, cats: DEFAULT_CATS.join('、'), budget: true,
      names: ['A', 'B'], method: 'half', incomeA: '', incomeB: '', percentA: '', unit: 1, holder: 0,
      paidA: '', paidB: '', rows: 20, credit: true,
    };
    if (!raw || typeof raw !== 'object') return s;
    if (['month', 'shared', 'year'].includes(raw.type)) s.type = raw.type;
    s.y = clampInt(raw.y, 2000, 2100, s.y);
    s.m = clampInt(raw.m, 1, 12, s.m);
    if (typeof raw.cats === 'string') s.cats = raw.cats.slice(0, 120);
    if (typeof raw.budget === 'boolean') s.budget = raw.budget;
    if (Array.isArray(raw.names)) s.names = [str(raw.names[0], 8) || 'A', str(raw.names[1], 8) || 'B'];
    if (['half', 'income', 'percent'].includes(raw.method)) s.method = raw.method;
    s.incomeA = clampInt(raw.incomeA, 0, 1e9, '');
    s.incomeB = clampInt(raw.incomeB, 0, 1e9, '');
    s.percentA = clampInt(raw.percentA, 0, 100, '');
    s.unit = UNITS.includes(Number(raw.unit)) ? Number(raw.unit) : 1;
    s.holder = Number(raw.holder) === 1 ? 1 : 0;
    s.paidA = clampInt(raw.paidA, 0, 1e9, '');
    s.paidB = clampInt(raw.paidB, 0, 1e9, '');
    s.rows = clampInt(raw.rows, 10, 30, 20);
    if (typeof raw.credit === 'boolean') s.credit = raw.credit;
    return s;
  }

  const api = { WD, DEFAULT_CATS, MAX_CATS, UNITS, daysInMonth, monthDays, parseCats, largestRemainder, shareRatio, splitShared, settle, normalize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Kakeibo = api;
})(typeof self !== 'undefined' ? self : this);
