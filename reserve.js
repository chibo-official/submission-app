/* ③ ご予約内容確認票：旅行会社などへFAXする書類を、画面で入力して PDF／Excel で出力する（経理部への提出物ではありません） */
const Reserve = (function () {
  // 店舗名・住所・電話は、店舗情報の一覧（添付のExcel）から。一覧にない店舗は、画面で入力する
  const STORE_INFO = {"002": {"name": "千房　千日前本店","zip": "542-0075","address": "大阪府大阪市中央区難波千日前11-27","building": "道風ビル1F～2F","tel": "06-6643-0111"},"005": {"name": "千房　リノアス八尾支店","zip": "581-0803","address": "大阪府八尾市光町2-60","building": "リノアス八尾8F","tel": "072-997-8550"},"010": {"name": "千房　京都アバンティ支店","zip": "601-8003","address": "京都府京都市南区東九条西山王町31","building": "京都アバンティB1","tel": "075-671-8921"},"013": {"name": "千房　堺髙島屋支店","zip": "590-0028","address": "大阪府堺市三国ヶ丘御幸通59","building": "堺髙島屋B1","tel": "072-223-4340"},"014": {"name": "千房　高槻阪急スクエア支店","zip": "569-1116","address": "大阪府高槻市白梅町4-1","building": "高槻阪急スクエア6F","tel": "072-681-3321"},"015": {"name": "千房　曽根崎支店","zip": "530-0057","address": "大阪府大阪市北区曽根崎2-10-15","building": "曽根崎センタービル1F","tel": "06-6361-4391"},"034": {"name": "華　千房　恵比寿ガーデンプレイス店","zip": "150-6038","address": "東京都渋谷区恵比寿4-20-3","building": "恵比寿ガーデンプレイスタワー38F","tel": "03-5424-1011"},"035": {"name": "千房　京橋京阪モール支店","zip": "534-0024","address": "大阪府大阪市都島区東野田町2-1-38","building": "京橋駅ビル5F","tel": "06-6353-5501"},"040": {"name": "千房　ハービスＰＬＡＺＡ梅田支店","zip": "530-0001","address": "大阪府大阪市北区梅田2-5-25","building": "ハービスPLAZA B2","tel": "06-6343-7113"},"052": {"name": "千房　有楽町ビックカメラ支店","zip": "100-0006","address": "東京都千代田区有楽町1-11-1","building": "ビックカメラ有楽町6F","tel": "03-5288-8570"},"053": {"name": "千房　そごう横浜店","zip": "220-8510","address": "神奈川県横浜市西区高島2-18-1","building": "そごう横浜10F","tel": "045-465-5954"},"057": {"name": "千房　ルミネ立川支店","zip": "190-0012","address": "東京都立川市曙町2-1-1","building": "ルミネ立川8F","tel": "042-528-3991"},"059": {"name": "千房　あべのキューズモール支店","zip": "545-0052","address": "大阪府大阪市阿倍野区阿倍野筋1-6-1","building": "あべのキューズモール4F","tel": "06-6634-3350"},"064": {"name": "千房　ヨドバシHD池袋ビル支店","zip": "171-0022","address": "東京都豊島区南池袋1-28-1","building": "ヨドバシHD池袋ビル8F","tel": "03-6384-4581"},"065": {"name": "千房　名代JO-TERRACE OSAKA店","zip": "540-0002","address": "大阪府大阪市中央区大阪城3-1","building": "E TERRACE 102","tel": "06-6450-6900"},"066": {"name": "千房　セレオ八王子支店","zip": "192-0083","address": "東京都八王子市旭町1-1","building": "セレオ八王子北館9F","tel": "042-686-3730"},"067": {"name": "千房　ららぽーと名古屋みなとアクルス支店","zip": "455-0018","address": "愛知県名古屋市港区港明2-3-2","building": "ららぽーと名古屋みなとアクルス1F","tel": "052-655-5260"},"068": {"name": "舞 千房　イクスピアリ店","zip": "279-0031","address": "千葉県浦安市舞浜1-4","building": "イクスピアリ3F","tel": "047-311-4545"},"069": {"name": "千房　有明ガーデン支店","zip": "135-0063","address": "東京都江東区有明2-1-8","building": "有明ガーデン5F","tel": "03-5962-4160"},"101": {"name": "ぷれじでんと千房　南本店","zip": "542-0084","address": "大阪府大阪市中央区宗右衛門町6-30","building": "豊の家ビル1F","tel": "06-6211-0755"},"102": {"name": "ぷれじでんと千房　北店","zip": "530-0002","address": "大阪府大阪市北区曽根崎新地1-10-1","building": "エスパシオンYAMADAビルＢ1","tel": "06-6345-7371"},"103": {"name": "ぷれじでんと千房　シェラトン都ホテル大阪店","zip": "543-0001","address": "大阪府大阪市天王寺区上本町6-1-55","building": "シェラトン都ホテル大阪Ｂ1","tel": "06-6773-6211"},"109": {"name": "ぷれじでんと千房　オー・エム・ホテル日航ビル店","zip": "542-0086","address": "大阪府大阪市中央区西心斎橋1-3-3","building": "オー・エム・ホテル日航ビルB2","tel": "06-6241-0390"},"111": {"name": "ぷれじでんと千房　大丸心斎橋店","zip": "542-8501","address": "大阪府大阪市中央区心斎橋筋1-7-1","building": "大丸心斎橋店10F","tel": "06-6251-7080"},"112": {"name": "琥 千房　虎ノ門","zip": "105-6403","address": "東京都港区虎ノ門1-17-1","building": "虎ノ門ヒルズビジネスタワー3階","tel": "03-6457-9740"},"113": {"name": "ぷれじでんと千房　Retreat","zip": "530-0002","address": "大阪府大阪市北区曽根崎新地1-5-22","building": "橋立ビル4F","tel": "06-6940-7611"},"301": {"name": "千房　道頓堀ビル店","zip": "542-0071","address": "大阪府大阪市中央区道頓堀1-5-5","building": "千房道頓堀ビル","tel": "06-6212-2211"}};
  // 現行の予約確認票にある連絡先は、そちらを優先（道頓堀ビル店）
  const OVERRIDE = { '301': { tel: '050-1807-5395', fax: '06-6212-2513', building: '' },
    // 店舗名は、アプリ内の名称に合わせる（住所・電話は一覧のまま）
    '013': { name: '千房\u3000堺東支店' }, '064': { name: '千房\u3000リンクス池袋支店' } };
  const FOOD = ['事前振込', 'クーポン券', '後日請求', '当日現金'], DRINK = ['事前振込', '業務用クーポン券', '後日請求', '当日現金'], WAYS = ['請求書にて相殺', '現金払い'];
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => (v === '' || v == null ? 0 : Number(v) || 0);
  const yen = (n) => '￥' + num(n).toLocaleString('ja-JP');

  function storeDefaults(store) {
    const code = store && store.code, base = STORE_INFO[code], ov = OVERRIDE[code] || {};
    const d = Object.assign({ name: store ? store.name : '', zip: '', address: '', building: '', tel: '', fax: '' }, base || {}, ov);
    d.known = !!base;
    return d;
  }
  function blank(store, today) {
    const d = storeDefaults(store);
    return { date: today || '', toCompany: '', toPerson: '', staff: '', storeName: d.name, zip: d.zip, address: d.address, building: d.building, tel: d.tel, fax: d.fax,
      group: '', useDate: '', ampm: '', start: '', end: '', meal: '', headcount: '', breakdown: '', unit: '', total: '', totalEdited: false,
      feeMode: 'rate', fee: '', feeWay: '', payFood: '', payDrink: '', other: '' };
  }
  const ymd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const wday = (s) => { const t = ymd(s); return t ? WD[new Date(t.y, t.m - 1, t.d).getDay()] : ''; };
  const dateText = (s) => { const t = ymd(s); return t ? t.y + '年' + t.m + '月' + t.d + '日' : ''; };
  const useText = (s) => { const t = ymd(s); return t ? t.y + '年' + t.m + '月' + t.d + '日（' + wday(s) + '）' : ''; };
  const totalOf = (rv) => (rv.totalEdited && rv.total !== '' ? num(rv.total) : (num(rv.unit) > 0 && num(rv.headcount) > 0 ? num(rv.unit) * num(rv.headcount) : 0));
  const timeText = (rv) => (rv.start || rv.end ? (rv.start || '') + ' ～ ' + (rv.end || '') : '');
  function check(rv) {
    const e = [];
    if (!String(rv.group || '').trim()) e.push('団体様名を入力してください');
    if (!ymd(rv.useDate)) e.push('ご利用日を入力してください');
    return e;
  }
  const fileName = (rv) => 'ご予約内容確認票_' + String(rv.group || '').replace(/[\\\/:*?"<>|\s　]/g, '') + '_' + (rv.useDate || '').replace(/-/g, '') ;
  const GREET = ['貴社益々ご清栄のこととお慶び申し上げます。平素は千房をご愛顧いただきありがとうございます。', '　またこのたびはご飲食のご予約を頂き心より御礼申し上げます。', '早速ですが、下記ご予約内容をご確認後太枠内にご記入のうえFAXにてご送信賜りますようお願い申し上げます。'];
  const NOTE = ['旅行会社様お取扱分は割引券の併用はできませんのでご了承ください。', 'お客様へのご案内も併せてお願いいたします。'];

  // ---------- 画面表示・印刷用（A4・1ページ） ----------
  const opt = (label, on) => '<span class="rvo' + (on ? ' on' : '') + '">' + esc(label) + '</span>';
  const opts = (list, sel, sep) => list.map((x) => opt(x, x === sel)).join(sep || '<i>・</i>');
  function html(rv) {
    const row = (lab, body, cls) => '<div class="rvr ' + (cls || '') + '"><div class="l">' + lab + '</div><div class="c">：</div><div class="v">' + body + '</div></div>';
    const tot = totalOf(rv), dash = '<span class="rvs"></span>';
    const feeBody = rv.feeMode === 'none'
      ? '<span class="rvx">　　％（ご予約料理のみ）</span>　<span class="rvm">手数料なし（旅行会社以外のお客様）</span>'
      : '<span class="rvf">' + esc(rv.fee) + '</span>％<small>（ご予約料理のみ）</small>';
    return '<div class="rvp">' +
      '<div class="rvt">ご 予 約 内 容 確 認 票</div><div class="rvd">' + (dateText(rv.date) || '　　　　年　　　月　　　日') + '</div>' +
      '<div class="rvh"><div class="to"><div class="ln"><span>' + esc(rv.toCompany) + '</span><b>御　中</b></div><div class="ln"><span>' + esc(rv.toPerson) + '</span><b>様</b></div></div>' +
      '<div class="from"><div class="nm">' + esc(rv.storeName) + '</div>' + (rv.zip ? '<div>〒' + esc(rv.zip) + '</div>' : '') + '<div>' + esc(rv.address) + '</div>' + (rv.building ? '<div>' + esc(rv.building) + '</div>' : '') +
      '<div class="tf">Tel.　' + esc(rv.tel) + '</div><div class="tf">Fax.　' + esc(rv.fax) + '</div><div class="st">担当者　' + esc(rv.staff) + '</div></div></div>' +
      '<div class="rvg">' + GREET.map((g) => '<div>' + esc(g) + '</div>').join('') + '</div>' +
      '<div class="rvk">記</div>' +
      row('団体様名', '<span class="fill">' + esc(rv.group) + '</span><b>様</b>', 'g') +
      row('ご利用日時', '<span class="fill">' + esc(useText(rv.useDate)) + '</span>') +
      row('', opts(['AM', 'PM'], rv.ampm, '・') + '　<span class="tm">' + esc(timeText(rv)) + '</span>', 'sub') +
      row('お食事内容', '<small>(コース名 等 )</small><div class="meal">' + esc(rv.meal).replace(/\n/g, '<br>') + '</div>', 'meal-r') +
      row('人数', '<span class="fill">' + esc(rv.headcount) + '</span>名様　内訳（<span class="bd">' + esc(rv.breakdown) + '</span>）') +
      row('料金', 'おひとり様　<span class="fill">' + (rv.unit === '' ? '￥' : yen(rv.unit)) + '</span>-　税・ｻｰﾋﾞｽ料込') +
      '<div class="rvr sub"><div class="l"></div><div class="c"></div><div class="v">（合計　<span class="fill">' + (tot ? yen(tot) : '￥') + '</span>-）</div></div>' +
      '<div class="rvn"><div>' + NOTE.map(esc).join('</div><div>') + '</div></div>' +
      row('取扱手数料', feeBody) +
      '<div class="rvr sub"><div class="l"></div><div class="c"></div><div class="v">' + (rv.feeMode === 'none' ? '' : opts(WAYS, rv.feeWay) + '<small>（領収証のご準備をお願いします）</small>') + '</div></div>' +
      row('お支払方法', 'お料理　⇒　' + opts(FOOD, rv.payFood)) +
      '<div class="rvr sub"><div class="l"></div><div class="c"></div><div class="v">お飲物　⇒　' + opts(DRINK, rv.payDrink) + '</div></div>' +
      '<div class="rvr sub"><div class="l"></div><div class="c"></div><div class="v"><b class="cc">＊ｸﾚｼﾞｯﾄｶｰﾄﾞでのお支払はできません。＊</b></div></div>' +
      row('その他', '<div class="oth">' + esc(rv.other).replace(/\n/g, '<br>') + '</div>', 'oth-r') +
      '<div class="rvb"><div class="bt">旅行会社様ご記入欄</div><div class="bx"><div class="bs">（ご連絡先・請求書送付先）</div>' +
      '<div class="br"><span>御　会　社　名</span>：<i></i></div><div class="br"><span>ご 担 当 者 名</span>：<i></i><em>印</em></div>' +
      '<div class="br tall"><span>所　　在　　地</span>：〒<i></i></div><div class="br"><span>ご　連　絡　先</span>：ＴＥＬ.<i></i>ＦＡＸ.<i></i></div><div class="br"><span>お支払い予定日</span><u>年</u><u>月</u><u>日</u></div></div></div>' +
      '</div>';
  }

  // ---------- Excel（A4・1ページ。見た目は画面の書式に近づけた表） ----------
  function sheets(rv) {
    const NC = 7, grid = [], merges = [], heights = {};
    const get = (r, c) => { while (grid.length < r) grid.push(new Array(NC).fill(null)); return grid[r - 1][c - 1] || (grid[r - 1][c - 1] = {}); };
    const put = (r, c, v, st) => { Object.assign(get(r, c), st || {}, { v: v }); };
    const style = (r, c, st) => Object.assign(get(r, c), st);
    const merge = (r, c1, c2, v, st, r2) => { put(r, c1, v, st); r2 = r2 || r; for (let y = r; y <= r2; y++) for (let x = c1; x <= c2; x++) { if (!(y === r && x === c1)) style(y, x, st || {}); } if (c2 > c1 || r2 > r) merges.push(col(c1) + r + ':' + col(c2) + r2); };
    const col = (i) => String.fromCharCode(64 + i);
    const LAB = { b: true, sz: 12, va: 'center' }, VAL = { sz: 12, va: 'center' };
    let r = 1;
    merge(r, 1, 7, 'ご 予 約 内 容 確 認 票', { b: true, sz: 18, h: 'center', va: 'center' }); heights[r] = 34; r++;
    merge(r, 5, 7, dateText(rv.date) || '　　　年　　　月　　　日', { sz: 11, h: 'right', bb: true }); r += 2;
    const top = r;
    merge(r, 1, 3, (rv.toCompany || '') + '　　　御　中', { sz: 14, bb: true, va: 'center' }); heights[r] = 26;
    merge(r + 1, 1, 3, (rv.toPerson || '') + '　　　様', { sz: 14, bb: true, va: 'center' }); heights[r + 1] = 26;
    const from = [[rv.storeName, { b: true, sz: 13 }], [rv.zip ? '〒' + rv.zip : '', { sz: 10 }], [rv.address, { sz: 10 }], [rv.building, { sz: 10 }], ['Tel.　' + (rv.tel || ''), { sz: 10 }], ['Fax.　' + (rv.fax || ''), { sz: 10 }], ['担当者　' + (rv.staff || ''), { sz: 10 }]].filter((x) => x[0]);
    from.forEach((x, i) => merge(top + i, 4, 7, x[0], Object.assign({ va: 'center' }, x[1])));
    r = top + Math.max(from.length, 2) + 1;
    GREET.forEach((g) => { merge(r, 1, 7, g, { sz: 10 }); r++; });
    r++; merge(r, 1, 7, '記', { sz: 12, h: 'center' }); r += 2;
    const lab = (t) => { put(r, 1, t, LAB); put(r, 2, '：', { sz: 12, h: 'center', va: 'center' }); };
    lab('団体様名'); merge(r, 3, 6, rv.group || '', Object.assign({ b: true, bb: true }, VAL)); put(r, 7, '様', { sz: 12, h: 'center', va: 'center' }); heights[r] = 24; r++;
    lab('ご利用日時'); merge(r, 3, 7, useText(rv.useDate), Object.assign({ bb: true }, VAL)); heights[r] = 24; r++;
    merge(r, 3, 7, (rv.ampm ? '（' + rv.ampm + '）' : 'AM・PM') + '　' + timeText(rv), VAL); r++;
    lab('お食事内容'); merge(r, 3, 7, rv.meal || '(コース名 等 )', { sz: 12, va: 'top', wrap: true, bb: true }); const ml = Math.max(2, String(rv.meal || '').split('\n').length); heights[r] = 18 * ml + 6; r++;
    lab('人数'); merge(r, 3, 7, (rv.headcount !== '' ? rv.headcount : '　　') + '名様　　内訳（' + (rv.breakdown || '　　　　') + '）', VAL); heights[r] = 24; r++;
    const tot = totalOf(rv);
    lab('料金'); merge(r, 3, 7, 'おひとり様　' + (rv.unit === '' ? '￥' : yen(rv.unit)) + '-　税・サービス料込', VAL); heights[r] = 24; r++;
    merge(r, 3, 7, '（合計　' + (tot ? yen(tot) : '￥') + '-）', VAL); r++;
    NOTE.forEach((n) => { merge(r, 3, 7, n, { sz: 10 }); r++; });
    const sel = (list, v) => list.map((x) => (x === v ? '（' + x + '）' : x)).join('・');
    lab('取扱手数料'); merge(r, 3, 7, rv.feeMode === 'none' ? '手数料なし（旅行会社以外のお客様）' : (rv.fee !== '' ? rv.fee : '　　') + '％（ご予約料理のみ）', VAL); heights[r] = 24; r++;
    if (rv.feeMode !== 'none') { merge(r, 3, 7, sel(WAYS, rv.feeWay) + '（領収証のご準備をお願いします）', { sz: 10, va: 'center' }); r++; }
    lab('お支払方法'); merge(r, 3, 7, 'お料理　⇒　' + sel(FOOD, rv.payFood), VAL); heights[r] = 24; r++;
    merge(r, 3, 7, 'お飲物　⇒　' + sel(DRINK, rv.payDrink), VAL); heights[r] = 24; r++;
    merge(r, 3, 7, '＊クレジットカードでのお支払はできません。＊', { b: true, sz: 10 }); r++;
    lab('その他'); merge(r, 3, 7, rv.other || '', { sz: 12, va: 'top', wrap: true, bb: true }); heights[r] = 18 * Math.max(2, String(rv.other || '').split('\n').length) + 6; r += 2;
    merge(r, 1, 7, '旅行会社様ご記入欄', { sz: 10 }); r++;
    const b1 = r;
    merge(r, 1, 7, '（ご連絡先・請求書送付先）', { sz: 12, va: 'center' }); heights[r] = 24; r++;
    const bl = (t, extra) => { put(r, 1, t, { sz: 12, va: 'center' }); put(r, 2, '：', { sz: 12, h: 'center', va: 'center' }); heights[r] = 28; };
    bl('御　会　社　名'); merge(r, 3, 7, '', { bb: true }); r++;
    bl('ご 担 当 者 名'); merge(r, 3, 6, '', { bb: true }); put(r, 7, '印', { sz: 12, h: 'center', va: 'center' }); r++;
    bl('所　　在　　地'); merge(r, 3, 7, '〒', { bb: true, sz: 12, va: 'center' }); r++;
    bl('ご　連　絡　先'); merge(r, 3, 4, 'ＴＥＬ.', { bb: true, sz: 10, va: 'center' }); merge(r, 5, 7, 'ＦＡＸ.', { bb: true, sz: 10, va: 'center' }); r++;
    put(r, 1, 'お支払い予定日', { sz: 12, va: 'center' }); put(r, 4, '年', { sz: 12, h: 'right', va: 'center' }); put(r, 5, '月', { sz: 12, h: 'right', va: 'center' }); put(r, 6, '日', { sz: 12, h: 'right', va: 'center' }); heights[r] = 28;
    const b2 = r;
    // 太枠（ご記入欄の外周）
    for (let y = b1; y <= b2; y++) for (let x = 1; x <= 7; x++) { const c = get(y, x); if (x === 1) c.bl = 'medium'; if (x === 7) c.br = 'medium'; if (y === b1) c.bt = 'medium'; if (y === b2) c.bb = 'medium'; }
    const rows = grid.map((rw) => rw.map((c) => (c === null ? null : c)));
    return [{ name: 'ご予約内容確認票', rows: rows, cols: [16, 3, 13, 13, 13, 13, 13], merges: merges, heights: heights, page: { fit: true, orient: 'portrait' } }];
  }
  return { STORE_INFO, storeDefaults, blank, totalOf, wday, check, fileName, html, sheets, FOOD, DRINK, WAYS, dateText, useText };
})();
if (typeof module !== 'undefined') module.exports = Reserve;
