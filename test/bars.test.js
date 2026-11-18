// 結果の棒（yorozu-plans QUEUE Q-454）: 額は computeSplit / computeMulti の結果そのまま。印の 1 歩は欄の step 1 つ
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { computeSplit, computeMulti } = require('../split.js');
const { WEIGHT, stepWeight, stepsFromDrag, barRows } = require('../bars.js');

const people = (ws, fixed = {}) => ws.map((w, i) => ({ id: i, name: 'P' + i, weight: w, fixed: fixed[i] ?? null }));

const CASES = [
  { name: '3 人・6,000円・自動', opts: { total: 6000, people: people([1, 1, 1]), organizerId: 0, unit: 'auto' } },
  { name: '8 人・傾斜・対象外あり・100円単位', opts: { total: 38500, excluded: 2500, people: people([1.5, 1, 1, 0.8, 0.7, 0.5, 1, 1.2]), organizerId: 1, unit: 100 } },
  { name: '20 人・幹事 0円 固定', opts: { total: 99999, people: people(Array.from({ length: 20 }, (_, i) => [1.5, 1, 0.8, 0.7, 0.5][i % 5]), { 0: 0 }), organizerId: 0, unit: 'auto' } }
];

for (const c of CASES) {
  test('棒の数 ＝ 参加者の数、棒の額 ＝ 結果の額: ' + c.name, () => {
    const r = computeSplit(c.opts);
    assert.ok(!r.error, r.error);
    const rows = barRows(r);
    assert.equal(rows.length, c.opts.people.length);
    assert.deepEqual(rows.map(b => b.amount), r.results.map(x => x.amount));
    assert.deepEqual(rows.map(b => b.id), c.opts.people.map(p => p.id));
    // いちばん多い額の棒が 100%、ほかは額の比
    const max = Math.max(...r.results.map(x => x.amount));
    rows.forEach(b => assert.ok(Math.abs(b.pct - b.amount / max * 100) < 1e-9));
    // 固定の人の棒は動かせない
    assert.deepEqual(rows.map(b => b.movable), c.opts.people.map(p => p.fixed === null));
  });

  test('印を 1 歩動かすと係数は前 ± step、全員の額の合計は割り勘対象額のまま: ' + c.name, () => {
    const i = c.opts.people.findIndex(p => p.fixed === null && p.weight > WEIGHT.min && p.weight < WEIGHT.max);
    for (const k of [1, -1]) {
      const w = stepWeight(c.opts.people[i].weight, k);
      assert.ok(Math.abs(w - (c.opts.people[i].weight + k * WEIGHT.step)) < 1e-9, `${c.opts.people[i].weight} → ${w}`);
      const moved = c.opts.people.map((p, j) => (j === i ? Object.assign({}, p, { weight: w }) : p));
      const r = computeSplit(Object.assign({}, c.opts, { people: moved }));
      assert.ok(!r.error, r.error);
      assert.equal(r.results.reduce((s, x) => s + x.amount, 0), c.opts.total - (c.opts.excluded || 0));
      assert.equal(barRows(r).length, c.opts.people.length);
    }
  });
}

test('2 次会の合算でも、1 人 1 本（合計の額）', () => {
  const ps = people([1.5, 1, 1, 0.8]);
  const r = computeMulti({
    bills: [{ id: 0, name: '1次会', total: 20000, excluded: 0, attendees: [0, 1, 2, 3] }, { id: 1, name: '2次会', total: 9000, excluded: 0, attendees: [1, 2] }],
    people: ps, organizerId: 0, unit: 'auto'
  });
  const rows = barRows(r);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(b => b.amount), r.results.map(x => x.amount));
});

test('係数は範囲（欄の min・max）の外へ出ない。刻みの端数を残さない', () => {
  assert.equal(stepWeight(WEIGHT.min, -1), WEIGHT.min);
  assert.equal(stepWeight(WEIGHT.max, 1), WEIGHT.max);
  assert.equal(stepWeight(0.7, 1), 0.8);
  assert.equal(stepWeight(1.5, -1), 1.4);
  assert.equal(stepWeight(1.0, 3), 1.3);
});

test('引いた距離: 棒の枠の幅で範囲の全部、半歩未満は動かない', () => {
  const span = Math.round((WEIGHT.max - WEIGHT.min) / WEIGHT.step);
  assert.equal(stepsFromDrag(300, 300), span);
  assert.equal(stepsFromDrag(-300, 300), -span);
  assert.equal(stepsFromDrag(300 / span * 0.4, 300), 0);
  assert.equal(stepsFromDrag(300 / span * 1.6, 300), 2);
  assert.equal(stepsFromDrag(50, 0), 0);
});

test('係数の欄（range）は bars.js の範囲と刻みを使う', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(main, /slider\.min = String\(W\.min\);/);
  assert.match(main, /slider\.max = W\.max\.toFixed\(1\);/);
  assert.match(main, /slider\.step = String\(W\.step\);/);
  assert.deepEqual(WEIGHT, { min: 0.5, max: 2.0, step: 0.1 });
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(sw.includes("'bars.js'"), 'sw.js の一覧に bars.js');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.indexOf('./bars.js') > html.indexOf('./split.js') && html.indexOf('./bars.js') < html.indexOf('./main.js'));
});
