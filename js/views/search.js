/* 搜尋：打字 + 時間 / 種類 / 付款方式 / 類別 / 標籤。結果點一下就能修改（data-edit 由 sheets.js 處理）。 */
import { money, esc, dayMonth, GROUP_LABEL } from '../format.js';
import { entryRow } from './sheets.js';

const TAGS = [['tax', '🧑 可扣稅'], ['biz', '💼 生意開銷'], ['claim', '待 claim'], ['rc', '缺 receipt']];

function q(ctx) {
  return ctx.state.search || (ctx.state.search = { text: '', period: 'all', kind: 'all', pay: '', category: '', tag: '' });
}

function catOptions(data, sel, year) {
  const rules = Logic.rulesFor(data.categories, year);
  return '<option value="">全部類別</option>' + ['tax', 'biz', 'plain'].map(g => `<optgroup label="${GROUP_LABEL[g]}">${Object.values(rules)
    .filter(c => c.group === g && !c.parent).map(c => `<option value="${esc(c.code)}" ${c.code === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
}

function otherRow(r) {
  const { d, m } = dayMonth(r.date);
  const sub = r.kind === 'income' ? `存入 ${r.record.account}` : '轉帳';
  return `<div class="item" data-edit="${r.kind}:${esc(r.id)}"><div class="d"><b>${d}</b>${m}月</div>
    <div class="t"><div class="m">${esc(r.label)}</div><div class="tags"><span class="chip plain">${esc(sub)}</span>${r.record.note ? `<span class="chip plain">${esc(r.record.note)}</span>` : ''}</div></div>
    <div class="a"><span class="num ${r.kind === 'income' ? 'up' : ''}">${r.kind === 'income' ? '＋' : ''}${money(r.amount)}</span></div></div>`;
}

export function render(ctx) {
  const data = ctx.state.data, s = q(ctx), today = ctx.today();
  const res = Logic.search(data, Object.assign({ today }, s));
  const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-sq="${key}:${v}" aria-pressed="${s[key] === v}">${l}</button>`).join('')}</div>`;
  const sums = [res.spend ? `花費 ${money(res.spend)}` : '', res.income ? `收入 ${money(res.income)}` : '', res.transfer ? `轉帳 ${money(res.transfer)}` : ''].filter(Boolean).join(' · ');
  return `<div class="view">
    <button class="link" data-go="home" style="justify-self:start">‹ 回首頁</button>
    <div class="view-head"><h2>搜尋</h2></div>
    <input id="srch" class="srch" type="search" value="${esc(s.text)}" placeholder="例如：Shopee、Grab、Maybank CC、2899" aria-label="搜尋商家、備註、類別、金額" autocomplete="off">
    <div class="filters">
      ${seg('period', [['month', '這個月'], ['year', '今年'], ['all', '全部']])}
      ${seg('kind', [['all', '全部'], ['entry', '花費'], ['income', '收入'], ['transfer', '轉帳']])}
      <div class="two">
        <select id="sqPay" aria-label="付款方式"><option value="">全部付款方式</option>${data.pay.map(p => `<option value="${esc(p.name)}" ${s.pay === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select id="sqCat" aria-label="類別">${catOptions(data, s.category, Number(today.slice(0, 4)))}</select>
      </div>
      <div class="chips">${TAGS.map(([v, l]) => `<button class="pick" data-sqtag="${v}" aria-pressed="${s.tag === v}">${l}</button>`).join('')}</div>
      ${s.pay || s.category || s.tag ? '<div class="hint">選了付款方式、類別或標籤，只會列出花費。</div>' : ''}
    </div>
    <div class="sum"><b>共 ${res.count} 筆</b>${sums ? ' · ' + sums : ''}</div>
    <div class="panel results"><div class="list">${res.rows.map(r => r.kind === 'entry' ? entryRow(data, r.record) : otherRow(r)).join('')
      || '<div class="hint">找不到。試試少打幾個字，或把時間改成「全部」。</div>'}</div></div>
  </div>`;
}

export function onInput(el, ctx) {
  if (el.id !== 'srch') return false;
  q(ctx).text = el.value;
  const pos = el.selectionStart, y = window.scrollY;
  ctx.render();
  const again = document.getElementById('srch');
  again.focus();
  try { again.setSelectionRange(pos, pos); } catch {}
  window.scrollTo(0, y);
  return true;
}

export function onChange(el, ctx) {
  if (el.id === 'sqPay') { q(ctx).pay = el.value; ctx.render(); return true; }
  if (el.id === 'sqCat') { q(ctx).category = el.value; ctx.render(); return true; }
  return false;
}

export function onClick(el, ctx) {
  const s = q(ctx);
  if (el.dataset.sq) { const [key, v] = el.dataset.sq.split(':'); s[key] = v; ctx.render(); return true; }
  if (el.dataset.sqtag) { s.tag = s.tag === el.dataset.sqtag ? '' : el.dataset.sqtag; ctx.render(); return true; }
  return false;
}
