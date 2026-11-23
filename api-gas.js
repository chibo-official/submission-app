/* 本番用：GASのウェブアプリを呼ぶ。関数名と戻り値はapi-demo.jsと同じ。 */
const ApiGas = (function () {
  const url = () => window.APP_CONFIG.API_URL;
  function call(action, payload) {
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
