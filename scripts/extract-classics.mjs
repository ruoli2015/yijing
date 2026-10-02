#!/usr/bin/env node
// Parse the raw Wikisource wikitext (content/sources/wikisource/) into content/classics.json:
// 卦辭, 爻辭, 彖傳, 大象, 小象 for all 64 hexagrams, plus 序卦傳 split into its sentences.
// classics.json is committed and reviewed by hand; rerun this only when the sources change.
//   node scripts/extract-classics.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'content', 'sources', 'wikisource');

// Simplified or non-standard characters Wikisource has inside otherwise traditional text,
// and readings that differ from the received text (通行本: 《周易正義》王弼注 / 朱熹《周易本義》).
const FIXES = [
  ['剛柔济也', '剛柔際也'], // 坎六四小象
  ['内約', '內約'],
  ['不觌', '不覿'],
  ['得所愿也', '得所願也'],
  ['得愿也', '得願也'],
  ['中心愿也', '中心願也'],
  ['亦可丑也', '亦可醜也'],
  ['離群丑也', '離羣醜也'],
  ['密云不雨', '密雲不雨'],
  ['負涂', '負塗'],
  ['瓮敝漏', '甕敝漏'],
  ['系小子', '係小子'],
  ['系丈夫', '係丈夫'],
  ['拘系之', '拘係之'],
  ['系于金柅', '繫于金柅'],
  ['祀事遄往', '已事遄往'], // 損初九小象, to match the 爻辭 below
  ['同人于門，無咎', '同人于門，无咎'],
  ['同人于郊，無悔', '同人于郊，无悔'],
  ['自天佑也', '自天祐也'],
  ['自上佑也', '自上祐也'],
  ['天命不佑', '天命不祐'],
  ['何之矣？ ', '何之矣？'],
];

// {{另|main|alt}}: Wikisource's "main" reading is not always the received one. Each entry here
// picks the received reading: 'alt', or an explicit string when neither form is the received one.
// Unlisted variants keep "main".
const VARIANT_CHOICE = {
  '8比:敺': 'alt', // 王用三驅
  '9小畜:車': 'alt', // 輿說輻
  '9小畜:輹': 'alt',
  '9小畜:得': 'alt', // 尚德載
  '12否:包': 'alt', // 繫于苞桑
  '13同人:庸': 'alt', // 乘其墉
  '14大有:轝': 'alt', // 大車以載
  '14大有:尫': 'alt', // 匪其彭
  '14大有:佑': '祐', // 自天祐之
  '16豫:戠': 'alt', // 朋盍簪
  '21噬嗑:昔': '腊', // 噬腊肉
  '23剝:德車': 'alt', // 君子得輿
  '26大畜:告': 'alt', // 童牛之牿
  '29坎:尊酒簋，貳用缶。内約自牖': 'alt', // 樽酒簋貳，用缶，納約自牖
  '29坎:禔': 'alt', // 祗既平
  '30離:差': 'alt', // 大耋之嗟
  '32恆:震': 'alt', // 振恆
  '34大壯:轝': 'alt', // 壯于大輿之輹
  '34大壯:腹': 'alt',
  '35晉:矢': 'alt', // 失得勿恤
  '38睽:𧤊': 'alt', // 其牛掣
  '40解:惟': 'alt', // 君子維有解
  '41損:祀': 'alt', // 已事遄往
  '45萃:資': 'alt', // 齎咨涕洟
  '46升:享': 'alt', // 王用亨于岐山
  '47困:蔾': 'alt', // 據于蒺藜
  '47困:荼荼': 'alt', // 來徐徐
  '47困:轝': 'alt', // 困于金車
  '50鼎:刑': 'alt', // 其形渥
  '52艮:裂': 'alt', // 列其夤
  '52艮:閽': 'alt', // 厲薰心
  '52艮:孚': 'alt', // 言有序
  '56旅:僮': 'alt', // 童僕
  '61中孚:既': '幾', // 月幾望
};

const variants = []; // {{另|main|alt}} notes, kept for the record

function clean(s, where) {
  let t = s
    .replace(/<span[^>]*>/g, '')
    .replace(/<\/span>/g, '')
    .replace(/'''/g, '')
    .replace(/-\{([^}]*)\}-/g, '$1')
    .replace(/\{\{另\|([^|}]*)\|([^}]*)\}\}/g, (_, a, b) => {
      const choice = VARIANT_CHOICE[`${where}:${a}`];
      const chosen = choice === 'alt' ? b : choice || a;
      variants.push({ where, main: a, alt: b, chosen });
      return chosen;
    })
    .replace(/\{\{\*\|[^}]*\}\}/g, '')
    .replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/[\s　]+/g, '');
  for (const [a, b] of FIXES) t = t.replaceAll(a, b);
  if (/[{}[\]<>|]/.test(t)) throw new Error(`${where}: unparsed markup in "${t}"`);
  return t;
}

const LINE_RE = /^(初[九六]|[九六][二三四五]|上[九六]|用[九六])[：，:](.*)$/;

function parseHexagram(file) {
  const text = readFileSync(join(SRC, file), 'utf8').replace(/<span\s*\n\s*/g, '<span ');
  const num = Number(file.slice(0, 2));
  const name = file.slice(3, -5);
  const trig = text.match(/\]\]\s*(\S+?)下(\S+?)上/);
  const out = { num, name, lowerName: trig?.[1].replace(/-\{|\}-/g, ''), upperName: trig?.[2].replace(/-\{|\}-/g, ''), judgment: '', lines: [], tuan: '', daxiang: '', xiaoxiang: [] };

  let section = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('*')) continue;
    const head = line.match(/^\*+'''(.+?)'''\s*$/) || line.match(/^\*<span[^>]*>'''(.+?)'''<\/span>\s*$/);
    if (head) {
      const h = head[1];
      section = h.startsWith('易經') ? 'jing' : h.startsWith('彖') ? 'tuan' : h.startsWith('象') ? 'xiang' : h.startsWith('文言') ? 'wenyan' : 'other';
      continue;
    }
    if (line === '*:') continue;
    const m = line.match(/^(\*+#?)(.*)$/);
    const level = m[1];
    const body = clean(m[2], `${num}${name}`);
    if (!body) continue;
    const isItem = level.endsWith('#');
    if (section === 'jing') {
      if (isItem) {
        const lm = body.match(LINE_RE);
        if (!lm) throw new Error(`${num}${name}: bad line "${body}"`);
        out.lines.push({ pos: lm[1], text: lm[2] });
      } else {
        // first line looks like「屯：元亨…」(name, sometimes 習坎); continuation lines are appended
        const jm = !out.judgment && body.match(/^([^：]{1,3})：(.*)$/);
        out.judgment += jm ? jm[2] : body;
        if (jm) out.judgmentLabel = jm[1];
      }
    } else if (section === 'tuan') {
      out.tuan += body;
    } else if (section === 'xiang') {
      if (isItem) out.xiaoxiang.push(body);
      else out.daxiang += body;
    }
  }
  return out;
}

const files = readdirSync(SRC).filter((f) => /^\d\d-.+\.wiki$/.test(f)).sort();
const hexagrams = files.map(parseHexagram);

// 序卦傳: one sentence per line, grouped into 上篇 / 下篇
const xuguaRaw = readFileSync(join(SRC, 'xugua.wiki'), 'utf8');
const xugua = { upper: [], lower: [] };
let part = null;
for (const line of xuguaRaw.split('\n')) {
  if (line.startsWith('==上篇')) part = 'upper';
  else if (line.startsWith('==下篇')) part = 'lower';
  else if (part && line.startsWith(':')) xugua[part].push(clean(line.slice(1), '序卦').replace(/；\s+/g, '；'));
}

const problems = [];
for (const h of hexagrams) {
  const expected = h.num === 1 || h.num === 2 ? 7 : 6;
  if (h.lines.length !== expected) problems.push(`${h.num}${h.name}: ${h.lines.length} lines`);
  if (h.xiaoxiang.length !== expected) problems.push(`${h.num}${h.name}: ${h.xiaoxiang.length} 小象`);
  if (!h.judgment || !h.tuan || !h.daxiang) problems.push(`${h.num}${h.name}: missing judgment/tuan/daxiang`);
  if (!h.lowerName || !h.upperName) problems.push(`${h.num}${h.name}: no trigram names`);
}
if (xugua.upper.length !== 29 || xugua.lower.length !== 34) problems.push(`序卦: ${xugua.upper.length}+${xugua.lower.length} sentences`);
if (problems.length) {
  problems.forEach((p) => console.error('✗', p));
  process.exit(1);
}

writeFileSync(join(ROOT, 'content', 'classics.json'), JSON.stringify({ source: 'zh.wikisource.org 周易 / 易傳·序卦', variants, hexagrams, xugua }, null, 1) + '\n');
console.log(`✓ ${hexagrams.length} hexagrams, ${xugua.upper.length + xugua.lower.length} 序卦 sentences, ${variants.length} variant notes`);
