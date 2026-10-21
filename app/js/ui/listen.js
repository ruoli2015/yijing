// 聽卦序: the audiobook page (transcript that follows the voice, controls, chapters) and the mini player
// shown on other pages while it plays.
import { html, useState, useEffect } from '../../vendor/preact.js';
import * as player from '../audiobook.js';
import { hex, numZh } from '../hex.js';
import { HexSvg, Bi, L, Segmented, useEn } from './common.js';

export function usePlayer() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = player.subscribe(() => setTick((t) => t + 1));
    player.load().catch(() => {});
    return unsub;
  }, []);
  return player.get();
}

const mb = (bytes) => `${Math.round(bytes / 1e6)} MB`;
const clock = (t) => {
  t = Math.max(0, Math.round(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const ICON = {
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z',
  prev: 'M6 5h2v14H6zm3.5 7L19 5.5v13z',
  next: 'M16 5h2v14h-2zM5 5.5 14.5 12 5 18.5z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
};
const Icon = ({ d }) => html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d=${d} /></svg>`;
const Skip = ({ back }) => html`<svg viewBox="0 0 24 24" aria-hidden="true" class="skip-icon">
  <path class="ring" d=${back ? 'M12 4.5a7.5 7.5 0 1 1-7.1 5.1' : 'M12 4.5a7.5 7.5 0 1 0 7.1 5.1'} />
  <path d=${back ? 'M12 1.5v6l-4.5-3z' : 'M12 1.5v6l4.5-3z'} />
  <text x="12" y="15.6">15</text>
</svg>`;

// Consecutive cues of one role form a block (a paragraph of the modern reading, the intro…).
function blocks(cues) {
  const out = [];
  cues.forEach((c, k) => {
    const last = out[out.length - 1];
    if (last && last.role === c.role && c.role !== 'canon') last.items.push([c, k]);
    else out.push({ role: c.role, items: [[c, k]] });
  });
  return out;
}

function Transcript({ ch, cue, book }) {
  const en = useEn();
  const n = ch.n;
  const h = n > 0 ? hex(n) : null; // each chapter explains how its own hexagram follows the one before
  const line = ([c, k]) => html`<span class=${`cue${k === cue ? ' on' : ''}`} onClick=${() => player.seek(c.start)}>${c.text}</span>`;
  const english = (role, items) => {
    if (!en) return null;
    if (role === 'quote') return h?.xugua.en;
    if (role === 'read') return h?.logicEn;
    if (role === 'intro') return book.introEn;
    if (role === 'outro') return book.outroEn;
    return items[0][0].en || null;
  };
  return html`<div class="transcript">
    ${blocks(ch.cues).map(({ role, items }) => {
      const e = english(role, items);
      const body = role === 'quote' ? html`<blockquote class="classic">${items.map(line)}</blockquote>` : html`<p class=${`t-${role}`}>${items.map(line)}</p>`;
      return html`<div class=${`tb tb-${role}`}>
        ${role === 'read' ? html`<div class="modern-label"><${L} zh="今解" en="Modern reading" /></div>` : null}
        ${body}${e ? html`<p class="en">${e}</p>` : null}
      </div>`;
    })}
  </div>`;
}

export function Listen() {
  const s = usePlayer();
  const en = useEn();
  const all = player.manifest();
  const book = player.current();

  // While playing, keep the sentence being read clear of the header and the player bar.
  useEffect(() => {
    const el = document.querySelector('.cue.on');
    const bar = document.querySelector('.player-bar');
    if (!s.playing || !el || !bar) return;
    const r = el.getBoundingClientRect();
    const bottom = bar.getBoundingClientRect().top - 12;
    if (r.bottom > bottom || r.top < 70) window.scrollBy({ top: r.top - Math.max(90, bottom / 3), behavior: 'smooth' });
  }, [s.chapter, s.cue]);

  if (!all || !book) {
    return html`<div class="page listen"><div class="card">
      <h1>聽卦序 <small>The Sequence, Read Aloud</small></h1>
      <p class="muted">${s.error ? `無法載入 Could not load: ${s.error}` : '載入中… Loading…'}</p>
    </div></div>`;
  }

  const ch = book.chapters[s.chapter];
  const h = ch.n > 0 ? hex(ch.n) : null;
  const full = all.books.find((b) => b.id === 'full');
  const names = all.books.find((b) => b.id === 'names');
  const variants = all.books.filter((b) => b.group === 'names'); // the same names, with different pauses
  const group = book.group || book.id;
  const looped = (n) => s.range.on && n >= s.range.from && n <= s.range.to;
  const lastNames = () => variants.find((b) => b.id === player.lastOf('names')) || names;
  const minutes = Math.round(full.duration / 60);

  return html`<div class="page listen">
    <div class="card listen-intro">
      <h1>聽卦序 <small>The Sequence, Read Aloud</small></h1>
      <${Bi} zh=${`六十四卦依序朗讀：每一卦讀出卦序與卦名，引《序卦傳》說明它為什麼接在前一卦之後，附上今解。全長約 ${minutes} 分鐘。另有只讀卦名的短版，約 ${Math.round(names.duration / 60)} 分鐘，方便背誦卦序。`}
        en=${`All sixty-four hexagrams read in order: each one's number and name, the Xugua sentence explaining why it follows the one before, and the modern reading. About ${minutes} minutes. A short version reads only the names (${Math.round(names.duration / 60)} minutes), for memorizing the order.`} />
      <${Segmented} value=${group} onChange=${(g) => player.setBook(g === 'full' ? 'full' : lastNames().id)} options=${[
        { value: 'full', label: html`完整版${en ? html` <small>Full</small>` : null}` },
        { value: 'names', label: html`只讀卦名${en ? html` <small>Names only</small>` : null}` },
      ]} />
      ${group === 'names'
        ? html`<div class="pause-row"><span class="muted small">停頓${en ? ' Pause' : ''}</span>
          <div class="chips-row">${variants.map((b) => html`<button type="button" class=${`chip-btn${b.id === book.id ? ' on' : ''}`} onClick=${() => player.setBook(b.id)}>
            ${b.pause ? `${b.pause} 秒` : '無'}${en && !b.pause ? html` <small>none</small>` : null}</button>`)}</div>
          </div>`
        : null}
      <${RangeRow} s=${s} en=${en} />
      <${OfflineRow} s=${s} en=${en} />
    </div>

    <section class="card now">
      <div class="now-head">
        ${h
          ? html`<a href=${`#/h/${h.n}`} class="now-fig"><${HexSvg} lines=${h.lines} size=${56} /></a>
            <div><div class="now-num">第${numZh(h.n)}卦 <small>No. ${h.n}</small></div>
              <a class="now-name" href=${`#/h/${h.n}`}>${h.full}</a>${en ? html` <small class="muted">${h.en}</small>` : null}</div>`
          : html`<div><div class="now-num">開場 <small>Introduction</small></div><div class="now-name">${full.titleZh}</div></div>`}
      </div>
      ${group === 'names' ? html`<p class="muted small">${book.titleZh} · ${book.titleEn}${book.pause ? ` · 停頓 ${book.pause} 秒` : ''}</p>` : null}
      <${Transcript} ch=${ch} cue=${s.cue} book=${book} />
      ${s.error ? html`<p class="bad small">${s.error}</p>` : null}
    </section>

    <div class="player-bar card">
      <input type="range" class="scrub" min="0" max=${Math.floor(book.duration)} step="1" value=${s.t}
        onInput=${(e) => player.seek(Number(e.target.value))} aria-label="position" />
      <div class="times"><span>${clock(s.t)}</span><span class="muted">${player.chapterTitle(s.n)}</span><span>-${clock(book.duration - s.t)}</span></div>
      <div class="controls">
        <button type="button" class="speed" onClick=${() => player.setRate(player.RATES[(player.RATES.indexOf(s.rate) + 1) % player.RATES.length])} aria-label="speed">${s.rate}×</button>
        <button type="button" onClick=${player.prev} aria-label="previous hexagram"><${Icon} d=${ICON.prev} /></button>
        <button type="button" onClick=${() => player.skip(-15)} aria-label="back 15 seconds"><${Skip} back /></button>
        <button type="button" class=${`main${s.waiting && s.playing ? ' busy' : ''}`} onClick=${player.toggle} aria-label=${s.playing ? 'pause' : 'play'}>
          <${Icon} d=${s.playing ? ICON.pause : ICON.play} /></button>
        <button type="button" onClick=${() => player.skip(15)} aria-label="forward 15 seconds"><${Skip} /></button>
        <button type="button" onClick=${player.next} aria-label="next hexagram"><${Icon} d=${ICON.next} /></button>
        <button type="button" class=${`repeat${s.repeat ? ' on' : ''}`} onClick=${() => player.setRepeat(!s.repeat)}
          aria-label="repeat" aria-pressed=${s.repeat} title=${s.repeat ? '循環播放：開 Repeat on' : '循環播放：關 Repeat off'}><${Icon} d=${ICON.repeat} /></button>
      </div>
    </div>

    <section class="card">
      <h2><${L} zh="章節" en="Chapters" /></h2>
      <div class="ch-grid">
        ${book.chapters[0].n === 0
          ? html`<button type="button" class=${`ch-tile ch-intro${s.n === 0 ? ' on' : ''}`} onClick=${() => player.playChapter(0)}>開場</button>`
          : null}
        ${book.chapters.filter((c) => c.n > 0).map((c) => {
          const x = hex(c.n);
          return html`<button type="button" class=${`ch-tile${s.n === c.n ? ' on' : ''}${looped(c.n) ? ' in-range' : ''}`} onClick=${() => player.playChapter(c.n)} aria-label=${player.chapterTitle(c.n)}>
            <span class="tile-num">${c.n}</span><${HexSvg} lines=${x.lines} size=${26} /><span class="tile-name">${x.name}</span>
          </button>`;
        })}
      </div>
      <p class="muted small">${all.voice.includes('Yunyi') ? 'Azure 雲逸 Yunyi' : all.voice} · ${all.books.every((b) => s.saved[b.id]) ? '已下載，可離線收聽 · saved for offline' : '音檔需要網路 · audio streams online'}</p>
    </section>
  </div>`;
}

// Loop between two hexagrams, in either version. Picking an end turns the loop on.
function RangeRow({ s, en }) {
  const { on, from, to } = s.range;
  const options = (sel) => Array.from({ length: 64 }, (_, i) => html`<option value=${i + 1} selected=${i + 1 === sel}>${i + 1} ${hex(i + 1).name}</option>`);
  return html`<div class="range-row">
    <button type="button" class=${`chip-btn${on ? ' on' : ''}`} onClick=${() => player.setRange({ on: !on })} aria-pressed=${on}>
      區間循環${en ? html` <small>Loop</small>` : null}</button>
    <select value=${from} onChange=${(e) => player.setRange({ on: true, from: Number(e.target.value) })} aria-label="loop from">${options(from)}</select>
    <span class="muted small">至${en ? ' to' : ''}</span>
    <select value=${to} onChange=${(e) => player.setRange({ on: true, to: Number(e.target.value) })} aria-label="loop to">${options(to)}</select>
  </div>`;
}

// Save the recordings on this device so they play without a connection.
function OfflineRow({ s, en }) {
  if (!player.canDownload()) return null;
  const all = player.manifest();
  const saved = all.books.every((b) => s.saved[b.id]);
  let body;
  if (s.dl) {
    const pct = Math.floor((100 * s.dl.got) / s.dl.total);
    body = html`<progress max="100" value=${pct}></progress><span class="muted small">下載中 ${pct}%${en ? ' Downloading' : ''}</span>`;
  } else if (saved) {
    body = html`<span class="small ok">✓ 已存在這部裝置，可離線收聽${en ? html` <span class="muted">Saved on this device for offline listening</span>` : null}</span>
      <button type="button" class="link-btn small" onClick=${player.removeDownload}>移除${en ? ' Remove' : ''}</button>`;
  } else {
    const again = s.savedOld || Object.values(s.saved).some(Boolean);
    body = html`<button type="button" class="chip-btn" onClick=${player.download}>
        ⤓ ${again ? '更新下載' : '下載音檔'}${en ? html` <small>${again ? 'Update download' : 'Download'}</small>` : null}</button>
      <span class="muted small">${again ? '錄音已更新 · ' : ''}離線收聽 · ${en ? 'listen offline · ' : ''}${mb(player.downloadSize())}</span>`;
  }
  return html`<div class="offline-row">${body}${s.dlError ? html`<span class="bad small">${s.dlError}</span>` : null}</div>`;
}

// Shown above the tabs on other pages once the audiobook has been started.
export function MiniPlayer() {
  const s = usePlayer();
  if (!s.started || !player.manifest()) return null;
  const n = s.n;
  return html`<div class="mini-player">
    <a href="#/listen" class="mini-info">
      ${n > 0 ? html`<${HexSvg} lines=${hex(n).lines} size=${24} />` : null}
      <span><small>聽卦序</small>${player.chapterTitle(n)}</span>
    </a>
    <button type="button" onClick=${player.toggle} aria-label=${s.playing ? 'pause' : 'play'}><${Icon} d=${s.playing ? ICON.pause : ICON.play} /></button>
    <button type="button" onClick=${player.next} aria-label="next hexagram"><${Icon} d=${ICON.next} /></button>
  </div>`;
}

// "Listen from here" button for a hexagram page.
export function ListenFrom({ n }) {
  const s = usePlayer();
  if (!player.manifest()) return null;
  const here = s.n === n && s.playing;
  return html`<button type="button" class="listen-from" onClick=${() => {
    if (!here) player.playChapter(n);
    location.hash = '#/listen';
  }}><${Icon} d=${ICON.play} /> ${here ? '正在播放 Now playing' : '從這一卦聽起 · Listen from here'}</button>`;
}
