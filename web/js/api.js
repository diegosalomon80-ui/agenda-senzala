/* Cliente da API Apps Script. Corpo em text/plain para evitar preflight CORS. */
var Api = (function () {
  function enviar(corpo) {
    return fetch(window.CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      redirect: 'follow',
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('rede');
      return r.json();
    }, function () {
      throw new Error('rede');
    });
  }

  // Resolve com a resposta da API ({ ok, ... }). Rejeita com Error('rede') sem conexão.
  function chamar(acao, dados) {
    var token = Sessao.token();
    var obterToken = token ? Promise.resolve(token) : Sessao.renovar();
    return obterToken.then(function (t) {
      return enviar(Object.assign({}, dados, { acao: acao, idToken: t }));
    }).then(function (resp) {
      if (resp.erro !== 'token_invalido') return resp;
      return Sessao.renovar().then(function (novo) {
        return enviar(Object.assign({}, dados, { acao: acao, idToken: novo }));
      });
    }).then(function (resp) {
      if (resp.erro === 'nao_autorizado') {
        document.dispatchEvent(new CustomEvent('acesso-negado'));
      }
      return resp;
    });
  }

  return { chamar: chamar };
})();
