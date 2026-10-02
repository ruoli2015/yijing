// Integrity of the built data file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync(new URL('../app/data/yijing.json', import.meta.url), 'utf8'));
const H = D.hexagrams;

test('64 hexagrams in order with unique line patterns', () => {
  assert.equal(H.length, 64);
  H.forEach((h, i) => assert.equal(h.n, i + 1));
  assert.equal(new Set(H.map((h) => h.lines)).size, 64);
});

test('anchors: 乾 111111, 坤 000000, 既濟 101010, 未濟 010101 (bottom → top)', () => {
  assert.equal(H[0].lines, '111111');
  assert.equal(H[1].lines, '000000');
  assert.equal(H[62].lines, '101010');
  assert.equal(H[63].lines, '010101');
  assert.equal(H[2].full, '水雷屯');
  assert.equal(H[28].full, '坎為水');
});

test('非覆即變: 28 inverted pairs and 4 complementary pairs', () => {
  const firsts = H.filter((h) => h.n % 2 === 1);
  const cuo = firsts.filter((h) => h.pair.rel === 'cuo').map((h) => h.name);
  assert.deepEqual(cuo, ['乾', '頤', '坎', '中孚']);
  const both = firsts.filter((h) => h.pair.rel === 'both').map((h) => h.name);
  assert.deepEqual(both, ['泰', '隨', '漸', '既濟']);
});

test('every hexagram has classical texts and bilingual explanations', () => {
  for (const h of H) {
    for (const k of ['judgment', 'tuan', 'daxiang', 'logicZh', 'logicEn', 'gistZh', 'gistEn', 'en', 'pinyin']) assert.ok(h[k], `#${h.n} ${k}`);
    assert.ok(h.xugua.zh && h.xugua.en, `#${h.n} xugua`);
    assert.equal(h.yao.length, h.n <= 2 ? 7 : 6, `#${h.n} yao count`);
    for (const y of h.yao) assert.ok(y.text && y.xiang, `#${h.n} ${y.pos}`);
  }
});

test('序卦 sentence of each hexagram names it (except 乾 坤 咸, which are implied)', () => {
  for (const h of H) if (![1, 2, 31].includes(h.n)) assert.ok(h.xugua.zh.includes(`受之${h.n === 63 ? '' : '以'}${h.name}`), `#${h.n}`);
});

test('ten "物不可（以）終…" sentences', () => {
  const n = H.filter((h) => /物不可(以)?終/.test(h.xugua.zh)).map((h) => h.n);
  assert.deepEqual(n, [12, 13, 24, 29, 34, 35, 40, 52, 53, 60]);
});

test('classical text is in traditional characters', () => {
  const simplified = /[这为说时动见观东车马门问长书]/;
  for (const h of H) {
    const all = [h.judgment, h.tuan, h.daxiang, h.xugua.zh, ...h.yao.flatMap((y) => [y.text, y.xiang])].join('');
    assert.ok(!simplified.test(all), `#${h.n} has simplified characters`);
  }
});
