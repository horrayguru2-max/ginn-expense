if (typeof Logic === 'undefined' && typeof require !== 'undefined') { var Logic = require('./logic.js'); }
/* 類別表、預設設定、示範資料。資料來源：記帳App/lhdn-categories.md（2026-10-15 整理）。 */
var Seed = (function () {
  function cat(code, name, group, cap, include, exclude, note, parent) {
    return { year: 2026, code: code, name: name, group: group, cap: cap || 0, parent: parent || '',
      include: include || '', exclude: exclude || '', note: note || '' };
  }
  var Y26 = [
    // 🧑 個人扣稅 relief（每筆記帳）
    cat('LIFESTYLE', 'Lifestyle 生活方式', 'tax', 2500, '書本、雜誌、報紙（含電子版）；個人用的電腦、手機、平板；家用上網月費（寫你名字的帳單）；技能進修課程', '電視、冷氣、家具；生意用的電腦（請記到 💼 器材）', '2027 年起再加：AI 軟體和 app 訂閱、向註冊收容所領養寵物'),
    cat('SPORTS', 'Sports 運動', 'tax', 1000, '運動器材、場地租金或入場費、比賽報名費、健身房會員、運動訓練費', '運動服、運動鞋（2026 年算個人衣物，不能扣）', '另外加，不佔 Lifestyle 的 RM2,500。2027 年起：運動鞋可以算，子上限 RM300'),
    cat('MEDICAL', 'Medical 醫療', 'tax', 10000, '嚴重疾病治療、生育治療、牙科（註冊牙醫）；含體檢、疫苗、孩子學習障礙等子項', '一般看診拿藥不一定算，會標「需確認」', '2027 年起再加：產後護理'),
    cat('MEDICAL_CHECKUP', '↳ 體檢 / 篩檢', 'tax', 1000, '全身檢查、心理健康諮詢、疾病檢測、血壓計和血糖機等自我檢測器材', '', '算在 Medical RM10,000 裡面', 'MEDICAL'),
    cat('MEDICAL_VACCINE', '↳ 疫苗', 'tax', 1000, '衛生部認可的疫苗', '', '算在 Medical RM10,000 裡面', 'MEDICAL'),
    cat('MEDICAL_CHILD_LD', '↳ 孩子學習障礙', 'tax', 10000, '18 歲以下孩子的評估、早期干預、復健（自閉症、ADHD 等）', '', '算在 Medical RM10,000 裡面', 'MEDICAL'),
    cat('PARENTS_MEDICAL', '父母醫藥', 'tax', 8000, '父母或祖父母的醫療、看護、特殊需要；體檢最多 RM1,000', '要醫生證明', '2027 年起：所有照護費用都算'),
    cat('EDUCATION', 'Education 自己的學費', 'tax', 7000, '認可院校的文憑以上課程（法律、會計、科技等）、碩士、博士', '孩子的學費和補習（2026 年不能扣）', '2027 年起：所有科目都算，也包括孩子的學費和補習'),
    cat('EDUCATION_UPSKILL', '↳ 進修短課', 'tax', 2000, '認可機構的技能課程', '', '算在 Education RM7,000 裡面', 'EDUCATION'),
    cat('TRAVEL_LOCAL', '本地旅遊 🆕', 'tax', 1000, '本地景點門票（博物館、主題樂園、動物園）、文化或藝術節目', '酒店、交通、演唱會門票', '需確認：是否已寫進最終的 Finance Act'),
    cat('EV_COMPOST', '電動車充電、廚餘機', 'tax', 2500, '電動車充電設備的安裝、租用、訂閱；家用廚餘處理機', '', '需確認：有網站說 CCTV 也包括在內'),
    cat('CHILDCARE', '托兒所、幼稚園', 'tax', 3000, '社會福利局（JKM）或教育部註冊的托兒所、幼稚園', '', '需確認：年齡限制是 6 歲以下還是 12 歲以下'),
    cat('BREASTFEED', '哺乳器材', 'tax', 1000, '吸奶器等；孩子 2 歲以下', '', '每 2 年一次'),
    cat('DISABLED_EQUIP', '殘障輔助器材', 'tax', 6000, '自己、配偶、孩子或父母（OKU）的輔助器材', '', ''),
    // 🧑 年底一次填（不用每筆記帳）
    cat('INDIVIDUAL', 'Individual 個人', 'tax_yearly', 9000, '自動有，不用記', '', ''),
    cat('EPF', 'EPF（含 i-Saraan 自願供款）', 'tax_yearly', 4000, 'Freelance 自己供的 EPF 也算', '', '你沒有 EPF，自己透過 i-Saraan 供，一年最多可以扣 RM4,000'),
    cat('LIFE_INSURANCE', '人壽保險 / takaful', 'tax_yearly', 3000, '', '', ''),
    cat('EDU_MED_INSURANCE', '醫藥卡、教育保險', 'tax_yearly', 4000, '', '', ''),
    cat('SOCSO', 'SOCSO / EIS', 'tax_yearly', 350, '', '', '需確認：Freelance 的 SKSPS 是否適用'),
    cat('PRS', 'PRS 私人退休計劃', 'tax_yearly', 3000, '', '', ''),
    cat('SSPN', 'SSPN', 'tax_yearly', 8000, '用「淨存款」計算', '', ''),
    cat('HOUSING_LOAN', '首間房貸款利息', 'tax_yearly', 7000, '房價 ≤ RM500k 上限 RM7,000；RM500k–750k 上限 RM5,000', '', '買賣合約在 2025–2027 年簽；連續 3 年'),
    cat('CHILD', '孩子 relief', 'tax_yearly', 8000, '每個孩子 RM2,000–8,000，看年齡和讀書情況', '', '年底填'),
    // 💼 Freelance 生意開銷（Form B，沒有上限）
    cat('BIZ_SOFTWARE', '軟體與訂閱', 'biz', 0, 'Canva、ChatGPT、Claude、Adobe、Google Workspace、Elementor', '私人用途的訂閱', ''),
    cat('BIZ_HOSTING', '網站、域名、Hosting', 'biz', 0, '客戶網站的 hosting、域名、外掛', '', ''),
    cat('BIZ_ADS', '廣告費', 'biz', 0, 'TheGuruboss 自己的 Google Ads、Meta Ads', '幫客戶代付、之後再向客戶收回的廣告費', ''),
    cat('BIZ_EQUIPMENT', '器材（電腦、相機）', 'biz', 0, '生意用的電腦、相機、咪高峰、螢幕', '同一件東西不能同時報 Lifestyle', '要分年扣（capital allowance），單件 RM2,000 以下可能可以一次扣，建議問會計師'),
    cat('BIZ_PHONE_NET', '電話、上網（生意部分）', 'biz', 0, '生意用的部分', '', '個人和生意共用的要按比例分'),
    cat('BIZ_TRANSPORT', '交通（見客戶）', 'biz', 0, '見客戶的 Grab、油錢、停車、過路費', '私人出行', ''),
    cat('BIZ_MEALS', '客戶應酬', 'biz', 0, '請客戶吃飯', '', '需確認：一般只能扣 50%'),
    cat('BIZ_TRAINING', '進修（生意）', 'biz', 0, '跟這份生意有關的課程', '不能同時報個人 Education relief', ''),
    cat('BIZ_PROFESSIONAL', '專業費用', 'biz', 0, '會計、SSM 年費、銀行手續費', '', ''),
    cat('BIZ_OTHER', '其他生意開銷', 'biz', 0, '文具、印刷、郵寄', '', ''),
    // ⚪ 一般開銷
    cat('FOOD', '吃喝', 'plain'), cat('GROCERY', '日用品、超市', 'plain'), cat('TRANSPORT', '交通（個人）', 'plain'),
    cat('SHOPPING', '購物', 'plain'), cat('HOME', '家用、水電', 'plain'), cat('ENTERTAIN', '娛樂', 'plain'),
    cat('FAMILY', '家人、孩子', 'plain'), cat('OTHER', '其他', 'plain')
  ];
  var BILL = 'Budget 2027 提案，Finance Bill 通過後才算數。';
  var Y27_OVERRIDES = {
    INDIVIDUAL: { cap: 12000, note: BILL },
    SPORTS: { include: '運動器材、場地租金或入場費、比賽報名費、健身房會員、運動訓練費；運動鞋（子上限 RM300）', exclude: '運動服', note: '另外加，不佔 Lifestyle 的 RM2,500。' + BILL },
    LIFESTYLE: { include: '書本、雜誌、報紙（含電子版）；個人用的電腦、手機、平板；家用上網月費；技能進修課程；AI 軟體和 app 訂閱；向註冊收容所領養寵物', note: 'AI 訂閱如果是 Freelance 用的，記成 💼 軟體與訂閱通常比較划算（沒有上限）。' + BILL },
    EDUCATION: { name: 'Education 學費（自己 / 孩子）', include: '所有科目的學費，也包括孩子的學費和補習費', exclude: '', note: BILL },
    EDUCATION_UPSKILL: { name: '↳ 興趣課程 / 孩子 STEM、語言、藝術補習', include: '自己或配偶的興趣課程；孩子的 STEM、藝術、語言、宗教課程或補習', note: '需確認：是否算在 RM7,000 裡面。' + BILL },
    MEDICAL: { include: '嚴重疾病治療、生育治療、牙科（註冊牙醫）、產後護理；含體檢、疫苗、孩子學習障礙等子項', note: BILL },
    PARENTS_MEDICAL: { name: '父母照護', include: '父母或祖父母的所有照護費用（醫療、看護等）', note: BILL }
  };
  function categories() {
    var y27 = Y26.map(function (c) {
      var o = Y27_OVERRIDES[c.code] || {};
      return Object.assign({}, c, { year: 2027 }, o);
    });
    return Y26.map(function (c) { return Object.assign({}, c); }).concat(y27);
  }

  var MAIN = '銀行戶口（日常）';
  function settings() {
    return {
      pay: [{ name: 'TNG', account: '' }, { name: 'Credit Card', account: '' }, { name: 'Bank Transfer', account: MAIN }, { name: 'Cash', account: '' }],
      use: ['自己', '家用', '孩子', '父母', 'TheGuruboss'].map(function (n) { return { name: n }; }),
      accounts: [
        { name: MAIN, group: 'daily', note: '正職戶口', where: '銀行 app', biz: false, order: 1 },
        { name: '屋子戶口', group: 'daily', note: '', where: '銀行 app', biz: false, order: 2 },
        { name: 'MyASNB', group: 'save', note: 'Chinkido 基金', where: 'MyASNB app', biz: false, order: 3 },
        { name: 'Versa', group: 'save', note: 'Personal saving 基金', where: 'Versa app', biz: false, order: 4 },
        { name: 'Kenanga App', group: 'save', note: 'Travel & Emergency', where: 'Kenanga app', biz: false, order: 5 },
        { name: 'Maybank Fixed Deposit', group: 'save', note: '定期存款', where: 'Maybank2u', biz: false, order: 6 },
        { name: '投資戶口', group: 'invest', note: '', where: '', biz: false, order: 7 },
        { name: 'TheGuruboss 戶口', group: 'biz', note: '', where: '銀行 app', biz: true, order: 8 }
      ],
      sources: [{ name: '正職收入', biz: false, account: MAIN }, { name: 'TheGuruboss 收入', biz: true, account: 'TheGuruboss 戶口' }],
      claimCos: [{ name: 'Kalt' }],
      recurring: []
    };
  }

  /* 示範資料：跟 mockup v4.2 一樣，日期換成 today 所在的月份（d(9) = 這個月 9 號，p(20) = 上個月 20 號） */
  function demo(today) {
    var m = today.slice(0, 7), pm = Logic.prevMonth(m), y = m.slice(0, 4);
    function d(n) { return m + '-' + Logic.pad2(n); }
    function p(n) { return pm + '-' + Logic.pad2(n); }
    var n = 0;
    function id() { n += 1; return 'demo-' + n; }
    var s = settings();
    var e = function (date, merchant, amount, category, pay, use, extra) {
      return Object.assign({ id: id(), date: date, merchant: merchant, amount: amount, category: category, use: use, pay: pay,
        account: pay === 'Bank Transfer' ? MAIN : '', claimCo: '', claimDone: false, needsCheck: false,
        receiptUrl: '', receiptFileId: '', note: '', createdAt: '' }, extra || {});
    };
    var rc = { receiptUrl: 'https://drive.google.com/' };
    return Object.assign(s, {
      categories: categories(),
      entries: [
        e(d(15), 'Shopee · Lenovo IdeaPad Slim 5', 2899, 'LIFESTYLE', 'Credit Card', '自己', { needsCheck: true }),
        e(d(14), 'Grab · 去 Ban Leng 拍片', 28, 'TRANSPORT', 'TNG', '自己', { claimCo: 'Kalt' }),
        e(d(14), '午餐 · Nasi Kandar', 15, 'FOOD', 'TNG', '自己'),
        e(d(13), 'Canva Pro 月費', 54.99, 'BIZ_SOFTWARE', 'Credit Card', 'TheGuruboss'),
        e(d(12), '羽毛球場 · 2 小時', 40, 'SPORTS', 'TNG', '自己', rc),
        e(d(11), 'Shopee · 拍攝補光燈', 129, 'SHOPPING', 'Credit Card', '自己', Object.assign({ claimCo: 'Kalt' }, rc)),
        e(d(10), '淘寶 · 書桌燈', 68, 'HOME', 'TNG', '家用'),
        e(d(9), 'TNB 電費', 132.4, 'HOME', 'Bank Transfer', '家用'),
        e(d(8), 'Pantai 全身檢查', 150, 'MEDICAL_CHECKUP', 'Bank Transfer', '自己', rc),
        e(p(2), 'Decathlon · 羽毛球拍', 280, 'SPORTS', 'Credit Card', '自己', rc),
        e(y + '-01-20', 'Hostinger 年費', 450, 'BIZ_HOSTING', 'Credit Card', 'TheGuruboss', rc),
        e(y + '-01-05', 'ChatGPT Plus', 1185.01, 'BIZ_SOFTWARE', 'Credit Card', 'TheGuruboss', rc)
      ],
      incomes: [
        { id: id(), date: d(1), source: '正職收入', amount: 5000, account: MAIN, note: '上個月薪水', createdAt: '' },
        { id: id(), date: d(6), source: 'TheGuruboss 收入', amount: 1500, account: 'TheGuruboss 戶口', note: '網站訂金', createdAt: '' }
      ],
      transfers: [
        { id: id(), date: d(2), from: MAIN, to: '屋子戶口', amount: 1000, note: '屋子供款', recurId: 'demo-r1', createdAt: '' },
        { id: id(), date: d(2), from: MAIN, to: 'MyASNB', amount: 500, note: 'Chinkido 基金', recurId: 'demo-r2', createdAt: '' }
      ],
      adjusts: [],
      stocktakes: [
        [MAIN, 7200, 8000], ['屋子戶口', 14000, 15000], ['MyASNB', 5000, 5000], ['Versa', 4000, 4100],
        ['Kenanga App', 6000, 6000], ['Maybank Fixed Deposit', 5000, 5000], ['投資戶口', 12000, 12500], ['TheGuruboss 戶口', 4500, 6000]
      ].reduce(function (out, r) {
        out.push({ id: id(), month: pm, account: r[0], balance: r[1], createdAt: '' });
        out.push({ id: id(), month: m, account: r[0], balance: r[2], createdAt: '' });
        return out;
      }, []),
      skips: [],
      recurring: [
        { id: 'demo-r1', day: 2, from: MAIN, to: '屋子戶口', amount: 1000, note: '屋子供款', active: true },
        { id: 'demo-r2', day: 2, from: MAIN, to: 'MyASNB', amount: 500, note: 'Chinkido 基金', active: true },
        { id: 'demo-r3', day: 20, from: MAIN, to: 'Kenanga App', amount: 300, note: 'Travel & Emergency', active: true }
      ]
    });
  }

  return { categories: categories, settings: settings, demo: demo, MAIN: MAIN };
})();
if (typeof module !== 'undefined') module.exports = Seed;
