/* API 路由：Apps Script 的 doPost 和前端示範模式都呼叫 ApiCore.handle。 */
if (typeof Logic === 'undefined' && typeof require !== 'undefined') { var Logic = require('./logic.js'); }
if (typeof Schema === 'undefined' && typeof require !== 'undefined') { var Schema = require('./schema.js'); }
var ApiCore = (function () {
  var RECORD_KINDS = ['entry', 'income', 'transfer', 'adjust'];
  var SETTING_KINDS = ['pay', 'use', 'account', 'source', 'claimCo', 'recurring'];
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function ok(data) { return { ok: true, data: data }; }
  function fail(error) { return { ok: false, error: error }; }

  function bootstrap(store) {
    var out = {};
    Object.keys(Schema.KINDS).forEach(function (kind) { out[Schema.dataKey(kind)] = store.list(kind); });
    return out;
  }

  function validateRecord(kind, r) {
    if (!DATE_RE.test(String(r.date || ''))) return '日期格式不對';
    if (kind !== 'adjust' && !(Number(r.amount) > 0)) return '金額要大於 0';
    if (kind === 'transfer') {
      if (!r.from) return '請選從哪個戶口轉出';
      if (!r.to) return '請選轉去哪個戶口';
      if (r.from === r.to) return '轉出和轉入不能是同一個戶口';
    }
    if (kind === 'adjust') {
      if (!r.account) return '請選戶口';
      if (isNaN(Number(r.real)) || r.real === '' || r.real === null) return '請填實際餘額';
    }
    return null;
  }

  function save(p, deps) {
    if (RECORD_KINDS.indexOf(p.kind) < 0) return fail('不認識的資料種類：' + p.kind);
    var r = Object.assign({}, p.record || {});
    var err = validateRecord(p.kind, r);
    if (err) return fail(err);
    if (r.amount !== undefined) r.amount = Logic.round2(r.amount);
    if (p.kind === 'adjust') { r.real = Logic.round2(r.real); r.calc = Logic.round2(r.calc); r.diff = Logic.round2(r.diff); }
    if (!r.id) r.id = Logic.newId();
    if (!r.createdAt) r.createdAt = deps.now();
    if (p.kind === 'entry' && r.receiptFileId && deps.files) {
      var old = r.id ? deps.store.list('entry').find(function (e) { return e.id === r.id; }) : null;
      var moved = old && old.receiptFileId === r.receiptFileId && old.receiptUrl &&
        String(old.date).slice(0, 4) === String(r.date).slice(0, 4) && old.category === r.category;
      if (!moved) {
        try { r.receiptUrl = deps.files.file(r.receiptFileId, r.date, r.category || 'OTHER'); }
        catch (e) { /* Drive 的檔案被移走或刪掉：帳照存，保留原本的連結 */ }
      }
    }
    var saved = deps.store.upsert(p.kind, r);
    return ok(saved);
  }

  function remove(p, deps) {
    if (RECORD_KINDS.indexOf(p.kind) < 0) return fail('不認識的資料種類：' + p.kind);
    return deps.store.remove(p.kind, p.id) ? ok({ id: p.id }) : fail('找不到這筆，可能已經刪掉了');
  }

  function saveStocktake(p, deps) {
    if (!/^\d{4}-\d{2}$/.test(String(p.month || ''))) return fail('月份格式不對');
    var rows = (p.balances || []).map(function (b) {
      return { id: Logic.newId(), month: p.month, account: b.account, balance: Logic.round2(b.balance), createdAt: deps.now() };
    });
    deps.store.replaceWhere('stocktake', function (s) { return s.month === p.month; }, rows);
    return ok(rows);
  }

  function saveSettings(p, deps) {
    if (SETTING_KINDS.indexOf(p.kind) < 0) return fail('不認識的設定：' + p.kind);
    var rows = (p.rows || []).map(function (r) { return Object.assign({}, r); });
    if (p.kind === 'recurring') {
      rows.forEach(function (r) { if (!r.id) r.id = Logic.newId(); r.amount = Logic.round2(r.amount); r.day = Number(r.day) || 1; });
    } else {
      var seen = {};
      for (var i = 0; i < rows.length; i++) {
        var n = String(rows[i].name || '').trim();
        if (!n) return fail('名稱不能空白');
        if (seen[n]) return fail('名稱重複了：' + n);
        seen[n] = true;
        rows[i].name = n;
      }
    }
    deps.store.replaceWhere(p.kind, function () { return true; }, rows);
    return ok(rows);
  }

  function readReceipt(p, deps) {
    var up = deps.files.save(p.base64, p.mime, p.filename);
    var categories = deps.store.list('category');
    var ai = deps.gemini.read(p.base64, p.mime, categories, p.today);
    return ai.ok ? ok({ fileId: up.fileId, url: up.url, draft: ai.draft })
      : ok({ fileId: up.fileId, url: up.url, draft: null, aiError: ai.error });
  }

  var RENAME_REFS = {
    account: [['entry', 'account'], ['income', 'account'], ['transfer', 'from'], ['transfer', 'to'], ['adjust', 'account'],
      ['stocktake', 'account'], ['pay', 'account'], ['source', 'account'], ['recurring', 'from'], ['recurring', 'to']],
    pay: [['entry', 'pay']],
    use: [['entry', 'use']],
    source: [['income', 'source']],
    claimCo: [['entry', 'claimCo']]
  };

  function rename(p, deps) {
    var refs = RENAME_REFS[p.kind];
    if (!refs) return fail('不認識的設定：' + p.kind);
    var to = String(p.to || '').trim();
    if (!to) return fail('名稱不能空白');
    var own = deps.store.list(p.kind);
    if (!own.some(function (r) { return r.name === p.from; })) return fail('找不到「' + p.from + '」');
    if (p.from !== to && own.some(function (r) { return r.name === to; })) return fail('名稱重複了：' + to);
    deps.store.replaceWhere(p.kind, function () { return true; },
      own.map(function (r) { return r.name === p.from ? Object.assign({}, r, { name: to }) : r; }));
    var changed = 0;
    var kinds = refs.map(function (r) { return r[0]; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
    kinds.forEach(function (kind) {
      var fields = refs.filter(function (r) { return r[0] === kind; }).map(function (r) { return r[1]; });
      var rows = deps.store.list(kind), touched = false;
      rows.forEach(function (row) {
        fields.forEach(function (f) { if (row[f] === p.from) { row[f] = to; touched = true; changed += 1; } });
      });
      if (touched) deps.store.replaceWhere(kind, function () { return true; }, rows);
    });
    return ok({ from: p.from, to: to, changed: changed });
  }

  /* 付款方式剛連上戶口：之前用這個付款方式、沒扣戶口的舊帳一起補上（已經有戶口的不動） */
  function linkPay(p, deps) {
    if (!deps.store.list('pay').some(function (r) { return r.name === p.pay; })) return fail('找不到付款方式「' + p.pay + '」');
    if (!deps.store.list('account').some(function (r) { return r.name === p.account; })) return fail('找不到戶口「' + p.account + '」');
    var rows = deps.store.list('entry'), changed = 0;
    rows.forEach(function (e) { if (e.pay === p.pay && !e.account) { e.account = p.account; changed += 1; } });
    if (changed) deps.store.replaceWhere('entry', function () { return true; }, rows);
    return ok({ pay: p.pay, account: p.account, changed: changed });
  }

  var WRITES = ['save', 'remove', 'saveStocktake', 'saveSettings', 'skipRecur', 'rename', 'linkPay'];

  function handle(req, deps) {
    try {
      var p = (req && req.payload) || {};
      var res;
      switch (req && req.action) {
        case 'bootstrap': res = ok(bootstrap(deps.store)); break;
        case 'save': res = save(p, deps); break;
        case 'remove': res = remove(p, deps); break;
        case 'saveStocktake': res = saveStocktake(p, deps); break;
        case 'saveSettings': res = saveSettings(p, deps); break;
        case 'skipRecur':
          deps.store.upsert('skip', { id: p.recurId + '@' + p.month, recurId: p.recurId, month: p.month });
          res = ok({ recurId: p.recurId, month: p.month }); break;
        case 'rename': res = rename(p, deps); break;
        case 'linkPay': res = linkPay(p, deps); break;
        case 'uploadReceipt': res = ok(deps.files.save(p.base64, p.mime, p.filename)); break;
        case 'readReceipt': res = readReceipt(p, deps); break;
        default: return fail('不認識的動作：' + (req && req.action));
      }
      if (res.ok && WRITES.indexOf(req.action) >= 0 && deps.afterWrite) {
        try { deps.afterWrite(); } catch (e) { /* 帳已經存好；報表明天凌晨 3 點的自動更新會補上 */ }
      }
      return res;
    } catch (e) {
      return fail('出錯了：' + (e && e.message ? e.message : e));
    }
  }

  return { handle: handle, RECORD_KINDS: RECORD_KINDS, SETTING_KINDS: SETTING_KINDS };
})();
if (typeof module !== 'undefined') module.exports = ApiCore;
