import { compress } from '../image.js';
/* 底部彈出視窗（流水、待處理、ⓘ、詳細）+ 各頁共用的小元件 */
import { fmt, money, num2, esc, dayMonth } from '../format.js';

export function mainAccount(data) {
  const p = data.pay.find(x => x.name === 'Bank Transfer' && x.account) || data.pay.find(x => x.account);
  return p ? p.account : (data.accounts[0] ? data.accounts[0].name : '');
}
export function catOf(data, code, date) {
  return Logic.rulesFor(data.categories, Logic.yearOf(date))[code] || { code, name: code || '其他', group: 'plain' };
}
const CHIP = { tax: 'tax', biz: 'biz', plain: 'plain', tax_yearly: 'tax' };

export function chipFor(data, e) {
  const c = catOf(data, e.category, e.date);
  let h = `<span class="chip ${CHIP[c.group] || 'plain'}">${esc(c.name.replace(/^↳ /, ''))}</span>`;
  if (e.needsCheck) h += '<span class="chip warn">需確認</span>';
  if (e.claimCo) h += `<span class="chip claim">🏢 ${esc(e.claimCo)} ${e.claimDone ? '已 claim' : '待 claim'}</span>`;
  if (Logic.needsReceipt(data, e) && !e.receiptUrl) h += '<span class="chip warn">📎 缺 receipt</span>';
  return h;
}

export function entryRow(data, e, act = '') {
  const { d, m } = dayMonth(e.date);
  return `<div class="item" data-edit="entry:${esc(e.id)}"><div class="d"><b>${d}</b>${m}月</div>
    <div class="t"><div class="m">${esc(e.merchant)}</div><div class="tags">${chipFor(data, e)}<span class="chip plain">${esc(e.pay)}</span></div></div>
    <div class="a" style="display:grid;justify-items:end;gap:4px"><span class="num">${money(e.amount)}</span>${act}</div></div>`;
}

export function bankHtml(ctx, name) {
  const data = ctx.state.data;
  const a = data.accounts.find(x => x.name === name) || {};
  const s = Logic.statement(data, name, ctx.today());
  const linked = data.pay.some(p => p.account === name);
  const baseRow = s.base.month
    ? `<div class="ln"><span>${Number(s.base.month.slice(5))}/1 月頭盤點<small>你填的真實餘額</small></span><span></span><span class="num">${num2(s.base.balance)}</span></div>`
    : '<div class="ln"><span>還沒有月頭盤點<small>從 0 開始算</small></span><span></span><span class="num">0.00</span></div>';
  return `<h3>${esc(name)}${a.note ? ` <span class="chip plain">${esc(a.note)}</span>` : ''}</h3>
    <div class="cap"><span>現在大約剩</span><span class="num">${fmt(s.now, 2)}</span></div>
    <div class="hint">${s.base.month ? Number(s.base.month.slice(5)) + ' 月' : ''}流水 · 像銀行月結單，由上往下看</div>
    <div class="stmt">
      <div class="ln hd"><span>日期 · 內容</span><span>進 / 出</span><span>餘額</span></div>
      ${baseRow}
      ${s.rows.map(r => { const { d, m } = dayMonth(r.date); return `<div class="ln" data-edit="${r.kind}:${esc(r.id)}" style="cursor:pointer"><span>${m}/${d} ${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><span class="num ${r.amount > 0 ? 'up' : 'down'}">${r.amount > 0 ? '＋' : '−'}${num2(Math.abs(r.amount))}</span><span class="num">${num2(r.balance)}</span></div>`; }).join('')}
    </div>
    ${s.rows.length ? '' : `<div class="hint">這個月還沒有進出。${a.group === 'save' ? '存款戶口通常只在月頭盤點時更新數字。' : ''}</div>`}
    ${linked ? '<div class="confirm"><div><b>還沒算進去的：</b>還信用卡、充值 TNG。這兩樣不用記，所以這個數字會比戶口實際的錢多一點。下個月月頭盤點時會自動校正。</div></div>' : ''}
    <form class="receipt" id="adjForm" data-account="${esc(name)}">
      <div class="ai">🔧 跟${esc(a.where || '銀行 app')}對不上？填它現在顯示的餘額</div>
      <div class="two">
        <div class="field"><label for="adjAmt">實際餘額</label><input id="adjAmt" class="amt" inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label for="adjNote">備註（可選）</label><input id="adjNote" placeholder="例如 還了信用卡"></div>
      </div>
      <button class="btn" type="submit">校正</button>
      <div style="font-size:12px;color:var(--muted)">差額會記在 Sheet 的「戶口調整」分頁，不算花費，也不影響扣稅。</div>
    </form>`;
}

export function claimHtml(ctx) {
  const data = ctx.state.data, pc = Logic.pendingClaims(data);
  return `<h3>🏢 待 claim</h3>
    <div class="cap"><span>${pc.length} 筆合計</span><span class="num">${fmt(Logic.sumBy(pc), 2)}</span></div>
    ${pc.length ? `<div class="list">${pc.map(e => entryRow(data, e, `<button class="act" data-claimdone="${esc(e.id)}">✓ 已 claim</button>`)).join('')}</div>` : '<p style="color:var(--muted)">全部 claim 完了 🎉</p>'}
    <div style="font-size:13px;color:var(--muted)">公司付回來之後按「已 claim」。待 claim 的錢不算進你自己的花費。</div>`;
}

export function rcHtml(ctx) {
  const data = ctx.state.data, mr = Logic.missingReceipts(data);
  return `<h3>📎 缺 receipt</h3>
    <p style="margin:0;font-size:13px;color:var(--muted)">只有可扣稅、生意開銷、要 claim 的才需要。去 Shopee、淘寶的訂單記錄或 TNG 交易記錄截圖補上就好。</p>
    ${mr.length ? `<div class="list">${mr.map(e => entryRow(data, e, `<button class="act" data-rcfix="${esc(e.id)}">📷 補上</button>`)).join('')}</div>` : '<p style="color:var(--muted)">都補齊了 🎉</p>'}`;
}

export function recurHtml(ctx) {
  const month = ctx.today().slice(0, 7), pr = Logic.pendingRecurring(ctx.state.data, month);
  return `<h3>🔁 每月固定轉帳 · ${Number(month.slice(5))} 月</h3>
    <p style="margin:0;font-size:13px;color:var(--muted)">在銀行 app 轉好之後，回來按「確認」，兩邊戶口就自動扣和加。這個月不轉就按「跳過」。</p>
    ${pr.length ? `<div class="list">${pr.map(r => { const { d, m } = dayMonth(r.due); return `<div class="item"><div class="d"><b>${d}</b>${m}月</div>
      <div class="t"><div class="m">${esc(r.from)} → ${esc(r.to)}</div><div class="tags">${r.note ? `<span class="chip plain">${esc(r.note)}</span>` : ''}</div></div>
      <div class="a" style="display:grid;justify-items:end;gap:4px"><span class="num">${money(r.amount)}</span><span style="display:flex;gap:4px">
      <button class="act" data-recurskip="${esc(r.id)}" style="border-color:var(--line);color:var(--muted)">跳過</button><button class="act" data-recurok="${esc(r.id)}">✓ 確認</button></span></div></div>`; }).join('')}</div>`
      : '<p style="color:var(--muted)">這個月的固定轉帳都確認了。</p>'}
    <div style="font-size:13px;color:var(--muted)">要新增或停掉：設定 › 每月固定轉帳。</div>`;
}

export function infoHtml(ctx, code, year) {
  const data = ctx.state.data;
  const rules = Logic.rulesFor(data.categories, year);
  const c = rules[code] || { name: code, group: 'plain' };
  if (c.group === 'plain') return `<h3>${esc(c.name)} <span class="chip plain">一般開銷</span></h3><p>這一類不能扣稅，只是記帳。如果其實是生意用的，請改選 💼 的類別。</p>`;
  const top = Logic.taxProgress(data, year).find(p => p.code === code);
  const used = top ? top.used : Logic.sumBy(data.entries.filter(e => Logic.yearOf(e.date) === year && e.category === code && !e.claimCo));
  const chip = c.group === 'biz' ? '<span class="chip biz">Freelance 生意開銷</span>' : '<span class="chip tax">個人扣稅 relief</span>';
  return `<h3>${esc(c.name)} ${chip}</h3>
    ${c.cap ? `<div class="cap"><span>上限 / 年</span><span class="num">${fmt(c.cap)}</span></div>
      <div class="cap"><span>${year} 年你已用</span><span class="num">${money(used)}${used >= c.cap ? ' · 已滿' : ''}</span></div>`
      : '<div class="cap"><span>上限</span><span>沒有上限，直接從收入扣</span></div>'}
    <dl>${c.include ? `<div><dt>包括</dt><dd>${esc(c.include)}</dd></div>` : ''}
      ${c.exclude ? `<div><dt>不包括 / 注意</dt><dd>${esc(c.exclude)}</dd></div>` : ''}
      ${c.note ? `<div><dt>備註</dt><dd>${esc(c.note)}</dd></div>` : ''}</dl>
    <div class="yr">📅 用 <b>YA${year}</b> 的規則（看記帳日期）。</div>
    <div style="font-size:12px;color:var(--muted)">僅供整理，報稅前請自行確認。</div>`;
}

export function detailHtml(ctx, code, year) {
  const data = ctx.state.data;
  const rules = Logic.rulesFor(data.categories, year);
  const codes = [code].concat(Object.values(rules).filter(k => k.parent === code).map(k => k.code));
  const rows = data.entries.filter(e => codes.includes(e.category) && Logic.yearOf(e.date) === year && !e.claimCo).sort((a, b) => b.date.localeCompare(a.date));
  return `<h3>${esc((rules[code] || {}).name || code)} · ${year}</h3>
    ${rows.length ? `<div class="list">${rows.map(e => entryRow(data, e)).join('')}</div>
      <div style="font-size:13px;color:var(--muted)">報稅時照著這裡填 e-Filing。每筆的 receipt 在 Google Drive「記帳App Receipts/${year}/」。</div>`
      : '<p style="color:var(--muted)">今年還沒有這一類的記錄。</p>'}
    <button class="link" data-info="${esc(code)}" data-year="${year}" style="justify-self:start">ⓘ 看這一類可以扣什麼</button>`;
}

export function onClick(el, ctx) {
  const d = el.dataset, data = ctx.state && ctx.state.data;
  if (!data) return false;
  if (d.edit) {
    const [kind, id] = d.edit.split(':');
    if (kind === 'entry') {
      const e = data.entries.find(x => x.id === id);
      if (!e) return true;
      ctx.closeSheet();
      ctx.state.draft = Object.assign({}, e, { claim: !!e.claimCo, claimCo: e.claimCo || (data.claimCos[0] || {}).name || '' });
      ctx.state.addMode = 'out'; ctx.state.confirmDelete = null;
      ctx.go('add');
    } else if (kind === 'income') {
      const i = data.incomes.find(x => x.id === id);
      if (!i) return true;
      ctx.closeSheet();
      ctx.state.incDraft = Object.assign({}, i);
      ctx.state.addMode = 'in'; ctx.state.confirmDelete = null;
      ctx.go('add');
    } else {
      ctx.state.confirmDelete = null;
      ctx.openSheet(rowHtml(ctx, kind, id));
    }
    return true;
  }
  if (d.delrow) {
    const [kind, id] = d.delrow.split(':');
    if (ctx.state.confirmDelete !== id) {
      ctx.state.confirmDelete = id;
      el.textContent = '再按一次確認刪除';
      return true;
    }
    ctx.state.confirmDelete = null;
    ctx.act('remove', { kind, id }, '已刪除').then(() => {
      ctx.closeSheet();
      if (kind === 'entry') ctx.state.draft = null;
      if (kind === 'income') { ctx.state.incDraft = null; ctx.state.addMode = 'out'; }
      if (kind === 'entry' || kind === 'income') ctx.go('home');
    }).catch(() => {});
    return true;
  }
  if (d.rcfix) {
    const e = data.entries.find(x => x.id === d.rcfix);
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      if (!input.files.length) return;
      try {
        const img = await compress(input.files[0]);
        const up = await ctx.act('uploadReceipt', { base64: img.base64, mime: img.mime, filename: img.filename });
        await ctx.act('save', { kind: 'entry', record: Object.assign({}, e, { receiptFileId: up.fileId }) }, 'receipt 已存到 Drive');
        ctx.openSheet(rcHtml(ctx));
      } catch { /* 已經 toast */ }
    };
    input.click();
    return true;
  }
  const month = ctx.today().slice(0, 7);
  if (d.bank !== undefined) { ctx.openSheet(bankHtml(ctx, mainAccount(data))); return true; }
  if (d.acct) { ctx.openSheet(bankHtml(ctx, d.acct)); return true; }
  if (d.pending) { ctx.openSheet({ claim: claimHtml, rc: rcHtml, recur: recurHtml }[d.pending](ctx)); return true; }
  if (d.detail) { ctx.openSheet(detailHtml(ctx, d.detail, Number(d.year) || Number(ctx.today().slice(0, 4)))); return true; }
  if (d.info) { ctx.openSheet(infoHtml(ctx, d.info, Number(d.year) || Number(ctx.today().slice(0, 4)))); return true; }
  if (d.claimdone) {
    const e = data.entries.find(x => x.id === d.claimdone);
    ctx.act('save', { kind: 'entry', record: Object.assign({}, e, { claimDone: true }) }, `已標記：${e.claimCo} 付回來了`)
      .then(() => ctx.openSheet(claimHtml(ctx))).catch(() => {});
    return true;
  }
  if (d.recurok) {
    const r = data.recurring.find(x => x.id === d.recurok);
    ctx.act('save', { kind: 'transfer', record: { date: ctx.today(), from: r.from, to: r.to, amount: r.amount, note: r.note, recurId: r.id } },
      `已記：${r.from} → ${r.to} ${money(r.amount)}`).then(() => ctx.openSheet(recurHtml(ctx))).catch(() => {});
    return true;
  }
  if (d.recurskip) {
    ctx.act('skipRecur', { recurId: d.recurskip, month }, '這個月跳過，下個月再提醒').then(() => ctx.openSheet(recurHtml(ctx))).catch(() => {});
    return true;
  }
  return false;
}

export function onSubmit(form, ctx) {
  if (form.id !== 'adjForm') return false;
  const name = form.dataset.account;
  const raw = form.querySelector('#adjAmt').value.replace(/[^\d.-]/g, '');
  if (!raw) { ctx.toast('請填它現在顯示的餘額', true); return true; }
  const adj = Logic.makeAdjust(ctx.state.data, name, Number(raw), ctx.today(), form.querySelector('#adjNote').value.trim());
  const msg = adj.diff ? `已校正 ${adj.diff > 0 ? '＋' : '−'}${fmt(Math.abs(adj.diff), 2)}，記到「戶口調整」` : '跟實際一樣，不用校正';
  if (!adj.diff) { ctx.toast(msg); return true; }
  ctx.act('save', { kind: 'adjust', record: adj }, msg).then(() => ctx.openSheet(bankHtml(ctx, name))).catch(() => {});
  return true;
}

function rowHtml(ctx, kind, id) {
  const data = ctx.state.data;
  if (kind === 'transfer') {
    const t = data.transfers.find(x => x.id === id);
    if (!t) return '<p>找不到這筆，可能已經刪掉了。</p>';
    return `<h3>↔ 轉帳 · ${esc(t.date)}</h3>
      <div class="check"><div class="ln"><span>${esc(t.from)}</span><span class="num down">− ${fmt(t.amount, 2)}</span></div>
      <div class="ln"><span>${esc(t.to)}</span><span class="num up">＋ ${fmt(t.amount, 2)}</span></div></div>
      ${t.note ? `<p style="margin:0">${esc(t.note)}</p>` : ''}
      <button class="danger" data-delrow="transfer:${esc(t.id)}">刪除這筆轉帳</button>
      <div class="hint">記錯了就刪掉，再重新記一筆。</div>`;
  }
  const a = data.adjusts.find(x => x.id === id);
  if (!a) return '<p>找不到這筆，可能已經刪掉了。</p>';
  return `<h3>🔧 校正 · ${esc(a.date)}</h3>
    <div class="cap"><span>App 算的</span><span class="num">${fmt(a.calc, 2)}</span></div>
    <div class="cap"><span>實際餘額</span><span class="num">${fmt(a.real, 2)}</span></div>
    <div class="cap"><span>差額</span><span class="num">${a.diff > 0 ? '＋' : '−'} ${fmt(Math.abs(a.diff), 2)}</span></div>
    <button class="danger" data-delrow="adjust:${esc(a.id)}">刪除這筆校正</button>`;
}
