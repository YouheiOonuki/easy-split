// バックアップファイル（書き出し・読み込み）のテスト: node --test test/*.test.js
// README「ツールを追加するとき」20（決定 D31）
const test = require('node:test');
const assert = require('node:assert/strict');
const { backupFileName, buildBackup, parseBackup } = require('../split.js');

const TOOL = 'easy-split';
const DATA = { draft: { bills: [{ id: 0, name: '1次会', total: 6000, excluded: 0, absent: [] }], participants: [{ id: 0, name: 'Aさん', weight: 1, fixed: null }], organizerId: 0, unit: 'auto', paid: {} }, names: ['Aさん'], history: [], historyOn: true, theme: 'dark' };
const REQUIRED = ['draft'];

test('backupFileName: <ツール名>-backup-YYYYMMDD.json（端末の日付）', () => {
  assert.equal(backupFileName(TOOL, new Date(2026, 8, 24, 23, 59)), TOOL + '-backup-20260924.json');
  assert.equal(backupFileName(TOOL, new Date(2027, 0, 5)), TOOL + '-backup-20270105.json');
});

test('buildBackup: tool・version・exportedAt・data の形', () => {
  const b = buildBackup(TOOL, DATA, new Date('2026-09-24T01:02:03Z'));
  assert.deepEqual(Object.keys(b), ['tool', 'version', 'exportedAt', 'data']);
  assert.equal(b.tool, TOOL);
  assert.equal(b.version, 1);
  assert.equal(b.exportedAt, '2026-09-24T01:02:03.000Z');
  assert.deepEqual(b.data, DATA);
});

test('parseBackup: 書き出したファイルはそのまま読める', () => {
  const r = parseBackup(JSON.stringify(buildBackup(TOOL, DATA)), TOOL, REQUIRED);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, DATA);
});

test('parseBackup: ほかのツールのファイルは断る', () => {
  const r = parseBackup(JSON.stringify(buildBackup('other-tool', DATA)), TOOL, REQUIRED);
  assert.equal(r.ok, false);
  assert.match(r.error, /ほかのツール（other-tool）/);
});

test('parseBackup: 壊れた JSON・JSON でないものは断る', () => {
  for (const text of ['{"tool": "' + TOOL, '', 'こんにちは', 'null', '[]', '123']) {
    const r = parseBackup(text, TOOL, REQUIRED);
    assert.equal(r.ok, false, text);
    assert.match(r.error, /読み取れませんでした/);
  }
});

test('parseBackup: 項目が欠けている・形が違うものは断る', () => {
  const ok = buildBackup(TOOL, DATA);
  const cases = [
    Object.assign({}, ok, { tool: undefined }),
    Object.assign({}, ok, { version: undefined }),
    Object.assign({}, ok, { version: '1' }),
    Object.assign({}, ok, { data: undefined }),
    Object.assign({}, ok, { data: [] }),
    Object.assign({}, ok, { data: 'x' }),
  ];
  REQUIRED.forEach((k) => {
    const data = Object.assign({}, DATA);
    delete data[k];
    cases.push(Object.assign({}, ok, { data }));
  });
  cases.forEach((c, i) => {
    const r = parseBackup(JSON.stringify(c), TOOL, REQUIRED);
    assert.equal(r.ok, false, 'case ' + i);
    assert.ok(typeof r.error === 'string' && r.error.length > 0);
  });
});

test('parseBackup: 新しい版の形式は、その旨を伝えて断る', () => {
  const r = parseBackup(JSON.stringify(Object.assign(buildBackup(TOOL, DATA), { version: 2 })), TOOL, REQUIRED);
  assert.equal(r.ok, false);
  assert.match(r.error, /新しい版/);
});

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
