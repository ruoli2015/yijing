// The audiobook script, built from the hexagram data and content/audiobook.yaml. No classical text is
// typed here: the 序卦 sentences and modern readings come straight from the built hexagrams.
//
// Two books. full — chapter n (1–64): 第n卦，<full>。 → 序卦傳說：「<sentence of n>」 → <logic of n>, i.e. how
// hexagram n follows n-1; the next chapter then opens with the next name. names — just 第n卦，<full>。 × 64.
// Every cue is one recorded clip: { role, text (shown), ssml (spoken), pause (seconds of silence after) }.
import { numZh } from '../../app/js/hex.js';

const PAUSE = { intro: 0.4, head: 0.9, quote: 1.0, read: 0.35, canon: 0.6, outro: 0.4 };
const LAST = { intro: 1.2, read: 0.9 }; // after the last sentence of a block

// Remove the spaces YAML folding leaves between Chinese characters.
export const tidy = (s) => s.trim().replace(/\s*\n\s*/g, ' ').replace(/(?<=[^\x00-\x7f])\s+|\s+(?=[^\x00-\x7f])/g, '');

// Split at 。！？ outside quotes and brackets (a full stop inside 「…。」 ends a sentence only with its quote).
export function sentences(text) {
  const out = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    cur += ch;
    if ('「『（'.includes(ch)) depth++;
    else if ('」』）'.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && (/[。！？]$/.test(cur) || /[。！？][」』）]$/.test(cur))) {
      out.push(cur);
      cur = '';
    }
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

// "zhūn" → "zhun 1" (Microsoft SAPI phone set for zh-CN; ü is written v, the neutral tone 5)
const TONES = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
export function sapi(syllable) {
  let tone = 5;
  let base = '';
  for (const c of syllable.normalize('NFD')) {
    if (TONES[c]) tone = TONES[c];
    else if (c === '̈') base = base.replace(/u$/, 'v');
    else base += c;
  }
  return `${base.toLowerCase()} ${tone}`;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Pronunciation rules from audiobook.yaml → { everywhere, classical } lists of { re, say[] }.
export function compileRules(pronounce) {
  const rules = { everywhere: [], classical: [] };
  for (const r of pronounce) {
    const where = r.where || 'everywhere';
    if (!rules[where]) throw new Error(`pronounce ${r.match}: where must be everywhere or classical`);
    rules[where].push({ re: new RegExp(r.match, 'g'), say: String(r.say).split(/\s+/), src: r.match });
  }
  return rules;
}

// Readings for each character of `text` (sparse array of pinyin syllables). Earlier rules win.
export function readings(text, ruleLists, preset = []) {
  const say = [...preset];
  for (const rules of ruleLists) {
    for (const r of rules) {
      for (const m of text.matchAll(r.re)) {
        if (m[0].length !== r.say.length) throw new Error(`pronounce ${r.src}: matched "${m[0]}" but has ${r.say.length} syllable(s)`);
        r.say.forEach((s, k) => (say[m.index + k] ??= s));
      }
    }
  }
  return say;
}

// Spoken form: marks the voice would read badly become pauses, then pinned readings become <phoneme>.
function spoken(text, say) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (say[i]) out += `<phoneme alphabet="sapi" ph="${sapi(say[i])}">${esc(ch)}</phoneme>`;
    else if (ch === '→') out += '、';
    else if (ch === '—' || ch === '…') out += text[i - 1] === ch ? '' : '，';
    else out += esc(ch);
  }
  return out.replace(/，(?=[，。、」])/g, '');
}

export function makeScript(hexagrams, book) {
  const rules = compileRules(book.pronounce || []);
  const H = (n) => hexagrams[n - 1];

  // Pin each hexagram name to the app's pinyin wherever this script itself names a hexagram.
  const named = (text, n) => {
    const h = H(n);
    const at = text.lastIndexOf(h.name);
    const syl = h.pinyin.split(/\s+/);
    const preset = [];
    if (at >= 0 && syl.length === h.name.length) syl.forEach((s, k) => !/ü|ǖ|ǘ|ǚ|ǜ/.test(s) && (preset[at + k] = s));
    return preset;
  };
  const cue = (role, text, { preset = [], classical = false, en } = {}) => {
    const say = readings(text, classical ? [rules.classical, rules.everywhere] : [rules.everywhere], preset);
    return { role, text, ssml: spoken(text, say), pause: PAUSE[role], ...(en ? { en } : {}) };
  };
  const block = (role, text, opts) => {
    const cues = sentences(tidy(text)).map((s) => cue(role, s, opts));
    if (LAST[role]) cues[cues.length - 1].pause = LAST[role];
    return cues;
  };
  const title = (n) => `第${numZh(n)}卦，${H(n).full}。`;

  const head = (n) => cue('head', title(n), { preset: named(title(n), n) });

  const chapters = [{ n: 0, cues: block('intro', book.intro_zh) }];
  for (let n = 1; n <= 64; n++) {
    const h = H(n);
    const cues = n === 31 ? [cue('canon', tidy(book.lower_start_zh), { en: book.lower_start_en })] : [];
    cues.push(head(n));
    // Only the quoted sentence is classical; the lead-in 序卦傳說 is modern speech.
    const lead = '序卦傳說：「';
    const quote = `${lead}${h.xugua.zh}」`;
    const preset = [];
    readings(h.xugua.zh, [rules.classical]).forEach((s, i) => (preset[lead.length + i] = s));
    const say = readings(quote, [rules.everywhere], preset);
    cues.push({ role: 'quote', text: quote, ssml: spoken(quote, say), pause: PAUSE.quote });
    cues.push(...block('read', h.logicZh));
    if (n === 30) cues.push(cue('canon', tidy(book.upper_end_zh), { en: book.upper_end_en }));
    if (n === 64) cues.push(...block('outro', book.outro_zh));
    cues[cues.length - 1].pause = 0;
    chapters.push({ n, cues });
  }
  const names = Array.from({ length: 64 }, (_, i) => ({ n: i + 1, cues: [{ ...head(i + 1), pause: 0 }] }));
  return {
    books: [
      { id: 'full', titleZh: book.title_zh, titleEn: book.title_en, introEn: tidy(book.intro_en), outroEn: tidy(book.outro_en), gap: 2.0, chapters },
      { id: 'names', titleZh: book.names_title_zh, titleEn: book.names_title_en, gap: 0.8, chapters: names },
    ],
  };
}

// The script as Markdown, for reading and review.
export function scriptMarkdown(script, hexagrams) {
  const [full, names] = script.books;
  const lines = [`# ${full.titleZh} · ${full.titleEn}`, '', '<!-- Generated by scripts/build.mjs from content/audiobook.yaml and the hexagram data. Do not edit. -->', ''];
  lines.push(`Also recorded: **${names.titleZh} · ${names.titleEn}**, the chapter headings alone.`, '');
  for (const ch of full.chapters) {
    lines.push(ch.n === 0 ? '## 開場 Introduction' : `## ${ch.n} ${hexagrams[ch.n - 1].full}`, '');
    let prev = null;
    for (const c of ch.cues) {
      if (prev && prev !== c.role) lines.push('');
      const t = c.role === 'head' ? `**${c.text}**` : c.role === 'quote' ? `> ${c.text}` : c.text;
      lines.push(prev === c.role && (c.role === 'read' || c.role === 'intro' || c.role === 'outro') ? lines.pop() + t : t);
      prev = c.role;
    }
    lines.push('');
  }
  return lines.join('\n');
}
