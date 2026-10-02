// One hexagram: figure, names, trigrams, 序卦 links in and out, 卦辭, 彖傳, 大象, 爻辭 with 小象.
import { html, useEffect, useRef } from '../../vendor/preact.js';
import { hex, trigram, data } from '../hex.js';
import { HexSvg, TriSvg, Bi, L, LinkChip, RelChip, useEn } from './common.js';

const NUM_ZH = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function numZh(n) {
  if (n < 10) return NUM_ZH[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return (t > 1 ? NUM_ZH[t] : '') + '十' + (u ? NUM_ZH[u] : '');
}

// Header block: figure + names + trigram composition
export function HexHeader({ n, size = 96, hideName = false }) {
  const h = hex(n);
  const up = trigram(h.upper);
  const low = trigram(h.lower);
  const en = useEn();
  return html`<div class="hex-header">
    <${HexSvg} lines=${h.lines} size=${size} />
    <div class="hh-text">
      <div class="hh-num">第${numZh(n)}卦 <small>No. ${n} · ${h.canon === 'upper' ? '上經' : '下經'}</small></div>
      ${hideName ? null : html`<h1 class="hh-name">${h.name}<span class="hh-pinyin">${h.pinyin}</span></h1>
        <div class="hh-full">${h.full}${en ? html` <span class="hh-en">${h.en}${h.enAlt ? ` · ${h.enAlt}` : ''}</span>` : null}</div>`}
      <div class="hh-tri">
        <span><${TriSvg} lines=${up.lines} /> 上${up.name}${up.image}${en ? html` <small>${up.imageEn}</small>` : null}</span>
        <span><${TriSvg} lines=${low.lines} /> 下${low.name}${low.image}${en ? html` <small>${low.imageEn}</small>` : null}</span>
      </div>
    </div>
  </div>`;
}

// The 序卦 link that brings hexagram `to` in (from to-1).
export function XuguaLink({ to, dir = 'in', open = true }) {
  const h = hex(to);
  const from = to > 1 ? hex(to - 1) : null;
  const shared = to === 1 || to === 2;
  return html`<div class=${`xg xg-${dir}`}>
    <div class="xg-head">
      ${from ? html`<a href=${`#/h/${from.n}`} class="xg-from"><${HexSvg} lines=${from.lines} size=${22} /> ${from.n} ${from.name}</a><span class="arrow">→</span>` : null}
      <a href=${`#/h/${h.n}`} class="xg-to"><${HexSvg} lines=${h.lines} size=${22} /> ${h.n} ${h.name}</a>
      <${LinkChip} link=${h.link} />
    </div>
    <blockquote class="classic">${h.xugua.zh}</blockquote>
    ${shared ? html`<p class="muted small">乾、坤共用序卦傳首句。 Qian and Kun share the opening sentence.</p>` : null}
    ${open ? html`<${Bi} cls="xg-en" en=${h.xugua.en} />
      <div class="modern">
        <div class="modern-label"><${L} zh="今解" en="Modern reading" /></div>
        <${Bi} zh=${h.logicZh} en=${h.logicEn} />
      </div>` : null}
  </div>`;
}

export function Detail({ n }) {
  const h = hex(n);
  const en = useEn();
  const touch = useRef(null);
  const go = (m) => {
    if (m >= 1 && m <= 64) location.hash = `#/h/${m}`;
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') go(n - 1);
      if (e.key === 'ArrowRight') go(n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n]);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, at: Date.now() };
  };
  const onTouchEnd = (e) => {
    const s = touch.current;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - s.at < 600) go(dx < 0 ? n + 1 : n - 1);
    touch.current = null;
  };

  const stage = data().stages[h.stage];
  const judgment = h.judgmentLabel ? `${h.judgmentLabel}：${h.judgment}` : h.judgment;
  const pairH = hex(h.pair.n);

  return html`<div class="page detail" onTouchStart=${onTouchStart} onTouchEnd=${onTouchEnd}>
    <div class="card">
      <${HexHeader} n=${n} />
      <${Bi} cls="gist" zh=${h.gistZh} en=${h.gistEn} />
      <div class="relations">
        <a href=${`#/h/${pairH.n}`} class="rel-link"><${HexSvg} lines=${pairH.lines} size=${20} /> ${pairH.n} ${pairH.name}</a>
        <${RelChip} rel=${h.pair.rel} />
        ${h.zong !== h.pair.n && h.zong !== n ? html`<a class="rel-link" href=${`#/h/${h.zong}`}>綜 ${hex(h.zong).name}</a>` : null}
        ${h.cuo !== h.pair.n ? html`<a class="rel-link" href=${`#/h/${h.cuo}`}>錯 ${hex(h.cuo).name}</a>` : null}
      </div>
      <a class="stage-link" href=${`#/order?stage=${h.stage}`}>
        <span class="muted">段落 Stage ${h.stage + 1}:</span> ${stage.titleZh}${en ? html` <small>${stage.titleEn}</small>` : null} ›
      </a>
    </div>

    <section class="card">
      <h2><${L} zh="序卦傳 · 從何而來" en="Xugua · how it arrives" /></h2>
      <${XuguaLink} to=${n} />
      ${n < 64
        ? html`<h2 class="sub"><${L} zh="往何處去" en="where it leads" /></h2><${XuguaLink} to=${n + 1} dir="out" open=${false} />
          <a class="more" href=${`#/h/${n + 1}`}>${hex(n + 1).name}之今解 · read on ›</a>`
        : html`<p class="muted">未濟為六十四卦之終——「終焉」。 Wei Ji closes the sequence.</p>`}
    </section>

    <section class="card classic-texts">
      <h2><${L} zh="卦辭" en="Judgment" /></h2>
      <p class="classic big">${judgment}</p>
      <h2><${L} zh="彖傳" en="Tuan commentary" /></h2>
      <p class="classic">彖曰：${h.tuan}</p>
      <h2><${L} zh="大象傳" en="Great Image" /></h2>
      <p class="classic">象曰：${h.daxiang}</p>
    </section>

    <section class="card classic-texts">
      <h2><${L} zh="爻辭 · 小象傳" en="Line texts · Small Images" /></h2>
      <ol class="yao">
        ${h.yao.map((y, i) => {
          return html`<li>
            <div class="yao-line">
              ${i < 6 ? html`<${HexSvg} lines=${h.lines} focus=${[i]} size=${20} cls="yao-mini" />` : html`<span class="yao-use">用</span>`}
              <p class="classic"><b>${y.pos}</b>：${y.text}</p>
            </div>
            <p class="classic xiang">象曰：${y.xiang}</p>
          </li>`;
        })}
      </ol>
    </section>

    <div class="pager">
      ${n > 1 ? html`<a href=${`#/h/${n - 1}`}>‹ ${n - 1} ${hex(n - 1).name}</a>` : html`<span></span>`}
      ${n < 64 ? html`<a href=${`#/h/${n + 1}`}>${n + 1} ${hex(n + 1).name} ›</a>` : html`<span></span>`}
    </div>
  </div>`;
}
