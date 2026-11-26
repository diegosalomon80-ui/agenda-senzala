/* Login com Google Identity Services. O ID token fica só em memória. */
var Sessao = (function () {
  var token = null;
  var aoEntrar = null;
  var esperando = [];      // promessas de renovar() aguardando um novo token
  var timerTela = null;

  function telaLogin(mostrar, msg) {
    document.getElementById('tela-login').hidden = !mostrar;
    document.getElementById('login-msg').textContent = msg || '';
  }

  function aoReceberCredencial(resposta) {
    token = resposta.credential;
    clearTimeout(timerTela);
    telaLogin(false);
    var lista = esperando;
    esperando = [];
    lista.forEach(function (p) { p.resolve(token); });
    if (aoEntrar) {
      var cb = aoEntrar;
      aoEntrar = null;
      cb();
    }
  }

  function quandoGoogleCarregar(fn) {
    if (window.google && google.accounts && google.accounts.id) return fn();
    var tentativas = 0;
    var t = setInterval(function () {
      if (window.google && google.accounts && google.accounts.id) { clearInterval(t); fn(); }
      else if (++tentativas > 100) {
        clearInterval(t);
        telaLogin(true, 'Não foi possível carregar o login do Google. Verifique a internet e recarregue.');
      }
    }, 100);
  }

  function iniciar(callback) {
    aoEntrar = callback;
    if (!window.CONFIG.CLIENT_ID) {
      telaLogin(true, 'App ainda não configurado (CLIENT_ID vazio em js/config.js).');
      return;
    }
    telaLogin(true);
    quandoGoogleCarregar(function () {
      google.accounts.id.initialize({
        client_id: window.CONFIG.CLIENT_ID,
        callback: aoReceberCredencial,
        auto_select: true,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true
      });
      google.accounts.id.renderButton(document.getElementById('botao-google'), {
        theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'pt-BR'
      });
      google.accounts.id.prompt();
    });
  }

  // Pede um token novo. Tenta em silêncio; se não vier logo, mostra a tela de login
  // por cima do que estiver aberto (nada na tela é perdido).
  function renovar() {
    token = null;
    return new Promise(function (resolve) {
      esperando.push({ resolve: resolve });
      quandoGoogleCarregar(function () { google.accounts.id.prompt(); });
      clearTimeout(timerTela);
      timerTela = setTimeout(function () {
        if (!token) telaLogin(true, 'Sua sessão expirou. Entre de novo para continuar.');
      }, 2500);
    });
  }

  function sair() {
    token = null;
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    location.reload();
  }

  return {
    iniciar: iniciar,
    token: function () { return token; },
    renovar: renovar,
    sair: sair
  };
})();
