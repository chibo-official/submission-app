(function () {
const api = window.APP_CONFIG && window.APP_CONFIG.API_URL ? ApiGas : ApiDemo;
const $app = document.getElementById('app'), $layer = document.getElementById('layer');
const S = { session: null, view: 'login', slips: [], form: null, sel: null, filter: { status: 'all', form: 'all', store: '', month: '', over: false, q: 'all' }, cache: {}, hist: {}, busy: false, loginMode: 'store', msg: '' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowStr = () => Core.fmt(new Date());
const short = (s) => (s ? (+s.slice(5, 7)) + '/' + (+s.slice(8, 10)) + ' ' + s.slice(11) : '');
const dlShort = (s) => (+s.slice(5, 7)) + '月' + (+s.slice(8, 10)) + '日 ' + s.slice(11);
const toInput = (s) => (s || '').replace(' ', 'T');
const fromInput = (v) => (v || '').replace('T', ' ');
const when = (s) => (Core.formOf(s) === 'void' ? short(s.occurredAt) : (+s.occurredAt.slice(5, 7)) + '/' + (+s.occurredAt.slice(8, 10)));
const todayStr = () => nowStr().slice(0, 10);
const monthLabel = (m) => m.slice(0, 4) + '年' + (+m.slice(5, 7)) + '月';
const stName = (st) => Core.STATUS[st] || st;
const stLabel = (s) => (Core.formOf(s) === 'usage' && s.status === 'draft' ? '入力中' : stName(s.status));
const badgeS = (s) => '<span class="badge b-' + s.status + '">' + esc(stLabel(s)) + '</span>';
const showAcc = (s) => s.status !== 'draft' || Core.formOf(s) === 'usage'; // 経理部には、①の入力中も見える
const badge = (st) => '<span class="badge b-' + st + '">' + esc(stName(st)) + '</span>';
const overBadge = (s) => (Core.isOverdue(s, nowStr()) && s.status !== 'confirmed' ? ' <span class="badge b-over">期限超過</span>' : '');
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }

function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }
function modal(html, bind) { $layer.innerHTML = '<div class="ov" data-act="ovclose"><div class="box" data-stop="1">' + html + '</div></div>'; if (bind) bind($layer); }
function closeModal() { $layer.innerHTML = ''; }
function ask(title, label, okLabel, cb) {
  modal('<h2>' + esc(title) + '</h2><div class="field"><div class="lbl">' + esc(label) + '</div><textarea id="askText"></textarea></div><div class="row"><button class="btn" data-act="ovclose">やめる</button><button class="btn pri" id="askOk">' + esc(okLabel) + '</button></div>', (l) => {
    l.querySelector('#askOk').onclick = () => { const v = l.querySelector('#askText').value; if (!v.trim()) { toast('理由を入力してください'); return; } closeModal(); cb(v.trim()); };
  });
}
function lightbox(src) { $layer.innerHTML = '<div class="ov" data-act="ovclose"><img class="big" src="' + esc(src) + '"></div>'; }

// ---------- 通信 ----------
const code = () => S.session && S.session.code;
async function run(p) { S.busy = true; try { return await p; } finally { S.busy = false; } }
async function loadPhoto(ref) {
  if (S.cache[ref]) return S.cache[ref];
  const r = await api.getPhoto(code(), ref);
  if (r.ok) S.cache[ref] = r.dataUrl; return S.cache[ref] || '';
}
function fillPhotos(root) {
  (root || document).querySelectorAll('img[data-ref]').forEach(async (img) => {
    const src = await loadPhoto(img.dataset.ref); if (src) img.src = src;
  });
}
async function refresh() {
  const r = S.session.role === 'store' ? await api.listStore(code()) : await api.listAll(code());
  if (r.ok) S.slips = r.slips; else toast(r.error);
}

// ---------- 画面の切り替え ----------
function go(view, extra) { S.view = view; Object.assign(S, extra || {}); render(); window.scrollTo(0, 0); }
function top(title, sub, back) {
  return '<div class="top">' + (back ? '<button class="back" data-act="' + back + '">‹ 戻る</button>' : '') + '<div class="t"><div class="s">' + esc(sub || '') + '</div><h1>' + esc(title) + '</h1></div><button class="out" data-act="logout">ログアウト</button></div>';
}
function render() {
  const v = S.view;
  if (v === 'login') $app.innerHTML = vLogin();
  else if (v === 'home') $app.innerHTML = vHome();
  else if (v === 'form') $app.innerHTML = vForm();
  else if (v === 'done') $app.innerHTML = vDone();
  else if (v === 'mylist') $app.innerHTML = vMyList();
  else if (v === 'approvals') $app.innerHTML = vApprovals();
  else if (v === 'acc') $app.innerHTML = vAcc();
  fillPhotos($app); loadHistory();
}

// ---------- ログイン ----------
function vLogin() {
  const acc = S.loginMode === 'acc';
  const hints = api.demo ? '<div class="demo"><b>デモ版です。</b>入力内容はこの端末の中だけに保存されます。<br>店舗ID：301（道頓堀ビル店）／015／101 など<br>経理部：' + esc(api.hints.accounting) + '　閲覧のみ（AM・部長）：' + esc(api.hints.viewer) + '</div>' : '';
  return '<div class="top"><div class="t"><div class="s">千房ホールディングス</div><h1>提出物管理</h1></div></div><div class="wrap narrow stack" style="padding-top:20px">' +
    '<div class="card stack"><h2>' + (acc ? '本部・経理部のログイン' : '店舗IDでログイン') + '</h2>' +
    '<div class="field"><div class="lbl">' + (acc ? 'アクセスID' : '店舗ID（3けた）') + '</div><input id="lgCode" inputmode="' + (acc ? 'text' : 'numeric') + '" autocomplete="off" value="' + esc(lsGet('chibo_code') || '') + '"></div>' +
    (acc ? '<div class="field"><div class="lbl">お名前（操作の記録に使います）</div><input id="lgName" autocomplete="off" value="' + esc(lsGet('chibo_name') || '') + '"></div>' : '') +
    (S.msg ? '<div class="alert">' + esc(S.msg) + '</div>' : '') +
    '<button class="btn pri" data-act="login" ' + (S.busy ? 'disabled' : '') + '>ログイン</button></div>' +
    '<button class="chip" style="align-self:center" data-act="loginmode">' + (acc ? '店舗の方はこちら' : '本部・経理の方はこちら') + '</button>' + hints + '</div>';
}
async function doLogin() {
  const c = document.getElementById('lgCode').value.trim(); const n = S.loginMode === 'acc' ? document.getElementById('lgName').value.trim() : '';
  if (!c) { S.msg = 'IDを入力してください'; render(); return; }
  if (S.loginMode === 'acc' && !n) { S.msg = 'お名前を入力してください'; render(); return; }
  S.msg = ''; const r = await run(api.login(c));
  if (!r.ok) { S.msg = r.error || 'ログインできませんでした'; render(); return; }
  S.session = Object.assign({ code: c, name: n }, r);
  if (r.role === 'store') { lsSet('chibo_code', c); } else { lsSet('chibo_code', c); lsSet('chibo_name', n); }
  S.cache = {}; await refresh();
  go(r.role === 'store' ? 'home' : 'acc', { sel: null });
}

// ---------- 店舗ホーム ----------
function deadlineBanner() {
  const d = new Date(), n = nowStr();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 15), cur = d;
  const key = (x) => Core.fmt(x).slice(0, 7) + '-15 12:00';
  const dp = Core.deadlineOf(key(prev)), dc = Core.deadlineOf(key(cur));
  let h = '<div class="alert info">誤打伝票・請求依頼票・POS修正（月末分）・月末の提出物の期限（休日・定休日でも変わりません）<br>';
  if (n < dp) h += '・前月発生分：<b>' + dlShort(dp) + '</b>まで<br>';
  return h + '・今月発生分：<b>' + dlShort(dc) + '</b>まで</div>';
}
function cashTile() {
  const ok = S.session.store.cashPlaces && S.session.store.cashPlaces.length;
  return ok ? '<button class="tile" data-act="newform" data-form="cash" ' + (S.session.readOnly ? 'disabled' : '') + '><div class="n">⑦ 現金管理票を入力する</div><div class="d">金種・つり銭準備金・預入予定の売上金</div></button>' : '<div class="tile off"><div class="n">⑦ 現金管理票</div><div class="d">この店舗は対象外です</div></div>';
}
function vHome() {
  const st = S.session.store, mine = S.slips, ro = S.session.readOnly ? 'disabled' : '';
  const pend = mine.filter((s) => s.status === 'pending').length, ret = mine.filter((s) => s.status === 'returned');
  const tile = (f, d, pri) => '<button class="tile' + (pri ? ' pri' : '') + '" data-act="newform" data-form="' + f + '" ' + ro + '><div class="n">' + Core.FORMS[f].no + ' ' + Core.FORMS[f].name + 'を入力する</div><div class="d">' + d + '</div></button>';
  return top(st.name + '（' + st.code + '）', '提出物管理') + '<div class="wrap stack">' + deadlineBanner() +
    (S.session.readOnly ? '<div class="alert">閉店した店舗のため、閲覧のみです。</div>' : '') +
    (ret.length ? '<div class="alert"><b>差戻しが' + ret.length + '件あります。</b>内容を直して、もう一度提出してください。<br><button class="btn sm" style="margin-top:8px" data-act="mylist" data-f="returned">差戻しを見る</button></div>' : '') +
    '<div class="tiles">' +
    '<div class="lbl" style="font-weight:700;color:var(--ink)">随時・10日／20日の報告</div><div class="tiles">' +
    tile('void', '写真を撮って、事由を書きます', true) + tile('bill', 'お客様の宛先・金額・レシートの写真') + tile('late', '預け入れが翌営業日を過ぎたときに作成します') + tile('pos', '10日・20日の中間報告と月末の修正依頼') + '</div>' +
    '<div class="lbl" style="font-weight:700;color:var(--ink)">月末に作成（期限：翌月3日 9:00）</div><div class="tiles">' + tile('usage', 'ポイント・クーポン・売掛キーの、日ごとの利用額') + cashTile() + tile('petty', '小口現金の金種と預金残高') + tile('book', '現金の入出金を1行ずつ記録します') + '</div>' +
    '<div class="tiles">' +
    '<button class="tile" data-act="approvals"><div class="n">承認する（店舗責任者）</div><div class="d">承認待ちの伝票を確認します</div>' + (pend ? '<span class="c">' + pend + '</span>' : '') + '</button>' +
    '<button class="tile" data-act="mylist" data-f="all"><div class="n">提出した伝票を見る</div><div class="d">下書き・差戻し・承認の状況</div></button>' +
    '</div></div>';
}

// ---------- 入力フォーム ----------
const defaultReport = () => { const d = new Date(), day = d.getDate(), pm = Core.fmt(new Date(d.getFullYear(), d.getMonth() - 1, 15)).slice(0, 7), cm = Core.fmt(d).slice(0, 7); return day <= 3 ? { t: 'eom', m: pm } : day <= 10 ? { t: 'd10', m: cm } : day <= 20 ? { t: 'd20', m: cm } : { t: 'eom', m: cm }; };
const blankPos = () => ({ receiptAt: '', receiptNo: '', content: '', requesterId: '' });
const blankBill = () => ({ usageDate: todayStr(), zip: '', address: '', company: '', dept: '', title: '', addressee: '', tel: '', fax: '', fee: '', headcount: '', amount: '', receiptNo: '', note: '' });
function blankForm(form) {
  if (form === 'bill') return { form: 'bill', id: null, inputterId: '', data: blankBill(), photos: {}, returnReason: '' };
  if (Core.MONTH_FORMS.indexOf(form) >= 0) return blankMonthForm(form);
  if (form === 'late') return { form: 'late', id: null, inputterId: '', depositDate: todayStr(), items: [{ salesDate: '', amount: '' }], reason: '', returnReason: '' };
  if (form === 'pos') { const r = defaultReport(); return { form: 'pos', id: null, inputterId: '', reportType: r.t, targetMonth: r.m, items: [blankPos()], returnReason: '' }; }
  return { form: 'void', id: null, occurredAt: nowStr(), inputterId: '', registerId: '', category: '', reason: '', photos: {}, returnReason: '' };
}
function formFromSlip(s) {
  if (Core.MONTH_FORMS.indexOf(Core.formOf(s)) >= 0) return monthFormFromSlip(s);
  const ph = {}; (s.photos || []).forEach((p) => (ph[p.slot] = { ref: p.ref }));
  if (Core.formOf(s) === 'bill') return { form: 'bill', id: s.id, inputterId: s.inputterId, data: Object.assign(blankBill(), JSON.parse(JSON.stringify(s.data || {}))), photos: ph, returnReason: s.status === 'returned' || s.returnReason ? s.returnReason : '' };
  return { form: Core.formOf(s), id: s.id, occurredAt: s.occurredAt, inputterId: s.inputterId, registerId: s.registerId, category: s.category, reason: s.reason, depositDate: s.depositDate, reportType: s.reportType, targetMonth: s.targetMonth, items: JSON.parse(JSON.stringify(s.items || [])), photos: ph, returnReason: s.status === 'returned' || s.returnReason ? s.returnReason : '' };
}
// 入力中の内容を、検証・件数計算に使える伝票の形にする
const formSlip = () => { const f = S.form; return { id: f.id, form: f.form, storeCode: S.session.store.code, reportType: f.reportType, reportName: (Core.reportType(f.reportType) || {}).name, targetMonth: f.targetMonth, items: f.items || [] }; };
function staffOpts(sel, onlyManager) {
  return '<option value="">担当者を選択</option>' + S.session.staff.filter((x) => !onlyManager || x.isManager).map((x) => '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
}
function vForm() {
  if (S.form.form === 'bill') return vFormBill();
  if (S.form.form === 'usage') return vFormUsage();
  if (S.form.form === 'late') return vFormLate();
  if (S.form.form === 'pos') return vFormPos();
  if (S.form.form === 'cash') return vFormCash();
  if (S.form.form === 'petty') return vFormPetty();
  if (S.form.form === 'book') return vFormBook();
  return vFormVoid();
}
function vFormVoid() {
  const f = S.form, c = Core.category(f.category), st = S.session.store;
  const dl = f.occurredAt ? Core.deadlineOf(f.occurredAt) : '';
  const slots = c ? Core.allSlots(c).map((label) => {
    const opt = c.slots.indexOf(label) < 0;
    const p = f.photos[label];
    const img = p ? (p.dataUrl ? '<img src="' + esc(p.dataUrl) + '">' : '<img data-ref="' + esc(p.ref) + '">') : '';
    return '<label class="ph' + (p ? ' has' : '') + '"' + (opt && !p ? ' style="border-color:var(--grey);color:var(--sub)"' : '') + '>' + img + (p ? '<span class="cap">' + esc(label) + '（撮り直す）</span>' : esc(label) + (opt ? '（任意）' : '') + '<br>＋ 撮影する') + '<input type="file" accept="image/*" capture="environment" data-photo="' + esc(label) + '"></label>';
  }).join('') : '';
  return top('② 誤打伝票（VOID）', st.name + '（' + st.code + '）' + (dl ? ' ／ 期限 ' + dlShort(dl) : ''), 'home') +
    '<div class="wrap narrow stack">' +
    (f.returnReason ? '<div class="alert"><b>差戻しの理由：</b>' + esc(f.returnReason) + '</div>' : '') +
    '<div class="field"><div class="lbl">入力者 <span class="req">必須</span></div><select data-bind="inputterId">' + staffOpts(f.inputterId) + '</select></div>' +
    '<div class="field"><div class="lbl">発生日時 <span class="req">必須</span></div><input type="datetime-local" data-bind="occurredAt" value="' + esc(toInput(f.occurredAt)) + '"></div>' +
    '<div class="field"><div class="lbl">レジ担当者 <span class="req">必須</span></div><select data-bind="registerId">' + staffOpts(f.registerId) + '</select></div>' +
    '<div><div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px;margin-bottom:6px">誤打区分 <span class="req">必須</span></div><div class="grid2">' +
    Core.CATEGORIES.map((x) => '<div class="opt' + (x.code === f.category ? ' on' : '') + '" data-act="cat" data-v="' + x.code + '">' + (x.code === f.category ? '✔ ' : '') + esc(x.name) + '</div>').join('') + '</div></div>' +
    '<div class="field"><div class="lbl">事由 <span class="req">必須</span></div><textarea data-bind="reason" placeholder="例：注文の入力ミス。数量を訂正">' + esc(f.reason) + '</textarea></div>' +
    '<div><div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px;margin-bottom:6px">伝票の写真' + (c ? '（3枚が必須。一括訂正伝票は任意）' : '') + '</div>' +
    (c ? '<div class="photos">' + slots + '</div><div class="lbl" style="margin-top:6px">伝票全体が写るように、明るい場所で撮影してください。</div>' : '<div class="lbl">誤打区分を選ぶと、必要な写真が表示されます。</div>') + '</div>' +
    '</div><div class="bar"><button class="btn" data-act="draft" ' + (S.busy ? 'disabled' : '') + '>下書き保存</button><button class="btn pri" data-act="submit" ' + (S.busy ? 'disabled' : '') + '>承認へ進む</button></div>';
}

const bar = () => { const u = S.form && S.form.form === 'usage'; return '<div class="bar"><button class="btn' + (u ? ' pri' : '') + '" data-act="draft" ' + (S.busy ? 'disabled' : '') + '>' + (u ? '保存（経理部にも反映）' : '下書き保存') + '</button><button class="btn' + (u ? '' : ' pri') + '" data-act="submit" ' + (S.busy ? 'disabled' : '') + '>' + (u ? '月末の提出（承認へ）' : '承認へ進む') + '</button></div>'; };
function vFormLate() {
  const f = S.form, st = S.session.store, total = f.items.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const rows = f.items.map((x, i) => '<div class="card stack" style="gap:8px"><div style="display:flex;align-items:center"><b>明細' + (i + 1) + '</b><span class="sp"></span>' + (f.items.length > 1 ? '<button class="chip" data-act="delitem" data-i="' + i + '">削除</button>' : '') + '</div>' +
    '<div class="row"><div class="field"><div class="lbl">売上日 <span class="req">必須</span></div><input type="date" data-item="' + i + '" data-key="salesDate" value="' + esc(x.salesDate) + '"></div>' +
    '<div class="field"><div class="lbl">金額（円） <span class="req">必須</span></div><input type="number" inputmode="numeric" min="0" data-item="' + i + '" data-key="amount" value="' + esc(x.amount) + '"></div></div></div>').join('');
  return top('⑤ 売上金預け入れ遅滞報告書', st.name + '（' + st.code + '）', 'home') + '<div class="wrap narrow stack">' +
    (f.returnReason ? '<div class="alert"><b>差戻しの理由：</b>' + esc(f.returnReason) + '</div>' : '') +
    '<div class="alert info">預け入れた日に作成してください。土日祝は紙幣のみ入金し、硬貨は休み明けに入金するルールです。</div>' +
    '<div class="field"><div class="lbl">入力者 <span class="req">必須</span></div><select data-bind="inputterId">' + staffOpts(f.inputterId) + '</select></div>' +
    '<div class="field"><div class="lbl">預け入れ日 <span class="req">必須</span></div><input type="date" data-bind="depositDate" value="' + esc(f.depositDate) + '"></div>' +
    '<div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px">遅滞明細（最大' + Core.LATE_MAX + '件）</div>' + rows +
    '<button class="btn" data-act="additem" ' + (f.items.length >= Core.LATE_MAX ? 'disabled' : '') + '>＋ 明細を追加</button>' +
    '<div class="card" style="display:flex;justify-content:space-between"><b>合計</b><b>' + total.toLocaleString('ja-JP') + ' 円</b></div>' +
    '<div class="field"><div class="lbl">遅滞理由 <span class="req">必須</span></div><textarea data-bind="reason" placeholder="例：土曜の売上のうち硬貨分を、休み明けに入金したため">' + esc(f.reason) + '</textarea></div>' +
    '</div>' + bar();
}
function vFormPos() {
  const f = S.form, st = S.session.store, fs = formSlip();
  const carried = Core.carriedRows(S.slips, fs), used = Core.usedRows(S.slips, fs), total = used + f.items.length;
  const d = new Date(), months = [Core.fmt(new Date(d.getFullYear(), d.getMonth() - 1, 15)).slice(0, 7), Core.fmt(d).slice(0, 7)];
  const car = carried.map((x) => '<div class="card" style="background:#F3F0EE;font-size:13px"><span class="badge">報告済み</span> ' + esc(x.from) + '<div class="kv" style="margin-top:6px"><div class="k">レシート日時</div><div>' + short(x.receiptAt) + '</div><div class="k">レシートNo</div><div>' + esc(x.receiptNo) + '</div><div class="k">修正内容</div><div>' + esc(x.content) + '</div><div class="k">依頼者</div><div>' + esc(x.requesterName) + '</div></div></div>').join('');
  const rows = f.items.map((x, i) => '<div class="card stack" style="gap:8px"><div style="display:flex;align-items:center"><b>明細' + (carried.length + i + 1) + '</b><span class="sp"></span>' + (f.items.length > 1 ? '<button class="chip" data-act="delitem" data-i="' + i + '">削除</button>' : '') + '</div>' +
    '<div class="field"><div class="lbl">対象レシートの日時 <span class="req">必須</span></div><input type="datetime-local" data-item="' + i + '" data-key="receiptAt" value="' + esc(toInput(x.receiptAt)) + '"></div>' +
    '<div class="field"><div class="lbl">レシートNo（数字） <span class="req">必須</span></div><input inputmode="numeric" data-item="' + i + '" data-key="receiptNo" value="' + esc(x.receiptNo) + '"></div>' +
    '<div class="field"><div class="lbl">修正内容 <span class="req">必須</span></div><textarea style="min-height:60px" data-item="' + i + '" data-key="content">' + esc(x.content) + '</textarea></div>' +
    '<div class="field"><div class="lbl">依頼者 <span class="req">必須</span></div><select data-item="' + i + '" data-key="requesterId">' + staffOpts(x.requesterId) + '</select></div></div>').join('');
  return top('⑥ POS及びCSM修正依頼書', st.name + '（' + st.code + '）' + (Core.deadlineFor(fs) ? ' ／ 期限 ' + dlShort(Core.deadlineFor(fs)) : ''), 'home') + '<div class="wrap narrow stack">' +
    (f.returnReason ? '<div class="alert"><b>差戻しの理由：</b>' + esc(f.returnReason) + '</div>' : '') +
    '<div class="alert info">日次精算を終えたあとは、POSで修正できません。会計側で直すため、ここで依頼してください。</div>' +
    '<div class="field"><div class="lbl">入力者 <span class="req">必須</span></div><select data-bind="inputterId">' + staffOpts(f.inputterId) + '</select></div>' +
    '<div class="row"><div class="field"><div class="lbl">対象月 <span class="req">必須</span></div><select data-bind="targetMonth">' + months.map((m) => '<option value="' + m + '"' + (m === f.targetMonth ? ' selected' : '') + '>' + monthLabel(m) + '</option>').join('') + '</select></div>' +
    '<div class="field"><div class="lbl">修正依頼日</div><div style="font-size:16px;font-weight:500;padding:2px 0">' + todayStr() + '</div></div></div>' +
    '<div><div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px;margin-bottom:6px">報告区分 <span class="req">必須</span></div><div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + Core.REPORT_TYPES.map((r) => '<div class="opt' + (r.code === f.reportType ? ' on' : '') + '" data-act="rtype" data-v="' + r.code + '">' + (r.code === f.reportType ? '✔ ' : '') + esc(r.name) + '</div>').join('') + '</div></div>' +
    '<div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px">明細　' + total + '行 / 上限' + Core.POS_MAX + '行' + (used ? '（この月はすでに' + used + '行を報告済み）' : '') + '</div>' +
    car + rows +
    '<button class="btn" data-act="additem" ' + (total >= Core.POS_MAX ? 'disabled' : '') + '>＋ 明細を追加</button>' + (total >= Core.POS_MAX ? '<div class="alert">1か月の上限（' + Core.POS_MAX + '行）に達しました。これ以上は追加できません。</div>' : '') +
    '</div>' + bar();
}
// ---------- 月末の現金管理（⑦⑧⑨）の入力 ----------
const yen = Core.yen;
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + yen(Math.abs(n));
const defaultMonth = () => { const d = new Date(); return d.getDate() <= 3 ? Core.prevMonth(Core.fmt(d).slice(0, 7)) : Core.fmt(d).slice(0, 7); };
const monthOptions = (sel) => { const m = Core.fmt(new Date()).slice(0, 7); return [Core.prevMonth(m), m].map((x) => '<option value="' + x + '"' + (x === sel ? ' selected' : '') + '>' + monthLabel(x) + '</option>').join(''); };
const sidNew = () => 'r' + Math.random().toString(36).slice(2, 8);
const blankRow = () => ({ sid: sidNew(), day: '', phrase: '', note: '', income: '', expense: '', burden: S.session.store.code, account: '', photo: null });
function prevBookOf(f) { return f.targetMonth ? Core.submittedOf(S.slips, { id: f.id, storeCode: S.session.store.code }, 'book', Core.prevMonth(f.targetMonth)) : null; }
function syncCarry() { const f = S.form; if (f.form !== 'book') return; const p = prevBookOf(f); if (p) f.data.carryOver = Core.bookClosingOf(p); }
const defaultUsageMonth = () => { const d = new Date(), cur = Core.fmt(d).slice(0, 7), pm = Core.prevMonth(cur); return d.getDate() <= 3 && S.slips.some((z) => Core.formOf(z) === 'usage' && z.targetMonth === pm && Core.can.edit(z)) ? pm : cur; };
function buildDays(month, old) {
  const last = +Core.monthEnd(month).slice(8, 10), out = {};
  for (let n = 1; n <= last; n++) { const o = (old || {})[n] || {}; out[n] = { pt: o.pt === undefined ? '' : o.pt, cp: o.cp === undefined ? '' : o.cp, ar: o.ar === undefined ? '' : o.ar, pti: o.pti || {}, cpi: o.cpi || {}, ari: o.ari || {} }; }
  return out;
}
function switchUsageMonth() {
  const m = S.form.targetMonth, who = S.form.inputterId, same = S.slips.filter((z) => Core.formOf(z) === 'usage' && z.targetMonth === m);
  const ex = same.filter((z) => Core.can.edit(z))[0];
  if (!ex && same.length) { toast('この月はすでに提出済みです'); S.form.targetMonth = same[0].targetMonth === m && S.form.id ? S.form.targetMonth : S.form.targetMonth; const keep = S.slips.filter((z) => z.id === S.form.id)[0]; if (keep) S.form.targetMonth = keep.targetMonth; else S.form.targetMonth = defaultUsageMonth(); return render(); }
  S.usageOpen = {};
  if (ex) S.form = formFromSlip(ex);
  else { S.form = blankForm('usage'); S.form.targetMonth = m; S.form.data.days = buildDays(m, {}); }
  S.form.inputterId = S.form.inputterId || who; return render();
}
function blankMonthForm(form) {
  const base = { form: form, id: null, inputterId: '', targetMonth: defaultMonth(), reason: '', returnReason: '' };
  if (form === 'cash') return Object.assign(base, { data: { places: S.session.store.cashPlaces.map((p) => Object.assign({}, p, { counts: {} })), baseA: '', reserve: [], deposits: [] } });
  if (form === 'petty') return Object.assign(base, { data: { counts: {}, bank: '' } });
  if (form === 'usage') { base.targetMonth = defaultUsageMonth(); return Object.assign(base, { data: { layout: S.session.store.usageLayout, days: buildDays(base.targetMonth, {}) } }); }
  const f = Object.assign(base, { data: { carryOver: '', rows: [blankRow()] } }); S.form = f; syncCarry(); return f;
}
function monthFormFromSlip(s) {
  const f = { form: Core.formOf(s), id: s.id, inputterId: s.inputterId, targetMonth: s.targetMonth, reason: s.reason || '', returnReason: s.status === 'returned' || s.returnReason ? s.returnReason : '', data: JSON.parse(JSON.stringify(s.data || {})) };
  if (f.form === 'usage') { f.data.days = buildDays(f.targetMonth, f.data.days); if (s.status === 'draft' || s.status === 'returned' || !f.data.layout) f.data.layout = S.session.store.usageLayout; }
  if (f.form === 'book') { const ph = {}; (s.photos || []).forEach((p) => (ph[p.slot] = p.ref)); (f.data.rows || []).forEach((r) => { r.sid = r.sid || sidNew(); r.photo = ph[r.sid] ? { ref: ph[r.sid] } : null; }); }
  return f;
}
function setPath(obj, path, val) { const k = path.split('.'); let o = obj; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = val; }
function liveOut() {
  const f = S.form; if (!f || Core.MONTH_FORMS.indexOf(f.form) < 0) return;
  const set = (k, v) => document.querySelectorAll('[data-out="' + k + '"]').forEach((el) => (el.textContent = v));
  const box = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  if (f.form === 'cash') {
    const c = Core.cashCalc(f.data);
    c.places.forEach((p, i) => { set('pt' + i, yen(p.total)); set('pd' + i, p.fixed > 0 ? '定額との差 ' + signed(p.total - p.fixed) : ''); Core.DENOMS.forEach((d) => set('pr' + i + '-' + d[0], yen(d[0] * (+(f.data.places[i].counts[d[0]]) || 0)))); });
    set('A', yen(c.A)); set('B', yen(c.B)); set('sum', yen(c.cashTotal)); set('exp', yen(c.expected)); set('dep', yen(c.depTotal));
    set('diff', c.diff === 0 ? '一致しています ✔' : 'A+Bと' + yen(Math.abs(c.diff)) + (c.diff > 0 ? '多い' : '少ない')); box('reasonBox', c.diff !== 0);
  } else if (f.form === 'petty') {
    const bk = Core.submittedOf(S.slips, { id: f.id, storeCode: S.session.store.code }, 'book', f.targetMonth), p = Core.pettyCalc(f.data, bk);
    Core.DENOMS.forEach((d) => set('pr-' + d[0], yen(d[0] * (+(f.data.counts[d[0]]) || 0))));
    set('sub', yen(p.subtotal)); set('tot', yen(p.total));
    set('pdiff', p.bookBalance == null ? '⑨が未提出のため照合できません' : p.diff === 0 ? '出納帳の残高と一致しています ✔' : '出納帳の残高と' + yen(Math.abs(p.diff)) + (p.diff > 0 ? '多い' : '少ない'));
    box('reasonBox', p.bookBalance == null || p.diff !== 0);
  } else if (f.form === 'usage') {
    const u = Core.usageCalc(f.data, f.targetMonth);
    u.days.forEach((x) => { set('uk' + x.day, usageState(x)); u.layout.forEach((g) => { set('us' + x.day + g.id, yen(x[g.id + 'Sum'])); set('ud' + x.day + g.id, g.short + 'の内訳：' + (x.diffs[g.id] === 0 ? '一致 ✔' : '差 ' + signed(x.diffs[g.id]))); }); });
    u.layout.forEach((g) => set('ut' + g.id, yen(u.tot[g.id])));
    set('ubad', u.bad.length ? u.bad.join('日、') + '日' : 'なし'); box('reasonBox', u.bad.length > 0);
  } else {
    const b = Core.bookCalc(f.data);
    b.rows.forEach((r, i) => set('rb' + i, '残高 ' + yen(r.balance))); set('bin', yen(b.income)); set('bout', yen(b.expense)); set('bclose', yen(b.closing)); set('bcarry', yen(b.carryOver));
  }
}
const usageState = (x) => (!x.has ? '—' : x.ok ? '✔' : '×');
const txt = (path, val, extra) => '<input class="inp" data-path="' + path + '" value="' + esc(val) + '" ' + (extra || '') + '>';
const inp = (path, val, extra) => '<input class="inp" data-path="' + path + '" data-num="1" type="number" inputmode="numeric" min="0" value="' + esc(val) + '" ' + (extra || '') + '>';
function denomRows(base, counts, out) {
  return Core.DENOMS.map((d) => '<div class="dn"><span>' + d[1] + '</span>' + inp(base + '.' + d[0], counts[d[0]] === undefined ? '' : counts[d[0]], 'placeholder="0"') + '<span style="text-align:right" data-out="' + out + d[0] + '">' + yen(d[0] * (+counts[d[0]] || 0)) + '</span></div>').join('');
}
const monthHead = (f) => '<div class="field"><div class="lbl">入力者（出納担当） <span class="req">必須</span></div><select data-bind="inputterId">' + staffOpts(f.inputterId) + '</select></div>' +
  '<div class="row"><div class="field"><div class="lbl">対象月 <span class="req">必須</span></div><select data-bind="targetMonth">' + monthOptions(f.targetMonth) + '</select></div><div class="field"><div class="lbl">作成日（月末）</div><div style="font-size:16px;font-weight:500;padding:2px 0">' + Core.monthEnd(f.targetMonth) + '</div></div></div>';
const monthTop = (f, title) => top(title, S.session.store.name + '（' + S.session.store.code + '） ／ 期限 ' + dlShort(Core.deadlineOf(f.targetMonth + '-15 00:00')), 'home');
const dateRows = (key, rows, max, l1) => rows.map((x, i) => '<div class="card" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end"><div><div class="lbl">' + l1 + '</div><input class="inp" type="date" data-path="data.' + key + '.' + i + '.date" value="' + esc(x.date) + '"></div><div><div class="lbl">金額（円）</div>' + inp('data.' + key + '.' + i + '.amount', x.amount) + '</div><button class="chip" data-act="delrow" data-key="' + key + '" data-i="' + i + '">削除</button></div>').join('');

const WD = ['日', '月', '火', '水', '木', '金', '土'];
function vFormUsage() {
  const f = S.form, u = Core.usageCalc(f.data, f.targetMonth), y = +f.targetMonth.slice(0, 4), m = +f.targetMonth.slice(5, 7);
  S.usageOpen = S.usageOpen || {};
  const days = u.days.map((x) => {
    const r = f.data.days[x.day], open = !!S.usageOpen[x.day], wd = new Date(y, m - 1, x.day).getDay();
    const groups = open ? u.layout.map((g) => '<div class="stack" style="gap:6px;border-top:1px solid var(--line);padding-top:8px"><div style="font-weight:700;font-size:13px">' + esc(g.name) + '　内訳</div><div class="grid2">' + g.items.map((m) => '<div><div class="lbl">' + esc(m.name) + '</div>' + inp('data.days.' + x.day + '.' + g.id + 'i.' + m.i, r[g.id + 'i'][m.i] === undefined ? '' : r[g.id + 'i'][m.i], 'placeholder="0"') + '</div>').join('') + '</div><div class="lbl">内訳の合計 <b data-out="us' + x.day + g.id + '">' + yen(x[g.id + 'Sum']) + '</b> ／ <span data-out="ud' + x.day + g.id + '">' + g.short + 'の内訳：' + (x.diffs[g.id] === 0 ? '一致 ✔' : '差 ' + signed(x.diffs[g.id])) + '</span></div></div>').join('') : '';
    return '<div class="card stack" style="gap:8px"><div style="display:flex;align-items:center;gap:8px"><b>' + x.day + '日（' + WD[wd] + '）</b><span data-out="uk' + x.day + '" style="font-weight:700">' + usageState(x) + '</span><span class="sp"></span><button class="chip' + (open ? ' on' : '') + '" data-act="usageopen" data-d="' + x.day + '">' + (open ? '内訳を閉じる' : '内訳を入力') + '</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' + u.layout.map((g) => '<div><div class="lbl">' + g.short + '（円）</div>' + inp('data.days.' + x.day + '.' + g.id, r[g.id], 'placeholder="0"') + '</div>').join('') + '</div>' + groups + '</div>';
  }).join('');
  return monthTop(f, '① 日次利用集計') + '<div class="wrap narrow stack">' + (f.returnReason ? '<div class="alert"><b>差戻しの理由：</b>' + esc(f.returnReason) + '</div>' : '') +
    '<div class="alert info"><b>毎日の入力：</b>その日の分を入力して「保存」を押すと、経理部がその日のうちに最新の状態を見られます。<b>月末：</b>1か月分がそろったら「月末の提出」を押し、店舗責任者が承認します（期限：翌月3日 9:00）。月を切り替える前に、保存してください。<br>日ごとに、レジのキー合計（ポイント・クーポン・売掛）を入力します。サイト別などの内訳を入力すると、合計と一致するかを自動で確認します（✔＝一致、×＝不一致、—＝入力なし）。利用がない日は空欄のままで構いません。</div>' + monthHead(f) + days +
    '<div class="card stack" style="gap:4px"><b>月の合計</b>' + u.layout.map((g) => '<div style="display:flex;justify-content:space-between"><span>' + esc(g.name) + '</span><b data-out="ut' + g.id + '">' + yen(u.tot[g.id]) + '</b></div>').join('') + '<div class="lbl">内訳が合わない日：<b data-out="ubad">' + (u.bad.length ? u.bad.join('日、') + '日' : 'なし') + '</b></div></div>' +
    '<div class="field" id="reasonBox" style="' + (u.bad.length ? '' : 'display:none') + '"><div class="lbl">内訳が合わない理由 <span class="req">必須</span></div><textarea data-bind="reason" placeholder="例：10日のぐるなび分の入力漏れ">' + esc(f.reason) + '</textarea></div></div>' + bar();
}
function vFormBill() {
  const f = S.form, b = f.data, st = S.session.store, dl = b.usageDate ? Core.deadlineOf(b.usageDate + ' 00:00') : '';
  const p = f.photos[Core.BILL_SLOT], img = p ? (p.dataUrl ? '<img src="' + esc(p.dataUrl) + '">' : '<img data-ref="' + esc(p.ref) + '">') : '';
  const fld = (label, path, val, req, extra) => '<div class="field"><div class="lbl">' + label + (req ? ' <span class="req">必須</span>' : '') + '</div>' + txt(path, val, extra).replace('class="inp"', 'class="inp" style="border:0;padding:2px 0"') + '</div>';
  const nf = (label, path, val, req) => '<div class="field"><div class="lbl">' + label + (req ? ' <span class="req">必須</span>' : '') + '</div>' + inp(path, val).replace('class="inp"', 'class="inp" style="border:0;padding:2px 0"') + '</div>';
  return top('④ 請求依頼票', st.name + '（' + st.code + '）' + (dl ? ' ／ 期限 ' + dlShort(dl) : ''), 'home') + '<div class="wrap narrow stack">' +
    (f.returnReason ? '<div class="alert"><b>差戻しの理由：</b>' + esc(f.returnReason) + '</div>' : '') +
    '<div class="alert info">お客様から「請求書で支払いたい」と頼まれたときに作成します。経理部が、この内容で請求書を発行します。</div>' +
    '<div class="field"><div class="lbl">入力者（担当名） <span class="req">必須</span></div><select data-bind="inputterId">' + staffOpts(f.inputterId) + '</select></div>' +
    '<div class="field"><div class="lbl">ご利用日 <span class="req">必須</span></div><input type="date" data-path="data.usageDate" value="' + esc(b.usageDate) + '"></div>' +
    '<div class="card stack" style="gap:8px"><b>請求先</b>' + fld('会社名', 'data.company', b.company, false, 'placeholder="個人の場合は空欄で可"') + fld('部署', 'data.dept', b.dept) + fld('役職', 'data.title', b.title) + fld('宛名（お名前）', 'data.addressee', b.addressee, false, 'placeholder="会社名か宛名のどちらかは必須"') +
    fld('郵便番号', 'data.zip', b.zip, true, 'inputmode="numeric" placeholder="556-0017"') + fld('宛先（住所）', 'data.address', b.address, true) + '<div class="row">' + fld('電話番号', 'data.tel', b.tel, false, 'type="tel" inputmode="tel"') + fld('FAX', 'data.fax', b.fax, false, 'type="tel" inputmode="tel"') + '</div></div>' +
    '<div class="card stack" style="gap:8px"><b>ご利用内容</b><div class="row">' + nf('お食事代金（円）', 'data.amount', b.amount, true) + nf('手数料（円）', 'data.fee', b.fee) + '</div>' +
    '<div class="row">' + nf('人数', 'data.headcount', b.headcount) + fld('レシートNo', 'data.receiptNo', b.receiptNo, true, 'inputmode="numeric"') + '</div>' +
    '<div class="field"><div class="lbl">備考</div><textarea style="min-height:60px" data-path="data.note">' + esc(b.note) + '</textarea></div></div>' +
    '<div><div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px;margin-bottom:6px">レシートの写真 <span class="req">必須</span></div><div class="photos"><label class="ph' + (p ? ' has' : '') + '">' + img + (p ? '<span class="cap">レシート（撮り直す）</span>' : 'レシート<br>＋ 撮影する') + '<input type="file" accept="image/*" capture="environment" data-photo="' + Core.BILL_SLOT + '"></label></div></div>' +
    '</div>' + bar();
}
function vFormCash() {
  const f = S.form, c = Core.cashCalc(f.data);
  const places = f.data.places.map((p, i) => '<div class="card stack" style="gap:6px"><div style="display:flex;align-items:baseline;gap:8px"><b>' + esc(p.name) + '</b><span class="lbl">' + (p.fixed > 0 ? '定額 ' + yen(p.fixed) : '定額は未設定') + '</span></div>' + denomRows('data.places.' + i + '.counts', p.counts, 'pr' + i + '-') +
    '<div style="display:flex;justify-content:space-between;font-weight:700"><span>合計</span><span data-out="pt' + i + '">' + yen(c.places[i].total) + '</span></div><div class="lbl" data-out="pd' + i + '">' + (p.fixed > 0 ? '定額との差 ' + signed(c.places[i].total - p.fixed) : '') + '</div></div>').join('');
  return monthTop(f, '⑦ 現金管理票') + '<div class="wrap narrow stack">' + (f.returnReason ? '<div class="alert"><b>差戻しの理由：</b>' + esc(f.returnReason) + '</div>' : '') +
    '<div class="alert info">毎月末日現在の現金を、保管場所ごとに金種で数えて入力してください。金種の合計が「レジ基本元金A＋つり銭準備金B」と一致する必要があります。</div>' + monthHead(f) + places +
    '<div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px">レジ基本元金 A</div>' +
    (c.fixedSum > 0 ? '<div class="card" style="display:flex;justify-content:space-between"><span>定額の合計</span><b data-out="A">' + yen(c.A) + '</b></div>' : '<div class="field"><div class="lbl">レジ基本元金A（円） <span class="req">必須</span>　※定額が未設定のため入力</div>' + inp('data.baseA', f.data.baseA).replace('class="inp"', 'class="inp" style="border:0;padding:2px 0"') + '</div><span data-out="A" hidden></span>') +
    '<div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px">つり銭準備金 B（売上金から抜いた日と金額・最大' + Core.RESERVE_MAX + '行）</div>' + dateRows('reserve', f.data.reserve, Core.RESERVE_MAX, '売上金から抜いた日') +
    '<button class="btn" data-act="addrow" data-key="reserve" ' + (f.data.reserve.length >= Core.RESERVE_MAX ? 'disabled' : '') + '>＋ 行を追加</button><div class="card" style="display:flex;justify-content:space-between"><span>B 計</span><b data-out="B">' + yen(c.B) + '</b></div>' +
    '<div class="card stack" style="gap:4px"><div style="display:flex;justify-content:space-between"><span>金種の合計</span><b data-out="sum">' + yen(c.cashTotal) + '</b></div><div style="display:flex;justify-content:space-between"><span>A＋B</span><b data-out="exp">' + yen(c.expected) + '</b></div><div class="alert info" style="margin-top:4px" data-out="diff">' + (c.diff === 0 ? '一致しています ✔' : 'A+Bと' + yen(Math.abs(c.diff)) + (c.diff > 0 ? '多い' : '少ない')) + '</div></div>' +
    '<div class="field" id="reasonBox" style="' + (c.diff !== 0 ? '' : 'display:none') + '"><div class="lbl">一致しない理由 <span class="req">必須</span></div><textarea data-bind="reason" placeholder="例：釣り銭の渡し間違いの可能性">' + esc(f.reason) + '</textarea></div>' +
    '<div class="lbl" style="font-weight:700;color:var(--ink);font-size:13px">元金とは別に、月末現在で手元にある銀行預入れ予定の売上金（最大' + Core.DEPOSIT_MAX + '行）</div>' + dateRows('deposits', f.data.deposits, Core.DEPOSIT_MAX, '売上日') +
    '<button class="btn" data-act="addrow" data-key="deposits" ' + (f.data.deposits.length >= Core.DEPOSIT_MAX ? 'disabled' : '') + '>＋ 行を追加</button><div class="card" style="display:flex;justify-content:space-between"><span>合計</span><b data-out="dep">' + yen(c.depTotal) + '</b></div></div>' + bar();
}
function vFormPetty() {
  const f = S.form, bk = Core.submittedOf(S.slips, { id: f.id, storeCode: S.session.store.code }, 'book', f.targetMonth), p = Core.pettyCalc(f.data, bk);
  const msg = p.bookBalance == null ? '⑨が未提出のため照合できません' : p.diff === 0 ? '出納帳の残高と一致しています ✔' : '出納帳の残高と' + yen(Math.abs(p.diff)) + (p.diff > 0 ? '多い' : '少ない');
  return monthTop(f, '⑧ 小口現金管理票') + '<div class="wrap narrow stack">' + (f.returnReason ? '<div class="alert"><b>差戻しの理由：</b>' + esc(f.returnReason) + '</div>' : '') +
    '<div class="alert info">毎月末日に作成します。合計が、金銭出納帳（⑨）の残高と一致する必要があります。出納帳のコピーは不要です（⑨の内容で照合します）。</div>' + monthHead(f) +
    '<div class="card stack" style="gap:6px"><b>金種</b>' + denomRows('data.counts', f.data.counts, 'pr-') + '<div style="display:flex;justify-content:space-between;font-weight:700"><span>小計</span><span data-out="sub">' + yen(p.subtotal) + '</span></div></div>' +
    '<div class="field"><div class="lbl">預金残高（円）</div>' + inp('data.bank', f.data.bank).replace('class="inp"', 'class="inp" style="border:0;padding:2px 0"') + '</div>' +
    '<div class="card stack" style="gap:4px"><div style="display:flex;justify-content:space-between"><span>合計（小計＋預金残高）</span><b data-out="tot">' + yen(p.total) + '</b></div><div style="display:flex;justify-content:space-between"><span>⑨ 出納帳の月末残高</span><b>' + (p.bookBalance == null ? '—' : yen(p.bookBalance)) + '</b></div><div class="alert info" style="margin-top:4px" data-out="pdiff">' + msg + '</div></div>' +
    '<div class="field" id="reasonBox" style="' + (p.bookBalance == null || p.diff !== 0 ? '' : 'display:none') + '"><div class="lbl">理由 <span class="req">必須</span>（出納帳と一致しない、または⑨が未提出のとき）</div><textarea data-bind="reason">' + esc(f.reason) + '</textarea></div></div>' + bar();
}
function vFormBook() {
  const f = S.form, b = Core.bookCalc(f.data), prev = prevBookOf(f), st = S.session;
  const rows = f.data.rows.map((r, i) => {
    const ph = r.photo ? (r.photo.dataUrl ? '<img src="' + esc(r.photo.dataUrl) + '">' : '<img data-ref="' + esc(r.photo.ref) + '">') : '';
    return '<div class="card stack" style="gap:8px"><div style="display:flex;align-items:center;gap:8px"><b>' + (i + 1) + '行目</b><span class="lbl" data-out="rb' + i + '">残高 ' + yen(b.rows[i].balance) + '</span><span class="sp"></span><button class="chip" data-act="delbook" data-i="' + i + '">削除</button></div>' +
      '<div class="row"><div><div class="lbl">日 <span class="req">必須</span></div>' + inp('data.rows.' + i + '.day', r.day, 'max="31"') + '</div><div><div class="lbl">科目 <span class="req">必須</span></div><select class="inp" data-path="data.rows.' + i + '.account"><option value="">選択</option>' + st.masters.accounts.map((a) => '<option' + (a === r.account ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select></div></div>' +
      '<div><div class="lbl">摘要 <span class="req">必須</span>（定型文＋自由入力）</div><select class="inp" data-path="data.rows.' + i + '.phrase"><option value="">定型文を選ぶ（なしでも可）</option>' + st.masters.phrases.map((a) => '<option' + (a === r.phrase ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select><input class="inp" style="margin-top:6px" data-path="data.rows.' + i + '.note" value="' + esc(r.note) + '" placeholder="例：アスクル　プリンターインク"></div>' +
      '<div class="row"><div><div class="lbl">収入（円）</div>' + inp('data.rows.' + i + '.income', r.income) + '</div><div><div class="lbl">支出（円）</div>' + inp('data.rows.' + i + '.expense', r.expense) + '</div></div>' +
      '<div><div class="lbl">負担店舗 <span class="req">必須</span></div><select class="inp" data-path="data.rows.' + i + '.burden">' + st.stores.map((s) => '<option value="' + s.code + '"' + (s.code === r.burden ? ' selected' : '') + '>' + esc(s.code + ' ' + s.name) + '</option>').join('') + '</select></div>' +
      '<label class="ph' + (r.photo ? ' has' : '') + '" style="height:' + (r.photo ? 120 : 52) + 'px">' + ph + (r.photo ? '<span class="cap">領収書（撮り直す）</span>' : '＋ 領収書を撮影（任意）') + '<input type="file" accept="image/*" capture="environment" data-rphoto="' + i + '"></label></div>';
  }).join('');
  return monthTop(f, '⑨ 金銭出納帳') + '<div class="wrap narrow stack">' + (f.returnReason ? '<div class="alert"><b>差戻しの理由：</b>' + esc(f.returnReason) + '</div>' : '') +
    '<div class="alert info">現金の入出金を1行ずつ入力します。残高は自動で計算されます。領収書の写真は行ごとに添付できます（必須ではありません）。</div>' + monthHead(f) +
    (prev ? '<div class="card" style="display:flex;justify-content:space-between"><span>前月繰越（前月の残高から自動）</span><b data-out="bcarry">' + yen(b.carryOver) + '</b></div>' : '<div class="field"><div class="lbl">前月繰越（円） <span class="req">必須</span>　※前月の出納帳が登録されていないため入力</div>' + inp('data.carryOver', f.data.carryOver).replace('class="inp"', 'class="inp" style="border:0;padding:2px 0"') + '</div><span data-out="bcarry" hidden></span>') +
    rows + '<button class="btn" data-act="addbook" ' + (f.data.rows.length >= Core.BOOK_MAX ? 'disabled' : '') + '>＋ 行を追加（' + f.data.rows.length + ' / ' + Core.BOOK_MAX + '行）</button>' +
    '<div class="card stack" style="gap:4px"><div style="display:flex;justify-content:space-between"><span>当月 収入計</span><b data-out="bin">' + yen(b.income) + '</b></div><div style="display:flex;justify-content:space-between"><span>当月 支出計</span><b data-out="bout">' + yen(b.expense) + '</b></div><div style="display:flex;justify-content:space-between"><b>月末残高</b><b data-out="bclose">' + yen(b.closing) + '</b></div></div></div>' + bar();
}

// ---------- 経理部：月末の提出状況（全店×3様式） ----------
function vMatrix() {
  const ses = S.session, m = S.matrixMonth || Core.prevMonth(Core.fmt(new Date()).slice(0, 7)), n = nowStr();
  const months = []; for (let i = 0, x = Core.fmt(new Date()).slice(0, 7); i < 4; i++, x = Core.prevMonth(x)) months.push(x);
  const dl = Core.deadlineOf(m + '-15 00:00');
  const stores = ses.stores.filter((s) => (s.status || '営業中') !== '閉店');
  const need = (s, f) => !(f === 'cash' && !Core.cashPlacesFor(s).length); // キッチンカー等は現金管理票が不要
  const cell = (s, f) => {
    if (!need(s, f)) return '<td style="color:var(--grey)">対象外</td>';
    const x = S.slips.filter((z) => z.storeCode === s.code && Core.formOf(z) === f && z.targetMonth === m && z.status !== 'draft').sort((a, b) => (a.status === 'returned') - (b.status === 'returned'))[0];
    const dr = !x && f === 'usage' ? S.slips.filter((z) => z.storeCode === s.code && Core.formOf(z) === 'usage' && z.targetMonth === m && z.status === 'draft')[0] : null;
    if (dr) return '<td><span class="badge" data-act="pickm" data-id="' + esc(dr.id) + '" style="cursor:pointer">入力中 ' + Core.usageCalc(dr.data, m).entered + '日分</span>' + (n > dl ? ' <span class="badge b-over">未提出・期限超過</span>' : '') + '<div class="lbl">' + esc(short(dr.savedAt || '')) + ' 保存</div></td>';
    if (!x) return '<td>' + (n > dl ? '<span class="badge b-over">未提出・期限超過</span>' : '<span class="badge">未提出</span>') + '</td>';
    return '<td><span class="badge b-' + x.status + '" data-act="pickm" data-id="' + esc(x.id) + '" style="cursor:pointer">' + esc(stName(x.status)) + '</span>' + overBadge(x) + '</td>';
  };
  let done = 0; const body = stores.map((s) => { const cs = Core.MONTH_FORMS.map((f) => cell(s, f)); const ok = Core.MONTH_FORMS.every((f) => !need(s, f) || S.slips.some((z) => z.storeCode === s.code && Core.formOf(z) === f && z.targetMonth === m && ['pending', 'received', 'confirmed'].indexOf(z.status) >= 0)); if (ok) done++; return '<tr><td>' + esc(s.code + ' ' + s.name) + '</td>' + cs.join('') + '</tr>'; }).join('');
  return '<div class="stack"><div class="row"><div class="field"><div class="lbl">対象月</div><select data-filter="matrixMonth">' + months.map((x) => '<option value="' + x + '"' + (x === m ? ' selected' : '') + '>' + monthLabel(x) + '</option>').join('') + '</select></div><div class="card"><div class="lbl">月末の提出物（①⑦⑧⑨）がそろった店舗　期限：' + dlShort(dl) + '</div><div style="font-size:22px;font-weight:700">' + done + ' / ' + stores.length + '</div></div></div>' +
    '<div class="tl"><table><thead><tr><th>店舗</th>' + Core.MONTH_FORMS.map((x) => '<th>' + Core.FORMS[x].no + ' ' + Core.FORMS[x].name + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div><div class="lbl">対象は直営店のみ（閉店店舗は対象外）。状態をタップすると、受付箱で内容を開きます。</div></div>';
}

function readImage(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)); const w = Math.round(img.width * k), h = Math.round(img.height * k); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', 0.72)); }; img.onerror = rej; img.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function formPayload() {
  const f = S.form;
  if (Core.MONTH_FORMS.indexOf(f.form) >= 0) {
    const out = { id: f.id, form: f.form, inputterId: f.inputterId, targetMonth: f.targetMonth, reason: f.reason, data: JSON.parse(JSON.stringify(f.data)) };
    if (f.form === 'usage') {
      Object.keys(out.data.days).forEach((n) => { const r = out.data.days[n]; if (!Core.usageCalc({ days: { 1: r } }, '2026-01').days[0].has) delete out.data.days[n]; });
    }
    if (f.form === 'book') {
      out.photos = f.data.rows.filter((r) => r.photo).map((r) => Object.assign({ slot: r.sid }, r.photo));
      out.data.rows.forEach((r) => { delete r.photo; });
    }
    return out;
  }
  if (f.form === 'bill') return { id: f.id, form: 'bill', inputterId: f.inputterId, data: JSON.parse(JSON.stringify(f.data)), photos: Object.keys(f.photos).map((k) => Object.assign({ slot: k }, f.photos[k])) };
  if (f.form === 'late') return { id: f.id, form: 'late', inputterId: f.inputterId, depositDate: f.depositDate, items: f.items, reason: f.reason };
  if (f.form === 'pos') return { id: f.id, form: 'pos', inputterId: f.inputterId, reportType: f.reportType, targetMonth: f.targetMonth, items: f.items };
  const c = Core.category(f.category);
  const photos = c ? Core.allSlots(c).filter((l) => f.photos[l]).map((l) => Object.assign({ slot: l }, f.photos[l])) : [];
  return { id: f.id, form: 'void', occurredAt: f.occurredAt, inputterId: f.inputterId, registerId: f.registerId, category: f.category, reason: f.reason, photos: photos };
}
async function saveForm(submitNow) {
  if (S.busy) return;
  const input = formPayload();
  if (submitNow) {
    const names = {}; S.session.staff.forEach((x) => (names[x.id] = x.name));
    const tmp = Core.applyInput({ id: input.id, form: input.form, storeCode: S.session.store.code, createdAt: nowStr() }, Object.assign({}, input, { photos: (input.photos || []).map((p) => ({ slot: p.slot, ref: p.ref || p.dataUrl })) }), names);
    const errs = Core.checkSubmit(tmp, S.slips);
    if (errs.length) { modal('<h2>提出の前に、次を確認してください</h2><div class="alert">' + errs.map(esc).join('<br>') + '</div><button class="btn pri" data-act="ovclose">閉じる</button>'); return; }
  }
  S.busy = true; render();
  const r = await api.save(code(), input, submitNow); S.busy = false;
  if (!r.ok) { render(); modal('<h2>保存できませんでした</h2><div class="alert">' + esc(r.error).replace(/\n/g, '<br>') + '</div><button class="btn pri" data-act="ovclose">閉じる</button>'); return; }
  await refresh();
  if (submitNow) go('done', { done: r.slip });
  else { S.form = formFromSlip(r.slip); toast(S.form.form === 'usage' ? '保存しました。経理部も最新の内容を見られます' : '下書きを保存しました'); render(); }
}
function vDone() {
  const s = S.done;
  return top('提出しました', S.session.store.name, null) + '<div class="wrap narrow stack"><div class="card stack"><h2>承認待ちに送りました</h2><div class="kv"><div class="k">伝票番号</div><div>' + esc(s.id) + '</div><div class="k">様式</div><div>' + esc(Core.title(s)) + '</div>' + (s.deadline ? '<div class="k">提出期限</div><div>' + dlShort(s.deadline) + '</div>' : '') + '</div>' +
    '<div class="alert info">次は、店舗責任者の方が「承認する」から承認してください。承認されると経理部の受付箱に届きます。</div></div>' +
    '<button class="btn pri" data-act="approvals">承認画面へ</button><button class="btn" data-act="home">ホームへ戻る</button></div>';
}

// ---------- 伝票の詳細（共通） ----------
function denomTable(counts) {
  return '<table><thead><tr><th>金種</th><th style="text-align:right">枚数</th><th style="text-align:right">金額</th></tr></thead><tbody>' + Core.DENOMS.filter((d) => +counts[d[0]] > 0).map((d) => '<tr><td>' + d[1] + '</td><td style="text-align:right">' + counts[d[0]] + '</td><td style="text-align:right">' + yen(d[0] * counts[d[0]]) + '</td></tr>').join('') + '<tr><td colspan="2"><b>合計</b></td><td style="text-align:right"><b>' + yen(Core.countsTotal(counts)) + '</b></td></tr></tbody></table>';
}
function usageDetail(s) {
  const d = s.data || {}, u = Core.usageCalc(d, s.targetMonth), G = u.layout;
  const ck = (x, g) => (x[g.id + 'Sum'] === x[g.id] ? '✔' : '<b style="color:var(--red)">×</b>');
  const head = '<tr><th>日</th>' + G.map((g) => '<th>' + esc(g.short) + '計</th>' + g.items.map((m) => '<th>' + esc(m.name) + '</th>').join('') + '<th>内訳計</th><th>確認</th>').join('') + '</tr>';
  const body = u.days.filter((x) => x.has).map((x) => { const r = (d.days || {})[x.day] || {}; return '<tr><td>' + x.day + '</td>' + G.map((g) => '<td style="text-align:right">' + (x[g.id] || '') + '</td>' + g.items.map((m) => '<td style="text-align:right">' + ((r[g.id + 'i'] || {})[m.i] || '') + '</td>').join('') + '<td style="text-align:right">' + (x[g.id + 'Sum'] || '') + '</td><td>' + ck(x, g) + '</td>').join('') + '</tr>'; }).join('');
  const foot = '<tr><td><b>計</b></td>' + G.map((g) => '<td style="text-align:right"><b>' + u.tot[g.id] + '</b></td>' + u.itemTot[g.id].map((v) => '<td style="text-align:right"><b>' + v + '</b></td>').join('') + '<td style="text-align:right"><b>' + u.itemTot[g.id].reduce((a, b) => a + b, 0) + '</b></td><td></td>').join('') + '</tr>';
  return '<div class="kv"><div class="k">対象月</div><div>' + esc(monthLabel(s.targetMonth)) + (s.status === 'draft' ? '（入力中：' + u.entered + '日分・最終保存 ' + esc(short(s.savedAt || '')) + '）' : '') + '</div>' + G.map((g) => '<div class="k">' + esc(g.name) + '</div><div>' + yen(u.tot[g.id]) + '</div>').join('') + '<div class="k">照合</div><div>' + (u.bad.length ? '<b style="color:var(--red)">' + u.bad.join('日、') + '日 が不一致</b>' : '内訳はすべて一致 ✔') + '</div>' + (s.reason ? '<div class="k">理由</div><div style="white-space:pre-wrap">' + esc(s.reason) + '</div>' : '') + '</div>' +
    '<div class="tl"><table><thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="30">入力のある日はありません</td></tr>') + foot + '</tbody></table></div>';
}
function billDetail(s) {
  const b = s.data || {}, ph = (s.photos || []).map((p) => '<div class="ph has" data-act="zoom" data-ref="' + esc(p.ref) + '"><img data-ref="' + esc(p.ref) + '"><span class="cap">' + esc(p.slot) + '</span></div>').join('');
  const row = (k, v) => '<div class="k">' + k + '</div><div style="white-space:pre-wrap">' + esc(v) + '</div>';
  return '<div class="kv">' + row('ご利用日', b.usageDate) + row('会社名', b.company) + row('部署／役職', [b.dept, b.title].filter(String).join(' ／ ')) + row('宛名', b.addressee) + row('郵便番号', b.zip) + row('宛先', b.address) + row('電話／FAX', [b.tel, b.fax].filter(String).join(' ／ ')) +
    row('お食事代金', yen(b.amount)) + row('手数料', b.fee === '' || b.fee == null ? '' : yen(b.fee)) + row('人数', b.headcount === '' || b.headcount == null ? '' : b.headcount + '名') + row('レシートNo', b.receiptNo) + row('備考', b.note) + '</div><div class="photos">' + ph + '</div>';
}
function monthItemsHtml(s) {
  if (Core.formOf(s) === 'usage') return usageDetail(s);
  const f = Core.formOf(s), d = s.data || {}, head = '<div class="kv"><div class="k">対象月</div><div>' + esc(monthLabel(s.targetMonth)) + '（' + esc(Core.monthEnd(s.targetMonth)) + ' 現在）</div></div>';
  if (f === 'cash') {
    const c = Core.cashCalc(d);
    return head + c.places.map((p) => '<div class="stack" style="gap:4px"><b>' + esc(p.name) + (p.fixed > 0 ? '（定額 ' + yen(p.fixed) + '）' : '') + '</b>' + denomTable(p.counts || {}) + '</div>').join('') +
      '<div class="kv"><div class="k">金種の合計</div><div>' + yen(c.cashTotal) + '</div><div class="k">A（基本元金）</div><div>' + yen(c.A) + '</div><div class="k">B（つり銭準備金）</div><div>' + yen(c.B) + (c.B ? '（' + (d.reserve || []).map((x) => x.date.slice(5) + ' ' + yen(x.amount)).join('、') + '）' : '') + '</div><div class="k">A＋B</div><div>' + yen(c.expected) + '</div><div class="k">照合</div><div>' + (c.diff === 0 ? '一致 ✔' : '<b style="color:var(--red)">差 ' + signed(c.diff) + '</b>') + '</div>' + (s.reason ? '<div class="k">理由</div><div style="white-space:pre-wrap">' + esc(s.reason) + '</div>' : '') + '</div>' +
      '<div class="lbl" style="font-weight:700;color:var(--ink)">銀行預入れ予定の売上金</div>' + ((d.deposits || []).length ? '<table><tbody>' + d.deposits.map((x) => '<tr><td>' + esc(x.date) + ' 分</td><td style="text-align:right">' + yen(x.amount) + '</td></tr>').join('') + '<tr><td><b>合計</b></td><td style="text-align:right"><b>' + yen(c.depTotal) + '</b></td></tr></tbody></table>' : '<div class="lbl">なし</div>');
  }
  if (f === 'petty') {
    const p = Core.pettyCalc(d, null), bb = d.bookBalance;
    return head + denomTable(d.counts || {}) + '<div class="kv"><div class="k">預金残高</div><div>' + yen(p.bank) + '</div><div class="k">合計</div><div>' + yen(p.total) + '</div><div class="k">⑨ 出納帳の残高</div><div>' + (bb == null || bb === '' ? '—（提出時に⑨が未提出）' : yen(bb)) + '</div><div class="k">照合</div><div>' + (s.diff === 0 ? '一致 ✔' : s.diff === '' || s.diff == null ? '照合なし' : '<b style="color:var(--red)">差 ' + signed(s.diff) + '</b>') + '</div>' + (s.reason ? '<div class="k">理由</div><div style="white-space:pre-wrap">' + esc(s.reason) + '</div>' : '') + '</div>';
  }
  const b = Core.bookCalc(d), ph = {}; (s.photos || []).forEach((p) => (ph[p.slot] = p.ref));
  const st = (S.session && S.session.stores) || [], nm = (c) => (st.filter((x) => x.code === c)[0] || { name: '' }).name;
  return head + '<div class="kv"><div class="k">前月繰越</div><div>' + yen(b.carryOver) + '</div><div class="k">収入計</div><div>' + yen(b.income) + '</div><div class="k">支出計</div><div>' + yen(b.expense) + '</div><div class="k">月末残高</div><div><b>' + yen(b.closing) + '</b></div></div>' +
    '<div class="tl"><table><thead><tr><th>日</th><th>摘要</th><th style="text-align:right">収入</th><th style="text-align:right">支出</th><th style="text-align:right">残高</th><th>負担店舗</th><th>科目</th><th>領収書</th></tr></thead><tbody>' +
    b.rows.map((r) => '<tr><td>' + esc(r.day) + '</td><td style="white-space:normal;min-width:150px">' + esc([r.phrase, r.note].filter(String).join(' ')) + '</td><td style="text-align:right">' + (num0(r.income) ? yen(r.income) : '') + '</td><td style="text-align:right">' + (num0(r.expense) ? yen(r.expense) : '') + '</td><td style="text-align:right;' + (r.balance < 0 ? 'color:var(--red)' : '') + '">' + yen(r.balance) + '</td><td>' + esc(r.burden + ' ' + nm(r.burden)) + '</td><td>' + esc(r.account) + '</td><td>' + (ph[r.sid] ? '<button class="chip" data-act="zoom" data-ref="' + esc(ph[r.sid]) + '">見る</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>';
}
const num0 = (v) => +v || 0;
function itemsHtml(s) {
  const f = Core.formOf(s);
  if (Core.MONTH_FORMS.indexOf(f) >= 0) return monthItemsHtml(s);
  if (f === 'bill') return billDetail(s);
  if (f === 'late') return '<div class="kv"><div class="k">預け入れ日</div><div>' + esc(s.depositDate) + '</div></div><table><thead><tr><th>売上日</th><th>金額</th></tr></thead><tbody>' + (s.items || []).map((x) => '<tr><td>' + esc(x.salesDate) + '</td><td style="text-align:right">' + Number(x.amount).toLocaleString('ja-JP') + ' 円</td></tr>').join('') + '<tr><td><b>合計</b></td><td style="text-align:right"><b>' + (s.total || 0).toLocaleString('ja-JP') + ' 円</b></td></tr></tbody></table><div class="kv"><div class="k">遅滞理由</div><div style="white-space:pre-wrap">' + esc(s.reason) + '</div></div>';
  if (f === 'pos') {
    const car = Core.carriedRows(S.slips, s).map((x) => Object.assign({ car: true }, x)), all = car.concat((s.items || []).map((x) => Object.assign({ from: '今回' }, x)));
    return '<div class="kv"><div class="k">対象月</div><div>' + esc(monthLabel(s.targetMonth)) + '</div><div class="k">報告区分</div><div>' + esc(s.reportName) + '</div><div class="k">修正依頼日</div><div>' + esc(s.occurredAt.slice(0, 10)) + '</div></div><div class="tl"><table><thead><tr><th>#</th><th>報告</th><th>レシート日時</th><th>No</th><th>修正内容</th><th>依頼者</th></tr></thead><tbody>' + all.map((x, i) => '<tr' + (x.car ? ' style="color:var(--sub)"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(x.from) + '</td><td>' + short(x.receiptAt) + '</td><td>' + esc(x.receiptNo) + '</td><td style="white-space:normal;min-width:160px">' + esc(x.content) + '</td><td>' + esc(x.requesterName) + '</td></tr>').join('') + '</tbody></table></div>' + (car.length ? '<div class="lbl">灰色の行は、10日・20日の中間報告で報告済みの行です。</div>' : '');
  }
  const photos = (s.photos || []).map((p) => '<div class="ph has" data-act="zoom" data-ref="' + esc(p.ref) + '"><img data-ref="' + esc(p.ref) + '"><span class="cap">' + esc(p.slot) + '</span></div>').join('');
  return '<div class="kv"><div class="k">発生日時</div><div>' + short(s.occurredAt) + '</div><div class="k">レジ担当者</div><div>' + esc(s.registerName) + '</div><div class="k">事由</div><div style="white-space:pre-wrap">' + esc(s.reason) + '</div></div><div class="photos">' + photos + '</div>';
}
function detailHtml(s) {
  return '<div class="stack"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h2>' + esc(Core.title(s)) + '</h2>' + badgeS(s) + overBadge(s) + '</div>' +
    (s.status === 'returned' ? '<div class="alert"><b>差戻し：</b>' + esc(s.returnReason) + '<br><span style="font-size:12px">' + esc(s.returnedBy || '') + ' ' + short(s.returnedAt || '') + '</span></div>' : '') +
    '<div class="kv"><div class="k">伝票番号</div><div>' + esc(s.id) + '</div><div class="k">店舗</div><div>' + esc(s.storeName) + '（' + esc(s.storeCode) + '）</div><div class="k">入力者</div><div>' + esc(s.inputterName) + (s.submittedAt ? '（' + short(s.submittedAt) + ' 提出・第' + s.rev + '版）' : '') + '</div>' +
    (s.approvedAt ? '<div class="k">承認</div><div>' + esc(s.approverName) + '（' + short(s.approvedAt) + '）</div>' : '') +
    (s.confirmedAt ? '<div class="k">経理確認</div><div>' + esc(s.confirmedBy) + '（' + short(s.confirmedAt) + '）</div>' : '') +
    (s.deadline ? '<div class="k">提出期限</div><div>' + dlShort(s.deadline) + '</div>' : '') + '</div>' +
    itemsHtml(s) +
    '<div><div class="lbl" style="font-weight:700;color:var(--ink)">経過の記録（上書きせず、すべて残ります）</div><div class="hist" id="hist-' + esc(s.id) + '">読み込み中…</div></div></div>';
}
async function loadHistory() {
  const el = document.querySelector('[id^="hist-"]'); if (!el) return;
  const id = el.id.slice(5); const r = await api.history(code(), id);
  const e2 = document.getElementById('hist-' + id); if (!e2 || !r.ok) return;
  const L = { submit: '提出', approve: '承認', return: '差戻し', confirm: '確認済み' };
  e2.innerHTML = r.history.map((h) => '<div><b>' + (L[h.action] || h.action) + '</b> ' + short(h.at) + ' ／ ' + esc(h.actor) + (h.action === 'return' ? '<br>理由：' + esc(h.note) : '') + '</div>').join('') || '記録はまだありません';
}
const byId = (id) => S.slips.filter((s) => s.id === id)[0];

// ---------- 提出履歴 ----------
function vMyList() {
  const f = S.filter.q;
  const items = S.slips.filter((s) => f === 'all' || s.status === f);
  const chips = [['all', 'すべて'], ['draft', '下書き'], ['returned', '差戻し'], ['pending', '承認待ち'], ['received', '受付'], ['confirmed', '確認済み']];
  const sel = S.sel ? byId(S.sel) : null;
  let act = '';
  if (sel && Core.can.edit(sel) && !S.session.readOnly) act = '<button class="btn pri" data-act="edit" data-id="' + esc(sel.id) + '">' + (sel.status === 'returned' ? '直して再提出する' : '続きを入力する') + '</button>';
  return top('提出した伝票', S.session.store.name + '（' + S.session.store.code + '）', 'home') + '<div class="wrap"><div class="stack"><div class="chips">' + chips.map((c) => '<button class="chip' + (f === c[0] ? ' on' : '') + '" data-act="qf" data-v="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
    '<div class="split' + (sel ? ' has-sel' : '') + '"><div class="list pane-list">' + (items.map((s) => '<div class="item' + (s.id === S.sel ? ' sel' : '') + '" data-act="pick" data-id="' + esc(s.id) + '"><div class="a"><span class="t">' + esc(Core.title(s)) + '</span><span>' + badgeS(s) + overBadge(s) + '</span></div><div class="m">' + when(s) + ' ／ ' + esc(Core.summary(s)) + '</div></div>').join('') || '<div class="alert info">該当する伝票はありません</div>') + '</div>' +
    '<div class="pane-detail' + (sel ? ' on' : '') + '">' + (sel ? '<div class="card stack"><button class="chip hide-wide" style="align-self:flex-start" data-act="unpick">‹ 一覧に戻る</button>' + detailHtml(sel) + act + '</div>' : '<div class="alert info">左の一覧から伝票を選んでください</div>') + '</div></div></div></div>';
}

// ---------- 承認（店舗責任者） ----------
function vApprovals() {
  const items = S.slips.filter((s) => s.status === 'pending');
  const sel = S.sel && items.filter((s) => s.id === S.sel)[0];
  const done = S.approvedFlash;
  return top('承認（店舗責任者）', S.session.store.name + '（' + S.session.store.code + '）', 'home') + '<div class="wrap"><div class="stack">' +
    (done ? '<div class="alert info">✔ ' + esc(done) + '</div>' : '') +
    '<div class="split' + (sel ? ' has-sel' : '') + '"><div class="list pane-list"><div style="font-weight:700">承認待ち ' + items.length + '件</div>' + (items.map((s) => '<div class="item' + (s.id === S.sel ? ' sel' : '') + '" data-act="pick" data-id="' + esc(s.id) + '"><div class="a"><span class="t">' + esc(Core.title(s)) + '</span>' + overBadge(s) + '</div><div class="m">' + when(s) + ' ／ 入力者：' + esc(s.inputterName) + '</div></div>').join('') || '<div class="alert info">承認待ちはありません</div>') + '</div>' +
    '<div class="pane-detail' + (sel ? ' on' : '') + '">' + (sel ? '<div class="card stack"><button class="chip hide-wide" style="align-self:flex-start" data-act="unpick">‹ 一覧に戻る</button>' + detailHtml(sel) +
      '<div class="alert info">承認すると、承認者と日時を記録します。押印は不要です。</div>' +
      '<div class="field"><div class="lbl">承認者（店舗責任者）<span class="req"> 必須</span></div><select id="apprSel">' + staffOpts('', true) + '</select></div>' +
      '<div class="row"><button class="btn" data-act="reject" data-id="' + esc(sel.id) + '">差戻す（理由を入力）</button><button class="btn pri" data-act="approve" data-id="' + esc(sel.id) + '">承認する</button></div></div>' : '<div class="alert info">左の一覧から伝票を選んでください</div>') + '</div></div></div></div>';
}

// ---------- 経理部の受付箱 ----------
function accRows() {
  const f = S.filter;
  return S.slips.filter((s) => (f.status === 'all' || s.status === f.status) && (f.form === 'all' || Core.formOf(s) === f.form) && (!f.store || s.storeCode === f.store) && (!f.month || s.occurredAt.slice(0, 7) === f.month) && (!f.over || (Core.isOverdue(s, nowStr()) && s.status !== 'confirmed')))
    .filter(showAcc);
}
function vAcc() {
  const ses = S.session, canEdit = ses.role === 'accounting', f = S.filter;
  const tabs = '<div class="chips"><button class="chip' + (S.accView !== 'matrix' ? ' on' : '') + '" data-act="accview" data-v="inbox">受付箱</button><button class="chip' + (S.accView === 'matrix' ? ' on' : '') + '" data-act="accview" data-v="matrix">月末の提出状況（全店）</button></div>';
  if (S.accView === 'matrix') return top('経理部 受付箱', ses.name + '（' + (canEdit ? '閲覧・編集' : '閲覧のみ') + '）', null) + '<div class="wrap stack">' + tabs + vMatrix() + '</div>';
  const all = S.slips.filter(showAcc), cnt = (st) => all.filter((s) => s.status === st).length;
  const over = all.filter((s) => Core.isOverdue(s, nowStr()) && s.status !== 'confirmed').length;
  const rows = accRows(), sel = S.sel ? byId(S.sel) : null;
  const months = Array.from(new Set(all.map((s) => s.occurredAt.slice(0, 7)))).sort().reverse();
  const chips = [['all', 'すべて'], ['received', '受付'], ['confirmed', '確認済み'], ['pending', '承認待ち'], ['returned', '差戻し'], ['draft', '入力中（①）']];
  const exp = sel ? '<div class="row"><button class="btn" data-act="xlsx" data-id="' + esc(sel.id) + '">Excelで保存</button><button class="btn" data-act="pdf" data-id="' + esc(sel.id) + '">PDFで保存（印刷）</button></div>' : '';
  const act = exp + (sel && canEdit && sel.status === 'received' ? '<div class="row"><button class="btn" data-act="accreturn" data-id="' + esc(sel.id) + '">差戻す（理由を入力）</button><button class="btn ok" data-act="accconfirm" data-id="' + esc(sel.id) + '">確認済みにする</button></div>' : (sel && !canEdit ? '<div class="alert info">閲覧のみのIDです（確認・差戻しはできません。Excel・PDFの出力はできます）。</div>' : ''));
  return top('経理部 受付箱', ses.name + '（' + (canEdit ? '閲覧・編集' : '閲覧のみ') + '）', null) + '<div class="wrap stack">' + tabs +
    '<div class="sum"><div class="card"><div class="n" style="color:var(--blue)">' + cnt('received') + '</div><div class="l">受付（確認待ち）</div></div><div class="card"><div class="n" style="color:var(--warn)">' + cnt('pending') + '</div><div class="l">承認待ち（店舗）</div></div><div class="card"><div class="n" style="color:var(--red)">' + cnt('returned') + '</div><div class="l">差戻し中</div></div><div class="card"><div class="n" style="color:var(--ok)">' + cnt('confirmed') + '</div><div class="l">確認済み</div></div><div class="card"><div class="n" style="color:var(--red)">' + over + '</div><div class="l">期限超過</div></div></div>' +
    '<div class="chips">' + [['all', '全様式'], ['usage', '① 日次利用'], ['void', '② 誤打伝票'], ['bill', '④ 請求依頼'], ['late', '⑤ 遅滞報告'], ['pos', '⑥ POS修正'], ['cash', '⑦ 現金管理票'], ['petty', '⑧ 小口現金'], ['book', '⑨ 出納帳']].map((c) => '<button class="chip' + (f.form === c[0] ? ' on' : '') + '" data-act="accform" data-v="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
    '<div class="chips">' + chips.map((c) => '<button class="chip' + (f.status === c[0] ? ' on' : '') + '" data-act="accf" data-v="' + c[0] + '">' + c[1] + '</button>').join('') + '<button class="chip' + (f.over ? ' on' : '') + '" data-act="accover">期限超過のみ</button></div>' +
    '<div class="row"><div class="field"><div class="lbl">店舗</div><select data-filter="store"><option value="">すべての店舗</option>' + ses.stores.map((s) => '<option value="' + s.code + '"' + (f.store === s.code ? ' selected' : '') + '>' + esc(s.code + ' ' + s.name) + '</option>').join('') + '</select></div><div class="field"><div class="lbl">発生月</div><select data-filter="month"><option value="">すべて</option>' + months.map((m) => '<option' + (f.month === m ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></div><button class="btn sm" style="flex:0 0 auto;align-self:end" data-act="xlsxlist">一覧をExcelで保存</button></div>' +
    '<div class="split wide' + (sel ? ' has-sel' : '') + '"><div class="pane-list"><div class="tl"><table><thead><tr><th>状態</th><th>様式</th><th>店舗</th><th>日付</th><th>内容</th><th>承認</th></tr></thead><tbody>' +
    (rows.map((s) => '<tr class="row-i' + (s.id === S.sel ? ' sel' : '') + '" data-act="pick" data-id="' + esc(s.id) + '"><td>' + badgeS(s) + overBadge(s) + '</td><td>' + esc(Core.title(s)) + '</td><td>' + esc(s.storeCode + ' ' + s.storeName) + '</td><td>' + when(s) + '</td><td>' + esc(Core.summary(s)) + '</td><td>' + (s.approvedAt ? esc(s.approverName) + ' ' + short(s.approvedAt) : '—') + '</td></tr>').join('') || '<tr><td colspan="6">該当する伝票はありません</td></tr>') + '</tbody></table></div></div>' +
    '<div class="pane-detail' + (sel ? ' on' : '') + '">' + (sel ? '<div class="card stack"><button class="chip hide-wide" style="align-self:flex-start" data-act="unpick">‹ 一覧に戻る</button>' + detailHtml(sel) + act + '</div>' : '<div class="alert info">一覧から伝票を選ぶと、写真と経過が表示されます</div>') + '</div></div></div>';
}
function tsv(rows) {
  const h = ['伝票番号', '様式', '状態', '店舗コード', '店舗名', '日付', '内容', '入力者', '承認者', '承認日時', '提出期限', '期限超過'];
  const q = (v) => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ');
  return [h.join('\t')].concat(rows.map((s) => [s.id, Core.title(s), stName(s.status), s.storeCode, s.storeName, s.occurredAt.slice(0, Core.formOf(s) === 'void' ? 16 : 10), Core.summary(s), s.inputterName, s.approverName, s.approvedAt, s.deadline, Core.isOverdue(s, nowStr()) ? '超過' : ''].map(q).join('\t'))).join('\n');
}

// ---------- イベント ----------
async function after(r, okMsg, flash) {
  if (!r.ok) { toast(r.error); return false; }
  await refresh(); if (flash) S.approvedFlash = okMsg; else toast(okMsg); S.sel = null; render(); return true;
}
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  if (a === 'ovclose') { if (t.classList.contains('ov') && e.target !== t) return; closeModal(); return; }
  if (a === 'login') return doLogin();
  if (a === 'loginmode') { S.loginMode = S.loginMode === 'acc' ? 'store' : 'acc'; S.msg = ''; return render(); }
  if (a === 'logout') { S.session = null; S.slips = []; S.sel = null; return go('login'); }
  if (a === 'home') { S.approvedFlash = ''; await refresh(); return go('home', { sel: null }); }
  if (a === 'newform') { S.usageOpen = {}; const nf = t.dataset.form || 'void'; let ex = null; if (nf === 'usage') { const m = defaultUsageMonth(); ex = S.slips.filter((z) => Core.formOf(z) === 'usage' && z.targetMonth === m && Core.can.edit(z))[0]; } S.form = ex ? formFromSlip(ex) : blankForm(nf); return go('form'); }
  if (a === 'edit') { S.usageOpen = {}; S.form = formFromSlip(byId(id)); return go('form'); }
  if (a === 'cat') { S.form.category = t.dataset.v; const c = Core.category(S.form.category); Object.keys(S.form.photos).forEach((k) => { if (Core.allSlots(c).indexOf(k) < 0) delete S.form.photos[k]; }); return render(); }
  if (a === 'rtype') { S.form.reportType = t.dataset.v; return render(); }
  if (a === 'additem') { const f = S.form; if (f.form === 'late') { if (f.items.length < Core.LATE_MAX) f.items.push({ salesDate: '', amount: '' }); } else if (Core.usedRows(S.slips, formSlip()) + f.items.length < Core.POS_MAX) f.items.push(blankPos()); return render(); }
  if (a === 'delitem') { S.form.items.splice(+t.dataset.i, 1); return render(); }
  if (a === 'addrow') { const arr = S.form.data[t.dataset.key]; if (arr.length < (t.dataset.key === 'reserve' ? Core.RESERVE_MAX : Core.DEPOSIT_MAX)) arr.push({ date: '', amount: '' }); return render(); }
  if (a === 'delrow') { S.form.data[t.dataset.key].splice(+t.dataset.i, 1); return render(); }
  if (a === 'usageopen') { S.usageOpen = S.usageOpen || {}; const k = t.dataset.d; S.usageOpen[k] = !S.usageOpen[k]; const y0 = window.scrollY; render(); return window.scrollTo(0, y0); }
  if (a === 'addbook') { if (S.form.data.rows.length < Core.BOOK_MAX) S.form.data.rows.push(blankRow()); return render(); }
  if (a === 'delbook') { S.form.data.rows.splice(+t.dataset.i, 1); return render(); }
  if (a === 'accview') { S.accView = t.dataset.v; S.sel = null; return render(); }
  if (a === 'pickm') { S.accView = 'inbox'; S.filter.form = 'all'; S.filter.status = 'all'; S.filter.store = ''; S.filter.month = ''; S.filter.over = false; S.sel = id; return render(); }
  if (a === 'accform') { S.filter.form = t.dataset.v; S.sel = null; return render(); }
  if (a === 'draft') return saveForm(false);
  if (a === 'submit') return saveForm(true);
  if (a === 'mylist') { S.filter.q = t.dataset.f || 'all'; await refresh(); return go('mylist', { sel: null }); }
  if (a === 'qf') { S.filter.q = t.dataset.v; S.sel = null; return render(); }
  if (a === 'approvals') { S.approvedFlash = ''; await refresh(); return go('approvals', { sel: null }); }
  if (a === 'pick') { S.sel = id; render(); return window.scrollTo(0, 0); }
  if (a === 'unpick') { S.sel = null; return render(); }
  if (a === 'zoom') { const src = await loadPhoto(t.dataset.ref); if (src) lightbox(src); return; }
  if (a === 'approve') { const who = document.getElementById('apprSel').value; if (!who) return toast('承認者（店舗責任者）を選んでください'); const r = await run(api.approve(code(), id, who)); return after(r, '承認しました。経理部の受付箱に届きました。', true); }
  if (a === 'reject') { const who = document.getElementById('apprSel').value; if (!who) return toast('差戻しする方（店舗責任者）を選んでください'); return ask('差戻しの理由', '入力者に伝わる理由を書いてください', '差戻す', async (reason) => { const r = await run(api.rejectStore(code(), id, who, reason)); after(r, '差戻しました。入力者が直して再提出します。', true); }); }
  if (a === 'accf') { S.filter.status = t.dataset.v; S.sel = null; return render(); }
  if (a === 'accover') { S.filter.over = !S.filter.over; S.sel = null; return render(); }
  if (a === 'accconfirm') { const r = await run(api.accConfirm(code(), id, S.session.name)); return after(r, '確認済みにしました'); }
  if (a === 'accreturn') return ask('差戻しの理由', '店舗に伝わる理由を書いてください', '差戻す', async (reason) => { const r = await run(api.accReturn(code(), id, S.session.name, reason)); after(r, '店舗に差戻しました'); });
  if (a === 'xlsx') { const z = byId(id); Xlsx.download(z.id + '.xlsx', Xlsx.build(Core.exportSheets(z))); return toast('Excelファイルを保存しました'); }
  if (a === 'xlsxlist') { const rows = accRows(), h = ['伝票番号', '様式', '状態', '店舗コード', '店舗名', '日付', '内容', '入力者', '承認者', '承認日時', '提出期限', '期限超過']; Xlsx.download('提出物一覧_' + todayStr() + '.xlsx', Xlsx.build([{ name: '一覧', rows: [h].concat(rows.map((z) => [z.id, Core.title(z), stLabel(z), z.storeCode, z.storeName, z.occurredAt.slice(0, Core.formOf(z) === 'void' ? 16 : 10), Core.summary(z), z.inputterName, z.approverName, z.approvedAt, z.deadline, Core.isOverdue(z, nowStr()) ? '超過' : ''])) }])); return toast('Excelファイルを保存しました'); }
  if (a === 'pdf') { const z = byId(id), pa = document.getElementById('printArea'); pa.innerHTML = detailHtml(z).replace(/id="hist-[^"]*"/, '').replace('読み込み中…', ''); fillPhotos(pa); setTimeout(() => { window.print(); }, 700); return; }
  if (a === 'copytsv') { const text = tsv(accRows()); try { await navigator.clipboard.writeText(text); toast('コピーしました。Excelに貼り付けできます'); } catch (x) { modal('<h2>コピーできませんでした</h2><div class="field"><textarea style="min-height:160px">' + esc(text) + '</textarea></div><button class="btn pri" data-act="ovclose">閉じる</button>'); } return; }
});
document.addEventListener('input', (e) => {
  const d = e.target.dataset || {};
  if (d.item !== undefined && S.form) { S.form.items[+d.item][d.key] = d.key === 'receiptAt' ? fromInput(e.target.value) : e.target.value; return; }
  if (d.path !== undefined && S.form) { let v = e.target.value; if (d.num) v = v === '' ? '' : Math.abs(Math.floor(Number(v)) || 0); setPath(S.form, d.path, v); liveOut(); return; }
  const b = d.bind; if (b && S.form) { S.form[b] = b === 'occurredAt' ? fromInput(e.target.value) : e.target.value; }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.filter === 'matrixMonth') { S.matrixMonth = el.value; return render(); }
  if (el.dataset.filter) { S.filter[el.dataset.filter] = el.value; S.sel = null; return render(); }
  if (el.dataset.bind === 'targetMonth') { if (S.form.form === 'usage') return switchUsageMonth(); syncCarry(); return render(); }
  if (el.dataset.bind === 'occurredAt') return render();
  if (el.dataset.rphoto !== undefined && el.files && el.files[0]) { try { S.form.data.rows[+el.dataset.rphoto].photo = { dataUrl: await readImage(el.files[0]) }; render(); } catch (x) { toast('写真を読み込めませんでした。もう一度撮影してください'); } return; }
  if (el.dataset.photo && el.files && el.files[0]) {
    try { const d = await readImage(el.files[0]); S.form.photos[el.dataset.photo] = { dataUrl: d }; render(); } catch (x) { toast('写真を読み込めませんでした。もう一度撮影してください'); }
  }
});
render();
})();
