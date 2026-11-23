/* デモ用の裏側（ブラウザ内だけで動く）。本番は api-gas.js が同じ関数名でGASを呼ぶ。 */
const ApiDemo = (function () {
  const DEMO_CODES = { accounting: 'KEIRI-DEMO', viewer: 'VIEW-DEMO' };
  // ① の項目構成は店舗ごとに変えられる（本番は「利用項目」シート）。デモでは015の店舗だけ、使わない項目と名称変更の例を入れている
  const DEMO_USAGE = [{ store: '015', group: 'cp', idx: 2, enabled: false }, { store: '015', group: 'cp', idx: 3, enabled: false }, { store: '015', group: 'cp', idx: 4, enabled: false }, { store: '015', group: 'cp', idx: 5, enabled: false }, { store: '015', group: 'cp', idx: 6, enabled: false }, { store: '015', group: 'ar', idx: 4, enabled: false }, { store: '015', group: 'pt', idx: 0, name: 'ジャパンチケット', enabled: true }];
  let mem = {}; // localStorageが使えない場合の代替
  const store = {
    get(k) { try { const v = localStorage.getItem(k); if (v !== null) return v; } catch (e) {} return mem[k] === undefined ? null : mem[k]; },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const nowStr = () => Core.fmt(new Date());
  let db = null;
  function load() {
    if (db) return db;
    try { db = JSON.parse(store.get('chibo_demo_db') || 'null'); } catch (e) { db = null; }
    if (!db) { db = { slips: {}, history: [], seq: 0 }; seed(); save(); }
    return db;
  }
  function save() { store.set('chibo_demo_db', JSON.stringify(db)); }
  function photo(label) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><rect width="480" height="640" fill="#EFEAE6"/><rect x="40" y="40" width="400" height="560" fill="#fff" stroke="#B5B5B6"/><text x="240" y="300" font-size="26" text-anchor="middle" fill="#6B5F63" font-family="sans-serif">' + label + '</text><text x="240" y="340" font-size="18" text-anchor="middle" fill="#B5B5B6" font-family="sans-serif">サンプル画像</text></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  function putPhoto(ref, dataUrl) { store.set('chibo_photo_' + ref, dataUrl); }
  function names(code) { const o = {}; demoStaff(code).forEach((s) => (o[s.id] = s.name)); return o; }
  function addHistory(slip, event) {
    db.history.push({ slipId: slip.id, rev: slip.rev, at: event.at, action: event.action, actor: event.actor, note: event.note, snapshot: JSON.stringify({ occurredAt: slip.occurredAt, category: slip.category, reason: slip.reason, photos: slip.photos }) });
  }
  function newId(code, now, form) { db.seq += 1; return Core.FORMS[form || 'void'].prefix + code + '-' + now.slice(0, 10).replace(/-/g, '') + '-' + String(db.seq).padStart(3, '0'); }
  function mk(code, occurredAt, cat, reason, status, extra) {
    const s = { id: newId(code, occurredAt, 'void'), form: 'void', storeCode: code, storeName: STORES.filter((x) => x.code === code)[0].name, status: 'draft', rev: 0, photos: [], createdAt: occurredAt };
    Core.applyInput(s, { occurredAt: occurredAt, inputterId: code + '-S1', registerId: code + '-S2', category: cat, reason: reason, photos: Core.category(cat).slots.map((l, i) => { const ref = 'seed-' + s.id + '-' + i; putPhoto(ref, photo(l)); return { slot: l, ref: ref }; }) }, names(code));
    db.slips[s.id] = s;
    const t = extra && extra.submitAt || occurredAt;
    if (status !== 'draft') { const r = Core.submit(s, t); addHistory(s, r.event); }
    if (status === 'received' || status === 'confirmed') { const r = Core.approve(s, demoStaff(code)[0], t); addHistory(s, r.event); }
    if (status === 'confirmed') { const r = Core.confirm(s, '経理担当者（デモ）', t); addHistory(s, r.event); }
    if (status === 'returned') { const r = Core.rejectByStore(s, demoStaff(code)[0], '数量の訂正内容が写真から読み取れません。撮り直してください。', t); addHistory(s, r.event); }
    return s;
  }
  function mkForm(code, form, input, status, t) {
    const s = { id: newId(code, t, form), form: form, storeCode: code, storeName: STORES.filter((x) => x.code === code)[0].name, status: 'draft', rev: 0, photos: [], createdAt: t };
    Core.applyInput(s, Object.assign({ inputterId: code + '-S1' }, input), names(code));
    s.savedAt = t; db.slips[s.id] = s;
    const sib = () => Object.values(db.slips).filter((x) => x.storeCode === code);
    if (status !== 'draft') { const r = Core.submit(s, t, sib()); if (!r.ok) throw new Error(r.errors.join(',')); addHistory(s, r.event); }
    if (status === 'received' || status === 'confirmed') { const r = Core.approve(s, demoStaff(code)[0], t); addHistory(s, r.event); }
    if (status === 'confirmed') { const r = Core.confirm(s, '経理担当者（デモ）', t); addHistory(s, r.event); }
    return s;
  }
  function seed() {
    const d = new Date(); const y = d.getFullYear(), m = d.getMonth() + 1;
    const p = (n) => (n < 10 ? '0' : '') + n;
    const day = (dd, hh) => y + '-' + p(m) + '-' + p(dd) + ' ' + hh;
    mk('301', day(Math.max(1, d.getDate() - 3), '19:42'), 'void_bulk', '注文の入力ミス。数量を訂正', 'pending');
    mk('301', day(Math.max(1, d.getDate() - 2), '20:15'), 'training', '新人のレジ研修中の打ち込み', 'received');
    mk('301', day(Math.max(1, d.getDate() - 1), '21:03'), 'void_change', '支払方法の登録を変更', 'confirmed');
    mk('301', day(Math.max(1, d.getDate() - 1), '12:20'), 'bulk', 'ランチのセット誤打', 'returned');
    mk('015', day(Math.max(1, d.getDate() - 2), '18:30'), 'void_bulk', '卓番号の誤り', 'received');
    mk('101', day(Math.max(1, d.getDate() - 1), '19:05'), 'training', '研修用の打ち込み', 'pending');
    const ym = y + '-' + p(m), today = ym + '-' + p(d.getDate());
    mkForm('301', 'late', { depositDate: ym + '-' + p(Math.max(1, d.getDate() - 1)), reason: '土曜の売上のうち、紙幣分のみ入金。硬貨は休み明けに入金', items: [{ salesDate: ym + '-' + p(Math.max(1, d.getDate() - 3)), amount: 38200 }, { salesDate: ym + '-' + p(Math.max(1, d.getDate() - 2)), amount: 41500 }] }, 'received', today + ' 10:00');
    mkForm('301', 'pos', { reportType: 'd10', targetMonth: ym, items: [{ receiptAt: ym + '-03 19:20', receiptNo: '10452', content: '支払方法をクレジットから現金に変更', requesterId: '301-S2' }, { receiptAt: ym + '-05 20:41', receiptNo: '10533', content: '商品の数量を2から1へ訂正', requesterId: '301-S3' }] }, 'confirmed', ym + '-10 21:00');
    mkForm('301', 'pos', { reportType: 'd20', targetMonth: ym, items: [{ receiptAt: ym + '-14 18:05', receiptNo: '10871', content: '会計の取り消し（二重入力）', requesterId: '301-S2' }] }, 'pending', ym + '-20 21:00');
    // 月末の現金管理（前月分）：出納帳→現金管理票→小口現金の順
    const pm = Core.prevMonth(ym), t1 = ym + '-01 10:00';
    mkForm('301', 'book', { targetMonth: pm, inputterId: '301-S1', data: { carryOver: 140327, rows: [
      { day: 1, phrase: '水道代', note: '9月分 （例）', income: 4400, expense: 0, burden: '301', account: '水道光熱費' },
      { day: 6, phrase: '消耗品の購入', note: '両面テープ', income: 0, expense: 110, burden: '301', account: '消耗品費' },
      { day: 12, phrase: '', note: '電話機', income: 0, expense: 9990, burden: '301', account: '消耗品費' }] } }, 'confirmed', t1);
    mkForm('301', 'cash', { targetMonth: pm, inputterId: '301-S1', data: { places: Core.cashPlacesFor({ code: '301', type: 'ビル型' }).map((p) => Object.assign(p, { counts: { alsok: { 5000: 14, 1000: 19, 500: 150, 100: 750, 50: 150, 10: 250, 5: 150, 1: 250 }, f1: { 5000: 10, 1000: 51, 500: 15, 100: 59, 50: 87, 10: 71, 5: 103, 1: 25 }, f2: { 5000: 22, 1000: 6, 500: 30, 100: 135, 50: 66, 10: 159, 5: 105, 1: 85 } }[p.id] })), reserve: [], deposits: [{ date: Core.monthEnd(pm), amount: 889747 }] } }, 'received', t1);
    mkForm('301', 'petty', { targetMonth: pm, inputterId: '301-S1', data: { counts: { 10000: 13, 1000: 4, 500: 1, 100: 1, 10: 2, 5: 1, 1: 2 }, bank: 0 } }, 'received', t1);
    // ④ 請求依頼票・① 日次利用集計
    const rref = 'seed-bill-1'; putPhoto(rref, photo('レシート'));
    mkForm('301', 'bill', { photos: [{ slot: 'レシート', ref: rref }], data: { usageDate: ym + '-' + p(Math.max(1, d.getDate() - 2)), zip: '541-0053', address: '大阪市中央区本町1-1-1 サンプルビル5F', company: '株式会社サンプル商事', dept: '総務部', title: '課長', addressee: '山田 太郎', tel: '06-1234-5678', fax: '', fee: '', headcount: 12, amount: 96800, receiptNo: '20817', note: '宴会（領収書は後日郵送を希望）' } }, 'received', today + ' 11:00');
    const ud = {}; for (let n = 1; n <= 28; n++) { ud[n] = { pt: n % 4 === 0 ? 5200 : '', pti: n % 4 === 0 ? { 1: 3200, 5: 2000 } : {}, cp: '', cpi: {}, ar: n % 9 === 0 ? 12000 : '', ari: n % 9 === 0 ? { 0: 12000 } : {} }; }
    ud[10] = { pt: 8000, pti: { 0: 3000, 2: 4000 }, cp: 1000, cpi: { 0: 1000 }, ar: '', ari: {} }; // 内訳が1,000円足りない日（理由を付けて提出）
    mkForm('301', 'usage', { targetMonth: pm, inputterId: '301-S1', reason: '10日のぐるなび分の入力漏れ。翌月の経理確認で修正予定', data: { layout: Core.usageLayoutFor('301', DEMO_USAGE), days: ud } }, 'received', t1);
    const cd = {}; for (let n = 1; n < d.getDate(); n++) cd[n] = { pt: n % 3 === 0 ? 4800 : '', pti: n % 3 === 0 ? { 1: 4800 } : {}, cp: '', cpi: {}, ar: '', ari: {} };
    mkForm('301', 'usage', { targetMonth: ym, inputterId: '301-S1', data: { layout: Core.usageLayoutFor('301', DEMO_USAGE), days: cd } }, 'draft', today + ' 09:30'); // 今月分：入力中
    // 期限超過の例（2か月前の発生分を、期限後に提出）
    const prev = new Date(y, d.getMonth() - 2, 20); const pmOld = prev.getFullYear() + '-' + p(prev.getMonth() + 1) + '-20 19:10';
    mk('002', pmOld, 'void_bulk', '誤打の訂正（提出が遅れた例）', 'received', { submitAt: Core.deadlineOf(pmOld).slice(0, 8) + '05 10:30' });
  }
  const find = (code) => STORES.filter((s) => s.code === code)[0];
  function auth(code) {
    code = String(code || '').trim();
    if (code === DEMO_CODES.accounting) return { role: 'accounting' };
    if (code === DEMO_CODES.viewer) return { role: 'viewer' };
    const s = find(code);
    return s ? { role: 'store', store: s } : null;
  }
  const strip = (s) => Object.assign({}, s);
  const ok = (o) => Promise.resolve(Object.assign({ ok: true }, o));
  const ng = (m) => Promise.resolve({ ok: false, error: m });

  return {
    demo: true,
    hints: DEMO_CODES,
    login(code) {
      load(); const a = auth(code);
      if (!a) return ng('IDが見つかりません');
      const r = { role: a.role, categories: Core.CATEGORIES, stores: STORES.map((s) => ({ code: s.code, name: s.name, type: s.type, status: s.status })), masters: { accounts: Core.DEFAULT_ACCOUNTS, phrases: Core.DEFAULT_PHRASES } };
      if (a.store) { r.store = Object.assign({}, a.store, { cashPlaces: Core.cashPlacesFor(a.store), usageLayout: Core.usageLayoutFor(a.store.code, DEMO_USAGE) }); r.staff = demoStaff(a.store.code); r.readOnly = a.store.status === '閉店'; }
      return ok(r);
    },
    listStore(code) { load(); const a = auth(code); if (!a || a.role !== 'store') return ng('権限がありません'); return ok({ slips: Object.values(db.slips).filter((s) => s.storeCode === a.store.code).sort((x, y) => (y.occurredAt > x.occurredAt ? 1 : -1)).map(strip) }); },
    listAll(code) { load(); const a = auth(code); if (!a || a.role === 'store') return ng('権限がありません'); return ok({ slips: Object.values(db.slips).sort((x, y) => (y.occurredAt > x.occurredAt ? 1 : -1)).map(strip) }); },
    getPhoto(code, ref) { load(); if (!auth(code)) return ng('権限がありません'); const v = store.get('chibo_photo_' + ref); return v ? ok({ dataUrl: v }) : ng('写真が見つかりません'); },
    history(code, id) { load(); if (!auth(code)) return ng('権限がありません'); return ok({ history: db.history.filter((h) => h.slipId === id) }); },
    save(code, input, submitNow) {
      load(); const a = auth(code);
      if (!a || a.role !== 'store') return ng('権限がありません');
      if (a.store.status === '閉店') return ng('閉店した店舗は閲覧のみです');
      const now = nowStr(); let slip = input.id ? db.slips[input.id] : null;
      if (slip && slip.storeCode !== a.store.code) return ng('権限がありません');
      if (slip && !Core.can.edit(slip)) return ng('この伝票は編集できません');
      const form = input.form || (slip && slip.form) || 'void';
      if (!slip) { slip = { id: newId(a.store.code, now, form), form: form, storeCode: a.store.code, storeName: a.store.name, status: 'draft', rev: 0, photos: [], createdAt: now }; db.slips[slip.id] = slip; }
      const photos = form !== 'void' && form !== 'book' && form !== 'bill' ? [] : !input.photos ? slip.photos : input.photos.filter((p) => p && p.slot).map((p) => {
        if (p.dataUrl) { const ref = slip.id + '-' + p.slot + '-' + Date.now(); putPhoto(ref, p.dataUrl); return { slot: p.slot, ref: ref }; }
        return { slot: p.slot, ref: p.ref };
      });
      Core.applyInput(slip, Object.assign({}, input, { photos: photos }), names(a.store.code)); slip.savedAt = now;
      if (submitNow) {
        const r = Core.submit(slip, now, Object.values(db.slips).filter((x) => x.storeCode === a.store.code));
        if (!r.ok) { save(); return Promise.resolve({ ok: false, error: r.errors.join('\n'), errors: r.errors, slip: strip(slip) }); }
        addHistory(slip, r.event);
      }
      save(); return ok({ slip: strip(slip) });
    },
    approve(code, id, approverId) {
      load(); const a = auth(code); if (!a || a.role !== 'store') return ng('権限がありません');
      const slip = db.slips[id]; if (!slip || slip.storeCode !== a.store.code) return ng('伝票が見つかりません');
      const approver = demoStaff(a.store.code).filter((s) => s.id === approverId)[0];
      const r = Core.approve(slip, approver, nowStr()); if (!r.ok) return ng(r.errors.join('\n'));
      addHistory(slip, r.event); save(); return ok({ slip: strip(slip) });
    },
    rejectStore(code, id, approverId, reason) {
      load(); const a = auth(code); if (!a || a.role !== 'store') return ng('権限がありません');
      const slip = db.slips[id]; if (!slip || slip.storeCode !== a.store.code) return ng('伝票が見つかりません');
      const approver = demoStaff(a.store.code).filter((s) => s.id === approverId)[0];
      const r = Core.rejectByStore(slip, approver, reason, nowStr()); if (!r.ok) return ng(r.errors.join('\n'));
      addHistory(slip, r.event); save(); return ok({ slip: strip(slip) });
    },
    accConfirm(code, id, actorName) {
      load(); const a = auth(code); if (!a || a.role !== 'accounting') return ng('権限がありません（閲覧のみのIDです）');
      const slip = db.slips[id]; if (!slip) return ng('伝票が見つかりません');
      const r = Core.confirm(slip, actorName, nowStr()); if (!r.ok) return ng(r.errors.join('\n'));
      addHistory(slip, r.event); save(); return ok({ slip: strip(slip) });
    },
    accReturn(code, id, actorName, reason) {
      load(); const a = auth(code); if (!a || a.role !== 'accounting') return ng('権限がありません（閲覧のみのIDです）');
      const slip = db.slips[id]; if (!slip) return ng('伝票が見つかりません');
      const r = Core.rejectByAccounting(slip, actorName, reason, nowStr()); if (!r.ok) return ng(r.errors.join('\n'));
      addHistory(slip, r.event); save(); return ok({ slip: strip(slip) });
    },
    resetDemo() { db = { slips: {}, history: [], seq: 0 }; seed(); save(); return ok({}); }
  };
})();
if (typeof module !== 'undefined') module.exports = ApiDemo;
