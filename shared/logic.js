/* 記帳 App 共用邏輯。瀏覽器（window.Logic）、Node 測試（require）、Apps Script（全域）都用這一份。
   不能用 import / export。日期一律是 'YYYY-MM-DD' 字串，月份 'YYYY-MM'。 */
var Logic = (function () {
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function sumBy(rows, f) {
    return round2(rows.reduce(function (s, r) { return s + (Number(f ? f(r) : r.amount) || 0); }, 0));
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function monthOf(date) { return String(date || '').slice(0, 7); }
  function yearOf(date) { return Number(String(date || '').slice(0, 4)); }
  function prevMonth(m) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1;
    if (mo === 0) { y -= 1; mo = 12; }
    return y + '-' + pad2(mo);
  }
  function nextMonth(m) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) + 1;
    if (mo === 13) { y += 1; mo = 1; }
    return y + '-' + pad2(mo);
  }
  function daysInMonth(m) { return new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate(); }
  var idCounter = 0;
  function newId() {
    idCounter += 1;
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + idCounter.toString(36);
  }
  function inScope(isBiz, scope) { return scope === 'all' || (scope === 'biz') === !!isBiz; }

  /* ---------- 戶口 ---------- */
  function stocktakeBase(data, account, month) {
    var rows = data.stocktakes
      .filter(function (s) { return s.account === account && s.month <= month; })
      .sort(function (a, b) { return a.month < b.month ? 1 : a.month > b.month ? -1 : 0; });
    return rows.length ? { month: rows[0].month, balance: round2(rows[0].balance) } : { month: null, balance: 0 };
  }

  function movements(data, account, fromDate, toDate) {
    function inRange(d) { return (!fromDate || d >= fromDate) && (!toDate || d <= toDate); }
    var rows = [];
    data.incomes.forEach(function (i) {
      if (i.account === account && inRange(i.date)) rows.push({ date: i.date, kind: 'income', id: i.id, label: '💰 ' + i.source, sub: i.note || '', amount: round2(i.amount) });
    });
    data.entries.forEach(function (e) {
      if (e.account && e.account === account && inRange(e.date)) rows.push({ date: e.date, kind: 'entry', id: e.id, label: e.merchant, sub: e.pay || '', amount: -round2(e.amount) });
    });
    data.transfers.forEach(function (t) {
      if (t.to === account && inRange(t.date)) rows.push({ date: t.date, kind: 'transfer', id: t.id, label: '↔ 從 ' + t.from + ' 轉入', sub: t.note || '', amount: round2(t.amount) });
      if (t.from === account && inRange(t.date)) rows.push({ date: t.date, kind: 'transfer', id: t.id, label: '↔ 轉去 ' + t.to, sub: t.note || '', amount: -round2(t.amount) });
    });
    data.adjusts.forEach(function (a) {
      if (a.account === account && inRange(a.date)) rows.push({ date: a.date, kind: 'adjust', id: a.id, label: '🔧 校正', sub: 'App 算 ' + round2(a.calc).toFixed(2) + ' → 實際 ' + round2(a.real).toFixed(2) + (a.note ? ' · ' + a.note : ''), amount: round2(a.diff) });
    });
    // Array.prototype.sort 是穩定排序：同一天的順序 = 收入、花費、轉帳、校正
    return rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function statement(data, account, today) {
    var base = stocktakeBase(data, account, monthOf(today));
    var run = base.balance;
    var rows = movements(data, account, base.month ? base.month + '-01' : null, today).map(function (r) {
      run = round2(run + r.amount);
      return Object.assign({}, r, { balance: run });
    });
    return { base: base, rows: rows, now: run };
  }
  function balanceNow(data, account, today) { return statement(data, account, today).now; }

  function estimateMonthStart(data, account, month) {
    var pm = prevMonth(month);
    var base = stocktakeBase(data, account, pm);
    if (!base.month) return null;
    var moves = movements(data, account, base.month + '-01', pm + '-31');
    return round2(base.balance + sumBy(moves));
  }

  function makeAdjust(data, account, real, today, note) {
    var calc = balanceNow(data, account, today);
    return { date: today, account: account, calc: calc, real: round2(real), diff: round2(Number(real) - calc), note: note || '' };
  }

  function accountIsBiz(data, name) {
    var a = data.accounts.find(function (x) { return x.name === name; });
    return !!(a && a.biz);
  }
  function stocktakeTotal(data, month, scope) {
    return sumBy(data.stocktakes.filter(function (s) {
      return s.month === month && inScope(accountIsBiz(data, s.account), scope);
    }), function (s) { return s.balance; });
  }
  function totalNow(data, today) {
    return round2(data.accounts.reduce(function (s, a) { return s + balanceNow(data, a.name, today); }, 0));
  }

  /* ---------- 類別、花費、收入 ---------- */
  function rulesFor(categories, year) {
    var years = categories.map(function (c) { return Number(c.year); })
      .filter(function (y, i, arr) { return arr.indexOf(y) === i; }).sort(function (a, b) { return a - b; });
    if (!years.length) return {};
    var older = years.filter(function (y) { return y <= year; });
    var pick = older.length ? older[older.length - 1] : years[0];
    var map = {};
    categories.forEach(function (c) { if (Number(c.year) === pick) map[c.code] = c; });
    return map;
  }
  function groupOf(data, code, date) {
    var c = rulesFor(data.categories, yearOf(date))[code];
    return c ? c.group : 'plain';
  }
  function monthSpend(data, month, scope) {
    return sumBy(data.entries.filter(function (e) {
      return monthOf(e.date) === month && !e.claimCo && inScope(groupOf(data, e.category, e.date) === 'biz', scope);
    }));
  }
  function sourceIsBiz(data, name) {
    var s = data.sources.find(function (x) { return x.name === name; });
    return !!(s && s.biz);
  }
  function monthIncome(data, month, scope) {
    return sumBy(data.incomes.filter(function (i) { return monthOf(i.date) === month && inScope(sourceIsBiz(data, i.source), scope); }));
  }

  /* ---------- 扣稅 ---------- */
  function taxProgress(data, year) {
    var rules = rulesFor(data.categories, year);
    var all = Object.keys(rules).map(function (k) { return rules[k]; });
    return all.filter(function (c) { return c.group === 'tax' && !c.parent; }).map(function (c) {
      var codes = [c.code].concat(all.filter(function (k) { return k.parent === c.code; }).map(function (k) { return k.code; }));
      var rows = data.entries.filter(function (e) { return yearOf(e.date) === year && !e.claimCo && codes.indexOf(e.category) >= 0; });
      var used = sumBy(rows), cap = Number(c.cap) || 0;
      return { code: c.code, name: c.name, cap: cap, used: used, left: round2(Math.max(0, cap - used)), full: cap > 0 && used >= cap,
        count: rows.length, needsCheck: rows.filter(function (r) { return r.needsCheck; }).length };
    });
  }
  function bizTotals(data, year) {
    var rules = rulesFor(data.categories, year);
    return Object.keys(rules).map(function (k) { return rules[k]; }).filter(function (c) { return c.group === 'biz'; }).map(function (c) {
      var rows = data.entries.filter(function (e) { return yearOf(e.date) === year && !e.claimCo && e.category === c.code; });
      return { code: c.code, name: c.name, total: sumBy(rows), count: rows.length };
    }).filter(function (x) { return x.count > 0; });
  }

  /* ---------- 待處理 ---------- */
  function needsReceipt(data, e) { return groupOf(data, e.category, e.date) !== 'plain' || !!e.claimCo; }
  function missingReceipts(data) { return data.entries.filter(function (e) { return needsReceipt(data, e) && !e.receiptUrl; }); }
  function pendingClaims(data) { return data.entries.filter(function (e) { return e.claimCo && !e.claimDone; }); }
  function pendingRecurring(data, month) {
    return data.recurring.filter(function (r) {
      return r.active !== false
        && !data.transfers.some(function (t) { return t.recurId === r.id && monthOf(t.date) === month; })
        && !data.skips.some(function (s) { return s.recurId === r.id && s.month === month; });
    }).map(function (r) {
      return Object.assign({}, r, { due: month + '-' + pad2(Math.min(Number(r.day) || 1, daysInMonth(month))) });
    });
  }

  /* ---------- 打字快記 ---------- */
  var GUESS = [
    [/電腦|laptop|手機|平板|ipad|iphone/i, 'LIFESTYLE', true],
    [/午餐|晚餐|早餐|kopi|lunch|dinner|nasi|mamak|咖啡|teh|roti|吃/i, 'FOOD'],
    [/grab|油|petrol|parking|停車|toll/i, 'TRANSPORT'],
    [/canva|chatgpt|claude|adobe|elementor|google workspace/i, 'BIZ_SOFTWARE'],
    [/hosting|hostinger|域名|domain/i, 'BIZ_HOSTING'],
    [/gym|健身|羽毛球|badminton|球場|futsal/i, 'SPORTS'],
    [/書|book|kindle|unifi|上網/i, 'LIFESTYLE'],
    [/超市|aeon|lotus|jaya grocer|speedmart|日用/i, 'GROCERY'],
    [/水電|電費|水費|tnb|air selangor|indah water/i, 'HOME']
  ];
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function payAccount(data, payName) {
    var p = data.pay.find(function (x) { return x.name === payName; });
    return p && p.account ? p.account : '';
  }
  function parseQuick(data, text, today) {
    var t = String(text || '').trim();
    var am = t.match(/RM\s*([\d,]+(?:\.\d+)?)|(?:^|\s)([\d,]+(?:\.\d+)?)(?=\s|$)/i);
    var amount = am ? round2(Number((am[1] || am[2]).replace(/,/g, ''))) : null;
    var rest = am ? t.replace(am[0], ' ') : t;
    var pays = data.pay.map(function (p) { return p.name; }).sort(function (a, b) { return b.length - a.length; });
    var pay = pays.find(function (p) { return new RegExp(escRe(p), 'i').test(rest); });
    if (pay) rest = rest.replace(new RegExp(escRe(pay), 'i'), ' ');
    pay = pay || (data.pay[0] ? data.pay[0].name : '');
    var g = GUESS.find(function (x) { return x[0].test(t); });
    return {
      date: today, merchant: rest.replace(/\s+/g, ' ').trim() || '（未填）', amount: amount,
      category: g ? g[1] : 'OTHER', pay: pay, account: payAccount(data, pay), needsCheck: !!(g && g[2])
    };
  }

  /* ---------- 搜尋 ----------
     q = { text, period: 'month'|'year'|'all', kind: 'all'|'entry'|'income'|'transfer', pay, category, tag: ''|'tax'|'biz'|'claim'|'rc', today }
     付款方式、類別、標籤只對花費有意義，選了就只留花費。多個字要全部符合。 */
  function search(data, q) {
    var words = String(q.text || '').toLowerCase().split(/\s+/).filter(Boolean);
    var entryOnly = !!(q.pay || q.category || q.tag);
    function inPeriod(date) {
      if (q.period === 'month') return monthOf(date) === monthOf(q.today);
      if (q.period === 'year') return yearOf(date) === yearOf(q.today);
      return true;
    }
    function hit(fields) {
      var hay = fields.filter(function (f) { return f !== undefined && f !== null && f !== ''; }).join(' ').toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    }
    var rows = [];
    if (q.kind === 'all' || q.kind === 'entry') {
      data.entries.forEach(function (e) {
        if (!inPeriod(e.date)) return;
        var c = rulesFor(data.categories, yearOf(e.date))[e.category] || {};
        if (q.pay && e.pay !== q.pay) return;
        if (q.category && e.category !== q.category && c.parent !== q.category) return;
        if (q.tag === 'tax' && c.group !== 'tax') return;
        if (q.tag === 'biz' && c.group !== 'biz') return;
        if (q.tag === 'claim' && !(e.claimCo && !e.claimDone)) return;
        if (q.tag === 'rc' && !(needsReceipt(data, e) && !e.receiptUrl)) return;
        if (!hit([e.merchant, e.note, c.name, e.category, e.pay, e.account, e.use, e.claimCo, String(e.amount)])) return;
        rows.push({ kind: 'entry', id: e.id, date: e.date, label: e.merchant, amount: round2(e.amount), record: e });
      });
    }
    if (!entryOnly && (q.kind === 'all' || q.kind === 'income')) {
      data.incomes.forEach(function (i) {
        if (!inPeriod(i.date) || !hit([i.source, i.note, i.account, String(i.amount)])) return;
        rows.push({ kind: 'income', id: i.id, date: i.date, label: '💰 ' + i.source, amount: round2(i.amount), record: i });
      });
    }
    if (!entryOnly && (q.kind === 'all' || q.kind === 'transfer')) {
      data.transfers.forEach(function (t) {
        if (!inPeriod(t.date) || !hit([t.from, t.to, t.note, '轉帳', String(t.amount)])) return;
        rows.push({ kind: 'transfer', id: t.id, date: t.date, label: '↔ ' + t.from + ' → ' + t.to, amount: round2(t.amount), record: t });
      });
    }
    rows.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      var ca = String(a.record.createdAt || ''), cb = String(b.record.createdAt || '');
      return ca < cb ? 1 : ca > cb ? -1 : 0;
    });
    function total(kind) { return sumBy(rows.filter(function (r) { return r.kind === kind; })); }
    return { rows: rows, count: rows.length, spend: total('entry'), income: total('income'), transfer: total('transfer') };
  }

  return {
    search: search,
    round2: round2, sumBy: sumBy, pad2: pad2, monthOf: monthOf, yearOf: yearOf, prevMonth: prevMonth, nextMonth: nextMonth,
    daysInMonth: daysInMonth, newId: newId, inScope: inScope,
    stocktakeBase: stocktakeBase, movements: movements, statement: statement, balanceNow: balanceNow,
    estimateMonthStart: estimateMonthStart, makeAdjust: makeAdjust, accountIsBiz: accountIsBiz,
    stocktakeTotal: stocktakeTotal, totalNow: totalNow,
    rulesFor: rulesFor, groupOf: groupOf, monthSpend: monthSpend, sourceIsBiz: sourceIsBiz, monthIncome: monthIncome,
    taxProgress: taxProgress, bizTotals: bizTotals,
    needsReceipt: needsReceipt, missingReceipts: missingReceipts, pendingClaims: pendingClaims, pendingRecurring: pendingRecurring,
    payAccount: payAccount, parseQuick: parseQuick
  };
})();
if (typeof module !== 'undefined') module.exports = Logic;
