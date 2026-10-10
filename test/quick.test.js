// 割り勘のスマホ版（yorozu-plans ROADMAP 7.41.3 K176）: 計算は split.js と同じ、送る文に名前が無く値は合計・人数・1 人あたり・幹事だけ、URL に値が無い
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../split.js');
const { quickSplit, shareText } = require('../quick/quick.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('計算は split.js の computeSplit と同じ（端数の配り方も split.js のまま）。額ごとの人数の合計が合計金額に合う', () => {
  const q = quickSplit(S, 21000, 6, 100);
  assert.deepEqual([q.ok, q.each, q.extra, q.total, q.count], [true, 3500, [], 21000, 6]);
  for (const [total, n, unit] of [[20000, 6, 100], [10000, 3, 10], [33333, 7, 100]]) {
    const r = quickSplit(S, total, n, unit);
    const people = Array.from({ length: n }, (_, i) => ({ id: i, name: '', weight: 1 }));
    const ref = S.computeSplit({ total, people, organizerId: 0, unit }).results.map((p) => p.amount).sort();
    const got = [...Array(n - r.extra.reduce((a, g) => a + g.n, 0)).fill(r.each), ...r.extra.flatMap((g) => Array(g.n).fill(g.amount))];
    assert.deepEqual(got.slice().sort(), ref, `${total} 円・${n} 人`);
    assert.equal(got.reduce((a, b) => a + b, 0), total, '合計に合う');
  }
  assert.equal(quickSplit(S, 0, 3, 100).ok, false);
});

test('送る文: 名前が無く、値は合計・人数・1 人あたり・額の違う人だけ', () => {
  assert.equal(shareText(quickSplit(S, 21000, 6, 100)), '1 人 3,500 円（合計 21,000 円・6 人）');
  assert.equal(shareText(quickSplit(S, 20000, 6, 100)), '1 人 3,300 円（合計 20,000 円・6 人）\n3,400 円の人が 2 人（幹事を含む）');
  const js = read('quick/quick.js');
  assert.match(js, /const URL_SHARE = 'https:\/\/yorozu-craft\.com\/easy-split\/quick\/';/, 'URL に値を入れない');
  assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\//g, ''), /localStorage|sessionStorage|name:\s*[^\s'"]|window\.open/, '保存しない・名前を入れない（name は空文字だけ）・本物の窓を開かない');
});

test('ページ: いつもの版へのリンク、split.js を読む、入口からのリンク', () => {
  const html = read('quick/index.html');
  assert.ok(html.indexOf('../split.js') < html.indexOf('./quick.js'));
  assert.match(html, /href="\.\.\/">いつもの版<\/a>/);
  assert.match(read('index.html'), /href="\.\/quick\/"/);
  assert.match(read('sitemap.xml'), /https:\/\/yorozu-craft\.com\/easy-split\/quick\//);
});
