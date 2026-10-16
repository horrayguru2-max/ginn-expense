import { fmt, money, esc } from '../format.js';

const toNum = v => Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;   // 透支的戶口可以是負數

function stock(ctx) {
  const s = ctx.state, data = s.data, month = ctx.today().slice(0, 7), pm = Logic.prevMonth(month);
  if (s.stock && s.stock.month === month) return s.stock;
  const values = {};
  data.accounts.forEach(a => {
    const cur = data.stocktakes.find(x => x.month === month && x.account === a.name);
    const prev = data.stocktakes.find(x => x.month === pm && x.account === a.name);
    values[a.name] = String(cur ? cur.balance : prev ? prev.balance : 0);
  });
  s.stock = { month, values };
  return s.stock;
}

export function render(ctx) {
  const data = ctx.state.data, st = stock(ctx), month = st.month, pm = Logic.prevMonth(month);
  const accs = data.accounts.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const prevOf = name => (data.stocktakes.find(x => x.month === pm && x.account === name) || { balance: 0 }).balance;
  const total = Logic.round2(accs.reduce((sum, a) => sum + toNum(st.values[a.name]), 0));
  const prevTotal = Logic.stocktakeTotal(data, pm, 'all');
  const diff = Logic.round2(total - prevTotal);
  const inc = Logic.monthIncome(data, pm, 'all'), spend = Logic.monthSpend(data, pm, 'all');
  const gap = Logic.round2(Math.abs((inc - spend) - diff));
  const pmLabel = Number(pm.slice(5)) + ' 月';
  const bySource = data.sources.map(src => ({ src, total: Logic.sumBy(data.incomes.filter(i => i.source === src.name && i.date.startsWith(pm))) }));

  return `<div class="view">
    <button class="link" data-go="accounts" style="justify-self:start">‹ 回我的戶口</button>
    <div class="view-head"><h2>月頭盤點</h2><span class="sub">${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月 1 日</span></div>
    <p class="say">每個月 1 號做一次：打開每個 app 看餘額，填進來就好。沒變的不用改。</p>
    <div class="panel"><h3><span>戶口餘額</span><span style="font-size:12px">已帶出${data.stocktakes.some(x => x.month === month) ? '這個月填過的' : '上個月的'}數字</span></h3>
      ${accs.map((a, i) => {
        const v = toNum(st.values[a.name]), p = prevOf(a.name), dl = Logic.round2(v - p);
        const est = Logic.estimateMonthStart(data, a.name, month);
        const g = est === null ? null : Logic.round2(Math.abs(v - est));
        return `<div class="acct"><label class="nm" for="acc${i}">${esc(a.name)}${a.note ? ` <span class="chip plain">${esc(a.note)}</span>` : ''}${a.biz ? ' <span class="chip biz">💼 生意</span>' : ''}</label>
          <input id="acc${i}" class="num" inputmode="decimal" value="${esc(st.values[a.name])}" data-stock="${esc(a.name)}">
          <div class="prev"><span>上月 ${money(p)}${a.where ? ` · 去 ${esc(a.where)} 看` : ''}</span><span id="dl${i}" class="${deltaCls(dl)}">${deltaText(dl)}</span></div>
          ${est !== null && a.group === 'daily' ? `<div class="prev"><span>App 推算 ${money(est)}（還卡、充 TNG 沒記，會偏高）</span><span id="gp${i}" class="${gapCls(g)}">${gapText(g)}</span></div>` : ''}
        </div>`;
      }).join('')}
      <div class="total"><span>💰 我全部的錢</span><span class="num" id="stTotal">${fmt(total)}</span></div>
      <div style="text-align:right;font-size:13px" id="stDiff" class="num ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${money(Math.abs(diff))} 比上月</div>
    </div>
    <div class="panel"><h3><span>${pmLabel}收入</span><button class="link" data-addmode="in">＋ 補記收入</button></h3>
      ${bySource.map(x => `<div class="bizline"><span>${esc(x.src.name)} ${x.src.biz ? '<span class="chip biz">💼 生意</span>' : '<span class="chip plain">🧑 個人</span>'} <span class="chip plain">報 Form B</span></span><span class="num">${money(x.total)}</span></div>`).join('')}
      <div class="hint">平時記過的會自動算進來。漏了就按「補記收入」。</div>
    </div>
    ${prevTotal ? `<div class="check">
      <div class="ln"><span>${pmLabel}收入 − 花費</span><span class="num">${money(inc)} − ${money(spend)} = ${money(inc - spend)}</span></div>
      <div class="ln"><span>資產變化</span><span class="num">${money(diff)}</span></div>
      <div><b>${gap <= 200 ? `✓ 差 ${money(gap)}，差不多對得上` : `⚠ 差了 ${money(gap)}，可能有帳漏記了`}</b></div>
    </div>` : ''}
    <button class="btn" data-save-stock>存這個月的盤點</button>
  </div>`;
}

const deltaCls = dl => 'num ' + (dl > 0 ? 'up' : dl < 0 ? 'down' : '');
const deltaText = dl => dl === 0 ? '沒變' : (dl > 0 ? '▲ ' : '▼ ') + money(Math.abs(dl));
const gapCls = g => 'num ' + (g > 500 ? 'down' : 'up');
const gapText = g => g > 500 ? `⚠ 差 ${money(g)}，可能漏記` : `✓ 差 ${money(g)}`;

/* 打字時只更新數字（不重畫整頁）：
   重畫會換掉輸入框（手機鍵盤出問題），也會換掉「存」按鈕（填完直接按存會按不到） */
export function onInput(el, ctx) {
  if (el.dataset.stock === undefined) return false;
  const data = ctx.state.data, st = ctx.state.stock, name = el.dataset.stock, i = el.id.replace('acc', '');
  st.values[name] = el.value;
  const v = toNum(el.value), pm = Logic.prevMonth(st.month);
  const p = (data.stocktakes.find(x => x.month === pm && x.account === name) || { balance: 0 }).balance;
  const dl = Logic.round2(v - p), dlEl = document.getElementById('dl' + i);
  if (dlEl) { dlEl.className = deltaCls(dl); dlEl.textContent = deltaText(dl); }
  const est = Logic.estimateMonthStart(data, name, st.month), gpEl = document.getElementById('gp' + i);
  if (gpEl && est !== null) { const g = Logic.round2(Math.abs(v - est)); gpEl.className = gapCls(g); gpEl.textContent = gapText(g); }
  const total = Logic.round2(data.accounts.reduce((sum, a) => sum + toNum(st.values[a.name]), 0));
  const diff = Logic.round2(total - Logic.stocktakeTotal(data, Logic.prevMonth(st.month), 'all'));
  document.getElementById('stTotal').textContent = fmt(total);
  const d = document.getElementById('stDiff');
  d.className = 'num ' + (diff >= 0 ? 'up' : 'down');
  d.textContent = (diff >= 0 ? '▲ ' : '▼ ') + money(Math.abs(diff)) + ' 比上月';
  return true;
}

export function onClick(el, ctx) {
  if (el.dataset.saveStock === undefined) return false;
  const st = ctx.state.stock;
  const balances = ctx.state.data.accounts.map(a => ({ account: a.name, balance: toNum(st.values[a.name]) }));
  ctx.act('saveStocktake', { month: st.month, balances }, `已存 ${Number(st.month.slice(5))} 月的盤點`).then(() => {
    ctx.state.stock = null;
    ctx.go('accounts');
  }).catch(() => {});
  return true;
}
