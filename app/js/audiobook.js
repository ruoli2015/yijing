// The audiobook player: one <audio> element for the whole app, so listening continues while you browse.
// data/audiobook.json holds two books: 'full' (chapter 0 is the introduction, then hexagrams 1–64) and 'names'
// (hexagrams 1–64, names only). state.chapter is an index into the current book; state.n is its hexagram.
// The position in each book is remembered. A range loop (state.range) repeats hexagrams from…to in either book.
// Recordings downloaded for offline listening are kept in the AUDIO_CACHE; sw.js plays them from there.
import { hex, numZh } from './hex.js';

const POS_KEY = 'yijing.audiobook';
const AUDIO_CACHE = 'yj-audio'; // the same name as in sw.js
export const RATES = [0.5, 0.8, 1, 1.25, 1.5];

let all = null; // the manifest
let book = null; // the book being played
let positions = {}; // book id → seconds
let last = {}; // group → the book last played in it (which pause length)
let loading = null;
let pendingSeek = null;
let lastSaved = 0;
const audio = globalThis.Audio ? new Audio() : null; // null under Node, where the tests import locate()
if (audio) audio.preload = 'none';

let state = { ready: false, started: false, playing: false, waiting: false, book: 'full', t: 0, chapter: 0, n: 0, cue: -1, rate: 1, repeat: false, error: null,
  range: { on: false, from: 1, to: 64 }, saved: {}, savedOld: false, dl: null, dlError: null };
const subs = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};

export const get = () => state;
export const manifest = () => all;
export const current = () => book;
export const lastOf = (group) => last[group];
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function readPos() {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY)) || {};
  } catch {
    return {};
  }
}
function savePos() {
  try {
    positions[state.book] = Math.round(state.t);
    localStorage.setItem(POS_KEY, JSON.stringify({ book: state.book, positions, last, rate: state.rate, repeat: state.repeat, range: state.range }));
  } catch {
    /* private mode */
  }
}

// Which chapter and cue are playing at time t.
export function locate(t, b = book) {
  const cs = b.chapters;
  let i = 0;
  while (i + 1 < cs.length && cs[i + 1].start <= t) i++;
  const cues = cs[i].cues;
  let k = -1;
  while (k + 1 < cues.length && cues[k + 1].start <= t + 0.05) k++;
  return { chapter: i, n: cs[i].n, cue: k };
}

// The part of book b a range loop plays: from the start of hexagram `from` until just after the last words of
// hexagram `to` (in the full book, before the closing words that follow 64).
export function span(b, from, to) {
  const cs = b.chapters;
  const last = cs.find((c) => c.n === to);
  const outro = last.cues.find((c) => c.role === 'outro');
  const said = last.cues.filter((c) => c.role !== 'outro').at(-1).end;
  const next = cs[cs.indexOf(last) + 1];
  const boundary = outro ? outro.start : next ? next.start : b.duration;
  return { start: cs.find((c) => c.n === from).start, stop: Math.max(said + 0.05, boundary - 0.3) };
}
const chapterOf = (n) => book.chapters.findIndex((c) => c.n === n);
const inRange = () => state.n >= state.range.from && state.n <= state.range.to;
// With a range loop on, the whole-book repeat waits.
const applyLoop = () => audio && (audio.loop = state.repeat && !state.range.on);
// Downloaded recordings get ?offline, which tells sw.js to serve them from the AUDIO_CACHE.
const src = (b) => (state.saved[b.id] ? `${b.audio}${b.audio.includes('?') ? '&' : '?'}offline` : b.audio);

// Point the audio element at the current book, at time t.
function point(t) {
  audio.src = src(book);
  audio.defaultPlaybackRate = audio.playbackRate = state.rate; // loading a source resets playbackRate to the default
  pendingSeek = t || null;
}

// Point the audio element at book `id`, at its remembered position.
function useBook(id) {
  book = all.books.find((b) => b.id === id) || all.books[0];
  if (book.group) last[book.group] = book.id;
  const t = Math.min(positions[book.id] || 0, book.duration - 1);
  point(t);
  set({ book: book.id, t, ...locate(t) });
}

export function load() {
  loading ??= fetch('data/audiobook.json')
    .then((r) => {
      if (!r.ok) throw new Error(`audiobook.json ${r.status}`);
      return r.json();
    })
    .then(async (m) => {
      all = m;
      await checkSaved();
      const saved = readPos();
      positions = saved.positions || { full: saved.t || 0 };
      last = saved.last || {};
      state.rate = RATES.includes(saved.rate) ? saved.rate : 1;
      state.repeat = saved.repeat === true;
      const r = saved.range;
      if (r && r.from >= 1 && r.from <= r.to && r.to <= 64) state.range = { on: r.on === true, from: r.from, to: r.to };
      applyLoop();
      useBook(saved.book || 'full');
      set({ ready: true });
      return m;
    })
    .catch((e) => {
      loading = null;
      set({ error: e.message });
      throw e;
    });
  return loading;
}

// play() must run inside the tap on iOS, so callers load() first (on mount) and play synchronously.
export function play() {
  if (!book) return;
  set({ started: true, error: null });
  audio.play().catch((e) => {
    if (e.name !== 'AbortError') set({ error: e.message, playing: false });
  });
}
export const pause = () => audio.pause();
export const toggle = () => (audio.paused ? play() : pause());

export function seek(t) {
  if (!book) return;
  t = Math.max(0, Math.min(t, book.duration - 0.5));
  if (audio.readyState >= 1) audio.currentTime = t;
  else pendingSeek = t;
  set({ t, ...locate(t) });
  savePos();
}
export const skip = (dt) => seek(state.t + dt);
export const goChapter = (i) => book && seek(book.chapters[Math.max(0, Math.min(i, book.chapters.length - 1))].start);
export const next = () => {
  if (book && state.range.on && state.n === state.range.to) goChapter(chapterOf(state.range.from));
  else goChapter(state.chapter + 1);
};
// Switch recordings; keeps playing if it was playing (call it inside the tap).
export function setBook(id) {
  if (!all || id === state.book) return;
  const wasPlaying = !audio.paused;
  const n = state.n;
  const sameText = book.group && book.group === all.books.find((b) => b.id === id)?.group;
  savePos();
  useBook(id);
  if (sameText) goChapter(chapterOf(n)); // another pause length: stay on this hexagram
  if (state.range.on && !inRange()) goChapter(chapterOf(state.range.from));
  savePos();
  if (wasPlaying) play();
}
export function prev() {
  const start = book?.chapters[state.chapter].start ?? 0;
  if (state.t - start > 3) goChapter(state.chapter);
  else if (book && state.range.on && state.n === state.range.from) goChapter(chapterOf(state.range.to));
  else goChapter(state.chapter - 1);
}
// Play hexagram n (0: the introduction) in the current book.
export function playChapter(n) {
  const i = book ? chapterOf(n) : -1;
  goChapter(i >= 0 ? i : 0);
  play();
}
// Repeat: when the book ends it starts again from the beginning, for either book, until turned off.
export function setRepeat(on) {
  set({ repeat: on });
  applyLoop();
  savePos();
}
// Range loop: play hexagrams from…to over and over, in either book. Turning it on or moving its ends jumps into
// the range when playback is outside it.
export function setRange(patch) {
  const r = { ...state.range, ...patch };
  if (r.from > r.to) {
    if ('from' in patch) r.to = r.from;
    else r.from = r.to;
  }
  set({ range: r });
  applyLoop();
  if (r.on && book && !inRange()) goChapter(chapterOf(r.from));
  savePos();
}
export function setRate(r) {
  audio.defaultPlaybackRate = audio.playbackRate = r;
  set({ rate: r });
  savePos();
}

// ---------- offline listening ----------
// Which recordings are saved on this device; savedOld: older recordings are saved, replaced since.
async function checkSaved() {
  try {
    const c = await caches.open(AUDIO_CACHE);
    const keys = new Set((await c.keys()).map((k) => k.url));
    const saved = {};
    for (const b of all.books) saved[b.id] = keys.delete(new URL(b.audio, location.href).href);
    set({ saved, savedOld: keys.size > 0 });
  } catch {
    /* no Cache API (Node, some private modes) */
  }
}
export const canDownload = () => !!globalThis.caches;
export const downloadSize = () => all.books.reduce((s, b) => s + b.bytes, 0);
// Download every recording (both versions, all pause lengths) into the AUDIO_CACHE.
export async function download() {
  if (state.dl || !all) return;
  const todo = all.books.filter((b) => !state.saved[b.id]);
  const total = todo.reduce((s, b) => s + b.bytes, 0);
  let got = 0;
  set({ dl: { got, total }, dlError: null });
  navigator.storage?.persist?.().catch(() => {}); // ask the browser not to clear it when space runs low
  try {
    const c = await caches.open(AUDIO_CACHE);
    for (const b of todo) {
      const r = await fetch(b.audio);
      if (!r.ok) throw new Error(`${b.audio} ${r.status}`);
      const reader = r.body.getReader();
      const parts = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        const pct = Math.floor((100 * got) / total);
        got += value.length;
        if (Math.floor((100 * got) / total) !== pct) set({ dl: { got, total } });
      }
      await c.put(b.audio, new Response(new Blob(parts, { type: 'audio/mpeg' })));
      set({ saved: { ...state.saved, [b.id]: true } });
    }
    const keep = new Set(all.books.map((b) => new URL(b.audio, location.href).href));
    for (const k of await c.keys()) if (!keep.has(k.url)) await c.delete(k);
    set({ dl: null, savedOld: false });
  } catch (e) {
    set({ dl: null, dlError: navigator.onLine ? e.message : '需要網路連線 Needs a connection' });
  }
  await checkSaved();
  if (audio.paused) point(state.t); // play the saved copy from now on
}
export async function removeDownload() {
  await caches.delete(AUDIO_CACHE);
  set({ saved: {}, savedOld: false });
  if (audio.paused) point(state.t);
}

export function chapterTitle(n) {
  return n === 0 ? '開場' : `第${numZh(n)}卦 ${hex(n).full}`;
}

// ---------- audio events ----------
audio?.addEventListener('loadedmetadata', () => {
  if (pendingSeek != null) audio.currentTime = pendingSeek;
  pendingSeek = null;
});
audio?.addEventListener('timeupdate', () => {
  if (pendingSeek != null || !book) return;
  const t = audio.currentTime;
  if (state.range.on && loopBack(t)) return;
  const where = locate(t);
  if (where.chapter !== state.chapter) mediaMeta(where.n);
  set({ t, ...where });
  if (Math.abs(t - lastSaved) > 5) {
    lastSaved = t;
    savePos();
  }
});
audio?.addEventListener('play', () => {
  set({ playing: true });
  mediaMeta(state.n);
});
audio?.addEventListener('pause', () => {
  set({ playing: false });
  savePos();
});
// A range loop goes back to its first hexagram when playback passes the end of its last one.
function loopBack(t) {
  const { start, stop } = span(book, state.range.from, state.range.to);
  if (!(state.t >= start && state.t < stop && t >= stop)) return false;
  seek(start);
  return true;
}
audio?.addEventListener('ended', () => {
  if (state.range.on && book) {
    seek(span(book, state.range.from, state.range.to).start);
    play();
    return;
  }
  set({ playing: false, t: 0, ...locate(0) });
  savePos();
});
audio?.addEventListener('waiting', () => set({ waiting: true }));
audio?.addEventListener('playing', () => set({ waiting: false }));
audio?.addEventListener('error', () => {
  if (audio.src) set({ playing: false, waiting: false, error: navigator.onLine ? '音檔載入失敗 Could not load the audio' : '需要網路連線，或先下載音檔 Needs a connection, or download the audio first' });
});

// ---------- lock screen and headphone controls ----------
function mediaMeta(n) {
  if (!('mediaSession' in navigator) || !book) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: chapterTitle(n),
    artist: `${book.titleZh} · ${book.titleEn}`,
    album: '周易六十四卦',
    artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  });
}
if ('mediaSession' in navigator) {
  const on = (action, fn) => {
    try {
      navigator.mediaSession.setActionHandler(action, fn);
    } catch {
      /* action not supported */
    }
  };
  on('play', play);
  on('pause', pause);
  on('previoustrack', prev);
  on('nexttrack', next);
  on('seekbackward', (e) => skip(-(e.seekOffset || 15)));
  on('seekforward', (e) => skip(e.seekOffset || 15));
  on('seekto', (e) => seek(e.seekTime));
}
