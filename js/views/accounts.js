import { fmt, num2, esc } from '../format.js';

const GROUPS = [['daily', '🏦 日常戶口', '平時花錢、收錢用的'], ['save', '💰 定期存款 / 儲蓄', '存起來的錢，月頭看一次就好'],
  ['invest', '📈 投資', ''], ['biz', '💼 TheGuruboss 生意', '生意的錢跟自己的錢分開看']];

export function render(ctx) {
  const data = ctx.state.data, today = ctx.today();
  const accs = data.accounts.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const now = a => Logic.balanceNow(data, a.name, today);
  return `<div class="view">
    <div class="view-head"><h2>我的戶口</h2><span class="sub">點一個看進出</span></div>
    <div class="kpi wide"><div><div class="lb">我全部的錢（大約）</div><div class="v num">${fmt(Logic.totalNow(data, today))}</div></div></div>
    <div class="two"><button class="btn ghost" data-addmode="tr">↔ 轉帳</button><button class="btn" data-go="balance">📋 月頭盤點</button></div>
    ${GROUPS.map(([g, label, desc]) => {
      const list = accs.filter(a => (a.group || 'daily') === g);
      if (!list.length) return '';
      return `<div class="panel"><h3><span>${label}</span><span class="num">${fmt(Logic.sumBy(list, now))}</span></h3>${desc ? `<div class="hint" style="margin:-6px 0 4px">${desc}</div>` : ''}
        ${list.map(a => `<button class="acrow" data-acct="${esc(a.name)}"><span><b>${esc(a.name)}</b>${a.note ? `<small>${esc(a.note)}</small>` : ''}</span><span class="num">${num2(now(a))} ›</span></button>`).join('')}</div>`;
    }).join('')}
    <div class="tip" style="border:0;margin:0">數字跟銀行或 app 對不上？點進那個戶口，在最下面按「校正」就好。不會弄亂你的帳。</div>
  </div>`;
}
