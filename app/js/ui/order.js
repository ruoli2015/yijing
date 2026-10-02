// 卦序之理: essays on the logic of the order, Zhu Xi's rhyme, and the whole chain stage by stage.
import { html, useState, useEffect } from '../../vendor/preact.js';
import { data, hex, all, linkLabel } from '../hex.js';
import { HexSvg, Bi, L, LinkChip, useEn } from './common.js';

export function Order({ params }) {
  const d = data();
  const en = useEn();
  const focusStage = params.stage != null ? Number(params.stage) : null;
  const [openStages, setOpenStages] = useState(() => new Set(focusStage != null ? [focusStage] : []));
  const [openLinks, setOpenLinks] = useState(new Set());

  useEffect(() => {
    if (focusStage != null) document.getElementById(`stage-${focusStage}`)?.scrollIntoView({ block: 'start' });
  }, []);

  const toggle = (set, setter, k) => {
    const s = new Set(set);
    s.has(k) ? s.delete(k) : s.add(k);
    setter(s);
  };

  const counts = all().reduce((m, h) => ({ ...m, [h.link]: (m[h.link] || 0) + 1 }), {});

  return html`<div class="page order">
    <div class="card intro">
      <h1>卦序之理 <small>The Logic of the Order</small></h1>
      <${Bi} zh="《序卦傳》用一連串因果把六十四卦串成一個故事。這裡先讀幾篇導論，再逐段走過整個卦序。"
        en="The Xugua strings the sixty-four hexagrams into one story through a chain of causes. Start with the short essays, then walk the whole sequence stage by stage." />
      <div class="link-counts">
        ${['承', '反', '補', '始'].map((k) => html`<span class=${`chip link-${k}`}>${k} ${linkLabel[k].long}${en ? html` <small>${linkLabel[k].en}</small>` : null} · ${counts[k] || 0}</span>`)}
      </div>
    </div>

    ${d.essays.map((e) => html`<details class="card essay">
      <summary><span>${e.titleZh}</span>${en ? html`<small>${e.titleEn}</small>` : null}</summary>
      <${Bi} zh=${e.bodyZh} en=${e.bodyEn} />
    </details>`)}

    <details class="card song">
      <summary><span>${d.song.titleZh}</span>${en ? html`<small>${d.song.titleEn}</small>` : null}</summary>
      <p class="muted small">${d.song.sourceZh}</p>
      <div class="song-lines">${d.song.lines.map((l) => html`<p class="classic">${l}</p>`)}</div>
    </details>

    <h2 class="section-title"><${L} zh="逐段讀卦序" en="The sequence, stage by stage" /></h2>
    ${d.stages.map((s, i) => {
      const open = openStages.has(i);
      const nums = Array.from({ length: s.to - s.from + 1 }, (_, k) => s.from + k);
      return html`<section class=${`card stage${open ? ' open' : ''}`} id=${`stage-${i}`}>
        ${i === 0 ? html`<div class="canon-tag">上經 Upper Canon</div>` : i === 8 ? html`<div class="canon-tag">下經 Lower Canon</div>` : null}
        <button type="button" class="stage-head" onClick=${() => toggle(openStages, setOpenStages, i)} aria-expanded=${open}>
          <span class="stage-range">${s.from}–${s.to}</span>
          <span class="stage-title">${s.titleZh}${en ? html`<small>${s.titleEn}</small>` : null}</span>
          <span class="stage-figs">${nums.map((n) => html`<${HexSvg} lines=${hex(n).lines} size=${18} />`)}</span>
          <span class="caret">${open ? '−' : '+'}</span>
        </button>
        <${Bi} cls="stage-sum" zh=${s.summaryZh} en=${s.summaryEn} />
        ${open
          ? html`<ol class="chain">${nums.map((n) => {
              const h = hex(n);
              const lo = openLinks.has(n);
              return html`<li class="chain-item">
                <div class="chain-row">
                  <a href=${`#/h/${n}`} class="chain-hex"><${HexSvg} lines=${h.lines} size=${30} /><b>${n}</b> ${h.name}</a>
                  <${LinkChip} link=${h.link} />
                </div>
                <blockquote class="classic" onClick=${() => toggle(openLinks, setOpenLinks, n)}>${h.xugua.zh}</blockquote>
                ${lo
                  ? html`<${Bi} cls="xg-en" en=${h.xugua.en} />
                    <div class="modern"><div class="modern-label"><${L} zh="今解" en="Modern reading" /></div><${Bi} zh=${h.logicZh} en=${h.logicEn} /></div>`
                  : null}
                <button type="button" class="link small" onClick=${() => toggle(openLinks, setOpenLinks, n)}>${lo ? '收起 Hide' : '今解 · Explain ›'}</button>
              </li>`;
            })}</ol>`
          : null}
      </section>`;
    })}
  </div>`;
}
