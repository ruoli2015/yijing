// 占卦: three-coin divination with Zhu Xi's reading rules, and a journal of past casts.
import { html, useState } from '../../vendor/preact.js';
import * as store from '../store.js';
import { byLines, hex, POS_NAMES } from '../hex.js';
import { tossCoins, castResult, readingPlan, VALUE_INFO } from '../divine.js';
import { HexSvg, Bi, L, useEn } from './common.js';

function Coin({ face, spinning }) {
  // face: 3 = 背 (plain), 2 = 字 (inscribed)
  return html`<div class=${`coin${spinning ? ' spin' : ''}${face === 3 ? ' back' : ' front'}`} aria-label=${face === 3 ? '背' : '字'}>
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" class="coin-rim" />
      <circle cx="50" cy="50" r="40" class="coin-face" />
      <rect x="40" y="40" width="20" height="20" class="coin-hole" />
      ${face === 2 && !spinning
        ? html`<text x="50" y="30" class="coin-ch">周</text><text x="50" y="84" class="coin-ch">易</text><text x="22" y="57" class="coin-ch">通</text><text x="78" y="57" class="coin-ch">寶</text>`
        : null}
    </svg>
  </div>`;
}

export function Divine({ sub }) {
  if (sub === 'journal') return html`<${Journal} />`;
  if (sub && sub.startsWith('r')) return html`<${Saved} id=${sub.slice(1)} />`;
  return html`<${Cast} />`;
}

function Cast() {
  const [question, setQuestion] = useState('');
  const [tosses, setTosses] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const en = useEn();
  const done = tosses.length === 6;

  const toss = () => {
    if (spinning || done) return;
    setSpinning(true);
    const t = tossCoins();
    setTimeout(() => {
      setTosses((ts) => [...ts, t]);
      setSpinning(false);
    }, 650);
  };
  const reset = () => {
    setTosses([]);
    setSavedId(null);
  };
  const save = () => {
    const id = store.addJournal({ q: question.trim(), values: tosses.map((t) => t.value) });
    setSavedId(id);
  };

  const last = tosses[tosses.length - 1];
  const partial = tosses.map((t) => (VALUE_INFO[t.value].yang ? '1' : '0')).join('').padEnd(6, '?');
  const changingSoFar = tosses.map((t, i) => (VALUE_INFO[t.value].changing ? i : -1)).filter((i) => i >= 0);

  return html`<div class="page divine">
    <div class="card">
      <h1>占卦 <small>Coin Divination</small></h1>
      <${Bi} zh="靜心思考你的問題，然後擲錢六次，由下而上成卦。三錢之中：字為二，背為三；合計六為老陰、七為少陽、八為少陰、九為老陽。老陰老陽為變爻。"
        en="Hold your question in mind, then toss three coins six times; the hexagram is built from the bottom up. Inscribed side = 2, plain side = 3. A total of 6 is old yin, 7 young yang, 8 young yin, 9 old yang; old lines are changing lines." />
      <p class="muted small">供學習與自省之用 · For study and reflection.</p>
      <div class="journal-link"><a href="#/divine/journal">占卜記錄 Journal (${store.get().journal.length}) ›</a></div>
    </div>

    ${!done || !savedId
      ? html`<div class="card cast">
          ${tosses.length === 0
            ? html`<textarea class="text" rows="2" placeholder="所問何事？（可留空） · Your question (optional)" value=${question} onInput=${(e) => setQuestion(e.target.value)}></textarea>`
            : question ? html`<p class="question-text">「${question}」</p>` : null}
          <div class="cast-body">
            <div class="coins" onClick=${toss}>
              ${(last && !spinning ? last.coins : [2, 3, 2]).map((f) => html`<${Coin} face=${f} spinning=${spinning} />`)}
            </div>
            <div class="cast-lines">
              <${HexSvg} lines=${partial} size=${110} changing=${changingSoFar} />
            </div>
          </div>
          ${last && !spinning ? html`<p class="center toss-result">第${tosses.length}爻 · ${POS_NAMES[tosses.length - 1]}：${last.value} ${VALUE_INFO[last.value].zh}${en ? html` <small>${VALUE_INFO[last.value].en}</small>` : null}</p>` : null}
          <div class="q-actions">
            ${done ? null : html`<button class="primary big" onClick=${toss} disabled=${spinning}>擲錢 Toss (${tosses.length + 1}/6)</button>`}
          </div>
        </div>`
      : null}

    ${done ? html`<${Reading} values=${tosses.map((t) => t.value)} question=${question} />
      <div class="q-actions">
        ${savedId
          ? html`<span class="muted">已存入記錄 · Saved</span><button class="ghost" onClick=${reset}>再占一卦 New cast</button>`
          : html`<button class="primary" onClick=${save}>存入記錄 Save to journal</button><button class="ghost" onClick=${reset}>重新起卦 Start over</button>`}
      </div>` : null}
  </div>`;
}

export function Reading({ values, question }) {
  const en = useEn();
  const res = castResult(values);
  const plan = readingPlan(res);
  const P = byLines(res.primary);
  const R = res.relating ? byLines(res.relating) : null;
  const isFocus = (which, kind, line) => plan.focus.some((f) => f.hex === which && f.kind === kind && (line == null || f.line === line));
  const mainFocus = plan.focus[0];

  const texts = (h, which) => {
    const lineFocus = plan.focus.filter((f) => f.hex === which && f.kind === 'line').map((f) => f.line);
    const jFocus = isFocus(which, 'judgment');
    const useFocus = isFocus(which, 'use');
    const isMain = (kind, line) => mainFocus.hex === which && mainFocus.kind === kind && (line == null || mainFocus.line === line);
    const judgment = h.judgmentLabel ? `${h.judgmentLabel}：${h.judgment}` : h.judgment;
    return html`<div class="reading-texts">
      <div class=${`rt${jFocus ? ' focus' : ''}${isMain('judgment') ? ' main' : ''}`}>
        <div class="rt-label">卦辭 <small>Judgment</small>${isMain('judgment') ? html`<span class="badge">主 main</span>` : null}</div>
        <p class="classic">${judgment}</p>
        ${jFocus ? html`<p class="classic xiang">彖曰：${h.tuan}</p><p class="classic xiang">象曰：${h.daxiang}</p>` : null}
      </div>
      ${(which === 'primary' ? res.changing : lineFocus).slice().sort((a, b) => b - a).map((i) => html`
        <div class=${`rt${lineFocus.includes(i) ? ' focus' : ''}${isMain('line', i) ? ' main' : ''}`}>
          <div class="rt-label">${h.yao[i].pos}${isMain('line', i) ? html`<span class="badge">主 main</span>` : null}</div>
          <p class="classic">${h.yao[i].text}</p>
          <p class="classic xiang">象曰：${h.yao[i].xiang}</p>
        </div>`)}
      ${useFocus && h.yao[6] ? html`<div class="rt focus main">
          <div class="rt-label">${h.yao[6].pos}<span class="badge">主 main</span></div>
          <p class="classic">${h.yao[6].text}</p>
          <p class="classic xiang">象曰：${h.yao[6].xiang}</p>
        </div>` : null}
    </div>`;
  };

  return html`<div class="card reading">
    ${question ? html`<p class="question-text">「${question}」</p>` : null}
    <div class="reading-figs">
      <a href=${`#/h/${P.n}`} class="rf">
        <${HexSvg} lines=${res.primary} size=${96} changing=${res.changing} />
        <span class="rf-label">本卦 <small>Primary</small></span>
        <b>${P.n} ${P.name}</b><span class="muted">${P.full}</span>
      </a>
      ${R ? html`<span class="arrow big">→</span>
        <a href=${`#/h/${R.n}`} class="rf">
          <${HexSvg} lines=${res.relating} size=${96} />
          <span class="rf-label">之卦 <small>Resulting</small></span>
          <b>${R.n} ${R.name}</b><span class="muted">${R.full}</span>
        </a>` : null}
    </div>
    <div class="values">${values.map((v, i) => html`<span class=${VALUE_INFO[v].changing ? 'chg' : ''}>${POS_NAMES[i]}${v}</span>`)}</div>
    <div class="plan"><${Bi} zh=${plan.zh} en=${plan.en} /><p class="muted small">依朱熹《易學啟蒙·考變占》 · Following Zhu Xi's rules.</p></div>

    <h3 class="sub">${P.name} <small>${en ? P.en : ''}</small></h3>
    ${texts(P, 'primary')}
    ${R ? html`<h3 class="sub">${R.name} <small>${en ? R.en : ''}</small></h3>${texts(R, 'relating')}` : null}
    <div class="modern">
      <div class="modern-label"><${L} zh="卦意" en="Theme" /></div>
      <${Bi} zh=${P.gistZh} en=${P.gistEn} />
      ${R ? html`<${Bi} zh=${`→ ${R.name}：${R.gistZh}`} en=${`→ ${R.en}: ${R.gistEn}`} />` : null}
    </div>
  </div>`;
}

function Journal() {
  const list = store.get().journal;
  return html`<div class="page divine">
    <div class="card"><h1>占卜記錄 <small>Journal</small></h1>
      <p class="muted small">記錄只保存在這台裝置上。 Entries are stored on this device only.</p></div>
    ${list.length === 0 ? html`<p class="muted center">尚無記錄 · No entries yet. <a href="#/divine">起卦 Cast ›</a></p>` : null}
    ${list.map((j) => {
      const res = castResult(j.values);
      const P = byLines(res.primary);
      const R = res.relating ? byLines(res.relating) : null;
      return html`<a class="card journal-item" href=${`#/divine/r${j.id}`}>
        <${HexSvg} lines=${res.primary} size=${40} changing=${res.changing} />
        <div>
          <div><b>${P.name}</b>${R ? html` → <b>${R.name}</b>` : null}</div>
          <div class="muted small">${new Date(j.ts).toLocaleString()}</div>
          ${j.q ? html`<div class="small">「${j.q}」</div>` : null}
        </div>
      </a>`;
    })}
  </div>`;
}

function Saved({ id }) {
  const j = store.get().journal.find((x) => x.id === id);
  const [note, setNote] = useState(j?.note || '');
  if (!j) return html`<div class="page"><p class="muted">找不到記錄 · Entry not found.</p></div>`;
  return html`<div class="page divine">
    <div class="card"><div class="muted small">${new Date(j.ts).toLocaleString()}</div></div>
    <${Reading} values=${j.values} question=${j.q} />
    <div class="card">
      <label class="part-label" for="note"><${L} zh="心得筆記" en="Notes" /></label>
      <textarea id="note" class="text" rows="4" value=${note} onInput=${(e) => setNote(e.target.value)} onBlur=${() => store.updateJournal(id, { note })}></textarea>
      <div class="q-actions">
        <button class="ghost danger" onClick=${() => { if (confirm('刪除此記錄？ Delete this entry?')) { store.deleteJournal(id); location.hash = '#/divine/journal'; } }}>刪除 Delete</button>
      </div>
    </div>
  </div>`;
}
