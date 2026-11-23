/* 本番用：GASのウェブアプリを呼ぶ。関数名と戻り値はapi-demo.jsと同じ。 */
const ApiGas = (function () {
  const url = () => window.APP_CONFIG.API_URL;
  // 通信中の表示：上部の動くバーと「通信中」の表示。0.25秒以内に終わる通信では出さない（ちらつき防止）
  let pending = 0, timer = null, box = null;
  function ensureBox() {
    if (box) return box;
    const st = document.createElement('style');
    st.textContent = '@keyframes gasbar{0%{left:-40%}100%{left:100%}}@keyframes gasspin{to{transform:rotate(360deg)}}'
      + '#gasLoad{position:fixed;inset:0;z-index:200;background:rgba(255,255,255,.55);display:none;align-items:center;justify-content:center}'
      + '#gasLoad .bar{position:absolute;top:0;left:0;right:0;height:5px;background:#EADCDF;overflow:hidden}'
      + '#gasLoad .bar i{position:absolute;top:0;height:5px;width:40%;background:#96213F;animation:gasbar 1s linear infinite}'
      + '#gasLoad .box{background:#fff;border:1px solid #E5DCDD;border-radius:12px;padding:16px 22px;display:flex;align-items:center;gap:12px;font-size:16px;font-weight:600;color:#2A2527;box-shadow:0 4px 16px rgba(0,0,0,.15)}'
      + '#gasLoad .sp{width:22px;height:22px;border:3px solid #EADCDF;border-top-color:#96213F;border-radius:50%;animation:gasspin .8s linear infinite}';
    document.head.appendChild(st);
    box = document.createElement('div'); box.id = 'gasLoad';
    box.innerHTML = '<div class="bar"><i></i></div><div class="box"><span class="sp"></span>通信中です。少しお待ちください</div>';
    document.body.appendChild(box); return box;
  }
  function busyOn() { pending++; if (pending === 1) timer = setTimeout(() => { ensureBox().style.display = 'flex'; }, 250); }
  function busyOff() { pending = Math.max(0, pending - 1); if (pending === 0) { clearTimeout(timer); if (box) box.style.display = 'none'; } }
  function call(action, payload) {
    busyOn();
    return call0(action, payload).then((r) => { busyOff(); return r; }, (e) => { busyOff(); throw e; });
  }
  function call0(action, payload) {
    // text/plainで送るとCORSの事前確認が不要になる（GAS側の定番の作法）
    return fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action: action }, payload)) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: '通信できませんでした。電波の良い場所でもう一度お試しください。' }));
  }
  return {
    demo: false, hints: null,
    login: (code) => call('login', { code }),
    listStore: (code) => call('listStore', { code }),
    listAll: (code) => call('listAll', { code }),
    getPhoto: (code, ref) => call('getPhoto', { code, ref }),
    history: (code, id) => call('history', { code, id }),
    save: (code, input, submitNow) => call('save', { code, input, submitNow }),
    approve: (code, id, approverId) => call('approve', { code, id, approverId }),
    rejectStore: (code, id, approverId, reason) => call('rejectStore', { code, id, approverId, reason }),
    accConfirm: (code, id, actorName) => call('accConfirm', { code, id, actorName }),
    accReturn: (code, id, actorName, reason) => call('accReturn', { code, id, actorName, reason })
  };
})();
