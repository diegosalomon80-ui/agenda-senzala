/* Sessão do professor.
 * Depois do primeiro "Entrar com Google", a API entrega uma chave de sessão que fica guardada
 * no aparelho (localStorage) até tocar em "Sair". Dados de alunos nunca são guardados aqui. */
var Sessao = (function () {
  var CHAVE = 'agenda.sessao';
  var emMemoria = null;    // reserva quando o localStorage está bloqueado (ex.: Safari privado)
  var aoEntrar = null;
  var esperando = [];      // promessas de renovar() aguardando uma sessão nova
  var timerTela = null;
  var googlePronto = false;

  // ---------- armazenamento ----------
  function ler() {
    try { return window.localStorage.getItem(CHAVE) || emMemoria; } catch (e) { return emMemoria; }
  }
  function guardar(valor) {
    emMemoria = valor;
    try { window.localStorage.setItem(CHAVE, valor); } catch (e) { /* fica só em memória */ }
  }
  function apagar() {
    emMemoria = null;
    try { window.localStorage.removeItem(CHAVE); } catch (e) { /* nada a fazer */ }
  }

  // ---------- tela de login ----------
  function telaLogin(mostrar, msg) {
    document.getElementById('tela-login').hidden = !mostrar;
    document.getElementById('login-msg').textContent = msg || '';
  }

  function concluir(sessao) {
    guardar(sessao);
    clearTimeout(timerTela);
    telaLogin(false);
    var lista = esperando;
    esperando = [];
    lista.forEach(function (resolve) { resolve(sessao); });
    if (aoEntrar) {
      var cb = aoEntrar;
      aoEntrar = null;
      cb();
    }
  }

  // Troca o ID token do Google (válido por 1 h) por uma sessão da API (válida até "Sair").
  function aoReceberCredencial(resposta) {
    fetch(window.CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'entrar', idToken: resposta.credential }),
      redirect: 'follow',
      cache: 'no-store'
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (r.ok && r.sessao) return concluir(r.sessao);
      if (r.erro === 'nao_autorizado') {
        telaLogin(false);
        document.dispatchEvent(new CustomEvent('acesso-negado'));
        return;
      }
      telaLogin(true, 'Não foi possível entrar. Tente de novo.');
    }, function () {
      telaLogin(true, 'Sem conexão. Verifique a internet e tente de novo.');
    });
  }

  // ---------- Google ----------
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

  function prepararGoogle(fn) {
    quandoGoogleCarregar(function () {
      if (!googlePronto) {
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
        googlePronto = true;
      }
      fn();
    });
  }

  // ---------- API pública ----------
  function iniciar(callback) {
    if (ler()) return callback();          // já entrou neste aparelho
    aoEntrar = callback;
    if (!window.CONFIG.CLIENT_ID) {
      telaLogin(true, 'App ainda não configurado (CLIENT_ID vazio em js/config.js).');
      return;
    }
    telaLogin(true);
    prepararGoogle(function () { google.accounts.id.prompt(); });
  }

  // A sessão "rejeitada" deixou de valer: pede o Google de novo por cima da tela atual (nada é perdido).
  // Se outra chamada já trocou a chave, usa a nova; se a troca está em andamento, espera por ela.
  function renovar(rejeitada) {
    var atual = ler();
    if (atual && rejeitada && atual !== rejeitada) return Promise.resolve(atual);
    if (esperando.length) return new Promise(function (resolve) { esperando.push(resolve); });
    apagar();
    return new Promise(function (resolve) {
      esperando.push(resolve);
      prepararGoogle(function () { google.accounts.id.prompt(); });
      clearTimeout(timerTela);
      timerTela = setTimeout(function () {
        if (!ler()) telaLogin(true, 'Entre de novo para continuar.');
      }, 2500);
    });
  }

  function sair() {
    var sessao = ler();
    apagar();
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    var aviso = sessao ? fetch(window.CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'sair', sessao: sessao }),
      keepalive: true
    }).catch(function () {}) : Promise.resolve();
    var recarregar = function () { location.reload(); };
    aviso.then(recarregar, recarregar);
  }

  return { iniciar: iniciar, token: ler, renovar: renovar, sair: sair };
})();
