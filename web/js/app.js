/* Telas e estado do app. */
var App = (function () {
  function iniciar() {
    document.addEventListener('click', function (e) {
      var alvo = e.target.closest('[data-acao="sair"]');
      if (alvo) Sessao.sair();
    });
    document.addEventListener('acesso-negado', function () {
      document.getElementById('tela-negado').hidden = false;
    });
    Sessao.iniciar(function () {
      document.getElementById('tela-agenda').hidden = false;
    });
  }

  return { iniciar: iniciar };
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
App.iniciar();
