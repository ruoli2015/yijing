// App entry: load data, route, render.
import { html, render, useState, useEffect } from '../vendor/preact.js';
import * as store from './store.js';
import { setData } from './hex.js';
import { Toast } from './ui/common.js';
import { Home } from './ui/home.js';
import { Browse } from './ui/browse.js';
import { Detail } from './ui/detail.js';
import { Order } from './ui/order.js';
import { Identify } from './ui/identify.js';
import { Draw } from './ui/draw.js';
import { Divine } from './ui/divine.js';
import { Progress } from './ui/progress.js';

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { parts, params: Object.fromEntries(new URLSearchParams(query)), key: h };
}

const NAV = [
  ['', '首頁', 'Home', 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'],
  ['browse', '六十四卦', 'Hexagrams', 'M4 5h16M4 9.5h7m2 0h7M4 14h16M4 18.5h7m2 0h7'],
  ['order', '卦序', 'Order', 'M5 4v16M5 7h9M5 12h12M5 17h7'],
  ['divine', '占卦', 'Divine', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-2.5 6.5h5v5h-5z'],
  ['progress', '進度', 'Progress', 'M4 20V10m5.5 10V4M15 20v-7m5 7V8'],
];
const TOP = new Set(['', 'browse', 'order', 'divine', 'progress']);

function App() {
  const [route, setRoute] = useState(parseHash());
  const [, setTick] = useState(0);
  const [toast, setToast] = useState(null);
  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    const unsub = store.subscribe(() => setTick((t) => t + 1));
    window.__showUpdate = (fn) => setToast({ msg: '有新版本 · New version', action: { label: '更新 Reload', fn } });
    return () => {
      window.removeEventListener('hashchange', onHash);
      unsub();
    };
  }, []);

  const [p0 = '', p1] = route.parts;
  let page;
  if (p0 === 'browse') page = html`<${Browse} params=${route.params} />`;
  else if (p0 === 'h') page = html`<${Detail} key=${p1} n=${Math.min(64, Math.max(1, Number(p1) || 1))} />`;
  else if (p0 === 'order') page = html`<${Order} params=${route.params} />`;
  else if (p0 === 'identify') page = html`<${Identify} />`;
  else if (p0 === 'draw') page = html`<${Draw} />`;
  else if (p0 === 'divine') page = html`<${Divine} sub=${p1} />`;
  else if (p0 === 'progress') page = html`<${Progress} />`;
  else page = html`<${Home} />`;

  const navKey = p0 === 'h' ? 'browse' : p0 === 'identify' || p0 === 'draw' ? '' : p0;
  return html`
    <header class="top">
      ${TOP.has(p0) && !p1
        ? html`<a class="logo" href="#/" aria-label="home">䷊</a>`
        : html`<button class="back" onClick=${() => (history.length > 1 ? history.back() : (location.hash = '#/'))} aria-label="back">‹</button>`}
      <span class="title">周易六十四卦 <small>The 64 Hexagrams</small></span>
    </header>
    <main>${page}</main>
    <nav class="tabs">
      ${NAV.map(([path, zh, en, d]) => html`<a class=${navKey === path ? 'on' : ''} href=${'#/' + path}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d=${d} /></svg>
        <span class="tz">${zh}</span><span class="te">${en}</span>
      </a>`)}
    </nav>
    <${Toast} toast=${toast} onClose=${() => setToast(null)} />
  `;
}

async function boot() {
  const res = await fetch('data/yijing.json');
  setData(await res.json());
  render(html`<${App} />`, document.getElementById('app'));
}

boot().catch((e) => {
  document.getElementById('app').innerHTML = `<div class="page"><p>載入失敗 · Failed to load: ${e.message}</p></div>`;
});

// Service worker: offline support + update prompt.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const prompt = (w) => window.__showUpdate?.(() => w.postMessage('skipWaiting'));
    if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}
