import { fmt, money, esc } from '../format.js';
import { mainAccount, entryRow } from './sheets.js';

const SHOW_ALWAYS = ['LIFESTYLE', 'SPORTS', 'MEDICAL', 'EDUCATION', 'TRAVEL_LOCAL'];

export function render(ctx) {
  const s = ctx.state, data = s.data, today = ctx.today(), month = today.slice(0, 7), year = Number(today.slice(0, 4));
  const scope = s.scope, main = mainAccount(data);
  const spend = Logic.monthSpend(data, month, scope), inc = Logic.monthIncome(data, month, scope);
  const bankNow = Logic.balanceNow(data, main, today);
  const pc = Logic.pendingClaims(data), mr = Logic.missingReceipts(data), pr = Logic.pendingRecurring(data, month);
  const todoCount = (pc.length ? 1 : 0) + (mr.length ? 1 : 0) + (pr.length ? 1 : 0);

  const stMonth = data.stocktakes.some(x => x.month === month) ? month
    : (data.stocktakes.map(x => x.month).filter(m => m <= month).sort().pop() || month);
  const assets = Logic.stocktakeTotal(data, stMonth, scope);
  const prevAssets = Logic.stocktakeTotal(data, Logic.prevMonth(stMonth), scope);
  const dl = Logic.round2(assets - prevAssets);

  const tax = Logic.taxProgress(data, year).filter(p => p.used > 0 || SHOW_ALWAYS.includes(p.code));
  const biz = Logic.bizTotals(data, year);
  const list = data.entries.slice()
    .filter(e => scope === 'all' || (scope === 'biz') === (Logic.groupOf(data, e.category, e.date) === 'biz'))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);
  const b = Logic.statement(data, main, today);
  const bIn = Logic.sumBy(b.rows.filter(r => r.kind === 'income')), bOut = -Logic.sumBy(b.rows.filter(r => r.kind === 'entry'));
  const bTr = Logic.sumBy(b.rows.filter(r => r.kind === 'transfer')), bAdj = Logic.sumBy(b.rows.filter(r => r.kind === 'adjust'));
  const sign = v => (v > 0 ? '＋' : '−') + ' ';

  return `<div class="view">
    <div class="view-head"><h2>${Number(month.slice(5))} 月</h2>
      <div class="seg" role="group" aria-label="範圍">
        ${[['all', '全部'], ['personal', '個人'], ['biz', '生意']].map(([v, l]) => `<button data-scope="${v}" aria-pressed="${scope === v}">${l}</button>`).join('')}
      </div></div>
    <p class="say">${Number(month.slice(5))} 月到今天，你花了 <b class="num">${fmt(spend, spend % 1 ? 2 : 0)}</b>，收到 <b class="num">${money(inc)}</b>。${scope !== 'biz' && main ? `${esc(main)}大約還有 <b class="num">${fmt(bankNow, 2)}</b>。` : ''}${todoCount ? `有 <b>${todoCount} 件事</b>要處理，看下面。` : '沒有要處理的事。'}</p>
    <div class="kpis">
      <div class="kpi"><div class="lb">本月花費（不含待 claim）</div><div class="v num">${money(spend)}</div></div>
      <div class="kpi"><div class="lb">本月收入</div><div class="v num">${money(inc)}</div></div>
      <div class="kpi wide"><div><div class="lb">我全部的錢（${Number(stMonth.slice(5))}/1 盤點）</div><div class="v num">${money(assets)}</div></div>
        ${prevAssets ? `<div class="delta num ${dl >= 0 ? 'up' : 'down'}">${dl >= 0 ? '▲' : '▼'} ${money(Math.abs(dl))} 比上月</div>` : ''}</div>
    </div>
    ${scope !== 'biz' && main ? `<button class="bank" data-bank>
      <span class="lb"><span>🏦 ${esc(main)}現在大約剩</span><span>看怎麼算 ›</span></span>
      <span class="v num">${fmt(bankNow, 2)}</span>
      <span class="calc num">${b.base.month ? Number(b.base.month.slice(5)) + '/1 盤點' : '盤點'} ${money(b.base.balance)} ＋ 存入 ${money(bIn)} − 扣 ${fmt(bOut, 2)}${bTr ? ` ${sign(bTr)}轉帳 ${money(Math.abs(bTr))}` : ''}${bAdj ? ` ${sign(bAdj)}校正 ${fmt(Math.abs(bAdj), 2)}` : ''}</span>
      <span class="note">未扣信用卡 / TNG 還款，所以會比實際多一點，下個月盤點時校正</span>
    </button>` : ''}
    ${todoCount ? `<div class="panel"><h3><span>待處理</span></h3><div class="todo">
      ${pr.length ? `<button data-pending="recur"><span>🔁 每月固定轉帳<br><small>${pr.length} 筆 · 轉了就按「確認」</small></span><span class="num">${money(Logic.sumBy(pr))}</span></button>` : ''}
      ${pc.length ? `<button data-pending="claim"><span>🏢 待 claim<br><small>${pc.length} 筆 · 公司付回來後按「已 claim」</small></span><span class="num">${fmt(Logic.sumBy(pc), 2)}</span></button>` : ''}
      ${mr.length ? `<button data-pending="rc"><span>📎 缺 receipt<br><small>可扣稅或要 claim 的，月底補截圖就好</small></span><span class="num">${mr.length} 筆</span></button>` : ''}
    </div></div>` : ''}
    ${scope !== 'biz' ? `<div class="panel"><h3><span>${year} 扣稅進度（${year + 1} 年報稅）</span></h3><div class="bars">
      ${tax.map(p => `<button class="bar ${p.full ? 'full' : ''}" data-detail="${esc(p.code)}" data-year="${year}">
        <div class="row"><span>${esc(p.name)}</span><span class="amt num">${money(p.used)} / ${fmt(p.cap)}</span></div>
        <div class="track"><div class="fill" style="width:${Math.min(100, p.cap ? p.used / p.cap * 100 : 0)}%"></div></div>
        ${p.full ? '<div class="state">✓ 已滿，再買這一類不會多扣</div>' : ''}
      </button>`).join('')}
      </div><div class="tip">💡 你沒有 EPF：自己透過 i-Saraan 供 EPF，一年最多可以扣 RM4,000</div></div>` : ''}
    ${scope !== 'personal' ? `<div class="panel"><h3><span>💼 Freelance 生意開銷 ${year}</span><span class="num" style="color:var(--biz);font-weight:600">${fmt(Logic.sumBy(biz, x => x.total), 2)}</span></h3>
      ${biz.map(x => `<div class="bizline"><span>${esc(x.name)}</span><span class="num">${fmt(x.total, 2)}</span></div>`).join('') || '<div class="hint">今年還沒有生意開銷。</div>'}
      <div style="font-size:12px;color:var(--muted);margin-top:6px">直接從 Freelance 收入扣，沒有上限</div></div>` : ''}
    <div class="panel"><h3><span>最近記帳</span><span style="display:flex;gap:14px"><button class="link" data-addmode="in">＋ 記收入</button><button class="link" data-addmode="out">＋ 記一筆</button></span></h3>
      <div class="list">${list.map(e => entryRow(data, e)).join('') || '<div class="hint">還沒有記帳。按下面的「記帳」開始。</div>'}</div></div>
  </div>`;
}

export function onClick(el, ctx) {
  if (el.dataset.scope) { ctx.state.scope = el.dataset.scope; ctx.render(); return true; }
  return false;
}
