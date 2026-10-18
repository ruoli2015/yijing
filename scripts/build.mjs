#!/usr/bin/env node
// Merge content/classics.json + content/hexagrams/*.yaml + content/order.yaml into app/data/yijing.json,
// validate everything, and stamp the service worker.
//   node scripts/build.mjs          build
//   node scripts/build.mjs --check  validate only
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import * as OpenCC from 'opencc-js';
import { makeScript, scriptMarkdown } from './audiobook/script.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const APP = join(ROOT, 'app');
const checkOnly = process.argv.includes('--check');

const errors = [];
const err = (m) => errors.push(m);

// ---------- trigrams (lines bottom → top, 1 = yang) ----------
const TRIGRAMS = [
  { name: '乾', lines: '111', image: '天', imageEn: 'Heaven', family: '父', familyEn: 'father', virtue: '健', virtueEn: 'strong', pinyin: 'qián', symbol: '☰' },
  { name: '兌', lines: '110', image: '澤', imageEn: 'Lake', family: '少女', familyEn: 'youngest daughter', virtue: '說', virtueEn: 'joyous', pinyin: 'duì', symbol: '☱' },
  { name: '離', lines: '101', image: '火', imageEn: 'Fire', family: '中女', familyEn: 'middle daughter', virtue: '麗', virtueEn: 'clinging', pinyin: 'lí', symbol: '☲' },
  { name: '震', lines: '100', image: '雷', imageEn: 'Thunder', family: '長男', familyEn: 'eldest son', virtue: '動', virtueEn: 'arousing', pinyin: 'zhèn', symbol: '☳' },
  { name: '巽', lines: '011', image: '風', imageEn: 'Wind', family: '長女', familyEn: 'eldest daughter', virtue: '入', virtueEn: 'penetrating', pinyin: 'xùn', symbol: '☴' },
  { name: '坎', lines: '010', image: '水', imageEn: 'Water', family: '中男', familyEn: 'middle son', virtue: '陷', virtueEn: 'dangerous', pinyin: 'kǎn', symbol: '☵' },
  { name: '艮', lines: '001', image: '山', imageEn: 'Mountain', family: '少男', familyEn: 'youngest son', virtue: '止', virtueEn: 'still', pinyin: 'gèn', symbol: '☶' },
  { name: '坤', lines: '000', image: '地', imageEn: 'Earth', family: '母', familyEn: 'mother', virtue: '順', virtueEn: 'yielding', pinyin: 'kūn', symbol: '☷' },
];
const trigramByName = Object.fromEntries(TRIGRAMS.map((t) => [t.name, t]));

// Independent record of the King Wen sequence (bottom → top), checked against the Wikisource trigram labels.
const KING_WEN = (
  '111111 000000 100010 010001 111010 010111 010000 000010 111011 110111 111000 000111 101111 111101 001000 000100 ' +
  '100110 011001 110000 000011 100101 101001 000001 100000 100111 111001 100001 011110 010010 101101 001110 011100 ' +
  '001111 111100 000101 101000 101011 110101 001010 010100 110001 100011 111110 011111 000110 011000 010110 011010 ' +
  '101110 011101 100100 001001 001011 110100 101100 001101 011011 110110 010011 110010 110011 001100 101010 010101'
).split(' ');

// ---------- load ----------
const classics = JSON.parse(readFileSync(join(CONTENT, 'classics.json'), 'utf8'));
const authored = readdirSync(join(CONTENT, 'hexagrams'))
  .filter((f) => f.endsWith('.yaml'))
  .sort()
  .flatMap((f) => parse(readFileSync(join(CONTENT, 'hexagrams', f), 'utf8')).map((h) => ({ ...h, _file: f })));
const order = parse(readFileSync(join(CONTENT, 'order.yaml'), 'utf8'));

// ---------- validate authored content ----------
const LINKS = ['承', '反', '補', '始'];
const REQUIRED = ['num', 'name', 'pinyin', 'en', 'gist_zh', 'gist_en', 'link', 'xugua_en', 'logic_zh', 'logic_en'];
if (authored.length !== 64) err(`expected 64 authored hexagrams, got ${authored.length}`);
authored.forEach((a, i) => {
  const where = `${a._file} #${a.num}`;
  if (a.num !== i + 1) err(`${where}: out of order (expected ${i + 1})`);
  for (const k of REQUIRED) if (!a[k] || typeof a[k] !== 'string' && k !== 'num') err(`${where}: missing ${k}`);
  if (!LINKS.includes(a.link)) err(`${where}: link must be one of ${LINKS.join(' ')}`);
  const c = classics.hexagrams[i];
  if (c && a.name !== c.name) err(`${where}: name ${a.name} ≠ classics ${c.name}`);
});

// ---------- 序卦傳 sentence for each hexagram ----------
function xuguaFor(n) {
  if (n <= 2) return classics.xugua.upper[0];
  if (n <= 30) return classics.xugua.upper[n - 2];
  return classics.xugua.lower[n - 31];
}

// ---------- assemble ----------
const reverse = (s) => [...s].reverse().join('');
const invert = (s) => [...s].map((b) => (b === '1' ? '0' : '1')).join('');

const hexagrams = classics.hexagrams.map((c, i) => {
  const n = i + 1;
  const a = authored[i] || {};
  const lower = trigramByName[c.lowerName];
  const upper = trigramByName[c.upperName];
  if (!lower || !upper) err(`#${n}: unknown trigram ${c.lowerName}/${c.upperName}`);
  const lines = (lower?.lines || '???') + (upper?.lines || '???');
  if (lines !== KING_WEN[i]) err(`#${n} ${c.name}: lines ${lines} from Wikisource ≠ King Wen record ${KING_WEN[i]}`);
  const full = lower === upper ? `${upper.name}為${upper.image}` : `${upper?.image}${lower?.image}${c.name}`;
  const xg = xuguaFor(n);
  if (n > 2 && n !== 31 && !xg.includes(c.name.slice(-1))) err(`#${n} ${c.name}: 序卦 sentence does not mention it: ${xg}`);
  if (xg.length < 4) err(`#${n}: missing 序卦 sentence`);
  return {
    n,
    name: c.name,
    pinyin: a.pinyin,
    en: a.en,
    enAlt: a.en_alt || null,
    gistZh: a.gist_zh,
    gistEn: a.gist_en,
    link: a.link,
    lines,
    lower: lower?.name,
    upper: upper?.name,
    full,
    canon: n <= 30 ? 'upper' : 'lower',
    judgmentLabel: c.judgmentLabel || null,
    judgment: c.judgment,
    tuan: c.tuan,
    daxiang: c.daxiang,
    yao: c.lines.map((l, j) => ({ pos: l.pos, text: l.text, xiang: c.xiaoxiang[j] })),
    xugua: { zh: xg, en: a.xugua_en?.trim() },
    logicZh: a.logic_zh?.trim(),
    logicEn: a.logic_en?.trim(),
  };
});

const byLines = Object.fromEntries(hexagrams.map((h) => [h.lines, h.n]));
if (Object.keys(byLines).length !== 64) err('line patterns are not unique');
for (const h of hexagrams) {
  h.zong = byLines[reverse(h.lines)];
  h.cuo = byLines[invert(h.lines)];
  const partner = h.n % 2 ? h.n + 1 : h.n - 1;
  const p = hexagrams[partner - 1];
  const isZong = reverse(h.lines) === p.lines && reverse(h.lines) !== h.lines;
  const isCuo = invert(h.lines) === p.lines;
  if (!isZong && !isCuo) err(`#${h.n}: pair rule 非覆即變 broken with #${partner}`);
  h.pair = { n: partner, rel: isZong && isCuo ? 'both' : isZong ? 'zong' : 'cuo' };
}

// stages must cover 1..64 contiguously
let next = 1;
order.stages.forEach((s, i) => {
  if (s.range[0] !== next) err(`order.yaml stage ${i + 1}: starts at ${s.range[0]}, expected ${next}`);
  next = s.range[1] + 1;
  for (let n = s.range[0]; n <= s.range[1]; n++) if (hexagrams[n - 1]) hexagrams[n - 1].stage = i;
});
if (next !== 65) err(`order.yaml stages end at ${next - 1}, expected 64`);

// the rhyme must name all 64 in order
{
  let rest = order.song.lines.join('');
  for (const h of hexagrams) {
    const at = rest.indexOf(h.name);
    if (at < 0) err(`卦序歌: ${h.name} (#${h.n}) not found in order`);
    else rest = rest.slice(at + h.name.length);
  }
}

if (errors.length) {
  errors.forEach((e) => console.error('✗', e));
  console.error(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log(`✓ 64 hexagrams, ${order.stages.length} stages, ${order.essays.length} essays`);
if (checkOnly) process.exit(0);

// ---------- simplified → traditional map, so typed answers in simplified characters are accepted ----------
const toSimp = OpenCC.Converter({ from: 'tw', to: 'cn' });
const s2t = {};
for (const h of hexagrams) {
  for (const ch of h.name + h.full) {
    const s = toSimp(ch);
    if (s !== ch && s.length === 1) s2t[s] = ch;
  }
}

// ---------- write ----------
const essays = order.essays.map((e) => ({ id: e.id, titleZh: e.title_zh, titleEn: e.title_en, bodyZh: e.body_zh.trim(), bodyEn: e.body_en.trim() }));
const stages = order.stages.map((s) => ({ from: s.range[0], to: s.range[1], titleZh: s.title_zh, titleEn: s.title_en, summaryZh: s.summary_zh, summaryEn: s.summary_en }));
const song = { titleZh: order.song.title_zh, titleEn: order.song.title_en, sourceZh: order.song.source_zh, lines: order.song.lines };
const body = { trigrams: TRIGRAMS, hexagrams, essays, stages, song, s2t };
const version = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 10);
writeFileSync(join(APP, 'data', 'yijing.json'), JSON.stringify({ version, ...body }));
console.log(`✓ wrote app/data/yijing.json (version ${version})`);

// ---------- audiobook script (recorded separately by scripts/audiobook/make.py) ----------
{
  const book = parse(readFileSync(join(CONTENT, 'audiobook.yaml'), 'utf8'));
  const script = makeScript(hexagrams, book);
  const json = JSON.stringify(script, null, 1);
  writeFileSync(join(CONTENT, 'audiobook', 'script.json'), json);
  writeFileSync(join(CONTENT, 'audiobook', 'script.md'), scriptMarkdown(script, hexagrams));
  const scriptHash = createHash('sha256').update(json).digest('hex').slice(0, 10);
  let recorded = null;
  try {
    recorded = JSON.parse(readFileSync(join(APP, 'data', 'audiobook.json'), 'utf8')).script;
  } catch {}
  const books = script.books.map((b) => `${b.id}: ${b.chapters.length} chapters, ${b.chapters.reduce((k, c) => k + c.cues.length, 0)} cues`);
  console.log(`✓ wrote content/audiobook/script.json (${books.join('; ')}; script ${scriptHash})`);
  if (recorded !== scriptHash)
    console.warn(`⚠ the audiobook was recorded from script ${recorded ?? '(none)'}; re-record with: ~/.cache/sbt-tts/env/bin/python scripts/audiobook/make.py`);
}

// ---------- service worker: precache list + version stamp ----------
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(APP)
  .map((p) => relative(APP, p).split('\\').join('/'))
  .filter((p) => p !== 'sw.js' && !p.endsWith('.DS_Store') && !p.startsWith('audio/')) // audio streams from the network
  .sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(APP, f)));
const swVersion = hash.digest('hex').slice(0, 10);
const swPath = join(APP, 'sw.js');
const sw = readFileSync(swPath, 'utf8')
  .replace(/const VERSION = '.*?';/, `const VERSION = '${swVersion}';`)
  .replace(/const FILES = \[[\s\S]*?\];/, `const FILES = ${JSON.stringify(['./', ...files], null, 2)};`);
writeFileSync(swPath, sw);
console.log(`✓ stamped sw.js (version ${swVersion}, ${files.length} files)`);
