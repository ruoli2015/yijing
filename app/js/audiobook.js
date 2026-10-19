// The audiobook player: one <audio> element for the whole app, so listening continues while you browse.
// data/audiobook.json holds two books: 'full' (chapter 0 is the introduction, then hexagrams 1–64) and 'names'
// (hexagrams 1–64, names only). state.chapter is an index into the current book; state.n is its hexagram.
// The position in each book is remembered.
import { hex, numZh } from './hex.js';

const POS_KEY = 'yijing.audiobook';
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

let state = { ready: false, started: false, playing: false, waiting: false, book: 'full', t: 0, chapter: 0, n: 0, cue: -1, rate: 1, repeat: false, error: null };
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
    localStorage.setItem(POS_KEY, JSON.stringify({ book: state.book, positions, last, rate: state.rate, repeat: state.repeat }));
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

// Point the audio element at book `id`, at its remembered position.
function useBook(id) {
  book = all.books.find((b) => b.id === id) || all.books[0];
  if (book.group) last[book.group] = book.id;
  const t = Math.min(positions[book.id] || 0, book.duration - 1);
  audio.src = book.audio;
  audio.playbackRate = state.rate;
  pendingSeek = t || null;
  set({ book: book.id, t, ...locate(t) });
}

export function load() {
  loading ??= fetch('data/audiobook.json')
    .then((r) => {
      if (!r.ok) throw new Error(`audiobook.json ${r.status}`);
      return r.json();
    })
    .then((m) => {
      all = m;
      const saved = readPos();
      positions = saved.positions || { full: saved.t || 0 };
      last = saved.last || {};
      state.rate = RATES.includes(saved.rate) ? saved.rate : 1;
      state.repeat = saved.repeat === true;
      audio.loop = state.repeat;
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
export const next = () => goChapter(state.chapter + 1);
// Switch recordings; keeps playing if it was playing (call it inside the tap).
export function setBook(id) {
  if (!all || id === state.book) return;
  const wasPlaying = !audio.paused;
  const n = state.n;
  const sameText = book.group && book.group === all.books.find((b) => b.id === id)?.group;
  savePos();
  useBook(id);
  if (sameText) goChapter(book.chapters.findIndex((c) => c.n === n)); // another pause length: stay on this hexagram
  savePos();
  if (wasPlaying) play();
}
export function prev() {
  const start = book?.chapters[state.chapter].start ?? 0;
  goChapter(state.t - start > 3 ? state.chapter : state.chapter - 1);
}
// Play hexagram n (0: the introduction) in the current book.
export function playChapter(n) {
  const i = book?.chapters.findIndex((c) => c.n === n) ?? -1;
  goChapter(i >= 0 ? i : 0);
  play();
}
// Repeat: when the book ends it starts again from the beginning, for either book, until turned off.
export function setRepeat(on) {
  audio.loop = on;
  set({ repeat: on });
  savePos();
}
export function setRate(r) {
  audio.playbackRate = r;
  set({ rate: r });
  savePos();
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
audio?.addEventListener('ended', () => {
  set({ playing: false, t: 0, ...locate(0) });
  savePos();
});
audio?.addEventListener('waiting', () => set({ waiting: true }));
audio?.addEventListener('playing', () => set({ waiting: false }));
audio?.addEventListener('error', () => {
  if (audio.src) set({ playing: false, waiting: false, error: navigator.onLine ? '音檔載入失敗 Could not load the audio' : '需要網路連線 Needs a connection' });
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
