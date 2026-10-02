#!/usr/bin/env node
// Download the classical texts from Chinese Wikisource into content/sources/wikisource/.
// Walks the 周易 hexagram pages from 乾 by following each page's `next=` link, then fetches 序卦傳.
// Run once; the raw wikitext is committed so builds never depend on the network.
//   node scripts/fetch-sources.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'content', 'sources', 'wikisource');
mkdirSync(OUT, { recursive: true });

const UA = 'yijing-study-app/0.1 (https://github.com/ruoli2015/yijing)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function raw(title) {
  const url = `https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const text = await res.text();
    if (res.ok && !text.startsWith('<!DOCTYPE')) return text;
    await sleep(1500 * attempt);
  }
  throw new Error(`could not fetch ${title}`);
}

const names = [];
let name = process.argv.includes('--xugua-only') ? null : '乾';
while (name && names.length < 64) {
  const text = await raw(`周易/${name}`);
  names.push(name);
  writeFileSync(join(OUT, `${String(names.length).padStart(2, '0')}-${name}.wiki`), text);
  console.log(names.length, name);
  const next = text.match(/\|\s*next\s*=\s*\[\[\.\.\/([^|\]]+)/);
  name = next?.[1].trim();
  await sleep(400);
}
if (name !== null && names.length !== 64) throw new Error(`expected 64 hexagrams, got ${names.length}`);

writeFileSync(join(OUT, 'xugua.wiki'), await raw('易傳/序卦'));
console.log('序卦傳');
