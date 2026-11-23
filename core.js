/* 提出物管理システム 共通ルール（フロントのデモ・GASの両方で同じコードを使う） */
const Core = (function () {
  // ② 誤打伝票：どの区分でも必須の写真は3枚。一括訂正伝票は任意の添付欄。
  const REQUIRED = ['誤打伝票', 'VOID伝票', '訂正後伝票'];
  const OPTIONAL = ['一括訂正伝票'];
  const CATEGORIES = [
    { code: 'training',    name: 'トレーニング',       slots: REQUIRED, optional: OPTIONAL },
    { code: 'bulk',        name: '一括訂正',           slots: REQUIRED, optional: OPTIONAL },
    { code: 'void_bulk',   name: 'VOID後一括訂正',     slots: REQUIRED, optional: OPTIONAL },
    { code: 'void_change', name: 'VOID後登録内容変更', slots: REQUIRED, optional: OPTIONAL }
  ];
  const FORMS = { void: { no: '②', name: '誤打伝票', prefix: 'V' }, late: { no: '⑤', name: '遅滞報告', prefix: 'L' }, pos: { no: '⑥', name: 'POS修正依頼', prefix: 'P' },
    cash: { no: '⑦', name: '現金管理票', prefix: 'C' }, petty: { no: '⑧', name: '小口現金管理票', prefix: 'K' }, book: { no: '⑨', name: '金銭出納帳', prefix: 'B' },
    bill: { no: '④', name: '請求依頼票', prefix: 'Q' }, usage: { no: '①', name: '日次利用集計', prefix: 'U' } };
  const MONTH_FORMS = ['usage', 'cash', 'petty', 'book']; // 月末（翌月3日 9:00まで）に作成する様式
  // ④ 請求依頼票：レシートの写真は1枚が必須
  const BILL_SLOT = 'レシート';
  // ① 日次利用集計：現行様式の列。名称・予備欄はここを書き換えて運用に合わせる
  const USAGE_GROUPS = [
    { id: 'pt', name: 'グルメサイト ポイントキー', short: 'ポイント', items: ['JapanTicket', '一休', 'ぐるなび', 'Hotpepper', 'paypayグルメ', '食べログ', 'ヒトサラ'] },
    { id: 'cp', name: 'クーポンキー', short: 'クーポン', items: ['大阪市プレミアム付商品券2023', '予備2', '予備3', '予備4', '予備5', '予備6', '予備7'] },
    { id: 'ar', name: '売掛キー', short: '売掛', items: ['後日請求', '一休 事前決済', 'リンベル食事券', '事前振込', '予備5'] }
  ];
  const REPORT_TYPES = [{ code: 'd10', name: '10日の中間報告' }, { code: 'd20', name: '20日の中間報告' }, { code: 'eom', name: '月末' }];
  const LATE_MAX = 4, POS_MAX = 30;
  const STATUS = { draft: '下書き', pending: '承認待ち', returned: '差戻し', received: '受付', confirmed: '確認済み' };
  const SUBMITTED = ['pending', 'received', 'confirmed']; // 提出済みとして数える状態

  const pad = (n) => (n < 10 ? '0' : '') + n;
  // ---------- 月末の現金管理（⑦⑧⑨） ----------
  const DENOMS = [[10000, '万円'], [5000, '5千円'], [2000, '2千円'], [1000, '千円'], [500, '5百円'], [100, '百円'], [50, '5拾円'], [10, '拾円'], [5, '5円'], [1, '壱円']];
  const BOOK_MAX = 60, RESERVE_MAX = 11, DEPOSIT_MAX = 6;
  // 現金の保管場所は店舗タイプで決まる（店舗マスターの「店舗タイプ」と連動）
  const PLACES_BY_TYPE = {
    '路面店': [{ id: 'reg', name: 'レジ' }], '百貨店ほか': [{ id: 'reg', name: 'レジ' }],
    'ビル型': [{ id: 'alsok', name: 'ALSOK' }, { id: 'f1', name: '1Fレジ' }, { id: 'f2', name: '2Fレジ' }],
    '本店型': [{ id: 'safe', name: '金庫' }, { id: 'f1', name: '1Fレジ' }, { id: 'f2', name: '2Fレジ' }]
  };
  const DEFAULT_FIXED = { '301': { alsok: 250000, f1: 120000, f2: 150000 } }; // 現行様式にある道頓堀ビル店の定額。他店は未設定
  function cashPlacesFor(store, fixedMap) {
    const base = PLACES_BY_TYPE[store.type]; if (!base) return [];
    const fx = Object.assign({}, DEFAULT_FIXED[store.code] || {}, fixedMap || {});
    return base.map((p) => ({ id: p.id, name: p.name, fixed: Number(fx[p.id]) || 0 }));
  }
  const DEFAULT_ACCOUNTS = ['交通費', '消耗品費', '水道光熱費', '通信費', '運搬費', '会議費', '福利厚生費', '雑費', 'その他']; // 仮置き（マスターで差し替え）
  const DEFAULT_PHRASES = ['交通費', '消耗品の購入', '水道代', '郵送料', '管理本部より入金', '催事用', '振替']; // 仮置き（マスターで差し替え）
  const num = (v) => Number(v) || 0;
  const countsTotal = (c) => DENOMS.reduce((a, d) => a + d[0] * num((c || {})[d[0]]), 0);
  const sumAmt = (rows) => (rows || []).reduce((a, x) => a + num(x.amount), 0);
  const monthEnd = (m) => { const y = +m.slice(0, 4), mo = +m.slice(5, 7); return m + '-' + pad(new Date(y, mo, 0).getDate()); };
  const prevMonth = (m) => { let y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (mo < 1) { mo = 12; y -= 1; } return y + '-' + pad(mo); };
  const yen = (n) => num(n).toLocaleString('ja-JP') + '円';
  function cashCalc(d) {
    d = d || {};
    const places = (d.places || []).map((p) => Object.assign({}, p, { total: countsTotal(p.counts) }));
    const cashTotal = places.reduce((a, p) => a + p.total, 0), fixedSum = places.reduce((a, p) => a + num(p.fixed), 0);
    const A = fixedSum > 0 ? fixedSum : num(d.baseA), B = sumAmt(d.reserve);
    return { places: places, cashTotal: cashTotal, fixedSum: fixedSum, A: A, B: B, expected: A + B, diff: cashTotal - (A + B), depTotal: sumAmt(d.deposits) };
  }
  function bookCalc(d) {
    d = d || {}; let bal = num(d.carryOver), inc = 0, exp = 0;
    const rows = (d.rows || []).map((r) => { inc += num(r.income); exp += num(r.expense); bal += num(r.income) - num(r.expense); return Object.assign({}, r, { balance: bal }); });
    return { rows: rows, income: inc, expense: exp, carryOver: num(d.carryOver), closing: bal };
  }
  const submittedOf = (siblings, slip, form, month) => (siblings || []).filter((s) => s.id !== slip.id && s.storeCode === slip.storeCode && formOf(s) === form && s.targetMonth === month && SUBMITTED.indexOf(s.status) >= 0)[0] || null;
  const bookClosingOf = (b) => bookCalc(b.data).closing;
  function pettyCalc(d, bookSlip) {
    d = d || {}; const subtotal = countsTotal(d.counts), bank = num(d.bank), total = subtotal + bank;
    const book = bookSlip ? bookClosingOf(bookSlip) : null;
    return { subtotal: subtotal, bank: bank, total: total, bookBalance: book, diff: book == null ? null : total - book };
  }

  // ① 項目の構成は店舗ごとに変えられる（名称・使う/使わない）。提出後は提出時の構成を伝票に残す
  const layoutDefault = () => USAGE_GROUPS.map((g) => ({ id: g.id, name: g.name, short: g.short, items: g.items.map((n, i) => ({ i: i, name: n })) }));
  function usageLayoutFor(storeCode, rows) {
    const mine = (rows || []).filter((r) => String(r.store) === String(storeCode)), all = (rows || []).filter((r) => String(r.store) === 'ALL');
    return USAGE_GROUPS.map((g) => {
      const items = [];
      g.items.forEach((n, i) => {
        const pick = (a) => a.filter((r) => r.group === g.id && +r.idx === i)[0], r = pick(mine) || pick(all);
        if (!r || r.enabled !== false) items.push({ i: i, name: r && r.name ? r.name : n });
      });
      return { id: g.id, name: g.name, short: g.short, items: items };
    });
  }
  // ① 日々のキー合計と、内訳の合計が一致するかを日ごとに確認する
  function usageCalc(d, month) {
    d = d || {}; const L = d.layout || layoutDefault(), last = month ? +monthEnd(month).slice(8, 10) : 31;
    const days = [], tot = { pt: 0, cp: 0, ar: 0 }, itemTot = {}, bad = [];
    L.forEach((g) => (itemTot[g.id] = g.items.map(() => 0)));
    for (let n = 1; n <= last; n++) {
      const r = (d.days || {})[n] || {}, x = { day: n, has: false, ok: true, diffs: {} };
      L.forEach((g) => {
        const t = num(r[g.id]), it = r[g.id + 'i'] || {}; let sm = 0;
        g.items.forEach((m, k) => { const v = num(it[m.i]); sm += v; itemTot[g.id][k] += v; if (it[m.i] !== undefined && it[m.i] !== '') x.has = true; });
        if (r[g.id] !== undefined && r[g.id] !== '') x.has = true;
        x[g.id] = t; x[g.id + 'Sum'] = sm; x.diffs[g.id] = sm - t; tot[g.id] += t;
        if (sm !== t) x.ok = false;
      });
      if (!x.ok) bad.push(n);
      days.push(x);
    }
    return { days: days, tot: tot, itemTot: itemTot, bad: bad, last: last, sum: tot.pt + tot.cp + tot.ar, layout: L, entered: days.filter((x) => x.has).length };
  }

  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  const allSlots = (c) => c.slots.concat(c.optional || []);
  const category = (code) => CATEGORIES.filter((c) => c.code === code)[0] || null;
  const formOf = (s) => s.form || 'void';
  const reportType = (code) => REPORT_TYPES.filter((r) => r.code === code)[0] || null;

  // 提出期限：発生月の翌月3日 9:00（休日・定休日でも変えない）
  function deadlineOf(base) {
    let y = parseInt(base.slice(0, 4), 10);
    let m = parseInt(base.slice(5, 7), 10) + 1;
    if (m > 12) { m = 1; y += 1; }
    return y + '-' + pad(m) + '-03 09:00';
  }
  // ②と④は発生月（④はご利用日）、⑥は月末報告のみ対象月、⑤（入金した日に作成）と10日・20日の中間報告は時刻の定めなし
  function deadlineFor(s) {
    const f = formOf(s);
    if (f === 'void' || f === 'bill') return s.occurredAt ? deadlineOf(s.occurredAt) : '';
    if (f === 'pos') return s.reportType === 'eom' && s.targetMonth ? deadlineOf(s.targetMonth + '-15 00:00') : '';
    if (MONTH_FORMS.indexOf(f) >= 0) return s.targetMonth ? deadlineOf(s.targetMonth + '-15 00:00') : '';
    return '';
  }
  function isOverdue(slip, now) {
    const dl = slip.deadline || deadlineFor(slip);
    return !!dl && (slip.firstSubmittedAt || now) > dl;
  }
  const sum = (items) => (items || []).reduce((a, x) => a + (Number(x.amount) || 0), 0);

  function applyInput(slip, input, names) {
    ['occurredAt', 'inputterId', 'registerId', 'category', 'reason', 'depositDate', 'reportType', 'targetMonth'].forEach((k) => {
      if (input[k] !== undefined) slip[k] = input[k];
    });
    if (input.photos) slip.photos = input.photos;
    if (input.data !== undefined) slip.data = input.data;
    const f = formOf(slip);
    if (input.items) {
      slip.items = input.items.map((x) => (f === 'late'
        ? { salesDate: x.salesDate || '', amount: x.amount === '' || x.amount == null ? '' : Number(x.amount) }
        : { receiptAt: x.receiptAt || '', receiptNo: String(x.receiptNo == null ? '' : x.receiptNo), content: x.content || '', requesterId: x.requesterId || '', requesterName: (names && names[x.requesterId]) || '' }));
    }
    slip.inputterName = (names && names[slip.inputterId]) || '';
    if (f === 'void') {
      slip.registerName = (names && names[slip.registerId]) || '';
      const c = category(slip.category); slip.categoryName = c ? c.name : '';
    } else if (f === 'late') {
      if (slip.depositDate) slip.occurredAt = slip.depositDate + ' 00:00';
      slip.total = sum(slip.items);
    } else if (f === 'pos') {
      if (!slip.occurredAt) slip.occurredAt = (slip.createdAt || '').slice(0, 10) + ' 00:00';
      const r = reportType(slip.reportType); slip.reportName = r ? r.name : '';
    } else if (f === 'bill') {
      const b = slip.data || {};
      if (b.usageDate) slip.occurredAt = b.usageDate + ' 00:00';
      slip.total = num(b.amount);
    } else if (MONTH_FORMS.indexOf(f) >= 0) {
      if (slip.targetMonth) slip.occurredAt = monthEnd(slip.targetMonth) + ' 00:00';
      if (f === 'cash') { const c = cashCalc(slip.data); slip.total = c.cashTotal; slip.diff = c.diff; }
      else if (f === 'petty') { slip.total = pettyCalc(slip.data).total; }
      else if (f === 'usage') { const u = usageCalc(slip.data, slip.targetMonth); slip.total = u.sum; slip.diff = u.bad.length; }
      else { slip.total = bookCalc(slip.data).closing; }
    }
    slip.deadline = deadlineFor(slip);
    return slip;
  }
  const mine = (siblings, slip) => (siblings || []).filter((s) => s.id !== slip.id && s.storeCode === slip.storeCode && formOf(s) === 'pos' && s.targetMonth === slip.targetMonth && SUBMITTED.indexOf(s.status) >= 0);
  // ⑥：同じ月に、他の伝票で報告済みの行数（上限30行に含める）
  const usedRows = (siblings, slip) => mine(siblings, slip).reduce((a, s) => a + (s.items || []).length, 0);
  // ⑥ 月末分の画面に引き継いで表示する、10日・20日で報告済みの行
  function carriedRows(siblings, slip) {
    if (slip.reportType !== 'eom') return [];
    const out = [];
    mine(siblings, slip).filter((s) => s.reportType === 'd10' || s.reportType === 'd20').sort((a, b) => (a.reportType > b.reportType ? 1 : -1))
      .forEach((s) => (s.items || []).forEach((x) => out.push(Object.assign({ from: s.reportName }, x))));
    return out;
  }

  function checkSubmit(slip, siblings) {
    const e = [], f = formOf(slip);
    if (!slip.inputterId) e.push('入力者を選んでください');
    if (f === 'void') {
      if (!slip.occurredAt) e.push('発生日時を入力してください');
      if (!slip.registerId) e.push('レジ担当者を選んでください');
      const c = category(slip.category);
      if (!c) e.push('誤打区分を選んでください');
      if (!slip.reason || !String(slip.reason).trim()) e.push('事由を入力してください');
      if (c) c.slots.forEach((label) => {
        const p = (slip.photos || []).filter((x) => x.slot === label)[0];
        if (!p || !p.ref) e.push('写真「' + label + '」が必要です');
      });
    } else if (f === 'late') {
      const it = slip.items || [];
      if (!slip.depositDate) e.push('預け入れ日を入力してください');
      if (it.length < 1) e.push('遅滞明細を1件以上入力してください');
      if (it.length > LATE_MAX) e.push('遅滞明細は最大' + LATE_MAX + '件までです');
      it.forEach((x, i) => {
        if (!x.salesDate) e.push('明細' + (i + 1) + '：売上日を入力してください');
        if (!(Number(x.amount) > 0)) e.push('明細' + (i + 1) + '：金額を入力してください');
      });
      if (!slip.reason || !String(slip.reason).trim()) e.push('遅滞理由を入力してください');
    } else if (f === 'pos') {
      const it = slip.items || [];
      if (!reportType(slip.reportType)) e.push('報告区分を選んでください');
      if (!slip.targetMonth) e.push('対象月を選んでください');
      if (it.length < 1) e.push('明細を1行以上入力してください');
      it.forEach((x, i) => {
        const n = '明細' + (i + 1) + '：';
        if (!x.receiptAt) e.push(n + '対象レシートの日時を入力してください');
        if (!/^\d+$/.test(x.receiptNo || '')) e.push(n + 'レシートNoを数字で入力してください');
        if (!x.content || !String(x.content).trim()) e.push(n + '修正内容を入力してください');
        if (!x.requesterId) e.push(n + '依頼者を選んでください');
      });
      const used = usedRows(siblings, slip);
      if (used + it.length > POS_MAX) e.push('1か月の上限は' + POS_MAX + '行です（この月はすでに' + used + '行を報告済み）。行を減らしてください');
      const dup = mine(siblings, slip).filter((s) => s.reportType === slip.reportType)[0];
      if (dup) e.push('この月の「' + slip.reportName + '」はすでに提出されています');
    } else if (f === 'bill') {
      const b = slip.data || {};
      if (!b.usageDate) e.push('ご利用日を入力してください');
      if (!String(b.company || '').trim() && !String(b.addressee || '').trim()) e.push('会社名か宛名のどちらかを入力してください');
      if (!/^\d{3}-?\d{4}$/.test(String(b.zip || '').trim())) e.push('郵便番号を7けたで入力してください（例：556-0017）');
      if (!String(b.address || '').trim()) e.push('宛先（住所）を入力してください');
      ['tel', 'fax'].forEach((k) => { const v = String(b[k] || '').trim(); if (v && !/^\d[\d-]{8,12}$/.test(v)) e.push((k === 'tel' ? '電話番号' : 'FAX') + 'は数字とハイフンで入力してください'); });
      if (!(num(b.amount) > 0)) e.push('お食事代金を入力してください');
      if (b.headcount !== '' && b.headcount != null && !(num(b.headcount) >= 1)) e.push('人数は1以上で入力してください');
      if (!String(b.receiptNo || '').trim()) e.push('レシートNoを入力してください');
      const p = (slip.photos || []).filter((x) => x.slot === BILL_SLOT)[0];
      if (!p || !p.ref) e.push('レシートの写真が必要です');
    } else if (MONTH_FORMS.indexOf(f) >= 0) {
      const d = slip.data || {}, F = FORMS[f];
      if (!slip.targetMonth) e.push('対象月を選んでください');
      if (submittedOf(siblings, slip, f, slip.targetMonth)) e.push('この月の「' + F.name + '」はすでに提出されています');
      if (f === 'cash') {
        const c = cashCalc(d), needReason = c.diff !== 0;
        if (c.cashTotal <= 0) e.push('金種の枚数を入力してください');
        if (c.fixedSum <= 0 && !(num(d.baseA) > 0)) e.push('レジ基本元金Aを入力してください');
        [['reserve', 'つり銭準備金B', '売上金から抜いた日'], ['deposits', '預入予定の売上金', '売上日']].forEach((k) => {
          (d[k[0]] || []).forEach((x, i) => { if (!x.date || !(num(x.amount) > 0)) e.push(k[1] + ' ' + (i + 1) + '行目：' + k[2] + 'と金額を入力してください'); });
        });
        if (needReason && !(slip.reason || '').trim()) e.push('金種の合計とA+Bが' + yen(Math.abs(c.diff)) + (c.diff > 0 ? '多い' : '少ない') + 'ため、理由を入力してください');
      } else if (f === 'petty') {
        const p = pettyCalc(d, submittedOf(siblings, slip, 'book', slip.targetMonth));
        if (p.total <= 0) e.push('金種の枚数または預金残高を入力してください');
        if ((p.bookBalance == null || p.diff !== 0) && !(slip.reason || '').trim()) e.push(p.bookBalance == null ? '金銭出納帳（⑨）が未提出のため照合できません。先に⑨を提出するか、理由を入力してください' : '合計が出納帳の残高と' + yen(Math.abs(p.diff)) + '違います。理由を入力してください');
      } else if (f === 'usage') {
        const u = usageCalc(d, slip.targetMonth);
        if (u.bad.length && !(slip.reason || '').trim()) e.push('キーの合計と内訳が一致しない日があります（' + u.bad.map((n) => n + '日').join('、') + '）。内訳を直すか、理由を入力してください');
      } else {
        const rows = d.rows || [], last = slip.targetMonth ? +monthEnd(slip.targetMonth).slice(8, 10) : 31;
        if (rows.length > BOOK_MAX) e.push('1か月の上限は' + BOOK_MAX + '行です');
        const prev = slip.targetMonth ? submittedOf(siblings, slip, 'book', prevMonth(slip.targetMonth)) : null;
        if (prev && num(d.carryOver) !== bookClosingOf(prev)) e.push('前月繰越が、前月の残高（' + yen(bookClosingOf(prev)) + '）と一致しません');
        rows.forEach((r, i) => {
          const n = (i + 1) + '行目：';
          if (!(+r.day >= 1 && +r.day <= last)) e.push(n + '日（1〜' + last + '）を入力してください');
          if (!(r.phrase || '').trim() && !(r.note || '').trim()) e.push(n + '摘要を入力してください');
          if ((num(r.income) > 0) === (num(r.expense) > 0)) e.push(n + '収入か支出のどちらか一方に金額を入力してください');
          if (!r.burden) e.push(n + '負担店舗を選んでください');
          if (!r.account) e.push(n + '科目を選んでください');
        });
      }
    }
    return e;
  }
  // ---------- 経理部のExcel出力：伝票1件を、表の形（行の配列）にする ----------
  function exportSheets(s, storeName) {
    const f = formOf(s), d = s.data || {}, ph = (s.photos || []).length;
    const head = [['伝票番号', s.id], ['様式', title(s)], ['店舗', s.storeCode + ' ' + (s.storeName || storeName || '')], ['状態', STATUS[s.status] || s.status], ['入力者', s.inputterName || ''],
      ['提出', s.submittedAt ? s.submittedAt + '（第' + s.rev + '版）' : ''], ['承認', s.approvedAt ? (s.approverName || '') + ' ' + s.approvedAt : ''], ['経理確認', s.confirmedAt ? (s.confirmedBy || '') + ' ' + s.confirmedAt : ''], ['提出期限', s.deadline || ''], []];
    let body = [], name = F_NAME(f);
    if (f === 'void') body = [['発生日時', s.occurredAt], ['レジ担当者', s.registerName], ['誤打区分', s.categoryName], ['事由', s.reason], ['添付写真の枚数', ph]];
    else if (f === 'late') body = [['預け入れ日', s.depositDate], ['遅滞理由', s.reason], [], ['売上日', '金額']].concat((s.items || []).map((x) => [x.salesDate, num(x.amount)]), [['合計', num(s.total)]]);
    else if (f === 'pos') body = [['対象月', s.targetMonth], ['報告区分', s.reportName], [], ['レシート日時', 'レシートNo', '修正内容', '依頼者']].concat((s.items || []).map((x) => [x.receiptAt, x.receiptNo, x.content, x.requesterName]));
    else if (f === 'bill') body = [['ご利用日', d.usageDate], ['会社名', d.company], ['部署', d.dept], ['役職', d.title], ['宛名', d.addressee], ['郵便番号', d.zip], ['宛先', d.address], ['電話番号', d.tel], ['FAX', d.fax], ['お食事代金', num(d.amount)], ['手数料', d.fee === '' || d.fee == null ? '' : num(d.fee)], ['人数', d.headcount === '' || d.headcount == null ? '' : num(d.headcount)], ['レシートNo', d.receiptNo], ['備考', d.note], ['レシート写真の枚数', ph]];
    else if (f === 'cash') {
      const c = cashCalc(d);
      body = [['対象月', s.targetMonth], [], ['金種'].concat(c.places.map((p) => p.name + '（枚数）'), c.places.map((p) => p.name + '（金額）'))]
        .concat(DENOMS.map((m) => [m[1]].concat(c.places.map((p) => num((p.counts || {})[m[0]])), c.places.map((p) => m[0] * num((p.counts || {})[m[0]])))))
        .concat([['合計'].concat(c.places.map(() => ''), c.places.map((p) => p.total)), [], ['金種の合計', c.cashTotal], ['A（基本元金）', c.A], ['B（つり銭準備金）', c.B], ['A＋B', c.expected], ['差', c.diff], ['理由', s.reason], [], ['つり銭準備金B：抜いた日', '金額']], (d.reserve || []).map((x) => [x.date, num(x.amount)]), [[], ['銀行預入れ予定：売上日', '金額']], (d.deposits || []).map((x) => [x.date, num(x.amount)]), [['合計', c.depTotal]]);
    } else if (f === 'petty') {
      const p = pettyCalc(d, null);
      body = [['対象月', s.targetMonth], [], ['金種', '枚数', '金額']].concat(DENOMS.map((m) => [m[1], num((d.counts || {})[m[0]]), m[0] * num((d.counts || {})[m[0]])]), [['小計', '', p.subtotal], ['預金残高', '', p.bank], ['合計', '', p.total], ['⑨ 出納帳の月末残高', '', d.bookBalance == null || d.bookBalance === '' ? '' : num(d.bookBalance)], ['差', '', s.diff === '' || s.diff == null ? '' : num(s.diff)], ['理由', '', s.reason]]);
    } else if (f === 'book') {
      const b = bookCalc(d);
      body = [['対象月', s.targetMonth], ['前月繰越', b.carryOver], [], ['日', '摘要', '収入', '支出', '残高', '負担店舗', '科目']].concat(b.rows.map((r) => [num(r.day), [r.phrase, r.note].filter(String).join(' '), num(r.income) || '', num(r.expense) || '', r.balance, r.burden, r.account]), [['計', '', b.income, b.expense, b.closing]]);
    } else if (f === 'usage') {
      const u = usageCalc(d, s.targetMonth), L = u.layout;
      body = [['対象月', s.targetMonth], ['内訳の不一致', u.bad.length ? u.bad.join('日、') + '日' : 'なし'], ['理由', s.reason], []];
      const h = ['日']; L.forEach((g) => { h.push(g.short + '計'); g.items.forEach((m) => h.push(m.name)); h.push('内訳計', '確認'); }); body.push(h);
      u.days.forEach((x) => { const r = (d.days || {})[x.day] || {}, row = [x.day]; L.forEach((g) => { row.push(x[g.id] || ''); g.items.forEach((m) => row.push(num((r[g.id + 'i'] || {})[m.i]) || '')); row.push(x[g.id + 'Sum'] || '', x.has ? (x[g.id + 'Sum'] === x[g.id] ? 'OK' : '×') : ''); }); body.push(row); });
      const t = ['計']; L.forEach((g) => { t.push(u.tot[g.id]); u.itemTot[g.id].forEach((v) => t.push(v)); t.push(u.itemTot[g.id].reduce((a, b) => a + b, 0), ''); }); body.push(t);
    }
    return [{ name: name, rows: head.concat(body) }];
  }
  const F_NAME = (f) => FORMS[f].no + FORMS[f].name;

  const can = {
    edit: (s) => s.status === 'draft' || s.status === 'returned',
    approve: (s) => s.status === 'pending',
    confirm: (s) => s.status === 'received'
  };
  function title(s) {
    const f = formOf(s), F = FORMS[f];
    return F.no + ' ' + F.name + (f === 'void' && s.categoryName ? '（' + s.categoryName + '）' : '') + (f === 'pos' && s.reportName ? '（' + s.reportName + '）' : '') + (f === 'bill' && ((s.data || {}).company || (s.data || {}).addressee) ? '（' + ((s.data || {}).company || (s.data || {}).addressee) + '）' : '') + (MONTH_FORMS.indexOf(f) >= 0 && s.targetMonth ? '（' + (+s.targetMonth.slice(5, 7)) + '月分）' : '');
  }
  function summary(s) {
    const f = formOf(s);
    if (f === 'void') return (s.registerName || '') + ' ／ ' + String(s.reason || '').slice(0, 24);
    if (f === 'late') return '預け入れ ' + (s.depositDate || '') + ' ／ ' + (s.items || []).length + '件 ' + (s.total || 0).toLocaleString('ja-JP') + '円';
    if (f === 'cash') return '金種合計 ' + yen(s.total) + ' ／ ' + (num(s.diff) === 0 ? 'A+Bと一致' : '差 ' + yen(s.diff));
    if (f === 'petty') return '合計 ' + yen(s.total) + ' ／ ' + (s.diff == null || s.diff === '' ? '出納帳との照合なし' : num(s.diff) === 0 ? '出納帳と一致' : '出納帳と差 ' + yen(s.diff));
    if (f === 'bill') { const b = s.data || {}; return (b.company || b.addressee || '') + ' ／ ご利用日 ' + (b.usageDate || '') + ' ／ ' + yen(b.amount); }
    if (f === 'usage' && s.status === 'draft') return '入力中：' + usageCalc(s.data, s.targetMonth).entered + '日分を入力済み ／ ポイント ' + yen(usageCalc(s.data, s.targetMonth).tot.pt) + ' ／ クーポン ' + yen(usageCalc(s.data, s.targetMonth).tot.cp) + ' ／ 売掛 ' + yen(usageCalc(s.data, s.targetMonth).tot.ar);
    if (f === 'usage') return 'ポイント ' + yen((s.data && usageCalc(s.data, s.targetMonth).tot.pt) || 0) + ' ／ クーポン ' + yen((s.data && usageCalc(s.data, s.targetMonth).tot.cp) || 0) + ' ／ 売掛 ' + yen((s.data && usageCalc(s.data, s.targetMonth).tot.ar) || 0) + ' ／ ' + (num(s.diff) === 0 ? '内訳すべて一致' : s.diff + '日が不一致');
    if (f === 'book') return '月末残高 ' + yen(s.total) + ' ／ ' + ((s.data && s.data.rows) || []).length + '行';
    return (s.targetMonth || '') + ' ／ ' + (s.items || []).length + '行';
  }
  const ev = (action, actor, note, now) => ({ action: action, actor: actor, note: note || '', at: now });

  function submit(slip, now, siblings) {
    if (!can.edit(slip)) return { ok: false, errors: ['この伝票は提出できない状態です'] };
    const errors = checkSubmit(slip, siblings);
    if (errors.length) return { ok: false, errors: errors };
    if (formOf(slip) === 'petty') { const p = pettyCalc(slip.data, submittedOf(siblings, slip, 'book', slip.targetMonth)); slip.data.bookBalance = p.bookBalance; slip.diff = p.diff; }
    slip.status = 'pending';
    slip.rev = (slip.rev || 0) + 1;
    slip.submittedAt = now;
    if (!slip.firstSubmittedAt) slip.firstSubmittedAt = now;
    slip.returnReason = '';
    return { ok: true, event: ev('submit', slip.inputterName, '提出（第' + slip.rev + '版）', now) };
  }
  // 承認：店舗責任者の担当者のみ。担当者と日時を記録する（押印は廃止）
  function approve(slip, approver, now) {
    if (!can.approve(slip)) return { ok: false, errors: ['承認待ちの伝票ではありません'] };
    if (!approver || !approver.isManager) return { ok: false, errors: ['承認できるのは店舗責任者のみです'] };
    slip.status = 'received';
    slip.approverId = approver.id; slip.approverName = approver.name; slip.approvedAt = now;
    return { ok: true, event: ev('approve', approver.name, '承認', now) };
  }
  function rejectByStore(slip, approver, reason, now) {
    if (!can.approve(slip)) return { ok: false, errors: ['承認待ちの伝票ではありません'] };
    if (!approver || !approver.isManager) return { ok: false, errors: ['差戻しできるのは店舗責任者のみです'] };
    if (!reason || !reason.trim()) return { ok: false, errors: ['差戻しの理由を入力してください'] };
    slip.status = 'returned'; slip.returnReason = reason; slip.returnedBy = approver.name + '（店舗責任者）'; slip.returnedAt = now;
    return { ok: true, event: ev('return', approver.name + '（店舗責任者）', reason, now) };
  }
  function rejectByAccounting(slip, actorName, reason, now) {
    if (!can.confirm(slip)) return { ok: false, errors: ['受付済みの伝票ではありません'] };
    if (!actorName) return { ok: false, errors: ['担当者名が必要です'] };
    if (!reason || !reason.trim()) return { ok: false, errors: ['差戻しの理由を入力してください'] };
    slip.status = 'returned'; slip.returnReason = reason; slip.returnedBy = actorName + '（経理部）'; slip.returnedAt = now;
    return { ok: true, event: ev('return', actorName + '（経理部）', reason, now) };
  }
  function confirm(slip, actorName, now) {
    if (!can.confirm(slip)) return { ok: false, errors: ['受付済みの伝票ではありません'] };
    if (!actorName) return { ok: false, errors: ['担当者名が必要です'] };
    slip.status = 'confirmed'; slip.confirmedBy = actorName; slip.confirmedAt = now;
    return { ok: true, event: ev('confirm', actorName + '（経理部）', '確認済み', now) };
  }
  return { exportSheets, BILL_SLOT, USAGE_GROUPS, usageLayoutFor, usageCalc, DENOMS, BOOK_MAX, RESERVE_MAX, DEPOSIT_MAX, MONTH_FORMS, DEFAULT_ACCOUNTS, DEFAULT_PHRASES, cashPlacesFor, countsTotal, cashCalc, bookCalc, pettyCalc, submittedOf, bookClosingOf, monthEnd, prevMonth, yen, CATEGORIES, FORMS, REPORT_TYPES, LATE_MAX, POS_MAX, STATUS, allSlots, formOf, reportType, fmt, category, deadlineOf, deadlineFor, isOverdue, applyInput, checkSubmit, usedRows, carriedRows, title, summary, can, submit, approve, rejectByStore, rejectByAccounting, confirm };
})();
if (typeof module !== 'undefined') module.exports = Core;
