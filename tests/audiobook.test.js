// The audiobook script (built by scripts/build.mjs) and the recording made from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { sentences, sapi, compileRules, readings, tidy } from '../scripts/audiobook/script.mjs';
import { setData, numZh } from '../app/js/hex.js';
import { locate, span } from '../app/js/audiobook.js';

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

test('full script: each hexagram is followed by its own 序卦 sentence and modern reading', () => {
  const full = S.books.find((b) => b.id === 'full');
  assert.equal(full.chapters.length, 65);
  full.chapters.forEach((ch, i) => assert.equal(ch.n, i));
  for (let n = 1; n <= 64; n++) {
    const h = H[n - 1];
    const cues = full.chapters[n].cues;
    const head = cues.findIndex((c) => c.role === 'head');
    assert.equal(head, n === 31 ? 1 : 0, `#${n}: the name opens the chapter (after 下經由此開始 at 31)`);
    assert.equal(cues[head].text, `第${numZh(n)}卦，${h.full}。`);
    assert.equal(cues[head + 1].text, `序卦傳說：「${h.xugua.zh}」`);
    assert.equal(cues.filter((c) => c.role === 'read').map((c) => c.text).join(''), tidy(h.logicZh));
  }
  assert.ok(full.chapters[3].cues[1].text.includes('受之以屯'), '屯 is explained in chapter 3, not after 坤');
  for (const b of S.books)
    for (const ch of b.chapters)
      for (const c of ch.cues) {
        const tags = c.ssml.replace(/<phoneme alphabet="sapi" ph="[a-z]+ [1-5]">.<\/phoneme>/g, '');
        assert.ok(!/[<>]/.test(tags), `only phoneme tags in: ${c.ssml}`);
        assert.ok(c.pause >= 0);
      }
});

test('names scripts: the 64 headings in order, nothing else; the paused ones split number and name', () => {
  const names = S.books.find((b) => b.id === 'names');
  assert.deepEqual(
    names.chapters.map((ch) => ch.cues.map((c) => c.text).join('')),
    H.map((h) => `第${numZh(h.n)}卦，${h.full}。`),
  );
  const paused = S.books.filter((b) => b.group === 'names' && b.pause);
  assert.deepEqual(paused.map((b) => b.pause), [0.5, 1, 2, 3]);
  for (const b of paused) {
    assert.equal(b.gap, b.pause, `${b.id}: the same pause before the next hexagram`);
    b.chapters.forEach((ch, i) => {
      assert.deepEqual(ch.cues.map((c) => c.text), [`第${numZh(i + 1)}卦。`, `${H[i].full}。`]);
      assert.equal(ch.cues[0].pause, b.pause);
    });
  }
});

const manifestUrl = new URL('../app/data/audiobook.json', import.meta.url);
test('recordings: chapters and cues line up with the script', { skip: !existsSync(manifestUrl) && 'not recorded yet' }, () => {
  const M = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  assert.deepEqual(M.books.map((b) => b.id), S.books.map((b) => b.id));
  const current = createHash('sha256').update(scriptJson).digest('hex').slice(0, 10);
  const texts = (chs) => chs.map((ch) => ch.cues.map((c) => c.text));
  for (const B of M.books) {
    const mp3 = new URL(`../app/${B.audio.split('?')[0]}`, import.meta.url);
    assert.ok(existsSync(mp3), `${B.id}: mp3 exists`);
    assert.equal(statSync(mp3).size, B.bytes);
    let t = -1;
    for (const ch of B.chapters)
      for (const c of ch.cues) {
        assert.ok(c.start > t && c.end > c.start && c.end <= B.duration, `${B.id}: cue times increase: ${c.text}`);
        t = c.start;
      }
    // a recording of the current script carries exactly its text (build.mjs warns when it is out of date)
    if (M.script === current) assert.deepEqual(texts(B.chapters), texts(S.books.find((b) => b.id === B.id).chapters));
  }
  const [full, names] = M.books;
  const two = M.books.find((b) => b.id === 'names-2');
  const gap = two.chapters[5].cues[1].start - two.chapters[5].cues[0].end;
  assert.ok(gap > 1.9 && gap < 2.3, `names-2: about 2 s between number and name (${gap.toFixed(2)})`);
  assert.deepEqual(locate(full.chapters[24].start + 0.01, full), { chapter: 24, n: 24, cue: 0 });
  assert.deepEqual(locate(names.chapters[2].start + 0.01, names), { chapter: 2, n: 3, cue: 0 });
  assert.equal(locate(0, full).chapter, 0);
  // a range loop stops in the silence after its last hexagram, before the next one (or the closing words) begins
  for (const B of M.books)
    for (const [from, to] of [[3, 10], [1, 64], [64, 64]]) {
      const { start, stop } = span(B, from, to);
      const i = B.chapters.findIndex((c) => c.n === to);
      const said = B.chapters[i].cues.filter((c) => c.role !== 'outro');
      const next = B.chapters[i].cues.find((c) => c.role === 'outro')?.start ?? B.chapters[i + 1]?.start ?? B.duration;
      assert.equal(start, B.chapters.find((c) => c.n === from).start);
      assert.ok(stop > said.at(-1).end && stop < next, `${B.id} ${from}–${to}: stop ${stop} between ${said.at(-1).end} and ${next}`);
    }
});
