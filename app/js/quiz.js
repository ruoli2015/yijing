// Quiz logic: which hexagram to ask next, multiple-choice options, and stat updates. Pure, no DOM.

export const MAX_BOX = 5;
// Lower boxes (shaky or new) come up much more often.
const BOX_WEIGHT = [10, 6, 4, 2.5, 1.5, 1];
const NEW_WEIGHT = 5;

export const RANGES = {
  all: { zh: '全部', en: 'All', test: () => true },
  upper: { zh: '上經', en: 'Upper', test: (n) => n <= 30 },
  lower: { zh: '下經', en: 'Lower', test: (n) => n > 30 },
  r1: { zh: '1–16', en: '', test: (n) => n <= 16 },
  r2: { zh: '17–32', en: '', test: (n) => n > 16 && n <= 32 },
  r3: { zh: '33–48', en: '', test: (n) => n > 32 && n <= 48 },
  r4: { zh: '49–64', en: '', test: (n) => n > 48 },
  weak: { zh: '弱項', en: 'Weak', test: null },
};

export function pool(rangeKey, stats = {}) {
  const nums = Array.from({ length: 64 }, (_, i) => i + 1);
  if (rangeKey === 'weak') {
    const weak = nums.filter((n) => stats[n] && (stats[n].box ?? 0) < 2);
    return weak.length >= 4 ? weak : nums.filter((n) => !stats[n] || (stats[n].box ?? 0) < 3);
  }
  const r = RANGES[rangeKey] || RANGES.all;
  return nums.filter(r.test);
}

// Weighted random pick, avoiding the most recent items when possible.
export function pickNext(nums, stats = {}, recent = [], rng = Math.random) {
  const candidates = nums.length > recent.length + 1 ? nums.filter((n) => !recent.includes(n)) : nums;
  const weights = candidates.map((n) => (stats[n] ? BOX_WEIGHT[Math.min(stats[n].box ?? 0, MAX_BOX)] : NEW_WEIGHT));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Distractors that are actually confusable: sequence neighbours, the pair partner, shared trigrams.
export function nameOptions(target, hexagrams, rng = Math.random, count = 4) {
  const t = hexagrams[target - 1];
  const near = [target - 2, target - 1, target + 1, target + 2, t.pair.n, t.zong, t.cuo]
    .filter((n) => n >= 1 && n <= 64 && n !== target);
  const sameTri = hexagrams.filter((h) => h.n !== target && (h.upper === t.upper || h.lower === t.lower)).map((h) => h.n);
  const picks = new Set();
  for (const n of shuffle([...new Set(near)], rng)) if (picks.size < 2) picks.add(n);
  for (const n of shuffle(sameTri, rng)) if (picks.size < count - 1) picks.add(n);
  while (picks.size < count - 1) {
    const n = 1 + Math.floor(rng() * 64);
    if (n !== target) picks.add(n);
  }
  return shuffle([target, ...picks], rng);
}

// Options for "which hexagram comes before/after": weighted toward hexagrams near the right answer.
export function orderOptions(answer, exclude, hexagrams, rng = Math.random, count = 4) {
  const near = [answer - 2, answer - 1, answer + 1, answer + 2, answer + 3, answer - 3, hexagrams[answer - 1].pair.n]
    .filter((n) => n >= 1 && n <= 64 && n !== answer && n !== exclude);
  const picks = new Set(shuffle([...new Set(near)], rng).slice(0, count - 1));
  while (picks.size < count - 1) {
    const n = 1 + Math.floor(rng() * 64);
    if (n !== answer && n !== exclude) picks.add(n);
  }
  return shuffle([answer, ...picks], rng);
}

export function numberOptions(answer, rng = Math.random, count = 4) {
  const picks = new Set();
  const offsets = shuffle([-10, -8, -6, -4, -3, -2, -1, 1, 2, 3, 4, 6, 8, 10, 20, -20], rng);
  for (const o of offsets) {
    const n = answer + o;
    if (n >= 1 && n <= 64 && picks.size < count - 1) picks.add(n);
  }
  return shuffle([answer, ...picks], rng);
}

// Leitner update: all parts right → up one box; anything wrong → back to box 0.
export function updateStat(stat, allRight, now = Date.now()) {
  const s = { seen: 0, right: 0, box: 0, ...(stat || {}) };
  s.seen += 1;
  if (allRight) {
    s.right += 1;
    s.box = Math.min(MAX_BOX, s.box + 1);
  } else {
    s.box = 0;
  }
  s.last = now;
  return s;
}

// 0 new · 1 learning · 2 familiar · 3 mastered
export function level(stat) {
  if (!stat) return 0;
  if (stat.box >= 4) return 3;
  if (stat.box >= 2) return 2;
  return 1;
}
