// Answer card shown after each quiz question: the hexagram, its neighbours, and the 序卦 links in and out.
import { html } from '../../vendor/preact.js';
import { hex } from '../hex.js';
import { RANGES } from '../quiz.js';
import * as store from '../store.js';
import { HexSvg, Bi, Segmented } from './common.js';
import { HexHeader, XuguaLink } from './detail.js';

export function Neighbours({ n }) {
  const cell = (m, cls) =>
    m >= 1 && m <= 64
      ? html`<a class=${`nb ${cls}`} href=${`#/h/${m}`}><${HexSvg} lines=${hex(m).lines} size=${cls === 'cur' ? 44 : 34} /><b>${m}</b><span>${hex(m).name}</span></a>`
      : html`<span class=${`nb ${cls} none`}>—</span>`;
  return html`<div class="neighbours">${cell(n - 1, 'prev')}<span class="arrow">→</span>${cell(n, 'cur')}<span class="arrow">→</span>${cell(n + 1, 'next')}</div>`;
}

export function Reveal({ n }) {
  const h = hex(n);
  return html`<div class="card reveal">
    <${HexHeader} n=${n} size=${72} />
    <${Bi} cls="gist" zh=${h.gistZh} en=${h.gistEn} />
    <${Neighbours} n=${n} />
    <h3 class="sub">序卦 · 入 <small>how it arrives</small></h3>
    <${XuguaLink} to=${n} />
    ${n < 64 ? html`<h3 class="sub">序卦 · 出 <small>where it leads</small></h3><${XuguaLink} to=${n + 1} dir="out" />` : null}
    <a class="more" href=${`#/h/${n}`}>查看全卦（卦辭、彖、象） · Full page ›</a>
  </div>`;
}

// Range + answer-mode controls shared by both quizzes.
export function QuizControls({ onChange }) {
  const s = store.settings();
  return html`<div class="quiz-controls">
    <div class="chips-row" role="group" aria-label="range">
      ${Object.entries(RANGES).map(([k, r]) => html`<button type="button" class=${`chip-btn${s.range === k ? ' on' : ''}`}
        onClick=${() => { store.setSetting('range', k); onChange?.(); }}>${r.zh}${r.en && s.showEn ? html` <small>${r.en}</small>` : null}</button>`)}
    </div>
    <${Segmented} value=${s.quizMode} onChange=${(v) => { store.setSetting('quizMode', v); onChange?.(); }}
      options=${[{ value: 'mc', label: '選擇 Choose' }, { value: 'typed', label: '輸入 Type' }]} />
  </div>`;
}

export function Score({ score }) {
  if (!score.total) return null;
  return html`<div class="score">本輪 <b>${score.right}</b> / ${score.total}${score.streak > 1 ? html` · 連對 ${score.streak} 🔥` : null}</div>`;
}
