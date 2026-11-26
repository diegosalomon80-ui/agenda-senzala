/* Telas e estado do app. Dados da planilha entram no DOM só via textContent. */
var App = (function () {
  var estado = {
    alunos: [], versao: null, completos: 0, meta: 0, professores: [], turmas: [],
    filtro: { busca: '', professor: '', turma: '' },
    carregado: false, atualizando: false, fichaLinha: null
  };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- utilidades de DOM ----------
  function el(tag, atributos, filhos) {
    var n = document.createElement(tag);
    Object.keys(atributos || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = atributos[k];
      else if (k === 'classe') n.className = atributos[k];
      else n.setAttribute(k, atributos[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(f); });
    return n;
  }

  function limpar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  var timerAviso = null;
  function aviso(texto) {
    var a = $('aviso');
    a.textContent = texto;
    a.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { a.hidden = true; }, 3500);
  }

  function status(texto, erro) {
    var s = $('agenda-status');
    s.textContent = texto || '';
    s.classList.toggle('erro', !!erro);
  }

  // ---------- navegação ----------
  var TELAS = ['tela-agenda', 'tela-ficha', 'tela-cadastro'];

  function mostrarTela(id) {
    TELAS.forEach(function (t) { $(t).hidden = t !== id; });
    window.scrollTo(0, 0);
  }

  function abrir(tela, dados) {
    history.pushState(Object.assign({ tela: tela }, dados || {}), '');
    aplicarHistorico(history.state);
  }

  function aplicarHistorico(st) {
    st = st || {};
    if (st.tela === 'ficha') {
      estado.fichaLinha = st.linha;
      renderFicha();
      mostrarTela('tela-ficha');
    } else if (st.tela === 'cadastro' && App.abrirCadastro) {
      App.abrirCadastro();
      mostrarTela('tela-cadastro');
    } else {
      estado.fichaLinha = null;
      mostrarTela('tela-agenda');
    }
  }

  // ---------- dados ----------
  function atualizar() {
    if (estado.atualizando) return Promise.resolve();
    estado.atualizando = true;
    return Api.chamar('listar', { versao: estado.versao }).then(function (r) {
      if (!r.ok) {
        if (r.erro !== 'nao_autorizado') status('Não foi possível atualizar a agenda. Tentando de novo…', true);
        return;
      }
      status('');
      if (r.inalterado) return;
      estado.versao = r.versao;
      estado.alunos = r.alunos;
      estado.completos = r.completos;
      estado.meta = r.meta;
      estado.professores = r.professores;
      estado.turmas = r.turmas;
      estado.carregado = true;
      renderAgenda();
      if (estado.fichaLinha !== null && !$('tela-ficha').hidden) renderFicha();
    }, function () {
      status('Sem conexão. Tentando de novo…', true);
    }).then(function () { estado.atualizando = false; });
  }

  function iniciarAtualizacaoAutomatica() {
    setInterval(function () {
      if (document.visibilityState === 'visible') atualizar();
    }, window.CONFIG.INTERVALO_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') atualizar();
    });
  }

  // ---------- agenda ----------
  function preencherSelect(select, opcoes, rotuloTodos) {
    var atual = select.value;
    limpar(select);
    select.appendChild(el('option', { value: '', texto: rotuloTodos }));
    opcoes.forEach(function (o) { select.appendChild(el('option', { value: o, texto: o })); });
    select.value = opcoes.indexOf(atual) !== -1 ? atual : '';
  }

  function renderProgresso() {
    var p = resumoProgresso(estado.completos, estado.meta);
    $('progresso-completos').textContent = estado.completos;
    $('progresso-meta').textContent = estado.meta;
    $('progresso-faltam').textContent = p.faltam === 0 ? 'Meta alcançada!' : 'faltam ' + p.faltam;
    $('progresso-preenchido').style.width = p.percentual + '%';
  }

  function renderLista() {
    var lista = $('lista');
    var hoje = new Date();
    var visiveis = filtrarAlunos(estado.alunos, estado.filtro);
    limpar(lista);
    if (!visiveis.length) {
      lista.appendChild(el('li', { classe: 'vazio-lista' }, [el('p', {
        texto: estado.alunos.length ? 'Nenhum aluno encontrado com esses filtros.' : 'Nenhum aluno cadastrado ainda.'
      })]));
      return;
    }
    visiveis.forEach(function (a) {
      var sub = [a.turma, a.professor].filter(Boolean).join(' · ');
      var botao = el('button', { type: 'button', 'data-linha': String(a.linha) }, [
        el('span', {}, [el('span', { texto: a.nome }), sub ? el('span', { classe: 'sub', texto: sub }) : null]),
        cadastroCompleto(a, hoje) ? null : el('span', { classe: 'etiqueta', texto: 'incompleto' })
      ]);
      lista.appendChild(el('li', {}, [botao]));
    });
  }

  function renderAgenda() {
    renderProgresso();
    preencherSelect($('filtro-professor'), estado.professores, 'Todos');
    preencherSelect($('filtro-turma'), estado.turmas, 'Todas');
    estado.filtro.professor = $('filtro-professor').value;
    estado.filtro.turma = $('filtro-turma').value;
    renderLista();
  }

  // ---------- ficha ----------
  function acoesContato(tel) {
    var link = linkWhatsApp(tel);
    if (!link) return null;
    return el('div', { classe: 'contato-acoes' }, [
      el('a', { classe: 'ligar', href: 'tel:+55' + normalizarTelefone(tel).replace(/\D/g, ''), texto: 'Ligar' }),
      el('a', { href: link, target: '_blank', rel: 'noopener noreferrer', texto: 'WhatsApp' })
    ]);
  }

  function valor(texto) {
    return texto ? el('p', { classe: 'valor', texto: texto }) : el('p', { classe: 'valor vazio', texto: 'não informado' });
  }

  function bloco(titulo, filhos) {
    return el('section', { classe: 'bloco' }, [el('h3', { texto: titulo })].concat(filhos));
  }

  function renderFicha() {
    var corpo = $('ficha-corpo');
    var a = estado.alunos.filter(function (x) { return x.linha === estado.fichaLinha; })[0];
    limpar(corpo);
    if (!a) {
      $('ficha-nome').textContent = 'Aluno não encontrado';
      return;
    }
    $('ficha-nome').textContent = a.nome;
    corpo.appendChild(bloco('WhatsApp do aluno', [valor(a.whatsapp), acoesContato(a.whatsapp)]));
    if (ehMenor(a.nascimento, new Date())) {
      corpo.appendChild(bloco('Responsável legal', [
        valor(a.responsavel), valor(a.whatsappResponsavel), acoesContato(a.whatsappResponsavel)
      ]));
    }
    var emergencia = [a.emergenciaNome, a.emergenciaParentesco].filter(Boolean).join(' · ');
    corpo.appendChild(bloco('Contato de emergência', [
      valor(emergencia), valor(a.emergenciaWhatsapp), acoesContato(a.emergenciaWhatsapp)
    ]));
  }

  // ---------- eventos ----------
  function ligarEventos() {
    document.addEventListener('click', function (e) {
      var alvo = e.target.closest('[data-acao], #lista button[data-linha]');
      if (!alvo) return;
      if (alvo.hasAttribute('data-linha')) return abrir('ficha', { linha: Number(alvo.getAttribute('data-linha')) });
      var acao = alvo.getAttribute('data-acao');
      if (acao === 'sair') Sessao.sair();
      else if (acao === 'voltar') history.back();
      else if (acao === 'novo') abrir('cadastro');
    });
    $('busca').addEventListener('input', function (e) {
      estado.filtro.busca = e.target.value;
      renderLista();
    });
    $('filtro-professor').addEventListener('change', function (e) {
      estado.filtro.professor = e.target.value;
      renderLista();
    });
    $('filtro-turma').addEventListener('change', function (e) {
      estado.filtro.turma = e.target.value;
      renderLista();
    });
    window.addEventListener('popstate', function (e) { aplicarHistorico(e.state); });
    document.addEventListener('acesso-negado', function () { $('tela-negado').hidden = false; });
  }

  function iniciar() {
    ligarEventos();
    history.replaceState({ tela: 'agenda' }, '');
    Sessao.iniciar(function () {
      document.body.classList.add('logado');
      mostrarTela('tela-agenda');
      status('Carregando agenda…');
      atualizar();
      iniciarAtualizacaoAutomatica();
    });
  }

  return {
    iniciar: iniciar,
    estado: estado,
    atualizar: atualizar,
    abrir: abrir,
    aviso: aviso,
    el: el,
    limpar: limpar,
    renderAgenda: renderAgenda,
    abrirCadastro: null
  };
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
document.addEventListener('DOMContentLoaded', function () {
  if (window.Cadastro) Cadastro.ligar();
  App.iniciar();
});
