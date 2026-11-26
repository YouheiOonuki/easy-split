// バックアップを読んだ中身の正規化など、この repo だけの確かめ。形の確かめは共通の本体（同じフォルダの backup.test.js。値は backup.values.json）にある（yorozu-plans 7.271）。
const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeNames, normalizeHistory } = require('../split.js');

test('normalizeNames: 空でない文字列だけ・重複なし・50 件まで', () => {
  assert.deepEqual(normalizeNames([' 田中 ', '田中', '', 3, null, '鈴木']), ['田中', '鈴木']);
  assert.equal(normalizeNames(Array.from({ length: 60 }, (_, i) => 'n' + i)).length, 50);
  assert.deepEqual(normalizeNames('田中'), []);
});

test('normalizeHistory: 結果の一覧があるものだけ・5 件まで・入力は参加者がいるときだけ残す', () => {
  const input = { participants: [{ id: 0, name: 'A' }], bills: [] };
  const list = [
    { date: '2026/9/24', totalAmount: 6000, results: [{ name: 'A', amount: '2000' }, null], input },
    { date: 'x', results: 'no' },
    null,
    { results: [], input: { participants: [1] } },
  ].concat(Array.from({ length: 6 }, () => ({ results: [] })));
  const r = normalizeHistory(list);
  assert.equal(r.length, 5);
  assert.deepEqual(r[0], { date: '2026/9/24', totalAmount: 6000, excludedAmount: 0, results: [{ name: 'A', amount: 2000 }], input });
  assert.equal(r[1].input, undefined);
  assert.deepEqual(normalizeHistory({}), []);
});
