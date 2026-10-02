import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setData, nameMatches, search, matchPattern, hex } from '../app/js/hex.js';
import { pool, pickNext, nameOptions, orderOptions, numberOptions, updateStat, level } from '../app/js/quiz.js';

const D = JSON.parse(readFileSync(new URL('../app/data/yijing.json', import.meta.url), 'utf8'));
setData(D);
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('typed names: traditional, simplified, full name and pinyin are accepted', () => {
  assert.ok(nameMatches('訟', hex(6)));
  assert.ok(nameMatches('讼', hex(6)));
  assert.ok(nameMatches('天水訟', hex(6)));
  assert.ok(nameMatches('song', hex(6)));
  assert.ok(nameMatches('xiao chu', hex(9)));
  assert.ok(nameMatches('Xiaochu', hex(9)));
  assert.ok(nameMatches('既济', hex(63)));
  assert.ok(nameMatches('習坎', hex(29)));
  assert.ok(!nameMatches('需', hex(6)));
  assert.ok(!nameMatches('', hex(6)));
});

test('search by number, name, pinyin, English', () => {
  assert.deepEqual(search('24').map((h) => h.n), [24]);
  assert.deepEqual(search('剥').map((h) => h.n), [23]);
  assert.ok(search('水').some((h) => h.n === 29));
  assert.ok(search('qian').map((h) => h.n).includes(1));
  assert.ok(search('qian').map((h) => h.n).includes(15));
  assert.ok(search('well').some((h) => h.n === 48));
});

test('find by partial lines', () => {
  assert.deepEqual(matchPattern('111111').map((h) => h.n), [1]);
  assert.equal(matchPattern('??????').length, 64);
  assert.equal(matchPattern('111???').length, 8);
});

test('pools and picks stay in range and avoid recent items', () => {
  assert.equal(pool('upper').length, 30);
  assert.equal(pool('r4').length, 16);
  const rng = seeded(7);
  for (let i = 0; i < 200; i++) {
    const n = pickNext(pool('r1'), {}, [1, 2, 3], rng);
    assert.ok(n >= 4 && n <= 16);
  }
});

test('weak items come up more often', () => {
  const stats = {};
  for (let n = 1; n <= 16; n++) stats[n] = { box: 5, seen: 5, right: 5 };
  stats[7] = { box: 0, seen: 3, right: 0 };
  const rng = seeded(3);
  let hits = 0;
  for (let i = 0; i < 2000; i++) if (pickNext(pool('r1'), stats, [], rng) === 7) hits++;
  assert.ok(hits > 2000 / 16 * 3, `weak item picked ${hits} times`);
});

test('options contain the answer exactly once, four distinct choices', () => {
  const rng = seeded(11);
  for (let n = 1; n <= 64; n++) {
    for (const opts of [nameOptions(n, D.hexagrams, rng), numberOptions(n, rng)]) {
      assert.equal(opts.length, 4);
      assert.equal(new Set(opts).size, 4);
      assert.equal(opts.filter((o) => o === n).length, 1);
      opts.forEach((o) => assert.ok(o >= 1 && o <= 64));
    }
    if (n < 64) {
      const o = orderOptions(n + 1, n, D.hexagrams, rng);
      assert.ok(o.includes(n + 1) && !o.includes(n) && new Set(o).size === 4);
    }
  }
});

test('Leitner boxes', () => {
  let s = updateStat(undefined, true);
  assert.equal(s.box, 1);
  s = updateStat(updateStat(updateStat(s, true), true), true);
  assert.equal(s.box, 4);
  assert.equal(level(s), 3);
  s = updateStat(s, false);
  assert.equal(s.box, 0);
  assert.equal(s.seen, 5);
  assert.equal(s.right, 4);
});
