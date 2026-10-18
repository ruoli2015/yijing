// 聽卦序: the audiobook page (transcript that follows the voice, controls, chapters) and the mini player
// shown on other pages while it plays.
import { html, useState, useEffect } from '../../vendor/preact.js';
import * as player from '../audiobook.js';
import { hex, numZh } from '../hex.js';
import { HexSvg, Bi, L, useEn } from './common.js';

export function usePlayer() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = player.subscribe(() => setTick((t) => t + 1));
    player.load().catch(() => {});
    return unsub;
  }, []);
  return player.get();
}

const clock = (t) => {
  t = Math.max(0, Math.round(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const ICON = {
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z',
  prev: 'M6 5h2v14H6zm3.5 7L19 5.5v13z',
  next: 'M16 5h2v14h-2zM5 5.5 14.5 12 5 18.5z',
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
  const to = n > 0 && n < 64 ? hex(n + 1) : null;
  const line = ([c, k]) => html`<span class=${`cue${k === cue ? ' on' : ''}`} onClick=${() => player.seek(c.start)}>${c.text}</span>`;
  const english = (role, items) => {
    if (!en) return null;
    if (role === 'quote') return to?.xugua.en;
    if (role === 'read') return to?.logicEn;
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
  const book = player.manifest();

  // While playing, keep the sentence being read clear of the header and the player bar.
  useEffect(() => {
    const el = document.querySelector('.cue.on');
    const bar = document.querySelector('.player-bar');
    if (!s.playing || !el || !bar) return;
    const r = el.getBoundingClientRect();
    const bottom = bar.getBoundingClientRect().top - 12;
    if (r.bottom > bottom || r.top < 70) window.scrollBy({ top: r.top - Math.max(90, bottom / 3), behavior: 'smooth' });
  }, [s.chapter, s.cue]);

  if (!book) {
    return html`<div class="page listen"><div class="card">
      <h1>聽卦序 <small>The Sequence, Read Aloud</small></h1>
      <p class="muted">${s.error ? `無法載入 Could not load: ${s.error}` : '載入中… Loading…'}</p>
    </div></div>`;
  }

  const ch = book.chapters[s.chapter];
  const h = ch.n > 0 ? hex(ch.n) : null;
  const minutes = Math.round(book.duration / 60);

  return html`<div class="page listen">
    <div class="card listen-intro">
      <h1>聽卦序 <small>The Sequence, Read Aloud</small></h1>
      <${Bi} zh=${`六十四卦依序朗讀：每一卦讀出卦序與卦名，引《序卦傳》說明為什麼接下一卦，附上今解。全長約 ${minutes} 分鐘。`}
        en=${`All sixty-four hexagrams read in order: each one's number and name, the Xugua sentence leading to the next, and the modern reading. About ${minutes} minutes.`} />
    </div>

    <section class="card now">
      <div class="now-head">
        ${h
          ? html`<a href=${`#/h/${h.n}`} class="now-fig"><${HexSvg} lines=${h.lines} size=${56} /></a>
            <div><div class="now-num">第${numZh(h.n)}卦 <small>No. ${h.n}</small></div>
              <a class="now-name" href=${`#/h/${h.n}`}>${h.full}</a>${en ? html` <small class="muted">${h.en}</small>` : null}</div>`
          : html`<div><div class="now-num">開場 <small>Introduction</small></div><div class="now-name">${book.titleZh}</div></div>`}
      </div>
      <${Transcript} ch=${ch} cue=${s.cue} book=${book} />
      ${s.error ? html`<p class="bad small">${s.error}</p>` : null}
    </section>

    <div class="player-bar card">
      <input type="range" class="scrub" min="0" max=${Math.floor(book.duration)} step="1" value=${s.t}
        onInput=${(e) => player.seek(Number(e.target.value))} aria-label="position" />
      <div class="times"><span>${clock(s.t)}</span><span class="muted">${player.chapterTitle(s.chapter)}</span><span>-${clock(book.duration - s.t)}</span></div>
      <div class="controls">
        <button type="button" class="speed" onClick=${() => player.setRate(player.RATES[(player.RATES.indexOf(s.rate) + 1) % player.RATES.length])} aria-label="speed">${s.rate}×</button>
        <button type="button" onClick=${player.prev} aria-label="previous hexagram"><${Icon} d=${ICON.prev} /></button>
        <button type="button" onClick=${() => player.skip(-15)} aria-label="back 15 seconds"><${Skip} back /></button>
        <button type="button" class=${`main${s.waiting && s.playing ? ' busy' : ''}`} onClick=${player.toggle} aria-label=${s.playing ? 'pause' : 'play'}>
          <${Icon} d=${s.playing ? ICON.pause : ICON.play} /></button>
        <button type="button" onClick=${() => player.skip(15)} aria-label="forward 15 seconds"><${Skip} /></button>
        <button type="button" onClick=${player.next} aria-label="next hexagram"><${Icon} d=${ICON.next} /></button>
        <span class="speed-pad"></span>
      </div>
    </div>

    <section class="card">
      <h2><${L} zh="章節" en="Chapters" /></h2>
      <div class="ch-grid">
        <button type="button" class=${`ch-tile ch-intro${s.chapter === 0 ? ' on' : ''}`} onClick=${() => player.playChapter(0)}>開場</button>
        ${book.chapters.slice(1).map((c) => {
          const x = hex(c.n);
          return html`<button type="button" class=${`ch-tile${s.chapter === c.n ? ' on' : ''}`} onClick=${() => player.playChapter(c.n)} aria-label=${player.chapterTitle(c.n)}>
            <span class="tile-num">${c.n}</span><${HexSvg} lines=${x.lines} size=${26} /><span class="tile-name">${x.name}</span>
          </button>`;
        })}
      </div>
      <p class="muted small">${book.voice.includes('Yunyi') ? 'Azure 雲逸 Yunyi' : book.voice} · 音檔需要網路 · audio streams online</p>
    </section>
  </div>`;
}

// Shown above the tabs on other pages once the audiobook has been started.
export function MiniPlayer() {
  const s = usePlayer();
  if (!s.started || !player.manifest()) return null;
  const n = s.chapter;
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
  const here = s.chapter === n && s.playing;
  return html`<button type="button" class="listen-from" onClick=${() => {
    if (!here) player.playChapter(n);
    location.hash = '#/listen';
  }}><${Icon} d=${ICON.play} /> ${here ? '正在播放 Now playing' : '從這一卦聽起 · Listen from here'}</button>`;
}
