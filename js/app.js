import { call, getConfig, clearConfig } from './api.js';
import { todayStr, esc } from './format.js';
import * as setup from './views/setup.js';
import * as home from './views/home.js';
import * as add from './views/add.js';
import * as accounts from './views/accounts.js';
import * as stocktake from './views/stocktake.js';
import * as settings from './views/settings.js';
import * as sheets from './views/sheets.js';
import * as search from './views/search.js';

const VIEWS = { home, add, accounts, balance: stocktake, settings, search };
const $ = s => document.querySelector(s);

const state = { data: null, tab: 'home', scope: 'all', addMode: 'out', draft: null, incDraft: null, trDraft: null, loading: false, error: '' };

/* 寫入成功後直接改 state.data，不用重新讀整個 Sheet */
const KEY = { entry: 'entries', income: 'incomes', transfer: 'transfers', adjust: 'adjusts',
  pay: 'pay', use: 'use', account: 'accounts', source: 'sources', claimCo: 'claimCos', recurring: 'recurring' };
function applyLocal(action, p, result) {
  const d = state.data;
  if (action === 'save') {
    const list = d[KEY[p.kind]];
    const i = list.findIndex(r => r.id === result.id);
    if (i >= 0) list[i] = result; else list.push(result);
  } else if (action === 'remove') {
    d[KEY[p.kind]] = d[KEY[p.kind]].filter(r => r.id !== p.id);
  } else if (action === 'saveStocktake') {
    d.stocktakes = d.stocktakes.filter(s => s.month !== p.month).concat(result);
  } else if (action === 'saveSettings') {
    d[KEY[p.kind]] = result;
  } else if (action === 'skipRecur') {
    d.skips.push({ id: p.recurId + '@' + p.month, recurId: p.recurId, month: p.month });
  }
}

export const ctx = {
  state,
  today: todayStr,
  render,
  go(tab) { state.tab = tab; render(); window.scrollTo(0, 0); },
  toast(msg, isError) {
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' err' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), isError ? 4000 : 2200);
  },
  openSheet(html) {
    ctx.closeSheet();
    const w = document.createElement('div');
    w.className = 'sheet-wrap';
    w.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}<button class="btn ghost" data-close>關閉</button></div>`;
    w.addEventListener('click', e => { if (e.target === w || e.target.closest('[data-close]')) w.remove(); });
    document.body.appendChild(w);
  },
  closeSheet() { document.querySelectorAll('.sheet-wrap').forEach(w => w.remove()); },
  async reload() {
    state.loading = true; render();
    try { state.data = await call('bootstrap'); state.error = ''; }
    catch (e) { state.data = null; state.error = e.message; }
    state.loading = false; render();
  },
  async act(action, payload, okMsg) {
    try {
      const result = await call(action, payload);
      applyLocal(action, payload, result);
      render();
      if (okMsg) ctx.toast(typeof okMsg === 'function' ? okMsg(result) : okMsg);
      return result;
    } catch (e) {
      ctx.toast(e.message, true);
      throw e;
    }
  },
  /* 先在畫面上記好，再在後台慢慢存（Apps Script 一次要好幾秒）。後台失敗就還原並提醒。只用在 save。 */
  actFast(payload, okMsg) {
    const list = state.data[KEY[payload.kind]];
    const rec = Object.assign({}, payload.record);
    if (!rec.id) rec.id = Logic.newId();
    if (!rec.createdAt) rec.createdAt = new Date().toISOString();
    const idx = list.findIndex(r => r.id === rec.id);
    const before = idx >= 0 ? list[idx] : null;
    if (idx >= 0) list[idx] = rec; else list.push(rec);
    render();
    if (okMsg) ctx.toast(typeof okMsg === 'function' ? okMsg(rec) : okMsg);
    return call('save', { kind: payload.kind, record: rec }).then(saved => {
      const l = state.data[KEY[payload.kind]], i = l.findIndex(r => r.id === rec.id);
      if (i >= 0) l[i] = saved;
      render();
      return saved;
    }, e => {
      const l = state.data[KEY[payload.kind]], i = l.findIndex(r => r.id === rec.id);
      if (i >= 0) { if (before) l[i] = before; else l.splice(i, 1); }
      render();
      ctx.toast('沒存成功，已還原：' + e.message, true);
      throw e;
    });
  },
  disconnect() { clearConfig(); state.data = null; state.error = ''; render(); }
};

function render() {
  const cfg = getConfig();
  const screen = $('#screen');
  const bar = $('#tabbar');
  if (!cfg) {
    bar.hidden = true;
    screen.innerHTML = setup.render(ctx);
    return;
  }
  if (!state.data) {
    bar.hidden = true;
    screen.innerHTML = state.loading
      ? '<div class="loading"><span class="spin"></span>讀取中…</div>'
      : `<div class="setup"><div class="err-box">${esc(state.error || '讀不到資料')}</div>
          <button class="btn" data-act="retry">再試一次</button><button class="btn ghost" data-act="disconnect">重新貼網址和密碼</button></div>`;
    return;
  }
  bar.hidden = false;
  const banner = cfg.mode === 'demo'
    ? '<div class="banner"><span>示範模式：資料是假的，重新整理就會還原</span><button class="link" data-act="disconnect">連接我的 Google Sheet</button></div>'
    : '';
  screen.innerHTML = banner + VIEWS[state.tab].render(ctx);
  const cur = state.tab === 'balance' ? 'accounts' : state.tab === 'search' ? 'home' : state.tab;
  bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === cur ? 'page' : 'false'));
}

function dispatch(name, el, e) {
  const fn = 'on' + name;
  const handlers = [sheets, getConfig() && state.data ? VIEWS[state.tab] : setup];
  for (const h of handlers) {
    if (h[fn] && h[fn](el, ctx, e)) return true;
  }
  return false;
}

document.addEventListener('click', e => {
  const el = e.target.closest('button, [data-act], [data-edit]');
  if (!el) return;
  if (el.dataset.tab && el.closest('#tabbar')) { ctx.go(el.dataset.tab); return; }
  if (el.dataset.go) { ctx.closeSheet(); ctx.go(el.dataset.go); return; }
  if (el.dataset.addmode) { ctx.closeSheet(); state.addMode = el.dataset.addmode; ctx.go('add'); return; }
  if (el.dataset.act === 'retry') { ctx.reload(); return; }
  if (el.dataset.act === 'disconnect') { ctx.disconnect(); return; }
  dispatch('Click', el, e);
});
document.addEventListener('submit', e => { e.preventDefault(); dispatch('Submit', e.target, e); });
document.addEventListener('change', e => dispatch('Change', e.target, e));
document.addEventListener('input', e => dispatch('Input', e.target, e));
// 中文輸入法選完字才算打完（選字中的 input 事件 isComposing = true，各 view 會先跳過）
document.addEventListener('compositionend', e => dispatch('Input', e.target, e));

if (getConfig()) ctx.reload(); else render();
