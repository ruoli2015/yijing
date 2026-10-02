// Three-coin divination (火珠林 convention) and Zhu Xi's rules for which texts to read. Pure, no DOM.
//   Each coin: 字 (inscribed side) = 2, 背 (plain side) = 3.
//   Sum of three: 6 老陰 (changing yin) · 7 少陽 · 8 少陰 · 9 老陽 (changing yang).

export function randomInt(max) {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function tossCoins(rand = randomInt) {
  const coins = [0, 1, 2].map(() => (rand(2) ? 3 : 2));
  return { coins, value: coins[0] + coins[1] + coins[2] };
}

export const VALUE_INFO = {
  6: { zh: '老陰', en: 'old yin (changing)', yang: false, changing: true },
  7: { zh: '少陽', en: 'young yang', yang: true, changing: false },
  8: { zh: '少陰', en: 'young yin', yang: false, changing: false },
  9: { zh: '老陽', en: 'old yang (changing)', yang: true, changing: true },
};

// values: six numbers bottom → top
export function castResult(values) {
  const primary = values.map((v) => (v === 7 || v === 9 ? '1' : '0')).join('');
  const changing = values.map((v, i) => (v === 6 || v === 9 ? i : -1)).filter((i) => i >= 0);
  const relating = changing.length
    ? values.map((v) => (v === 9 ? '0' : v === 6 ? '1' : v === 7 ? '1' : '0')).join('')
    : null;
  return { primary, relating, changing };
}

// Zhu Xi, 《易學啟蒙·考變占》. Returns which texts to read, the main one first.
//   focus items: { hex: 'primary'|'relating', kind: 'judgment'|'line'|'use', line?: index }
export function readingPlan({ primary, relating, changing }) {
  const k = changing.length;
  const unchanged = [0, 1, 2, 3, 4, 5].filter((i) => !changing.includes(i));
  switch (k) {
    case 0:
      return {
        focus: [{ hex: 'primary', kind: 'judgment' }],
        zh: '六爻皆不變：占本卦卦辭。',
        en: 'No changing lines: read the judgment of the primary hexagram.',
      };
    case 1:
      return {
        focus: [{ hex: 'primary', kind: 'line', line: changing[0] }],
        zh: '一爻變：以本卦變爻之辭占。',
        en: 'One changing line: read that line of the primary hexagram.',
      };
    case 2:
      return {
        focus: [
          { hex: 'primary', kind: 'line', line: changing[1] },
          { hex: 'primary', kind: 'line', line: changing[0] },
        ],
        zh: '二爻變：以本卦二變爻之辭占，以上爻為主。',
        en: 'Two changing lines: read both lines of the primary hexagram; the upper one is primary.',
      };
    case 3:
      return {
        focus: [
          { hex: 'primary', kind: 'judgment' },
          { hex: 'relating', kind: 'judgment' },
        ],
        zh: '三爻變：占本卦及之卦之卦辭，以本卦為貞（主），之卦為悔（輔）。',
        en: 'Three changing lines: read the judgments of both hexagrams; the primary one is the main reading, the resulting one the outcome.',
      };
    case 4:
      return {
        focus: [
          { hex: 'relating', kind: 'line', line: unchanged[0] },
          { hex: 'relating', kind: 'line', line: unchanged[1] },
        ],
        zh: '四爻變：以之卦二不變爻占，以下爻為主。',
        en: 'Four changing lines: read the two unchanging lines in the resulting hexagram; the lower one is primary.',
      };
    case 5:
      return {
        focus: [{ hex: 'relating', kind: 'line', line: unchanged[0] }],
        zh: '五爻變：以之卦不變爻占。',
        en: 'Five changing lines: read the one unchanging line in the resulting hexagram.',
      };
    default:
      if (primary === '111111')
        return { focus: [{ hex: 'primary', kind: 'use' }], zh: '六爻皆變，乾占「用九」。', en: 'All six lines change from Qian: read "using nines" (用九).' };
      if (primary === '000000')
        return { focus: [{ hex: 'primary', kind: 'use' }], zh: '六爻皆變，坤占「用六」。', en: 'All six lines change from Kun: read "using sixes" (用六).' };
      return {
        focus: [{ hex: 'relating', kind: 'judgment' }],
        zh: '六爻皆變：占之卦卦辭。',
        en: 'All six lines change: read the judgment of the resulting hexagram.',
      };
  }
}
