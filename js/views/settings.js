import { fmt, esc } from '../format.js';
import { getConfig } from '../api.js';

const LISTS = [
  ['pay', 'pay', '付款方式', '例如 Maybank CC'],
  ['use', 'use', '用途', '例如 送禮'],
  ['account', 'accounts', '戶口', '例如 ASB'],
  ['source', 'sources', '收入來源', '例如 Shopee 聯盟'],
  ['claimCo', 'claimCos', 'Claim 公司', '例如 Chillhub']
];
const GROUP_NAME = { daily: '日常', save: '存款', invest: '投資', biz: '生意' };
const NEW_ROW = {
  pay: n => ({ name: n, account: '' }), use: n => ({ name: n }), claimCo: n => ({ name: n }),
  account: n => ({ name: n, group: 'daily', note: '', where: '', biz: false, order: 0 }),
  source: n => ({ name: n, biz: false, account: '' })
};

function listPanel(ctx, kind, key, title, ph) {
  const rows = ctx.state.data[key], s = ctx.state;
  return `<div class="panel"><h3><span>${title}</span></h3>
    <div class="olist" data-list="${kind}">${rows.map((r, i) => {
      const id = kind + ':' + i;
      const extra = kind === 'account' ? `<small>${GROUP_NAME[r.group] || '日常'}${r.note ? ' · ' + esc(r.note) : ''}</small>`
        : kind === 'source' ? `<small>${r.biz ? '💼 生意' : '🧑 個人'}${r.account ? ' · 存入 ' + esc(r.account) : ''}</small>` : '';
      const renaming = s.renaming === id && kind !== 'account' && kind !== 'source';
      return `<div class="orow">
        ${renaming ? `<span class="addbox"><input id="renIn" value="${esc(r.name)}" aria-label="新名稱"><button type="button" data-renok="${id}">存</button></span>`
          : `<span><span class="nm">${esc(r.name)}</span>${extra}</span>`}
        <span class="ops">
          <button data-move="${id}:-1" aria-label="往上移 ${esc(r.name)}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button data-move="${id}:1" aria-label="往下移 ${esc(r.name)}" ${i === rows.length - 1 ? 'disabled' : ''}>↓</button>
          <button data-ren="${id}">改</button>
          <button data-del="${id}" class="${s.confirmDelete === id ? 'warn' : ''}">${s.confirmDelete === id ? '再按一次' : '刪'}</button>
        </span></div>`;
    }).join('')}</div>
    <form class="quick" data-setadd="${kind}" style="margin-top:10px"><input placeholder="${ph}" aria-label="新增${title}"><button type="submit">加</button></form>
  </div>`;
}

export function render(ctx) {
  const data = ctx.state.data, cfg = getConfig() || {};
  const years = [...new Set(data.categories.map(c => Number(c.year)))].sort();
  const active = data.recurring.filter(r => r.active !== false);
  return `<div class="view">
    <div class="view-head"><h2>設定</h2><span class="sub">自己加、刪、改名、排順序</span></div>
    ${listPanel(ctx, ...LISTS[0])}
    <div class="panel"><h3><span>付款方式 → 扣款戶口</span></h3>
      <p style="margin:0 0 6px;font-size:13px;color:var(--muted)">用這個付款方式記帳時，自動從哪個戶口扣。想看 TNG、信用卡的餘額，就先在「戶口」加一個 TNG / 信用卡戶口，再在這裡選它；不想追蹤的選「不扣」，月頭盤點時一次算。每一筆記帳時還是可以手動改。</p>
      <div class="maps">${data.pay.map((p, i) => `<div class="map"><label for="pm${i}">${esc(p.name)}</label>
        <select id="pm${i}" data-paymap="${i}" aria-label="${esc(p.name)} 預設扣款戶口"><option value="" ${!p.account ? 'selected' : ''}>不扣（月底一次算）</option>
        ${data.accounts.map(a => `<option value="${esc(a.name)}" ${p.account === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>`).join('')}</div></div>
    <div class="panel"><h3><span>🔁 每月固定轉帳</span></h3>
      <div class="maps">${active.map(r => `<div class="map" style="grid-template-columns:minmax(0,1fr) auto auto"><span>每月 ${r.day} 號 · ${esc(r.from)} → ${esc(r.to)}${r.note ? `<br><span class="hint">${esc(r.note)}</span>` : ''}</span><span class="num">${fmt(r.amount)}</span><button class="act" data-recurstop="${esc(r.id)}" style="border-color:var(--line);color:var(--muted)">停掉</button></div>`).join('') || '<div class="hint">還沒有。記轉帳時勾「🔁 每個月固定轉」就會加到這裡。</div>'}</div>
      <div class="hint" style="margin-top:6px">要新增：去記帳 › 轉帳，勾「🔁 每個月固定轉」。</div></div>
    ${LISTS.slice(1).map(l => listPanel(ctx, ...l)).join('')}
    <div class="panel"><h3><span>連接</span></h3>
      <div style="display:grid;gap:8px;font-size:14px">
        <div>${cfg.mode === 'demo' ? '🧪 示範模式（資料是假的）' : '✅ 已連接你的 Google Sheet'}</div>
        <div>📁 Receipt 在 Google Drive 的「記帳App Receipts」資料夾</div>
        <div>📅 扣稅規則：${years.map(y => 'YA' + y + (y >= 2027 ? '（Budget 2027 提案）' : '') + ' ✓').join(' · ')}</div>
        <button class="btn ghost" data-act="disconnect">${cfg.mode === 'demo' ? '連接我的 Google Sheet' : '重新貼網址和密碼'}</button>
      </div></div>
  </div>`;
}

function linkPayHtml(pay, account, old) {
  const total = old.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return `<h3>之前的帳要一起補上嗎？</h3>
    <p style="margin:0 0 12px;font-size:14px">之前有 <b>${old.length} 筆</b>用 ${esc(pay)} 付、還沒扣戶口的花費（共 <span class="num">${fmt(total, 2)}</span>）。<br>補上之後，這些花費會從「${esc(account)}」扣，戶口餘額會跟著變。</p>
    <div class="two"><button class="btn ghost" data-close>不用，只管以後的</button><button class="btn" data-linkpay="${esc(pay)}" data-linkacc="${esc(account)}">一起補上</button></div>`;
}

function editAccountHtml(ctx, i) {
  const a = ctx.state.data.accounts[i];
  return `<h3>改戶口</h3><form class="receipt" id="accForm" data-index="${i}">
    <div class="field"><label for="aName">名稱</label><input id="aName" value="${esc(a.name)}"></div>
    <div class="field"><label for="aNote">說明</label><input id="aNote" value="${esc(a.note)}" placeholder="例如 Chinkido 基金"></div>
    <div class="field"><label for="aWhere">去哪裡看餘額</label><input id="aWhere" value="${esc(a.where)}" placeholder="例如 MyASNB app"></div>
    <div class="field"><label for="aGroup">分組</label><select id="aGroup">${Object.entries(GROUP_NAME).map(([k, v]) => `<option value="${k}" ${a.group === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="aBiz" ${a.biz ? 'checked' : ''}> 💼 這是生意的戶口</label>
    <button class="btn" type="submit">存</button></form>`;
}
function editSourceHtml(ctx, i) {
  const s = ctx.state.data.sources[i];
  return `<h3>改收入來源</h3><form class="receipt" id="srcForm" data-index="${i}">
    <div class="field"><label for="sName">名稱</label><input id="sName" value="${esc(s.name)}"></div>
    <div class="field"><label for="sAcc">預設存入戶口</label><select id="sAcc">${ctx.state.data.accounts.map(a => `<option ${s.account === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sBiz" ${s.biz ? 'checked' : ''}> 💼 這是生意收入（TheGuruboss）</label>
    <button class="btn" type="submit">存</button></form>`;
}

const KEY = Object.fromEntries(LISTS.map(l => [l[0], l[1]]));
function saveList(ctx, kind, rows, msg) {
  if (kind === 'account') rows = rows.map((r, i) => Object.assign({}, r, { order: i + 1 }));
  return ctx.act('saveSettings', { kind, rows }, msg);
}
async function renameThen(ctx, kind, from, to) {
  if (from !== to) { await ctx.act('rename', { kind, from, to }); await ctx.reload(); }
}

export function onClick(el, ctx) {
  const s = ctx.state, data = s.data, d = el.dataset;
  if (d.move) {
    const [kind, i, dir] = d.move.split(':'); const rows = data[KEY[kind]].slice(), a = Number(i), b = a + Number(dir);
    [rows[a], rows[b]] = [rows[b], rows[a]];
    saveList(ctx, kind, rows).catch(() => {});
    return true;
  }
  if (d.ren) {
    const [kind, i] = d.ren.split(':');
    if (kind === 'account') { ctx.openSheet(editAccountHtml(ctx, Number(i))); return true; }
    if (kind === 'source') { ctx.openSheet(editSourceHtml(ctx, Number(i))); return true; }
    s.renaming = d.ren; ctx.render(); setTimeout(() => document.getElementById('renIn')?.focus(), 0);
    return true;
  }
  if (d.renok) {
    const [kind, i] = d.renok.split(':'); const from = data[KEY[kind]][Number(i)].name, to = document.getElementById('renIn').value.trim();
    s.renaming = null;
    renameThen(ctx, kind, from, to).then(() => { ctx.render(); ctx.toast('已改好'); }).catch(() => ctx.render());
    return true;
  }
  if (d.del) {
    if (s.confirmDelete !== d.del) { s.confirmDelete = d.del; ctx.render(); return true; }
    const [kind, i] = d.del.split(':'); const rows = data[KEY[kind]].filter((_, j) => j !== Number(i));
    s.confirmDelete = null;
    saveList(ctx, kind, rows, '已刪除').catch(() => {});
    return true;
  }
  if (d.linkpay) {
    ctx.closeSheet();
    ctx.act('linkPay', { pay: d.linkpay, account: d.linkacc })
      .then(r => ctx.reload().then(() => ctx.toast(`已補上 ${r.changed} 筆，從${r.account}扣`))).catch(() => {});
    return true;
  }
  if (d.recurstop) {
    const rows = data.recurring.map(r => r.id === d.recurstop ? Object.assign({}, r, { active: false }) : r);
    const r = data.recurring.find(x => x.id === d.recurstop);
    ctx.act('saveSettings', { kind: 'recurring', rows }, `已停掉：每月轉去 ${r.to}`).catch(() => {});
    return true;
  }
  return false;
}

export function onChange(el, ctx) {
  if (el.dataset.paymap === undefined) return false;
  const data = ctx.state.data, i = Number(el.dataset.paymap);
  const rows = data.pay.map((p, j) => j === i ? Object.assign({}, p, { account: el.value }) : p);
  const pay = rows[i].name, account = el.value;
  ctx.act('saveSettings', { kind: 'pay', rows }, account ? `${pay} → 從${account}扣` : `${pay} → 不扣戶口`).then(() => {
    const old = account ? ctx.state.data.entries.filter(e => e.pay === pay && !e.account) : [];
    if (old.length) ctx.openSheet(linkPayHtml(pay, account, old));
  }).catch(() => {});
  return true;
}

export function onSubmit(form, ctx) {
  const data = ctx.state.data;
  if (form.dataset.setadd) {
    const kind = form.dataset.setadd, v = form.querySelector('input').value.trim();
    if (!v) return true;
    saveList(ctx, kind, data[KEY[kind]].concat([NEW_ROW[kind](v)]), `已新增「${v}」`).catch(() => {});
    return true;
  }
  if (form.id === 'accForm') {
    const i = Number(form.dataset.index), old = data.accounts[i], to = form.querySelector('#aName').value.trim();
    const patch = { note: form.querySelector('#aNote').value.trim(), where: form.querySelector('#aWhere').value.trim(),
      group: form.querySelector('#aGroup').value, biz: form.querySelector('#aBiz').checked };
    renameThen(ctx, 'account', old.name, to)
      .then(() => saveList(ctx, 'account', ctx.state.data.accounts.map((a, j) => j === i ? Object.assign({}, a, patch) : a), '已改好'))
      .then(() => ctx.closeSheet()).catch(() => {});
    return true;
  }
  if (form.id === 'srcForm') {
    const i = Number(form.dataset.index), old = data.sources[i], to = form.querySelector('#sName').value.trim();
    const patch = { account: form.querySelector('#sAcc').value, biz: form.querySelector('#sBiz').checked };
    renameThen(ctx, 'source', old.name, to)
      .then(() => saveList(ctx, 'source', ctx.state.data.sources.map((x, j) => j === i ? Object.assign({}, x, patch) : x), '已改好'))
      .then(() => ctx.closeSheet()).catch(() => {});
    return true;
  }
  return false;
}
