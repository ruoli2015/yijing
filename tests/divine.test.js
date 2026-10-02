import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tossCoins, castResult, readingPlan } from '../app/js/divine.js';

test('coin values follow 火珠林: three plain = 9, three inscribed = 6', () => {
  assert.equal(tossCoins(() => 1).value, 9);
  assert.equal(tossCoins(() => 0).value, 6);
  const counts = { 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let i = 0; i < 8000; i++) counts[tossCoins().value]++;
  // expected 1/8, 3/8, 3/8, 1/8
  assert.ok(counts[6] > 800 && counts[6] < 1200);
  assert.ok(counts[7] > 2700 && counts[7] < 3300);
});

test('primary and resulting hexagrams', () => {
  const r = castResult([9, 7, 8, 6, 7, 8]);
  assert.equal(r.primary, '110010');
  assert.equal(r.relating, '010110');
  assert.deepEqual(r.changing, [0, 3]);
  assert.equal(castResult([7, 7, 8, 8, 7, 8]).relating, null);
});

test("Zhu Xi's rules", () => {
  const plan = (values) => readingPlan(castResult(values));
  assert.deepEqual(plan([7, 7, 7, 8, 8, 8]).focus, [{ hex: 'primary', kind: 'judgment' }]);
  assert.deepEqual(plan([7, 9, 7, 8, 8, 8]).focus, [{ hex: 'primary', kind: 'line', line: 1 }]);
  // two changing: upper one first
  assert.deepEqual(plan([9, 7, 7, 6, 8, 8]).focus.map((f) => f.line), [3, 0]);
  // three: both judgments, primary first
  assert.deepEqual(plan([9, 9, 9, 8, 8, 8]).focus.map((f) => f.hex), ['primary', 'relating']);
  // four: the two unchanging lines of the resulting hexagram, lower first
  assert.deepEqual(plan([9, 7, 9, 6, 8, 6]).focus, [{ hex: 'relating', kind: 'line', line: 1 }, { hex: 'relating', kind: 'line', line: 4 }]);
  // five: the one unchanging line
  assert.deepEqual(plan([9, 9, 9, 6, 6, 8]).focus, [{ hex: 'relating', kind: 'line', line: 5 }]);
  // six: 用九 / 用六, else resulting judgment
  assert.equal(plan([9, 9, 9, 9, 9, 9]).focus[0].kind, 'use');
  assert.equal(plan([6, 6, 6, 6, 6, 6]).focus[0].kind, 'use');
  assert.deepEqual(plan([9, 6, 9, 6, 9, 6]).focus, [{ hex: 'relating', kind: 'judgment' }]);
});
