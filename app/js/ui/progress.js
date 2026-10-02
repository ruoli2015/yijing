// Progress per hexagram for both quizzes, plus settings and backup.
import { html, useState } from '../../vendor/preact.js';
import * as store from '../store.js';
import { all } from '../hex.js';
import { level } from '../quiz.js';
import { HexTile, Segmented, L } from './common.js';
import { Bar } from './home.js';

const LEVELS = [
  ['未學', 'new'],
  ['學習中', 'learning'],
  ['熟悉', 'familiar'],
  ['熟記', 'mastered'],
];

export function Progress() {
  const [kind, setKind] = useState('identify');
  const s = store.get();
  const stats = s[kind];
  const counts = [0, 1, 2, 3].map((l) => all().filter((h) => level(stats[h.n]) === l).length);
  const seen = Object.values(stats).reduce((a, x) => a + x.seen, 0);
  const right = Object.values(stats).reduce((a, x) => a + x.right, 0);

  const doExport = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `yijing-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doImport = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      try {
        store.importJson(t);
        alert('已匯入 · Imported');
      } catch (err) {
        alert(`匯入失敗 · Import failed: ${err.message}`);
      }
    });
  };

  return html`<div class="page progress">
    <div class="card">
      <h1>進度 <small>Progress</small></h1>
      <${Segmented} value=${kind} onChange=${setKind} options=${[{ value: 'identify', label: '認卦 Identify' }, { value: 'draw', label: '畫卦 Draw' }]} />
      <${Bar} counts=${counts} />
      <div class="legend">${LEVELS.map(([zh, en], l) => html`<span><i class=${`seg-${l}`}></i>${zh} <small>${en}</small> ${counts[l]}</span>`)}</div>
      <p class="muted small">作答 ${seen} 次 · 全對 ${right} 次${seen ? `（${Math.round((100 * right) / seen)}%）` : ''} · ${seen} answered, ${right} fully correct</p>
    </div>
    <div class="grid">${all().map((h) => html`<${HexTile} n=${h.n} href=${`#/h/${h.n}`} level=${level(stats[h.n])} />`)}</div>

    <div class="card settings">
      <h2><${L} zh="設定" en="Settings" /></h2>
      <label class="toggle">
        <input type="checkbox" checked=${s.settings.showEn} onChange=${(e) => store.setSetting('showEn', e.target.checked)} />
        <span>顯示英文 Show English</span>
      </label>
      <h2><${L} zh="備份" en="Backup" /></h2>
      <p class="muted small">進度保存在本機瀏覽器。換手機或電腦時，可匯出再匯入。 Progress lives in this browser; export it to move to another device.</p>
      <div class="q-actions left">
        <button class="ghost" onClick=${doExport}>匯出 Export</button>
        <label class="ghost file-btn">匯入 Import<input type="file" accept="application/json" onChange=${doImport} hidden /></label>
        <button class="ghost danger" onClick=${() => confirm('清除所有測驗進度？ Reset all quiz progress?') && store.resetProgress()}>重設 Reset</button>
      </div>
    </div>
    <p class="muted small center">經傳原文：維基文庫《周易》（王弼本／朱熹本校訂）。今解為本應用撰寫，參酌程頤《伊川易傳》、朱熹《周易本義》。<br />
      Classical texts from Chinese Wikisource, checked against the received editions. Modern readings written for this app, drawing on Cheng Yi and Zhu Xi.</p>
  </div>`;
}
