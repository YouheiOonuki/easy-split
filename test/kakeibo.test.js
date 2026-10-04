'use strict';
// 家計簿テンプレート（kakeibo/）のテスト: 日付と曜日・費目・割合・按分（合計が一致）・精算・正規化・ページの決まり
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../kakeibo/kakeibo-calc.js');

test('月の日付と曜日: 2026 年 10 月は木曜はじまり 31 日、2028 年 2 月は 29 日', () => {
  const oct = K.monthDays(2026, 10);
  assert.equal(oct.length, 31);
  assert.equal(oct[0].wd, '木');
  assert.equal(oct[30].wd, '土');
  assert.equal(K.monthDays(2028, 2).length, 29);
  assert.equal(K.monthDays(2026, 2).length, 28);
  assert.equal(K.monthDays(2100, 2).length, 28);
  assert.equal(K.monthDays(2026, 1)[0].wd, '木');
});

test('費目: 読点・カンマ・改行で区切り、空と重複を除いて 8 個まで', () => {
  assert.deepEqual(K.parseCats('食費、日用品,交通，医療\n交際、、食費'), ['食費', '日用品', '交通', '医療', '交際']);
  assert.equal(K.parseCats('a,b,c,d,e,f,g,h,i,j').length, 8);
  assert.deepEqual(K.parseCats('とても長い費目の名前です'), ['とても長い費目の']);
  assert.deepEqual(K.parseCats(''), []);
});

test('負担の割合: 折半・収入の比（1% 単位で合計 100）・割合', () => {
  assert.deepEqual(K.shareRatio('half'), [50, 50]);
  assert.deepEqual(K.shareRatio('income', [300000, 200000]), [60, 40]);
  assert.deepEqual(K.shareRatio('income', [250000, 230000]), [52, 48]); // 52.08 / 47.92
  assert.deepEqual(K.shareRatio('income', [1, 2]), [33, 67]); // 33.3 / 66.7 → 剰余の大きい B に 1
  assert.deepEqual(K.shareRatio('income', [100, 0]), [100, 0]);
  assert.equal(K.shareRatio('income', [0, 0]), null);
  assert.equal(K.shareRatio('income', ['', 200000]), null);
  assert.deepEqual(K.shareRatio('percent', [65]), [65, 35]);
  assert.equal(K.shareRatio('percent', [120]), null);
  for (let a = 1; a < 50; a++) for (let b = 1; b < 50; b++) {
    const r = K.shareRatio('income', [a * 1000, b * 1000]);
    assert.equal(r[0] + r[1], 100);
  }
});

test('按分: 120,000 円を 60%・40% → 72,000・48,000（使い方の例）。合計はいつも一致', () => {
  assert.deepEqual(K.splitShared(120000, [60, 40], 1, 0), [72000, 48000]);
  assert.deepEqual(K.splitShared(10001, [50, 50], 1, 0), [5001, 5000]);
  assert.deepEqual(K.splitShared(10001, [50, 50], 1, 1), [5001, 5000]); // 1 円単位なら端数は出ない。剰余は最大剰余法（同じなら前の人）
  assert.deepEqual(K.splitShared(12345, [60, 40], 100, 0), [7445, 4900]); // 123 単位 → 74:49、端数 45 円は A
  assert.deepEqual(K.splitShared(12345, [60, 40], 100, 1), [7400, 4945]);
  assert.deepEqual(K.splitShared(1000, [33, 67], 10, 0), [330, 670]);
  for (let t = 0; t < 5000; t += 37) for (const u of [1, 10, 100]) for (const r of [[50, 50], [61, 39], [33, 67], [100, 0]]) {
    const x = K.splitShared(t, r, u, 0);
    assert.equal(x[0] + x[1], t);
    assert.equal(x[1] % u, 0);
  }
  assert.equal(K.splitShared(1000, null, 1, 0), null);
});

test('精算: 多く払った人へ差額を渡す', () => {
  assert.deepEqual(K.settle([84000, 36000], [72000, 48000]), { from: 1, to: 0, amount: 12000 });
  assert.deepEqual(K.settle([50000, 70000], [72000, 48000]), { from: 0, to: 1, amount: 22000 });
  assert.deepEqual(K.settle([72000, 48000], [72000, 48000]), { from: -1, to: -1, amount: 0 });
  assert.deepEqual(K.settle(['', 1000], [500, 500]), { from: 0, to: 1, amount: 500 });
});

test('正規化: 種類・年月・名前・単位・行数', () => {
  const d = K.normalize(null, { y: 2026, m: 10 });
  assert.equal(d.type, 'month');
  assert.equal(d.m, 10);
  assert.equal(K.parseCats(d.cats).length, 6);
  const s = K.normalize({ type: 'x', y: 3000, m: 13, names: ['とても長い名前ですよ', ''], method: 'income', incomeA: -5, unit: 7, holder: 5, rows: 99, credit: false, budget: 'no' }, { y: 2026, m: 10 });
  assert.equal(s.type, 'month');
  assert.equal(s.y, 2100);
  assert.equal(s.m, 12);
  assert.deepEqual(s.names, ['とても長い名前で', 'B']);
  assert.equal(s.method, 'income');
  assert.equal(s.incomeA, 0);
  assert.equal(s.unit, 1);
  assert.equal(s.holder, 0);
  assert.equal(s.rows, 30);
  assert.equal(s.credit, false);
  assert.equal(s.budget, true);
});

test('ページの決まり: 保存キー easysplit_kakeibo・消すボタン・自動広告・sitemap・sw', () => {
  const root = path.join(__dirname, '..');
  const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
  const html = read('kakeibo/index.html');
  assert.ok(html.includes('data-reset-storage="easysplit_kakeibo"'));
  // AdSense 審査中（2026-10-04）は本文の薄いページなので広告 script を外し、所有確認の meta だけ
  assert.ok(!html.includes('adsbygoogle.js'));
  assert.equal((html.match(/name="google-adsense-account"/g) || []).length, 1);
  assert.ok(html.includes('<link rel="canonical" href="https://yorozu-craft.com/easy-split/kakeibo/">'));
  assert.match(read('kakeibo/kakeibo.js'), /const KEY = 'easysplit_kakeibo';/);
  assert.ok(read('sitemap.xml').includes('https://yorozu-craft.com/easy-split/kakeibo/'));
  for (const f of ['kakeibo/', 'kakeibo/index.html', 'kakeibo/kakeibo.js', 'kakeibo/kakeibo-calc.js', 'kakeibo/kakeibo.css', 'kakeibo/guide.html']) assert.ok(read('sw.js').includes(`'${f}'`), f);
  assert.ok(read('kakeibo/guide.html').includes('7 万 2,000 円と 4 万 8,000 円'));
});
