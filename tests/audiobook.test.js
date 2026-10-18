// The audiobook script (built by scripts/build.mjs) and the recording made from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { sentences, sapi, compileRules, readings, tidy } from '../scripts/audiobook/script.mjs';
import { setData, numZh } from '../app/js/hex.js';
import { locate } from '../app/js/audiobook.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const D = JSON.parse(read('../app/data/yijing.json'));
const H = D.hexagrams;
setData(D);
const scriptJson = read('../content/audiobook/script.json');
const S = JSON.parse(scriptJson);
const book = parse(read('../content/audiobook.yaml'));

test('sentences split at full stops outside quotes', () => {
  assert.deepEqual(sentences('卦辭講師生關係：「匪我求童蒙，童蒙求我。」屯與蒙互為綜卦。'), ['卦辭講師生關係：「匪我求童蒙，童蒙求我。」', '屯與蒙互為綜卦。']);
  assert.deepEqual(sentences('守成比創業更難。（序卦原文此句作「故受之既濟」，比其他句子少一個「以」字。）'), [
    '守成比創業更難。',
    '（序卦原文此句作「故受之既濟」，比其他句子少一個「以」字。）',
  ]);
  assert.equal(tidy('樣子。 所以\n  屯有 two words'), '樣子。所以屯有two words');
});

test('pinyin → SAPI phones', () => {
  assert.equal(sapi('zhūn'), 'zhun 1');
  assert.equal(sapi('pǐ'), 'pi 3');
  assert.equal(sapi('lǚ'), 'lv 3');
  assert.equal(sapi('guài'), 'guai 4');
});

test('pronunciation rules agree with the pinyin shown in the app', () => {
  const rules = compileRules(book.pronounce);
  for (const h of H) {
    const text = `故受之以${h.name}`;
    const say = readings(text, [rules.classical, rules.everywhere]);
    h.pinyin.split(' ').forEach((syl, k) => {
      const got = say[text.length - h.name.length + k];
      if (got) assert.equal(got, syl, `${h.name}: rule says ${got}, app says ${syl}`);
    });
  }
  // context: 否則 and 解作 keep their ordinary readings
  const r = readings('否則解作', [rules.everywhere]);
  assert.equal(r.filter(Boolean).length, 0);
});

test('script: an introduction and one chapter per hexagram, chained by the 序卦 sentences', () => {
  assert.equal(S.chapters.length, 65);
  S.chapters.forEach((ch, i) => assert.equal(ch.n, i));
  for (let n = 1; n <= 64; n++) {
    const cues = S.chapters[n].cues;
    assert.equal(cues[0].role, 'head');
    assert.equal(cues[0].text, `第${numZh(n)}卦，${H[n - 1].full}。`);
    if (n < 64) {
      const to = H[n];
      assert.equal(cues.find((c) => c.role === 'quote').text, `序卦傳說：「${to.xugua.zh}」`);
      assert.equal(cues.filter((c) => c.role === 'read').map((c) => c.text).join(''), tidy(to.logicZh));
      assert.ok(cues.some((c) => c.role === 'next' && c.text === `下一卦：第${numZh(n + 1)}卦，${to.full}。`), `#${n} names the next hexagram`);
    }
  }
  for (const ch of S.chapters)
    for (const c of ch.cues) {
      const tags = c.ssml.replace(/<phoneme alphabet="sapi" ph="[a-z]+ [1-5]">.<\/phoneme>/g, '');
      assert.ok(!/[<>]/.test(tags), `only phoneme tags in: ${c.ssml}`);
      assert.ok(c.pause >= 0);
    }
});

const manifestUrl = new URL('../app/data/audiobook.json', import.meta.url);
test('recording: chapters and cues line up with the script', { skip: !existsSync(manifestUrl) && 'not recorded yet' }, () => {
  const M = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  const mp3 = new URL(`../app/${M.audio.split('?')[0]}`, import.meta.url);
  assert.ok(existsSync(mp3), 'mp3 exists');
  assert.equal(statSync(mp3).size, M.bytes);
  assert.equal(M.chapters.length, 65);
  let t = -1;
  for (const ch of M.chapters)
    for (const c of ch.cues) {
      assert.ok(c.start > t && c.end > c.start && c.end <= M.duration, `cue times increase: ${c.text}`);
      t = c.start;
    }
  // a recording of the current script carries exactly its text (build.mjs warns when it is out of date)
  const current = createHash('sha256').update(scriptJson).digest('hex').slice(0, 10);
  const texts = (chs) => chs.map((ch) => ch.cues.map((c) => c.text));
  if (M.script === current) assert.deepEqual(texts(M.chapters), texts(S.chapters));
  const mid = M.chapters[24];
  assert.deepEqual(locate(mid.start + 0.01, M), { chapter: 24, cue: 0 });
  assert.equal(locate(0, M).chapter, 0);
});
