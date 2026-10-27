import { fmt, money, esc, GROUP_LABEL } from '../format.js';
import { catOf } from './sheets.js';
import { compress } from '../image.js';

const COMPUTER = /電腦|laptop|手機|平板|ipad|iphone|macbook/i;
const $ = id => document.getElementById(id);

function pick(attr, val, cur, label) {
  return `<button type="button" class="pick" data-${attr}="${esc(val)}" aria-pressed="${cur === val}">${esc(label ?? val)}</button>`;
}
function adder(ctx, kind, placeholder) {
  return ctx.state.adding === kind
    ? `<span class="addbox"><input id="newOpt" placeholder="${placeholder}" aria-label="新增的名稱"><button type="button" data-addok="${kind}">加</button></span>`
    : `<button type="button" class="pick add" data-adding="${kind}">➕ 新增…</button>`;
}
/* 類別搜尋：比對名稱、代碼、「包括」裡的字 */
function catMatches(data, year, text) {
  const t = String(text || '').trim().toLowerCase();
  const all = Object.values(Logic.rulesFor(data.categories, year)).filter(c => c.group !== 'tax_yearly');
  if (!t) return all;
  return all.filter(c => [c.name, c.code, c.include].join(' ').toLowerCase().includes(t));
}
function catOptions(data, sel, year, filter) {
  let list = catMatches(data, year, filter);
  if (!list.length) list = catMatches(data, year, '');
  return ['tax', 'biz', 'plain'].map(g => {
    const opts = list.filter(c => c.group === g);
    return opts.length ? `<optgroup label="${GROUP_LABEL[g]}">${opts.map(c => `<option value="${esc(c.code)}" ${c.code === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}

export function newDraft(ctx, over) {
  const data = ctx.state.data, pay = data.pay[0] ? data.pay[0].name : '';
  return Object.assign({ date: ctx.today(), merchant: '', amount: null, category: 'OTHER', use: '自己', pay, account: Logic.payAccount(data, pay),
    claim: false, claimCo: data.claimCos[0] ? data.claimCos[0].name : '', claimDone: false, needsCheck: false, checkReason: '',
    receiptFileId: '', receiptUrl: '', receiptName: '', note: '' }, over || {});
}
function newIncDraft(ctx) {
  const s = ctx.state.data.sources[0] || { name: '', account: '' };
  return { date: ctx.today(), amount: '', source: s.name, account: s.account || '', note: '' };
}
function newTrDraft(ctx) {
  return { date: ctx.today(), amount: '', from: (ctx.state.data.accounts[0] || {}).name || '', to: '', note: '', rep: false };
}

export function render(ctx) {
  const mode = ctx.state.addMode;
  return `<div class="view">
    <div class="view-head"><h2>${mode === 'in' ? '記收入' : mode === 'tr' ? '記轉帳' : '記一筆'}</h2>
      <div class="seg" role="group" aria-label="記花費、收入還是轉帳">${[['out', '花費'], ['in', '收入'], ['tr', '轉帳']]
        .map(([v, l]) => `<button data-mode="${v}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div></div>
    ${mode === 'in' ? incomeHtml(ctx) : mode === 'tr' ? transferHtml(ctx) : expenseHtml(ctx)}
  </div>`;
}

function expenseHtml(ctx) {
  const s = ctx.state;
  return `<form class="quick" id="quickForm"><input id="quickIn" placeholder="例如：午餐 15 TNG" aria-label="打字快記" autocomplete="off"><button type="submit">記</button></form>
    <div class="photo-row"><span>有截圖或收據的話（可選，可以一次選多張）：</span>
      <label class="btn ghost" style="width:auto;padding:8px 12px;font-size:13px;cursor:pointer">📷 拍照 / 選圖片<input type="file" id="rcFiles" accept="image/*" multiple hidden></label></div>
    ${s.queue && s.queue.length ? `<div class="hint">還有 ${s.queue.length} 張等著讀</div>` : ''}
    ${s.reading ? '<div class="reading"><span class="spin"></span>AI 正在讀 receipt…</div>' : s.draft ? draftHtml(ctx, s.draft) : ''}`;
}

function checkHtml(d) {
  return d.needsCheck ? `<div class="confirm"><div><b>需確認：</b>${esc(d.checkReason || '請確認類別對不對')}</div><div class="row">
      ${COMPUTER.test(d.merchant) ? '<button type="button" data-check="LIFESTYLE|自己">🧑 個人用 → Lifestyle</button><button type="button" data-check="BIZ_EQUIPMENT|TheGuruboss">💼 生意用 → 器材</button>' : ''}
      <button type="button" data-check="ok">✓ 我確認過了</button></div></div>` : '';
}

/* 打字時只更新類別這幾個小地方，不重畫整張表單（輸入框被換掉的話，中文輸入法和手機鍵盤會出問題） */
function updateCat(ctx) {
  const d = ctx.state.draft, data = ctx.state.data, year = Logic.yearOf(d.date);
  const c = catOf(data, d.category, d.date), g = c.group === 'tax_yearly' ? 'tax' : c.group;
  const chip = document.getElementById('catChip');
  if (chip) { chip.className = 'chip ' + g; chip.textContent = GROUP_LABEL[g]; }
  const sel = document.getElementById('fCat');
  if (sel) { sel.innerHTML = catOptions(data, d.category, year, d.catQ); sel.value = d.category; }
  const info = document.getElementById('catInfo');
  if (info) info.dataset.info = d.category;
  const box = document.getElementById('checkBox');
  if (box) box.innerHTML = checkHtml(d);
}

function draftHtml(ctx, d) {
  const data = ctx.state.data, year = Logic.yearOf(d.date), c = catOf(data, d.category, d.date);
  const g = c.group === 'tax_yearly' ? 'tax' : c.group;
  const need = Logic.needsReceipt(data, { category: d.category, date: d.date, claimCo: d.claim ? d.claimCo : '' });
  const hasRc = d.receiptFileId || d.receiptUrl;
  return `<form class="receipt" id="draftForm">
    <div class="ai">${d.id ? '✏️ 修改這一筆' : d.fromAI ? '✨ AI 已自動填好，請檢查一下' : '✍️ 從文字讀出，請檢查一下'}</div>
    ${d.aiError ? `<div class="err-box">${esc(d.aiError)}</div>` : ''}
    <div class="two">
      <div class="field"><label for="fDate">日期</label><input id="fDate" type="date" value="${esc(d.date)}"></div>
      <div class="field"><label for="fAmt">金額</label><input id="fAmt" class="amt" inputmode="decimal" value="${d.amount ?? ''}" placeholder="0.00"></div>
    </div>
    <div class="field"><label for="fMer">商家 / 內容</label><input id="fMer" value="${esc(d.merchant)}"></div>
    <div class="field"><label for="fCat"><span>類別</span><span class="chip ${g}" id="catChip">${GROUP_LABEL[g]}</span></label>
      <input id="catQ" class="catq" value="${esc(d.catQ || '')}" placeholder="🔍 搜尋類別，例如：書、牙醫、Canva、血壓計" aria-label="搜尋類別" autocomplete="off">
      <div class="catrow"><select id="fCat">${catOptions(data, d.category, year, d.catQ)}</select>
      <button type="button" class="info" id="catInfo" data-info="${esc(d.category)}" data-year="${year}" aria-label="這個類別的扣稅說明">i</button></div></div>
    <div id="checkBox">${checkHtml(d)}</div>
    <div class="field"><span class="lbl">付款方式</span><div class="chips">${data.pay.map(p => pick('pay', p.name, d.pay)).join('')}${adder(ctx, 'pay', '例如 Maybank CC')}</div></div>
    <div class="field"><span class="lbl"><span>從戶口扣</span><span class="hint">按付款方式自動選好，可以改</span></span><div class="chips">
      ${pick('from', '', d.account, '不扣（月底一次算）')}${data.accounts.map(a => pick('from', a.name, d.account)).join('')}</div></div>
    <div class="field"><span class="lbl">用途</span><div class="chips">${data.use.map(u => pick('use', u.name, d.use)).join('')}${adder(ctx, 'use', '例如 送禮')}</div></div>
    <div class="field"><span class="lbl">公司 claim</span><div class="chips">
      <button type="button" class="pick" data-claimtoggle aria-pressed="${!!d.claim}">🏢 公司會 claim</button>
      ${d.claim ? data.claimCos.map(x => pick('co', x.name, d.claimCo)).join('') + adder(ctx, 'claimCo', '公司名') : ''}</div></div>
    ${hasRc ? `<div class="thumb"><span class="img" aria-hidden="true"></span>📎 已附 receipt${d.receiptName ? ' · ' + esc(d.receiptName) : ''} · 會放到 Drive：${year}/${esc(d.category)}/</div>`
      : need ? `<div class="confirm"><div><b>📎 ${d.claim ? '要 claim' : '這筆可以扣稅或是生意開銷'}，建議附 receipt</b></div>
          <div class="row"><label style="border:1px solid var(--warn);border-radius:999px;padding:4px 10px;font-size:13px;cursor:pointer">📷 現在附上<input type="file" id="rcAttach" accept="image/*" hidden></label></div>
          <div style="color:var(--muted)">也可以先存，之後在首頁「缺 receipt」補上</div></div>`
      : '<div class="photo-row">一般開銷，不用 receipt</div>'}
    <div class="field"><label for="fNote">備註（可選）</label><input id="fNote" value="${esc(d.note || '')}"></div>
    <button class="btn" type="submit">存</button>
    ${d.id ? `<button class="danger" type="button" data-delrow="entry:${esc(d.id)}">${ctx.state.confirmDelete === d.id ? '再按一次確認刪除' : '刪除這一筆'}</button>` : ''}
  </form>`;
}

function incomeHtml(ctx) {
  const s = ctx.state, data = s.data, d = s.incDraft || (s.incDraft = newIncDraft(ctx));
  return `<form class="receipt" id="incForm">
    <div class="ai">${d.id ? '✏️ 修改這筆收入' : '💰 收到錢就記，月中也知道戶口還剩多少'}</div>
    <div class="two">
      <div class="field"><label for="iDate">日期</label><input id="iDate" type="date" value="${esc(d.date)}"></div>
      <div class="field"><label for="iAmt">金額</label><input id="iAmt" class="amt" inputmode="decimal" value="${esc(d.amount)}" placeholder="0.00"></div>
    </div>
    <div class="field"><span class="lbl">來源</span><div class="chips">${data.sources.map(x => pick('src', x.name, d.source, x.name + (x.biz ? ' 💼' : ''))).join('')}</div></div>
    <div class="field"><span class="lbl"><span>存入戶口</span><span class="hint">按來源自動選好，可以改</span></span><div class="chips">${data.accounts.map(a => pick('into', a.name, d.account)).join('')}</div></div>
    <div class="field"><label for="iNote">備註（可選）</label><input id="iNote" value="${esc(d.note)}" placeholder="例如：9 月薪水、XX 公司網站尾款"></div>
    <button class="btn" type="submit">存收入</button>
    ${d.id ? `<button class="danger" type="button" data-delrow="income:${esc(d.id)}">${s.confirmDelete === d.id ? '再按一次確認刪除' : '刪除這筆收入'}</button>` : ''}
    <div style="font-size:12px;color:var(--muted)">報 Form B 時，正職和 TheGuruboss 的收入都從這裡加總。</div>
  </form>`;
}

function transferHtml(ctx) {
  const s = ctx.state, data = s.data, d = s.trDraft || (s.trDraft = newTrDraft(ctx));
  const amt = Number(d.amount) > 0 ? fmt(Number(d.amount), 2) : '…';
  return `<form class="receipt" id="trForm">
    <div class="ai">↔ 錢從一個戶口搬到另一個，不算花費，也不算收入</div>
    <div class="two">
      <div class="field"><label for="tDate">日期</label><input id="tDate" type="date" value="${esc(d.date)}"></div>
      <div class="field"><label for="tAmt">金額</label><input id="tAmt" class="amt" inputmode="decimal" value="${esc(d.amount)}" placeholder="0.00"></div>
    </div>
    <div class="field"><span class="lbl">從哪個戶口轉出（會扣錢）</span><div class="chips">${data.accounts.map(a => pick('trfrom', a.name, d.from)).join('')}</div></div>
    <div class="field"><span class="lbl">轉去哪個戶口（會加錢）</span><div class="chips">${data.accounts.filter(a => a.name !== d.from).map(a => pick('trto', a.name, d.to)).join('')}</div></div>
    ${d.from && d.to ? `<div class="check"><div class="ln"><span>${esc(d.from)}</span><span class="num down">− ${amt}</span></div><div class="ln"><span>${esc(d.to)}</span><span class="num up">＋ ${amt}</span></div></div>` : ''}
    <div class="field"><label for="tNote">備註（可選）</label><input id="tNote" value="${esc(d.note)}" placeholder="例如：屋子供款、存 Chinkido 基金"></div>
    <div class="chips"><button type="button" class="pick" data-trrep aria-pressed="${!!d.rep}">🔁 每個月固定轉（每月 ${Number(String(d.date).slice(8)) || 1} 號提醒我）</button></div>
    <button class="btn" type="submit">存轉帳</button>
  </form>`;
}

/* ---------- 讀表單 ---------- */
function readDraft(s) {
  const d = s.draft; if (!d || !$('fDate')) return;
  d.date = $('fDate').value; d.amount = $('fAmt').value; d.merchant = $('fMer').value; d.category = $('fCat').value; d.note = $('fNote').value;
}
function readInc(s) { const d = s.incDraft; if (!d || !$('iDate')) return; d.date = $('iDate').value; d.amount = $('iAmt').value; d.note = $('iNote').value; }
function readTr(s) { const d = s.trDraft; if (!d || !$('tDate')) return; d.date = $('tDate').value; d.amount = $('tAmt').value; d.note = $('tNote').value; }
function readAll(s) { readDraft(s); readInc(s); readTr(s); }
const toNum = v => Number(String(v ?? '').replace(/[^\d.]/g, ''));

/* ---------- 圖片 ---------- */
async function readNext(ctx) {
  const s = ctx.state;
  if (!s.queue || !s.queue.length) return;
  const file = s.queue.shift();
  s.reading = true; s.draft = null; ctx.render();
  try {
    const img = await compress(file);
    const r = await ctx.act('readReceipt', { base64: img.base64, mime: img.mime, filename: img.filename, today: ctx.today() });
    s.draft = newDraft(ctx, Object.assign({}, r.draft || {}, { fromAI: !!r.draft, aiError: r.aiError || '', receiptFileId: r.fileId, receiptName: file.name }));
  } catch (e) {
    s.draft = newDraft(ctx, { aiError: e.message });
  }
  s.reading = false; ctx.render();
}

async function attachOne(ctx, file) {
  const s = ctx.state;
  try {
    const img = await compress(file);
    const r = await ctx.act('uploadReceipt', { base64: img.base64, mime: img.mime, filename: img.filename });
    s.draft.receiptFileId = r.fileId; s.draft.receiptName = file.name;
    ctx.render();
  } catch { /* ctx.act 已經 toast 錯誤 */ }
}

/* ---------- 事件 ---------- */
const SETTING_ROW = { pay: v => ({ name: v, account: '' }), use: v => ({ name: v }), claimCo: v => ({ name: v }) };
const SETTING_KEY = { pay: 'pay', use: 'use', claimCo: 'claimCos' };
const DRAFT_FIELD = { pay: 'pay', use: 'use', claimCo: 'claimCo' };

export function onClick(el, ctx) {
  const s = ctx.state, data = s.data, ds = el.dataset;
  if (ds.mode) { readAll(s); s.addMode = ds.mode; s.confirmDelete = null; ctx.render(); return true; }
  if (ds.pay !== undefined) { readDraft(s); s.draft.pay = ds.pay; s.draft.account = Logic.payAccount(data, ds.pay); ctx.render(); return true; }
  if (ds.from !== undefined) { readDraft(s); s.draft.account = ds.from; ctx.render(); return true; }
  if (ds.use !== undefined) { readDraft(s); s.draft.use = ds.use; ctx.render(); return true; }
  if (ds.co !== undefined) { readDraft(s); s.draft.claimCo = ds.co; ctx.render(); return true; }
  if (ds.claimtoggle !== undefined) { readDraft(s); s.draft.claim = !s.draft.claim; ctx.render(); return true; }
  if (ds.check) {
    readDraft(s);
    if (ds.check !== 'ok') { const [code, use] = ds.check.split('|'); s.draft.category = code; s.draft.use = use; }
    s.draft.needsCheck = false; ctx.render(); return true;
  }
  if (ds.adding) { readAll(s); s.adding = ds.adding; ctx.render(); setTimeout(() => $('newOpt') && $('newOpt').focus(), 0); return true; }
  if (ds.addok) {
    readDraft(s);
    const kind = ds.addok, v = ($('newOpt').value || '').trim();
    s.adding = null;
    if (!v) { ctx.render(); return true; }
    const rows = data[SETTING_KEY[kind]].concat([SETTING_ROW[kind](v)]);
    ctx.act('saveSettings', { kind, rows }, `已新增「${v}」，下次會自動出現`).then(() => { s.draft[DRAFT_FIELD[kind]] = v; ctx.render(); }).catch(() => ctx.render());
    return true;
  }
  if (ds.src) { readInc(s); const x = data.sources.find(y => y.name === ds.src); s.incDraft.source = x.name; s.incDraft.account = x.account || s.incDraft.account; ctx.render(); return true; }
  if (ds.into) { readInc(s); s.incDraft.account = ds.into; ctx.render(); return true; }
  if (ds.trfrom) { readTr(s); s.trDraft.from = ds.trfrom; if (s.trDraft.to === ds.trfrom) s.trDraft.to = ''; ctx.render(); return true; }
  if (ds.trto) { readTr(s); s.trDraft.to = ds.trto; ctx.render(); return true; }
  if (ds.trrep !== undefined) { readTr(s); s.trDraft.rep = !s.trDraft.rep; ctx.render(); return true; }
  return false;
}

export function onInput(el, ctx, e) {
  const s = ctx.state, d = s.draft;
  if (!d || (el.id !== 'fMer' && el.id !== 'catQ')) return false;
  readDraft(s);
  if (el.id === 'catQ') d.catQ = el.value;
  if (e && e.isComposing) return true;          // 中文還在選字，等 compositionend
  if (el.id === 'fMer') {
    // 自己選過類別、或是在修改舊帳，就不要自動換
    if (d.catManual || d.id) return true;
    const g = Logic.guessCategory(s.data, d.merchant, d.date);
    if (g.category && (g.category !== d.category || g.needsCheck !== !!d.needsCheck)) {
      d.category = g.category; d.needsCheck = g.needsCheck; d.checkReason = g.reason;
      updateCat(ctx);
    }
    return true;
  }
  const hits = catMatches(s.data, Logic.yearOf(d.date), d.catQ);
  if (d.catQ.trim() && hits.length) { d.category = hits[0].code; d.catManual = true; }
  updateCat(ctx);
  return true;
}

export function onChange(el, ctx) {
  const s = ctx.state;
  if (el.id === 'fCat') { readDraft(s); s.draft.catManual = true; ctx.render(); return true; }
  if (el.id === 'fDate') { readDraft(s); ctx.render(); return true; }   // 年份變了，類別規則跟著換
  if (el.id === 'rcFiles' && el.files.length) { s.queue = Array.from(el.files); readNext(ctx); return true; }
  if (el.id === 'rcAttach' && el.files.length) { readDraft(s); attachOne(ctx, el.files[0]); return true; }
  return false;
}

export function onSubmit(form, ctx) {
  const s = ctx.state, data = s.data;
  if (form.id === 'quickForm') {
    const text = $('quickIn').value.trim();
    if (!text) return true;
    const p = Logic.parseQuick(data, text, ctx.today());
    s.draft = newDraft(ctx, p);
    ctx.render();
    return true;
  }
  if (form.id === 'draftForm') {
    readDraft(s);
    const d = s.draft, amount = toNum(d.amount);
    const record = { id: d.id, date: d.date, merchant: d.merchant.trim() || '（未填）', amount, category: d.category, use: d.use, pay: d.pay,
      account: d.account || '', claimCo: d.claim ? d.claimCo : '', claimDone: d.claim ? !!d.claimDone : false, needsCheck: !!d.needsCheck,
      receiptFileId: d.receiptFileId || '', receiptUrl: d.receiptUrl || '', note: d.note || '', createdAt: d.createdAt };
    const missingRc = Logic.needsReceipt(data, record) && !record.receiptFileId && !record.receiptUrl;
    const msg = missingRc ? '已存。📎 記得之後補 receipt' : record.account ? `已存，從${record.account}扣 ${fmt(amount, 2)}` : '已存';
    ctx.actFast({ kind: 'entry', record }, msg).catch(() => {});
    s.draft = null; s.confirmDelete = null;
    if (s.queue && s.queue.length) readNext(ctx); else ctx.go('home');
    return true;
  }
  if (form.id === 'incForm') {
    readInc(s);
    const d = s.incDraft;
    const record = { id: d.id, date: d.date, source: d.source, amount: toNum(d.amount), account: d.account, note: d.note, createdAt: d.createdAt };
    ctx.actFast({ kind: 'income', record }, r => `已存。存入${r.account} ${fmt(r.amount, 2)}`).catch(() => {});
    s.incDraft = null; s.addMode = 'out'; ctx.go('home');
    return true;
  }
  if (form.id === 'trForm') {
    readTr(s);
    const d = s.trDraft, amount = toNum(d.amount), day = Number(String(d.date).slice(8)) || 1;
    const saveTransfer = recurId => ctx.act('save', { kind: 'transfer', record: { date: d.date, from: d.from, to: d.to, amount, note: d.note, recurId: recurId || '' } },
      d.rep ? `已記，以後每月 ${day} 號提醒你` : `${d.from} − ${fmt(amount, 2)}，${d.to} ＋ ${fmt(amount, 2)}`);
    const done = () => { s.trDraft = null; s.addMode = 'out'; ctx.go('accounts'); };
    if (!(amount > 0)) { ctx.toast('金額要大於 0', true); return true; }
    if (!d.to) { ctx.toast('請選轉去哪個戶口', true); return true; }
    if (d.rep) {
      const rows = data.recurring.concat([{ day, from: d.from, to: d.to, amount, note: d.note, active: true }]);
      ctx.act('saveSettings', { kind: 'recurring', rows }).then(saved => saveTransfer(saved[saved.length - 1].id)).then(done).catch(() => {});
    } else {
      saveTransfer('').then(done).catch(() => {});
    }
    return true;
  }
  return false;
}
