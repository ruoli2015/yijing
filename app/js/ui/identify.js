// 認卦: see a hexagram, name it, give its number, and the hexagrams before and after it.
import { html, useState, useMemo, useRef, useEffect } from '../../vendor/preact.js';
import * as store from '../store.js';
import { hex, all, nameMatches } from '../hex.js';
import { pool, pickNext, nameOptions, orderOptions, numberOptions, updateStat } from '../quiz.js';
import { HexSvg, L } from './common.js';
import { Reveal, QuizControls, Score } from './reveal.js';

function newQuestion(recent) {
  const s = store.get();
  const n = pickNext(pool(s.settings.range, s.identify), s.identify, recent);
  const hs = all();
  return {
    n,
    opts: {
      name: nameOptions(n, hs),
      num: numberOptions(n),
      prev: n > 1 ? orderOptions(n - 1, n, hs) : null,
      next: n < 64 ? orderOptions(n + 1, n, hs) : null,
    },
  };
}

export function Identify() {
  const recent = useRef([]);
  const [q, setQ] = useState(() => newQuestion([]));
  const [ans, setAns] = useState({});
  const [result, setResult] = useState(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const mode = store.settings().quizMode;
  const h = hex(q.n);
  const revealRef = useRef(null);

  const parts = ['name', 'num', ...(q.n > 1 ? ['prev'] : []), ...(q.n < 64 ? ['next'] : [])];
  const answered = parts.every((p) => ans[p] != null && String(ans[p]).trim() !== '');

  const restart = () => {
    recent.current = [];
    setQ(newQuestion([]));
    setAns({});
    setResult(null);
  };

  const check = () => {
    if (!answered || result) return;
    const ok = {
      name: mode === 'mc' ? ans.name === q.n : nameMatches(ans.name, h),
      num: Number(ans.num) === q.n,
      prev: q.n > 1 ? (mode === 'mc' ? ans.prev === q.n - 1 : nameMatches(ans.prev, hex(q.n - 1))) : true,
      next: q.n < 64 ? (mode === 'mc' ? ans.next === q.n + 1 : nameMatches(ans.next, hex(q.n + 1))) : true,
    };
    const allRight = parts.every((p) => ok[p]);
    store.setStat('identify', q.n, updateStat(store.get().identify[q.n], allRight));
    setScore((s) => ({ right: s.right + (allRight ? 1 : 0), total: s.total + 1, streak: allRight ? s.streak + 1 : 0 }));
    setResult({ ok, allRight });
  };

  const next = () => {
    recent.current = [q.n, ...recent.current].slice(0, 4);
    setQ(newQuestion(recent.current));
    setAns({});
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (result && revealRef.current) revealRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  const set = (k, v) => !result && setAns({ ...ans, [k]: v });

  return html`<div class="page quiz">
    <div class="quiz-head">
      <h2>認卦 <small>Identify</small></h2>
      <${Score} score=${score} />
    </div>
    <${QuizControls} onChange=${restart} />

    <form class="card question" onSubmit=${(e) => { e.preventDefault(); result ? next() : check(); }}>
      <div class="q-figure"><${HexSvg} lines=${h.lines} size=${128} /></div>

      <${Part} label=${html`<${L} zh="卦名" en="Name" />`} ok=${result?.ok.name} answer=${`${h.name}（${h.full}）`}>
        ${mode === 'mc'
          ? html`<${Choices} opts=${q.opts.name} value=${ans.name} onPick=${(v) => set('name', v)} result=${result} correct=${q.n} render=${(m) => hex(m).name} />`
          : html`<input class="text" lang="zh-Hant" autocomplete="off" placeholder="卦名或拼音 · name or pinyin" value=${ans.name || ''} onInput=${(e) => set('name', e.target.value)} disabled=${!!result} />`}
      </${Part}>

      <${Part} label=${html`<${L} zh="卦序" en="Number" />`} ok=${result?.ok.num} answer=${String(q.n)}>
        ${mode === 'mc'
          ? html`<${Choices} opts=${q.opts.num} value=${ans.num} onPick=${(v) => set('num', v)} result=${result} correct=${q.n} render=${(m) => m} />`
          : html`<input class="text num" type="number" inputmode="numeric" min="1" max="64" placeholder="1–64" value=${ans.num ?? ''} onInput=${(e) => set('num', e.target.value)} disabled=${!!result} />`}
      </${Part}>

      ${q.n > 1
        ? html`<${Part} label=${html`<${L} zh="前一卦" en="Previous" />`} ok=${result?.ok.prev} answer=${`${q.n - 1} ${hex(q.n - 1).name}`}>
            ${mode === 'mc'
              ? html`<${Choices} opts=${q.opts.prev} value=${ans.prev} onPick=${(v) => set('prev', v)} result=${result} correct=${q.n - 1} render=${(m) => hex(m).name} />`
              : html`<input class="text" lang="zh-Hant" autocomplete="off" placeholder="卦名 · name" value=${ans.prev || ''} onInput=${(e) => set('prev', e.target.value)} disabled=${!!result} />`}
          </${Part}>`
        : html`<p class="muted small">乾為第一卦，之前無卦。 Qian is first; nothing precedes it.</p>`}

      ${q.n < 64
        ? html`<${Part} label=${html`<${L} zh="後一卦" en="Next" />`} ok=${result?.ok.next} answer=${`${q.n + 1} ${hex(q.n + 1).name}`}>
            ${mode === 'mc'
              ? html`<${Choices} opts=${q.opts.next} value=${ans.next} onPick=${(v) => set('next', v)} result=${result} correct=${q.n + 1} render=${(m) => hex(m).name} />`
              : html`<input class="text" lang="zh-Hant" autocomplete="off" placeholder="卦名 · name" value=${ans.next || ''} onInput=${(e) => set('next', e.target.value)} disabled=${!!result} />`}
          </${Part}>`
        : html`<p class="muted small">未濟為最後一卦。 Wei Ji is the last.</p>`}

      <div class="q-actions">
        ${result
          ? html`<div class=${`verdict ${result.allRight ? 'good' : 'bad'}`}>${result.allRight ? '全對！ All correct' : '再接再厲 · Keep going'}</div>
              <button type="submit" class="primary">下一題 Next ›</button>`
          : html`<button type="submit" class="primary" disabled=${!answered}>核對 Check</button>`}
      </div>
    </form>

    ${result ? html`<div ref=${revealRef}><${Reveal} n=${q.n} /></div>
      <div class="q-actions bottom"><button type="button" class="primary" onClick=${next}>下一題 Next ›</button></div>` : null}
  </div>`;
}

export function Part({ label, ok, answer, children }) {
  return html`<div class=${`part${ok === true ? ' ok' : ok === false ? ' no' : ''}`}>
    <div class="part-label">${label}${ok === true ? html`<span class="mark">✓</span>` : ok === false ? html`<span class="mark">✗ <span class="answer">${answer}</span></span>` : null}</div>
    ${children}
  </div>`;
}

export function Choices({ opts, value, onPick, result, correct, render }) {
  return html`<div class="choices">
    ${opts.map((o) => {
      let cls = 'choice';
      if (value === o) cls += ' picked';
      if (result && o === correct) cls += ' right';
      else if (result && value === o) cls += ' wrong';
      return html`<button type="button" class=${cls} onClick=${() => onPick(o)} disabled=${!!result}>${render(o)}</button>`;
    })}
  </div>`;
}
