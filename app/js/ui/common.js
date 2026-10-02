// Shared UI pieces: hexagram drawing, line editor, bilingual text, chips.
import { html } from '../../vendor/preact.js';
import * as store from '../store.js';
import { hex, linkLabel, relLabel } from '../hex.js';

// ---------- hexagram SVG ----------
// lines: 6 chars bottom → top ('1' yang, '0' yin, '?' empty). Drawn top line first.
//   changing: indices with a changing-line mark · wrong: indices to highlight as mistakes · focus: indices to emphasise
export function HexSvg({ lines, size = 64, changing = [], wrong = [], focus = [], cls = '' }) {
  const w = 100;
  const t = 11; // bar thickness
  const g = 7; // gap between bars
  const h = 6 * t + 5 * g;
  const bars = [];
  for (let i = 5; i >= 0; i--) {
    const y = (5 - i) * (t + g);
    const c = lines[i];
    const klass = `bar${wrong.includes(i) ? ' wrong' : ''}${focus.includes(i) ? ' focus' : ''}${c === '?' ? ' empty' : ''}`;
    if (c === '1') bars.push(html`<rect class=${klass} x="0" y=${y} width=${w} height=${t} rx="1.5" />`);
    else if (c === '0')
      bars.push(html`<rect class=${klass} x="0" y=${y} width="39" height=${t} rx="1.5" /><rect class=${klass} x="61" y=${y} width="39" height=${t} rx="1.5" />`);
    else bars.push(html`<rect class=${klass} x="0.75" y=${y + 0.75} width=${w - 1.5} height=${t - 1.5} rx="1.5" />`);
    if (changing.includes(i)) {
      const cy = y + t / 2;
      bars.push(
        c === '1'
          ? html`<circle class="chg" cx="50" cy=${cy} r="5.2" />`
          : html`<path class="chg" d=${`M45 ${cy - 5}L55 ${cy + 5}M55 ${cy - 5}L45 ${cy + 5}`} />`,
      );
    }
  }
  return html`<svg class=${`hex ${cls}`} viewBox=${`-2 -2 ${w + 4} ${h + 4}`} width=${size} height=${(size * (h + 4)) / (w + 4)} role="img" aria-label=${lines}>${bars}</svg>`;
}

// Small trigram drawing (3 lines)
export function TriSvg({ lines, size = 24 }) {
  const t = 16;
  const g = 10;
  const h = 3 * t + 2 * g;
  const bars = [];
  for (let i = 2; i >= 0; i--) {
    const y = (2 - i) * (t + g);
    if (lines[i] === '1') bars.push(html`<rect class="bar" x="0" y=${y} width="100" height=${t} />`);
    else bars.push(html`<rect class="bar" x="0" y=${y} width="38" height=${t} /><rect class="bar" x="62" y=${y} width="38" height=${t} />`);
  }
  return html`<svg class="hex tri" viewBox=${`0 0 100 ${h}`} width=${size} height=${(size * h) / 100} aria-hidden="true">${bars}</svg>`;
}

// ---------- line editor ----------
// value: 6 chars bottom → top of '1' / '0' / '?'. cycle: the order a tap moves through.
export function LineEditor({ value, onChange, cycle = ['?', '1', '0'], wrong = [], disabled = false, labels = true }) {
  const tap = (i) => {
    if (disabled) return;
    const cur = value[i];
    const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
    onChange(value.slice(0, i) + next + value.slice(i + 1));
  };
  const rows = [];
  for (let i = 5; i >= 0; i--) {
    const c = value[i];
    rows.push(html`<button type="button" class=${`le-row${wrong.includes(i) ? ' wrong' : ''}`} onClick=${() => tap(i)} disabled=${disabled}
        aria-label=${`line ${i + 1}: ${c === '1' ? 'yang' : c === '0' ? 'yin' : 'empty'}`}>
      ${labels ? html`<span class="le-pos">${['初', '二', '三', '四', '五', '上'][i]}</span>` : null}
      <span class=${`le-bar le-${c === '1' ? 'yang' : c === '0' ? 'yin' : 'empty'}`}><i></i><i></i></span>
    </button>`);
  }
  return html`<div class="line-editor">${rows}</div>`;
}

// ---------- text ----------
export function useEn() {
  return store.settings().showEn;
}

// Chinese block with optional English below it.
export function Bi({ zh, en, cls = '' }) {
  const showEn = useEn();
  return html`<div class=${`bi ${cls}`}>
    ${zh ? html`<p class="zh">${zh}</p>` : null}
    ${showEn && en ? html`<p class="en">${en}</p>` : null}
  </div>`;
}

// Inline label: 中文 English
export function L({ zh, en }) {
  const showEn = useEn();
  return html`<span class="lbl">${zh}${showEn && en ? html` <small class="en-inline">${en}</small>` : null}</span>`;
}

export function LinkChip({ link }) {
  const l = linkLabel[link];
  if (!l) return null;
  return html`<span class=${`chip link-${link}`} title=${l.en}>${l.zh} · ${l.long}${useEn() ? html` <small>${l.en}</small>` : null}</span>`;
}

export function RelChip({ rel }) {
  const r = relLabel[rel];
  return html`<span class="chip rel">${r.zh}${useEn() ? html` <small>${r.en}</small>` : null}</span>`;
}

// Compact tile used in grids and lists
export function HexTile({ n, onClick, href, level, extra }) {
  const h = hex(n);
  const inner = html`<span class="tile-num">${n}</span>
    <${HexSvg} lines=${h.lines} size=${38} />
    <span class="tile-name">${h.name}</span>
    ${extra || null}
    ${level != null ? html`<span class=${`lv lv-${level}`}></span>` : null}`;
  return href
    ? html`<a class="tile" href=${href}>${inner}</a>`
    : html`<button type="button" class="tile" onClick=${onClick}>${inner}</button>`;
}

export function Toast({ toast, onClose }) {
  if (!toast) return null;
  return html`<div class="toast" role="status">
    <span>${toast.msg}</span>
    ${toast.action ? html`<button onClick=${() => { toast.action.fn(); onClose(); }}>${toast.action.label}</button>` : null}
    <button class="x" onClick=${onClose} aria-label="close">×</button>
  </div>`;
}

export function Segmented({ value, options, onChange }) {
  return html`<div class="seg" role="tablist">
    ${options.map((o) => html`<button type="button" role="tab" aria-selected=${value === o.value} class=${value === o.value ? 'on' : ''} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
  </div>`;
}
