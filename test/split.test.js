const test = require('node:test');
const assert = require('node:assert/strict');
const { allocate, autoUnit, computeSplit, computeMulti } = require('../split.js');

const people = (...weights) => weights.map((w, i) => ({ id: i, name: 'P' + i, weight: w, fixed: null }));
const withFixed = (list, fixedById) => list.map(p => (p.id in fixedById ? { ...p, fixed: fixedById[p.id] } : p));
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

test('ties give the extra unit to the organizer', () => {
  const r = computeSplit({ total: 10000, people: people(1, 1, 1), organizerId: 1, unit: 1 });
  assert.deepEqual(amounts(r), [3333, 3334, 3333]);
});

test('organizer fixed at 0: others share the rest', () => {
  const r = computeSplit({ total: 10000, people: withFixed(people(1, 1, 1), { 0: 0 }), organizerId: 0, unit: 100 });
  assert.deepEqual(amounts(r), [0, 5000, 5000]);
  assert.equal(r.results[0].isFixed, true);
});

test('any participant can be fixed (late joiner pays 3000)', () => {
  const r = computeSplit({ total: 15000, people: withFixed(people(1, 1, 1, 1), { 3: 3000 }), organizerId: 0, unit: 100 });
  assert.deepEqual(amounts(r), [4000, 4000, 4000, 3000]);
});

test('everyone fixed: valid only when fixed amounts match exactly', () => {
  const p = withFixed(people(1, 1), { 0: 2000, 1: 4000 });
  const ok = computeSplit({ total: 6000, people: p, organizerId: 0 });
  assert.deepEqual(amounts(ok), [2000, 4000]);
  assert.equal(ok.absorberId, null);
  assert.ok(computeSplit({ total: 7000, people: p, organizerId: 0 }).error);
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
  assert.ok(computeSplit({ total: 6000, people: withFixed(p, { 0: 8000 }), organizerId: 0 }).error);
  assert.ok(computeSplit({ total: 6000, people: withFixed(p, { 0: -1 }), organizerId: 0 }).error);
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
    const total = 1 + rand(200000);
    const excluded = rand(3) === 0 ? rand(total) : 0;
    const splittable = total - excluded;
    const p = people(...Array.from({ length: n }, () => (5 + rand(16)) / 10)).map(x =>
      n >= 2 && rand(4) === 0 ? { ...x, fixed: rand(Math.floor(splittable / n) + 1) } : x);
    if (p.every(x => x.fixed !== null)) p[0].fixed = null;
    const r = computeSplit({ total, excluded, people: p, organizerId: rand(n), unit: units[rand(units.length)] });
    assert.ok(!r.error, r.error);
    assert.equal(sum(r), splittable);
    for (const x of r.results) {
      assert.ok(x.amount >= 0);
      if (x.id === r.absorberId || x.isFixed) continue;
      assert.equal(x.amount % r.unit, 0);
    }
  }
});

const bill = (id, total, attendees, excluded = 0) => ({ id, name: (id + 1) + '次会', total, excluded, attendees });

test('multi: 2次会 is split only among its attendees', () => {
  const p = people(1, 1, 1, 1, 1);
  const r = computeMulti({ bills: [bill(0, 12000, [0, 1, 2, 3, 4]), bill(1, 6000, [0, 1, 2])], people: p, organizerId: 0, unit: 100 });
  assert.deepEqual(amounts(r), [4400, 4400, 4400, 2400, 2400]);
  assert.deepEqual(r.results[0].bills, [0, 1]);
  assert.deepEqual(r.results[3].bills, [0]);
  assert.equal(r.splittable, 18000);
});

test('multi: weights apply within each bill', () => {
  const p = people(2, 1, 1);
  const r = computeMulti({ bills: [bill(0, 8000, [0, 1, 2]), bill(1, 3000, [1, 2])], people: p, organizerId: 0, unit: 1 });
  assert.deepEqual(amounts(r), [4000, 3500, 3500]);
});

test('multi: organizer fixed at 0 across all bills', () => {
  const p = withFixed(people(1, 1, 1, 1, 1), { 0: 0 });
  const r = computeMulti({ bills: [bill(0, 12000, [0, 1, 2, 3, 4]), bill(1, 6000, [0, 1, 2])], people: p, organizerId: 0, unit: 100 });
  assert.equal(r.results[0].amount, 0);
  assert.equal(sum(r), 18000);
  assert.ok(r.results[1].amount > r.results[3].amount);
});

test('multi: a person who attended nothing pays nothing', () => {
  const p = people(1, 1, 1);
  const r = computeMulti({ bills: [bill(0, 6000, [0, 1])], people: p, organizerId: 0, unit: 100 });
  assert.deepEqual(amounts(r), [3000, 3000, 0]);
});

test('multi: bill-specific errors are prefixed with the bill name', () => {
  const p = people(1, 1);
  const noTotal = computeMulti({ bills: [bill(0, 6000, [0, 1]), bill(1, 0, [0])], people: p, organizerId: 0 });
  assert.match(noTotal.error, /^2次会：/);
  const nobody = computeMulti({ bills: [bill(0, 6000, [0, 1]), bill(1, 3000, [])], people: p, organizerId: 0 });
  assert.match(nobody.error, /^2次会：参加した人/);
});

test('multi fuzz: grand total always matches', () => {
  let seed = 7;
  const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let k = 0; k < 2000; k++) {
    const n = 1 + rand(8);
    const p = people(...Array.from({ length: n }, () => (5 + rand(16)) / 10));
    const bills = Array.from({ length: 1 + rand(3) }, (_, i) => {
      const att = p.filter(() => rand(3) > 0).map(x => x.id);
      return bill(i, 1 + rand(80000), att.length ? att : [p[0].id]);
    });
    const r = computeMulti({ bills, people: p, organizerId: rand(n), unit: ['auto', 1, 100, 500][rand(4)] });
    assert.ok(!r.error, r.error);
    assert.equal(sum(r), bills.reduce((s, b) => s + b.total, 0));
  }
});

test('allocate distributes by largest remainder', () => {
  assert.deepEqual(allocate(1000, [1, 1, 1], 100), { amounts: [400, 300, 300], remainder: 0 });
});
