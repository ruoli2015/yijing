// Home: entry points to the learning modes, a random hexagram, and a progress summary.
import { html, useState } from '../../vendor/preact.js';
import * as store from '../store.js';
import { hex } from '../hex.js';
import { level } from '../quiz.js';
import { HexSvg, Bi, useEn } from './common.js';

const MODES = [
  { href: '#/identify', fig: '100010', zh: '認卦', en: 'Identify', dzh: '看卦象，說出卦名、卦序與前後卦', den: 'See a hexagram: name it, number it, give its neighbors' },
  { href: '#/draw', fig: '010001', zh: '畫卦', en: 'Draw', dzh: '看卦名，畫出卦象並說出卦序', den: 'See a name: draw the hexagram and give its number' },
  { href: '#/listen', fig: '100100', zh: '聽卦序', en: 'Listen', dzh: '依序朗讀六十四卦：卦名、序卦傳與今解；或只聽卦名', den: 'All 64 read in order with the Xugua and modern readings, or just the names' },
  { href: '#/order', fig: '111000', zh: '卦序之理', en: 'Logic of the order', dzh: '序卦傳原文與今解，逐段讀懂卦序', den: 'The Xugua with modern explanations, stage by stage' },
  { href: '#/browse', fig: '000111', zh: '六十四卦', en: 'All hexagrams', dzh: '依卦名、卦象或卦序查找，閱讀彖傳與象傳', den: 'Find by name, figure or number; read the Tuan and Xiang' },
  { href: '#/divine', fig: '101010', zh: '占卦', en: 'Divination', dzh: '三錢起卦，依朱熹占法讀卦', den: 'Three-coin cast, read by Zhu Xi’s rules' },
];

export function Home() {
  const en = useEn();
  const [rnd, setRnd] = useState(() => 1 + Math.floor(Math.random() * 64));
  const s = store.get();
  const nums = Array.from({ length: 64 }, (_, i) => i + 1);
  const count = (kind) => [0, 1, 2, 3].map((l) => nums.filter((n) => level(s[kind][n]) === l).length);
  const id = count('identify');
  const dr = count('draw');
  const h = hex(rnd);

  return html`<div class="page home">
    <div class="hero">
      <div class="hero-figs">${['111111', '000000'].map((l) => html`<${HexSvg} lines=${l} size=${34} />`)}</div>
      <h1>周易六十四卦</h1>
      <p class="hero-sub">${en ? 'Learn the sixty-four hexagrams and the logic of their order' : '熟悉六十四卦與卦序之理'}</p>
    </div>

    <div class="modes">
      ${MODES.map((m) => html`<a class="mode card" href=${m.href}>
        <${HexSvg} lines=${m.fig} size=${40} />
        <div><div class="mode-title">${m.zh}${en ? html` <small>${m.en}</small>` : null}</div>
          <div class="mode-desc">${m.dzh}${en ? html`<br /><span class="en">${m.den}</span>` : null}</div></div>
        <span class="chev">›</span>
      </a>`)}
    </div>

    <div class="card random">
      <div class="random-head"><span>隨機一卦 <small>Random hexagram</small></span>
        <button type="button" class="link" onClick=${() => setRnd(1 + Math.floor(Math.random() * 64))}>換一卦 Another ↻</button></div>
      <a class="random-body" href=${`#/h/${rnd}`}>
        <${HexSvg} lines=${h.lines} size=${64} />
        <div><div class="random-name"><b>${h.n}</b> ${h.name} <span class="muted">${h.full}</span></div>
          <${Bi} zh=${h.gistZh} en=${h.gistEn} /></div>
      </a>
    </div>

    <a class="card summary" href="#/progress">
      <div class="summary-row"><span>認卦 <small>Identify</small></span><${Bar} counts=${id} /></div>
      <div class="summary-row"><span>畫卦 <small>Draw</small></span><${Bar} counts=${dr} /></div>
      <div class="muted small">熟記 mastered ${id[3]}/64 · ${dr[3]}/64 ›</div>
    </a>
  </div>`;
}

export function Bar({ counts }) {
  return html`<div class="bar-stack" aria-label=${`new ${counts[0]}, learning ${counts[1]}, familiar ${counts[2]}, mastered ${counts[3]}`}>
    ${[3, 2, 1, 0].map((l) => (counts[l] ? html`<span class=${`seg-${l}`} style=${`flex:${counts[l]}`}></span>` : null))}
  </div>`;
}
