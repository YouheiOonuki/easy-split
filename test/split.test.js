const test = require('node:test');
const assert = require('node:assert/strict');
const { allocate, autoUnit, computeSplit } = require('../split.js');

const people = (...weights) => weights.map((w, i) => ({ id: i, name: 'P' + i, weight: w }));
const amounts = r => r.results.map(x => x.amount);
const sum = r => r.results.reduce((s, x) => s + x.amount, 0);

test('equal split with clean total', () => {
  const r = computeSplit({ total: 6000, people: people(1, 1, 1), organizerId: 0 });
  assert.deepEqual(amounts(r), [2000, 2000, 2000]);
  assert.equal(r.unit, 100);
});

test('weighted split keeps every share on the unit grid', () => {
  const r = computeSplit({ total: 4000, people: people(2, 0.5, 0.5, 0.5), organizerId: 0, unit: 100 });
  assert.deepEqual(amounts(r), [2300, 600, 600, 500]);
});

test('odd remainder is absorbed by the organizer', () => {
  const r = computeSplit({ total: 7777, people: people(1, 1, 1), organizerId: 0, unit: 100 });
  assert.equal(r.remainder, 77);
  assert.equal(r.absorberId, 0);
  assert.deepEqual(amounts(r), [2677, 2600, 2500]);
});

test('1-yen unit matches exact proportional split', () => {
  const r = computeSplit({ total: 10000, people: people(1, 1, 1), organizerId: 1, unit: 1 });
  assert.deepEqual(amounts(r), [3333, 3334, 3333]);
});

test('fixed organizer amount: others share the rest', () => {
  const r = computeSplit({ total: 10000, people: people(1, 1, 1), organizerId: 0, organizerFixedAmount: 0, unit: 100 });
  assert.equal(r.results[0].amount, 0);
  assert.equal(sum(r), 10000);
  assert.deepEqual(amounts(r), [0, 5000, 5000]);
});

test('excluded amount is not split', () => {
  const r = computeSplit({ total: 8000, excluded: 2000, people: people(1, 1), organizerId: 0 });
  assert.equal(sum(r), 6000);
});

test('validation errors', () => {
  const p = people(1, 1);
  assert.ok(computeSplit({ total: 0, people: p }).error);
  assert.ok(computeSplit({ total: 1000, excluded: 1000, people: p }).error);
  assert.ok(computeSplit({ total: 1000, excluded: -1, people: p }).error);
  assert.ok(computeSplit({ total: 1000, people: [] }).error);
  assert.ok(computeSplit({ total: 6000, people: p, organizerId: 0, organizerFixedAmount: 8000 }).error);
  assert.ok(computeSplit({ total: 6000, people: people(1), organizerId: 0, organizerFixedAmount: 0 }).error);
});

test('autoUnit picks ~2 significant digits of the average', () => {
  assert.equal(autoUnit(50000, 3), 1000);
  assert.equal(autoUnit(6000, 3), 100);
  assert.equal(autoUnit(900, 3), 10);
  assert.equal(autoUnit(200, 3), 1);
});

test('fuzz: totals always match and non-absorbers sit on the unit grid', () => {
  const units = ['auto', 1, 10, 100, 500, 1000];
  let seed = 42;
  const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let k = 0; k < 3000; k++) {
    const n = 1 + rand(8);
    const p = people(...Array.from({ length: n }, () => (5 + rand(16)) / 10));
    const total = 1 + rand(200000);
    const excluded = rand(3) === 0 ? rand(total) : 0;
    const splittable = total - excluded;
    const fixed = n >= 2 && rand(3) === 0 ? rand(splittable + 1) : null;
    const organizerId = rand(n);
    const r = computeSplit({ total, excluded, people: p, organizerId, organizerFixedAmount: fixed, unit: units[rand(units.length)] });
    assert.ok(!r.error, r.error);
    assert.equal(sum(r), splittable);
    for (const x of r.results) {
      assert.ok(x.amount >= 0);
      if (x.id === r.absorberId || (fixed !== null && x.id === organizerId)) continue;
      assert.equal(x.amount % r.unit, 0);
    }
  }
});

test('allocate distributes by largest remainder', () => {
  assert.deepEqual(allocate(1000, [1, 1, 1], 100), { amounts: [400, 300, 300], remainder: 0 });
});
