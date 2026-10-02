// 六十四卦: all hexagrams in order, as pairs, or as a trigram matrix; search by name, number or lines.
import { html, useState } from '../../vendor/preact.js';
import * as store from '../store.js';
import { all, hex, search, matchPattern, trigrams, byLines } from '../hex.js';
import { level } from '../quiz.js';
import { HexTile, HexSvg, TriSvg, LineEditor, Segmented, L, useEn } from './common.js';

export function Browse({ params }) {
  const s = store.settings();
  const [view, setView] = useState(params.view || s.browseView || 'order');
  const [q, setQ] = useState('');
  const [pattern, setPattern] = useState('??????');
  const [finder, setFinder] = useState(false);
  const stats = store.get().identify;

  const changeView = (v) => {
    setView(v);
    store.setSetting('browseView', v);
  };

  let list = search(q);
  if (finder) list = matchPattern(pattern, list);
  const filtering = q.trim() || (finder && pattern !== '??????');
  const lv = (n) => level(stats[n]);

  return html`<div class="page browse">
    <div class="searchbar">
      <input type="search" placeholder="卦名・拼音・序號 · search" value=${q}
        onInput=${(e) => setQ(e.target.value)} aria-label="search" />
      <button type="button" class=${`finder-btn${finder ? ' on' : ''}`} onClick=${() => setFinder(!finder)} aria-pressed=${finder}>
        ${html`<${HexSvg} lines="101010" size=${16} />`} <span>以象尋卦</span>
      </button>
    </div>

    ${finder
      ? html`<div class="card finder">
          <div class="finder-head">
            <${L} zh="點擊爻位畫出你記得的部分（由下而上）" en="Tap the lines you remember, bottom to top. Leave unknown lines empty." />
            <button type="button" class="link" onClick=${() => setPattern('??????')}>清除 Clear</button>
          </div>
          <div class="finder-body">
            <${LineEditor} value=${pattern} onChange=${setPattern} />
            <div class="finder-count">${list.length} <small>${list.length === 1 ? 'match' : 'matches'}</small></div>
          </div>
        </div>`
      : null}

    ${filtering
      ? html`<div class="grid">${list.map((h) => html`<${HexTile} n=${h.n} href=${`#/h/${h.n}`} level=${lv(h.n)} />`)}</div>
          ${list.length === 0 ? html`<p class="muted center">沒有符合的卦 · No match</p>` : null}`
      : html`
        <${Segmented} value=${view} onChange=${changeView} options=${[
          { value: 'order', label: '卦序 Order' },
          { value: 'pairs', label: '成對 Pairs' },
          { value: 'matrix', label: '上下卦 Trigrams' },
        ]} />
        ${view === 'order' ? html`<${OrderGrid} lv=${lv} />` : view === 'pairs' ? html`<${Pairs} />` : html`<${Matrix} />`}
      `}
  </div>`;
}

function OrderGrid({ lv }) {
  const hs = all();
  return html`
    <h3 class="canon"><${L} zh="上經 · 一至三十" en="Upper Canon · 1–30" /></h3>
    <div class="grid">${hs.slice(0, 30).map((h) => html`<${HexTile} n=${h.n} href=${`#/h/${h.n}`} level=${lv(h.n)} />`)}</div>
    <h3 class="canon"><${L} zh="下經 · 三十一至六十四" en="Lower Canon · 31–64" /></h3>
    <div class="grid">${hs.slice(30).map((h) => html`<${HexTile} n=${h.n} href=${`#/h/${h.n}`} level=${lv(h.n)} />`)}</div>
  `;
}

function Pairs() {
  const en = useEn();
  const pairs = [];
  for (let n = 1; n <= 64; n += 2) pairs.push([hex(n), hex(n + 1)]);
  const relText = { zong: ['覆', 'inverted'], cuo: ['變', 'complement'], both: ['覆·變', 'both'] };
  return html`
    <p class="muted small">二二相耦，非覆即變：每對中第二卦多為第一卦上下顛倒（覆），四對陰陽全反（變）。${en ? ' Each pair: the second is the first turned upside down, or (four pairs) with every line inverted.' : ''}</p>
    <div class="pairs">
      ${pairs.map(([a, b]) => html`<div class=${`pair rel-${a.pair.rel}`}>
        <a href=${`#/h/${a.n}`}><span class="tile-num">${a.n}</span><${HexSvg} lines=${a.lines} size=${40} /><span class="tile-name">${a.name}</span></a>
        <span class="pair-rel">${relText[a.pair.rel][0]}${en ? html`<small>${relText[a.pair.rel][1]}</small>` : null}</span>
        <a href=${`#/h/${b.n}`}><span class="tile-num">${b.n}</span><${HexSvg} lines=${b.lines} size=${40} /><span class="tile-name">${b.name}</span></a>
      </div>`)}
    </div>`;
}

function Matrix() {
  const ts = trigrams();
  return html`
    <p class="muted small"><${L} zh="橫列為上卦，直行為下卦。" en="Rows: upper trigram · Columns: lower trigram." /></p>
    <div class="matrix-wrap"><table class="matrix">
      <thead><tr><th class="corner"><span>上＼下</span></th>
        ${ts.map((t) => html`<th><${TriSvg} lines=${t.lines} /><span>${t.name}${t.image}</span></th>`)}
      </tr></thead>
      <tbody>
        ${ts.map((up) => html`<tr>
          <th><${TriSvg} lines=${up.lines} /><span>${up.name}${up.image}</span></th>
          ${ts.map((low) => {
            const h = byLines(low.lines + up.lines);
            return html`<td><a href=${`#/h/${h.n}`}><b>${h.n}</b><span>${h.name}</span></a></td>`;
          })}
        </tr>`)}
      </tbody>
    </table></div>`;
}
