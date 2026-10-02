// Local persistence: settings, quiz stats, divination journal. Everything stays in this browser.
const KEY = 'yijing.v1';

const DEFAULT = {
  settings: { showEn: true, quizMode: 'mc', range: 'all' },
  identify: {}, // n -> { seen, right, box, last }
  draw: {},
  journal: [], // { id, ts, q, values, note }
};

let state = load();
const subs = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const s = JSON.parse(raw);
    return { ...structuredClone(DEFAULT), ...s, settings: { ...DEFAULT.settings, ...(s.settings || {}) } };
  } catch {
    return structuredClone(DEFAULT);
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or storage full: keep working in memory */
  }
  subs.forEach((f) => f());
}

export const get = () => state;
export const settings = () => state.settings;
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function setSetting(k, v) {
  state.settings = { ...state.settings, [k]: v };
  save();
}

export function setStat(kind, n, stat) {
  state[kind] = { ...state[kind], [n]: stat };
  save();
}

export function addJournal(entry) {
  state.journal = [{ id: Date.now().toString(36), ts: Date.now(), ...entry }, ...state.journal];
  save();
  return state.journal[0].id;
}
export function updateJournal(id, patch) {
  state.journal = state.journal.map((j) => (j.id === id ? { ...j, ...patch } : j));
  save();
}
export function deleteJournal(id) {
  state.journal = state.journal.filter((j) => j.id !== id);
  save();
}

export function exportJson() {
  return JSON.stringify({ app: 'yijing', exported: new Date().toISOString(), ...state }, null, 1);
}
export function importJson(text) {
  const s = JSON.parse(text);
  if (s.app !== 'yijing') throw new Error('not a yijing export');
  const { app, exported, ...rest } = s;
  state = { ...structuredClone(DEFAULT), ...rest, settings: { ...DEFAULT.settings, ...(rest.settings || {}) } };
  save();
}
export function resetProgress() {
  state = { ...state, identify: {}, draw: {} };
  save();
}
