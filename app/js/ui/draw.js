// 畫卦: given a name, draw the hexagram line by line and give its number.
import { html, useState, useRef, useEffect } from '../../vendor/preact.js';
import * as store from '../store.js';
import { hex } from '../hex.js';
import { pool, pickNext, numberOptions, updateStat } from '../quiz.js';
import { HexSvg, LineEditor, L } from './common.js';
import { Reveal, QuizControls, Score } from './reveal.js';
import { Part, Choices } from './identify.js';

function newQuestion(recent) {
  const s = store.get();
  const n = pickNext(pool(s.settings.range, s.draw), s.draw, recent);
  return { n, numOpts: numberOptions(n) };
}

export function Draw() {
  const recent = useRef([]);
  const [q, setQ] = useState(() => newQuestion([]));
  const [lines, setLines] = useState('??????');
  const [num, setNum] = useState(null);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const mode = store.settings().quizMode;
  const h = hex(q.n);
  const revealRef = useRef(null);
  const answered = !lines.includes('?') && num != null && String(num).trim() !== '';

  const restart = () => {
    recent.current = [];
    setQ(newQuestion([]));
    setLines('??????');
    setNum(null);
    setResult(null);
  };

  const check = () => {
    if (!answered || result) return;
    const wrong = [...lines].map((c, i) => (c !== h.lines[i] ? i : -1)).filter((i) => i >= 0);
    const ok = { lines: wrong.length === 0, num: Number(num) === q.n };
    const allRight = ok.lines && ok.num;
    store.setStat('draw', q.n, updateStat(store.get().draw[q.n], allRight));
    setScore((s) => ({ right: s.right + (allRight ? 1 : 0), total: s.total + 1, streak: allRight ? s.streak + 1 : 0 }));
    setResult({ ok, wrong, allRight });
  };

  const next = () => {
    recent.current = [q.n, ...recent.current].slice(0, 4);
    setQ(newQuestion(recent.current));
    setLines('??????');
    setNum(null);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (result && revealRef.current) revealRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  return html`<div class="page quiz">
    <div class="quiz-head">
      <h2>畫卦 <small>Draw</small></h2>
      <${Score} score=${score} />
    </div>
    <${QuizControls} onChange=${restart} />

    <form class="card question" onSubmit=${(e) => { e.preventDefault(); result ? next() : check(); }}>
      <div class="q-name">${h.name}<span class="hh-pinyin">${h.pinyin}</span></div>

      <${Part} label=${html`<${L} zh="畫出卦象（由下而上，點擊切換陰陽）" en="Draw it — bottom to top; tap to switch yin/yang" />`} ok=${result?.ok.lines} answer="">
        <div class="draw-area">
          <${LineEditor} value=${lines} onChange=${(v) => !result && setLines(v)} cycle=${['1', '0']} wrong=${result?.wrong || []} disabled=${!!result} />
          ${result && !result.ok.lines
            ? html`<div class="draw-answer"><${HexSvg} lines=${h.lines} size=${88} focus=${result.wrong} /><small>正確 correct</small></div>`
            : null}
        </div>
      </${Part}>

      <${Part} label=${html`<${L} zh="卦序" en="Number" />`} ok=${result?.ok.num} answer=${String(q.n)}>
        ${mode === 'mc'
          ? html`<${Choices} opts=${q.numOpts} value=${num} onPick=${(v) => !result && setNum(v)} result=${result} correct=${q.n} render=${(m) => m} />`
          : html`<input class="text num" type="number" inputmode="numeric" min="1" max="64" placeholder="1–64" value=${num ?? ''} onInput=${(e) => setNum(e.target.value)} disabled=${!!result} />`}
      </${Part}>

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
