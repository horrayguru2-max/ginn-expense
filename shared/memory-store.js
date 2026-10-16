/* 記憶體版資料庫：Node 測試和前端「示範模式」用。介面和 SheetStore 一樣。 */
if (typeof Schema === 'undefined' && typeof require !== 'undefined') { var Schema = require('./schema.js'); }
var MemoryStore = function (initialData) {
  var db = {};
  Object.keys(Schema.KINDS).forEach(function (kind) {
    var key = Schema.dataKey(kind);
    db[kind] = JSON.parse(JSON.stringify((initialData && initialData[key]) || []));
  });
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  return {
    list: function (kind) { return copy(db[kind]); },
    upsert: function (kind, obj) {
      var i = db[kind].findIndex(function (r) { return r.id === obj.id; });
      if (i >= 0) db[kind][i] = copy(obj); else db[kind].push(copy(obj));
      return copy(obj);
    },
    remove: function (kind, id) {
      var i = db[kind].findIndex(function (r) { return r.id === id; });
      if (i < 0) return false;
      db[kind].splice(i, 1);
      return true;
    },
    replaceWhere: function (kind, pred, rows) {
      db[kind] = db[kind].filter(function (r) { return !pred(r); }).concat(copy(rows));
    },
    snapshot: function () {
      var out = {};
      Object.keys(db).forEach(function (kind) { out[Schema.dataKey(kind)] = copy(db[kind]); });
      return out;
    }
  };
};
if (typeof module !== 'undefined') module.exports = MemoryStore;
