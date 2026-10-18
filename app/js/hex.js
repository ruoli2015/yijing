// Pure helpers over the hexagram data: lookup, name normalization, search. No DOM, so tests can import it.

let DATA = null;
let BY_LINES = null;
let TRIGRAM = null;

export function setData(d) {
  DATA = d;
  BY_LINES = Object.fromEntries(d.hexagrams.map((h) => [h.lines, h]));
  TRIGRAM = Object.fromEntries(d.trigrams.map((t) => [t.name, t]));
}
export const data = () => DATA;
export const hex = (n) => DATA.hexagrams[n - 1];
export const all = () => DATA.hexagrams;
export const byLines = (lines) => BY_LINES[lines] || null;
export const trigram = (name) => TRIGRAM[name];
export const trigrams = () => DATA.trigrams;

const NUM_ZH = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
// 1 → 一, 31 → 三十一
export function numZh(n) {
  if (n < 10) return NUM_ZH[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return (t > 1 ? NUM_ZH[t] : '') + '十' + (u ? NUM_ZH[u] : '');
}

export const prevOf = (n) => (n > 1 ? n - 1 : null);
export const nextOf = (n) => (n < 64 ? n + 1 : null);

// Strip tone marks and spaces: "xiǎo chù" → "xiaochu"
export function plainPinyin(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ü/g, 'v').replace(/[\s'’-]+/g, '').toLowerCase();
}

// Convert simplified characters in typed input to traditional, drop spaces/punctuation.
export function normalizeZh(s, s2t = DATA?.s2t || {}) {
  return [...String(s).trim()].map((c) => s2t[c] || c).join('').replace(/[\s，。、：:,.]/g, '');
}

// Does a typed answer name hexagram h? Accepts the name, the full name (水雷屯), or toneless pinyin.
export function nameMatches(input, h, s2t) {
  const z = normalizeZh(input, s2t);
  if (!z) return false;
  if (z === h.name || z === h.full) return true;
  if (h.n === 29 && z === '習坎') return true;
  return plainPinyin(input) === plainPinyin(h.pinyin) && /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s'’-]+$/.test(input.trim());
}

// Free-text search over number, name, full name, pinyin and English name.
export function search(query, list = DATA.hexagrams, s2t) {
  const q = String(query || '').trim();
  if (!q) return list;
  if (/^\d{1,2}$/.test(q)) return list.filter((h) => h.n === Number(q));
  const z = normalizeZh(q, s2t);
  const p = plainPinyin(q);
  const lower = q.toLowerCase();
  const isLatin = /^[\x00-\x7fāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]+$/.test(q);
  return list.filter((h) => {
    if (!isLatin) return h.name.includes(z) || h.full.includes(z);
    return plainPinyin(h.pinyin).startsWith(p) || h.en.toLowerCase().includes(lower) || (h.enAlt || '').toLowerCase().includes(lower);
  });
}

// Pattern of 6 chars bottom→top, each '1', '0' or '?' (unknown).
export function matchPattern(pattern, list = DATA.hexagrams) {
  return list.filter((h) => [...pattern].every((c, i) => c === '?' || c === h.lines[i]));
}

export const relLabel = {
  zong: { zh: '綜卦（上下顛倒）', en: 'inverted pair' },
  cuo: { zh: '錯卦（陰陽全反）', en: 'complementary pair' },
  both: { zh: '綜卦，亦為錯卦', en: 'inverted and complementary pair' },
};

export const linkLabel = {
  承: { zh: '承', long: '因果相承', en: 'Consequence' },
  反: { zh: '反', long: '物極而反', en: 'Reversal' },
  補: { zh: '補', long: '補其不足', en: 'Remedy' },
  始: { zh: '始', long: '開端', en: 'Beginning' },
};

export const POS_NAMES = ['初', '二', '三', '四', '五', '上'];
