/* easy-split — pure calculation logic (browser global `EasySplit` / CommonJS) */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EasySplit = api;
})(this, function () {
  'use strict';

  // Largest-remainder allocation in whole `unit` steps.
  // On equal remainders, `preferIdx` gets the extra unit first.
  const EPS = 1e-9;
  function allocate(total, weights, unit, preferIdx) {
    const units = Math.floor(total / unit);
    const remainder = total - units * unit;
    const sumW = weights.reduce((a, b) => a + b, 0);
    const exact = weights.map(w => (units * w) / sumW);
    const base = exact.map(e => Math.floor(e + EPS));
    const left = units - base.reduce((a, b) => a + b, 0);
    exact
      .map((e, i) => [e - base[i], i])
      .sort((a, b) => (Math.abs(b[0] - a[0]) > EPS ? b[0] - a[0] : 0) ||
        (b[1] === preferIdx) - (a[1] === preferIdx) || a[1] - b[1])
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

  const hasFixed = p => p.fixed !== null && p.fixed !== undefined;
  const yen = n => n.toLocaleString() + '円';

  // bills:  [{ id, name, total, excluded, attendees: [personId] }]
  // people: [{ id, name, weight, fixed }] — `fixed` (integer yen) pins that person's grand total.
  // Each bill is split by weight among its attendees; the per-person sums are then
  // scaled to absorb fixed amounts and rounded to the collection unit once.
  function computeMulti(opts) {
    const bills = opts.bills || [];
    const people = opts.people || [];
    const organizerId = opts.organizerId;
    const unitOpt = opts.unit === undefined ? 'auto' : opts.unit;

    if (bills.length === 0) return { error: '会計を1つ以上追加してください。' };
    if (people.length === 0) return { error: '参加者を1人以上追加してください。' };

    const prefix = b => (bills.length > 1 ? b.name + '：' : '');
    const exposure = new Map(people.map(p => [p.id, 0]));
    const attended = new Map(people.map(p => [p.id, []]));
    const billSummaries = [];
    let splittable = 0;

    for (const b of bills) {
      const excluded = b.excluded || 0;
      if (!isNonNegInt(b.total) || b.total === 0) return { error: prefix(b) + '合計金額を入力してください。' };
      if (!isNonNegInt(excluded)) return { error: prefix(b) + '割り勘対象外の金額が正しくありません。' };
      if (excluded >= b.total) return { error: prefix(b) + '割り勘対象外の金額が合計金額以上になっています。' };

      const att = people.filter(p => b.attendees.includes(p.id));
      if (att.length === 0) return { error: prefix(b) + '参加した人を1人以上選んでください。' };

      const s = b.total - excluded;
      const w10 = p => Math.round(p.weight * 10);
      const sumW = att.reduce((a, p) => a + w10(p), 0);
      att.forEach(p => {
        exposure.set(p.id, exposure.get(p.id) + (s * w10(p)) / sumW);
        attended.get(p.id).push(b.id);
      });
      splittable += s;
      billSummaries.push({ id: b.id, name: b.name, total: b.total, excluded, attendees: att.map(p => p.id) });
    }

    const bad = people.find(p => hasFixed(p) && !isNonNegInt(p.fixed));
    if (bad) return { error: bad.name + ' の固定額が正しくありません。' };

    const fixedSum = people.filter(hasFixed).reduce((s, p) => s + p.fixed, 0);
    if (fixedSum > splittable) {
      return { error: '固定額の合計（' + yen(fixedSum) + '）が割り勘対象額（' + yen(splittable) + '）を超えています。' };
    }

    // Only non-fixed people who attended something share the rest.
    const payers = people.filter(p => !hasFixed(p) && exposure.get(p.id) > 0);
    const pool = splittable - fixedSum;
    const toResult = (p, amount) => ({
      id: p.id,
      name: p.name,
      amount,
      isOrganizer: p.id === organizerId,
      isFixed: hasFixed(p),
      bills: attended.get(p.id)
    });
    const base = { splittable, bills: billSummaries };

    if (payers.length === 0) {
      if (pool !== 0) {
        return {
          error: people.some(p => !hasFixed(p))
            ? '固定額の合計が割り勘対象額（' + yen(splittable) + '）に足りませんが、残りを払う参加者がどの会計にも参加していません。'
            : '全員の金額が固定されています。固定額の合計を割り勘対象額（' + yen(splittable) + '）に合わせるか、固定を外してください。'
        };
      }
      return Object.assign({
        results: people.map(p => toResult(p, hasFixed(p) ? p.fixed : 0)),
        unit: 1, remainder: 0, absorberId: null
      }, base);
    }

    const unit = unitOpt === 'auto' ? autoUnit(pool, payers.length) : unitOpt;
    if (!Number.isInteger(unit) || unit < 1) return { error: '集金単位が正しくありません。' };

    const weights = payers.map(p => exposure.get(p.id));

    // The organizer collects the money, so they absorb the odd remainder.
    // If their amount is fixed, the payer with the largest share absorbs it instead.
    let absorberIdx = payers.findIndex(p => p.id === organizerId);
    if (absorberIdx < 0) {
      absorberIdx = 0;
      weights.forEach((w, i) => { if (w > weights[absorberIdx] + EPS) absorberIdx = i; });
    }

    const { amounts, remainder } = allocate(pool, weights, unit, absorberIdx);
    amounts[absorberIdx] += remainder;

    const byId = new Map(payers.map((p, i) => [p.id, amounts[i]]));
    const results = people.map(p => toResult(p, hasFixed(p) ? p.fixed : (byId.get(p.id) || 0)));

    return Object.assign({ results, unit, remainder, absorberId: payers[absorberIdx].id }, base);
  }

  // Single-bill convenience wrapper.
  function computeSplit(opts) {
    const people = opts.people || [];
    return computeMulti(Object.assign({}, opts, {
      bills: [{ id: 0, name: '', total: opts.total, excluded: opts.excluded || 0, attendees: people.map(p => p.id) }]
    }));
  }

  // ---- Backup file (README「ツールを追加するとき」20。決定 D31) ----
  // 形式: { tool, version, exportedAt, data }。data はブラウザに保存しているものと同じ形
  const BACKUP_VERSION = 1;

  // 書き出すファイル名: <ツール名>-backup-YYYYMMDD.json（日付は端末の時計）
  function backupFileName(tool, date) {
    const d = date || new Date();
    return tool + '-backup-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
  }

  function buildBackup(tool, data, date) {
    return { tool, version: BACKUP_VERSION, exportedAt: (date || new Date()).toISOString(), data };
  }

  // 読み込んだファイルの文字列を確かめる。{ ok: true, data } か { ok: false, error: 画面に出す文 }
  function parseBackup(text, tool, requiredKeys) {
    let o;
    try { o = JSON.parse(text); } catch { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.tool !== 'string') {
      return { ok: false, error: 'ファイルを読み取れませんでした。このツールの「ファイルに書き出す」で作った .json ファイルを選んでください。' };
    }
    if (o.tool !== tool) {
      return { ok: false, error: 'ほかのツール（' + o.tool.slice(0, 40) + '）のファイルです。このツールで書き出したファイルを選んでください。' };
    }
    if (o.version !== BACKUP_VERSION) {
      return { ok: false, error: typeof o.version === 'number' && o.version > BACKUP_VERSION
        ? '新しい版のツールで書き出したファイルのため読み込めません。ページを再読み込みしてから、もう一度お試しください。'
        : 'ファイルの形式が正しくないため読み込めません。' };
    }
    const data = o.data;
    const missing = !data || typeof data !== 'object' || Array.isArray(data) ||
      (requiredKeys || []).some(k => data[k] === undefined || data[k] === null);
    if (missing) return { ok: false, error: 'ファイルの中身が足りないため読み込めません。' };
    return { ok: true, data };
  }

  // 名前の入力候補: 空でない文字列だけ、重複なし、最新 50 件（main.js の saveName と同じ上限）
  function normalizeNames(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    list.forEach(n => {
      const t = typeof n === 'string' ? n.trim() : '';
      if (t && !out.includes(t)) out.push(t);
    });
    return out.slice(-50);
  }

  // 計算履歴: 結果の一覧があるものだけ、最新 5 件。入力（input）は復元するときに normalizeState を通す
  function normalizeHistory(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(e => e && typeof e === 'object' && Array.isArray(e.results))
      .slice(0, 5)
      .map(e => {
        const entry = {
          date: String(e.date || ''),
          totalAmount: Number(e.totalAmount) || 0,
          excludedAmount: Number(e.excludedAmount) || 0,
          results: e.results.filter(x => x && typeof x === 'object').map(x => ({ name: String(x.name || ''), amount: Number(x.amount) || 0 }))
        };
        if (e.input && typeof e.input === 'object' && Array.isArray(e.input.participants) && e.input.participants.length > 0 &&
          e.input.participants.every(x => x && typeof x === 'object')) entry.input = e.input;
        return entry;
      });
  }

  return { allocate, autoUnit, computeSplit, computeMulti, backupFileName, buildBackup, parseBackup, normalizeNames, normalizeHistory };
});
