/* 每種資料對應 Google Sheet 的哪個分頁、哪些欄位。讀寫一律按「表頭名稱」，Ginn 搬欄位也不會錯。 */
var Schema = (function () {
  var KINDS = {
    entry: { key: 'entries', tab: '每日記帳', cols: [['id', 'id'], ['date', '日期'], ['merchant', '商家 / 內容'], ['amount', '金額'], ['category', '類別代碼'], ['use', '用途'], ['pay', '付款方式'], ['account', '從戶口扣'], ['claimCo', 'Claim 公司'], ['claimDone', '已 claim'], ['needsCheck', '需確認'], ['receiptUrl', 'Receipt 連結'], ['receiptFileId', 'Receipt 檔案 id'], ['note', '備註'], ['createdAt', '建立時間']] },
    income: { key: 'incomes', tab: '收入', cols: [['id', 'id'], ['date', '日期'], ['source', '來源'], ['amount', '金額'], ['account', '存入戶口'], ['note', '備註'], ['createdAt', '建立時間']] },
    transfer: { key: 'transfers', tab: '轉帳', cols: [['id', 'id'], ['date', '日期'], ['from', '從哪個戶口'], ['to', '轉去哪個戶口'], ['amount', '金額'], ['note', '備註'], ['recurId', '固定轉帳 id'], ['createdAt', '建立時間']] },
    adjust: { key: 'adjusts', tab: '戶口調整', cols: [['id', 'id'], ['date', '日期'], ['account', '戶口'], ['calc', 'App 算的'], ['real', '實際餘額'], ['diff', '差額'], ['note', '備註'], ['createdAt', '建立時間']] },
    stocktake: { key: 'stocktakes', tab: '月頭盤點', cols: [['id', 'id'], ['month', '月份'], ['account', '戶口'], ['balance', '餘額'], ['createdAt', '建立時間']] },
    skip: { key: 'skips', tab: '⚙固定轉帳略過', hidden: true, cols: [['id', 'id'], ['recurId', '固定轉帳 id'], ['month', '月份']] },
    pay: { key: 'pay', tab: '⚙付款方式', hidden: true, cols: [['name', '名稱'], ['account', '預設扣款戶口']] },
    use: { key: 'use', tab: '⚙用途', hidden: true, cols: [['name', '名稱']] },
    account: { key: 'accounts', tab: '⚙戶口', hidden: true, cols: [['name', '名稱'], ['group', '分組'], ['note', '說明'], ['where', '去哪裡看'], ['biz', '生意'], ['order', '順序']] },
    source: { key: 'sources', tab: '⚙收入來源', hidden: true, cols: [['name', '名稱'], ['biz', '生意'], ['account', '預設存入戶口']] },
    claimCo: { key: 'claimCos', tab: '⚙Claim公司', hidden: true, cols: [['name', '名稱']] },
    recurring: { key: 'recurring', tab: '⚙固定轉帳', hidden: true, cols: [['id', 'id'], ['day', '每月幾號'], ['from', '從哪個戶口'], ['to', '轉去哪個戶口'], ['amount', '金額'], ['note', '備註'], ['active', '使用中']] },
    category: { key: 'categories', tab: '⚙類別', hidden: true, cols: [['year', '年份'], ['code', '代碼'], ['name', '名稱'], ['group', '分組'], ['cap', '上限'], ['parent', '屬於'], ['include', '包括'], ['exclude', '不包括'], ['note', '備註']] }
  };
  var NUM = ['amount', 'balance', 'calc', 'real', 'diff', 'cap', 'day', 'order', 'year'];
  var BOOL = ['claimDone', 'needsCheck', 'biz', 'active'];
  var BOOL_DEFAULT_TRUE = ['active'];

  function pad2(n) { return String(n).padStart(2, '0'); }
  function headers(kind) { return KINDS[kind].cols.map(function (c) { return c[1]; }); }
  function dataKey(kind) { return KINDS[kind].key; }

  function isDate(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
  function isoFromText(field, s) {
    var m;
    if (field === 'date') {
      if ((m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/))) return m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]);
      if ((m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/))) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    }
    if (field === 'month') {
      if ((m = s.match(/^(\d{1,2})[\/-](\d{4})$/))) return m[2] + '-' + pad2(m[1]);
      if ((m = s.match(/^(\d{4})[\/-](\d{1,2})$/))) return m[1] + '-' + pad2(m[2]);
    }
    return s;
  }

  function coerce(field, v, opts) {
    if (NUM.indexOf(field) >= 0) return v === '' || v === null || v === undefined ? 0 : Number(v) || 0;
    if (BOOL.indexOf(field) >= 0) {
      if (v === '' || v === null || v === undefined) return BOOL_DEFAULT_TRUE.indexOf(field) >= 0;
      return v === true || v === 'TRUE' || v === 'true' || v === '是';
    }
    if (isDate(v)) {
      if (field === 'createdAt') return v.toISOString();
      // 用 Sheet 的時區（opts.formatDate）；沒有就用執行環境的時區
      if (opts && opts.formatDate) return opts.formatDate(v, field === 'month' ? 'month' : 'date');
      var ymd = v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate());
      return field === 'month' ? ymd.slice(0, 7) : ymd;
    }
    if (v === null || v === undefined) return '';
    return field === 'date' || field === 'month' ? isoFromText(field, String(v).trim()) : String(v);
  }

  function fromRow(kind, cells, headerRow, opts) {
    var obj = {};
    KINDS[kind].cols.forEach(function (c) {
      var i = headerRow.indexOf(c[1]);
      obj[c[0]] = coerce(c[0], i >= 0 ? cells[i] : '', opts);
    });
    return obj;
  }

  /* baseRow：原本那一列。不認識的欄位（Ginn 自己加的）保留原值，不會被清掉 */
  function toRow(kind, obj, headerRow, baseRow) {
    return headerRow.map(function (h, i) {
      var col = KINDS[kind].cols.find(function (c) { return c[1] === h; });
      if (!col) return baseRow && baseRow[i] !== undefined ? baseRow[i] : '';
      var v = obj[col[0]];
      return v === null || v === undefined ? '' : v;
    });
  }

  return { KINDS: KINDS, headers: headers, dataKey: dataKey, fromRow: fromRow, toRow: toRow };
})();
if (typeof module !== 'undefined') module.exports = Schema;
