/* Tela de cadastro de aluno e edição da meta. Usa App (app.js) e as regras globais. */
var Cadastro = (function () {
  var CAMPOS = [
    { grupo: 'Aluno', id: 'nome', rotulo: 'Nome completo', tipo: 'text', autocomplete: 'off' },
    { grupo: 'Aluno', id: 'nascimento', rotulo: 'Data de nascimento', tipo: 'date' },
    { grupo: 'Aluno', id: 'turma', rotulo: 'Turma', tipo: 'select' },
    { grupo: 'Aluno', id: 'professor', rotulo: 'Professor responsável', tipo: 'select' },
    { grupo: 'Aluno', id: 'whatsapp', rotulo: 'WhatsApp do aluno', tipo: 'tel' },
    { grupo: 'Responsável legal', id: 'responsavel', rotulo: 'Nome do responsável legal', tipo: 'text' },
    { grupo: 'Responsável legal', id: 'whatsappResponsavel', rotulo: 'WhatsApp do responsável', tipo: 'tel' },
    { grupo: 'Contato de emergência', id: 'emergenciaNome', rotulo: 'Nome', tipo: 'text' },
    { grupo: 'Contato de emergência', id: 'emergenciaParentesco', rotulo: 'Parentesco', tipo: 'text' },
    { grupo: 'Contato de emergência', id: 'emergenciaWhatsapp', rotulo: 'WhatsApp', tipo: 'tel' }
  ];
  var GRUPO_IDS = { 'Aluno': 'c-grupo-aluno', 'Responsável legal': 'c-grupo-responsavel', 'Contato de emergência': 'c-grupo-emergencia' };
  var tentouSalvar = false;
  var enviando = false;
  var camposServidor = []; // recusados pela API; somem quando o campo é editado
  var $ = function (id) { return document.getElementById(id); };

  // ---------- montagem ----------
  function montarFormulario() {
    var el = App.el;
    var form = $('form-cadastro');
    var grupos = {};
    CAMPOS.forEach(function (c) {
      if (!grupos[c.grupo]) {
        grupos[c.grupo] = el('fieldset', { id: GRUPO_IDS[c.grupo] }, [el('legend', { texto: c.grupo })]);
        form.appendChild(grupos[c.grupo]);
      }
      var controle;
      if (c.tipo === 'select') {
        controle = el('select', { id: 'c-' + c.id, name: c.id });
      } else {
        controle = el('input', { id: 'c-' + c.id, name: c.id, type: c.tipo, autocomplete: c.autocomplete || 'off' });
        if (c.tipo === 'tel') {
          controle.setAttribute('inputmode', 'tel');
          controle.setAttribute('placeholder', '(43) 99999-9999');
        }
      }
      grupos[c.grupo].appendChild(el('div', { classe: 'campo', 'data-campo': c.id }, [
        el('label', { for: 'c-' + c.id, texto: c.rotulo }),
        el('span', { classe: 'ajuda', id: 'c-ajuda-' + c.id }),
        controle,
        el('span', { classe: 'ajuda-erro', texto: c.tipo === 'tel' ? 'Informe um telefone com DDD.' : 'Campo obrigatório.' })
      ]));
    });
    form.appendChild(el('div', { id: 'c-msg', classe: 'msg', role: 'status' }));
    form.appendChild(el('button', { id: 'c-salvar', type: 'submit', classe: 'botao botao-principal', texto: 'Salvar cadastro' }));
  }

  function preencherOpcoes(select, opcoes) {
    var atual = select.value;
    App.limpar(select);
    select.appendChild(App.el('option', { value: '', texto: 'Escolha…' }));
    opcoes.forEach(function (o) { select.appendChild(App.el('option', { value: o, texto: o })); });
    select.value = opcoes.indexOf(atual) !== -1 ? atual : '';
  }

  // ---------- estado do formulário ----------
  function lerAluno() {
    var aluno = {};
    CAMPOS.forEach(function (c) { aluno[c.id] = $('c-' + c.id).value.trim(); });
    return aluno;
  }

  function pendentes(aluno) {
    var hoje = new Date();
    var lista = [];
    if (!aluno.nome) lista.push('nome');
    if (idadeEm(aluno.nascimento, hoje) === null) lista.push('nascimento');
    if (!aluno.turma) lista.push('turma');
    if (!aluno.professor) lista.push('professor');
    camposFaltando(aluno, hoje).forEach(function (c) { if (lista.indexOf(c) === -1) lista.push(c); });
    return lista;
  }

  function marcar(campos, todos) {
    CAMPOS.forEach(function (c) {
      var caixa = document.querySelector('.campo[data-campo="' + c.id + '"]');
      var tocado = todos || $('c-' + c.id).getAttribute('data-tocado') === '1';
      caixa.classList.toggle('pendente', tocado && campos.indexOf(c.id) !== -1);
    });
  }

  function atualizarFormulario() {
    var aluno = lerAluno();
    var menor = ehMenor(aluno.nascimento, new Date());
    $('c-grupo-responsavel').hidden = !menor;
    $('c-ajuda-whatsapp').textContent = menor ? 'Opcional para menores' : '';
    var faltam = pendentes(aluno);
    marcar(faltam.concat(camposServidor), tentouSalvar);
    $('c-salvar').disabled = enviando || faltam.length > 0;
  }

  function mensagem(filhos, erro) {
    var caixa = $('c-msg');
    App.limpar(caixa);
    caixa.classList.toggle('erro', !!erro);
    (Array.isArray(filhos) ? filhos : [filhos]).forEach(function (f) {
      caixa.appendChild(typeof f === 'string' ? App.el('p', { texto: f }) : f);
    });
  }

  function limparFormulario() {
    $('form-cadastro').reset();
    CAMPOS.forEach(function (c) { $('c-' + c.id).removeAttribute('data-tocado'); });
    tentouSalvar = false;
    camposServidor = [];
    mensagem([]);
  }

  function descreverAluno(a) {
    var partes = [a.nome];
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.nascimento || '');
    if (d) partes.push('nasc. ' + d[3] + '/' + d[2] + '/' + d[1]);
    if (a.turma) partes.push(a.turma);
    return partes.join(' · ');
  }

  // ---------- envio ----------
  function salvar(confirmarSemelhante) {
    var aluno = lerAluno();
    tentouSalvar = true;
    if (pendentes(aluno).length) return atualizarFormulario();
    enviando = true;
    atualizarFormulario();
    mensagem('Salvando…');
    return Api.chamar('cadastrar', { aluno: aluno, confirmarSemelhante: confirmarSemelhante === true })
      .then(tratarResposta, function () {
        mensagem('Sem conexão. Seus dados continuam aqui; tente salvar de novo.', true);
      })
      .then(function () {
        enviando = false;
        atualizarFormulario();
      });
  }

  function tratarResposta(r) {
    var el = App.el;
    if (r.ok) {
      limparFormulario();
      App.aviso('Cadastro salvo');
      history.back();
      App.atualizar();
      return;
    }
    if (r.erro === 'duplicado') {
      var a = r.alunos[0];
      mensagem([
        'Este aluno já está cadastrado: ' + descreverAluno(a) + '.',
        el('button', { type: 'button', classe: 'botao botao-secundario', 'data-linha': String(a.linha), texto: 'Ver ficha' })
      ], true);
    } else if (r.erro === 'semelhante') {
      var lista = el('ul', {}, r.alunos.map(function (x) { return el('li', { texto: descreverAluno(x) }); }));
      mensagem(el('div', { classe: 'semelhantes' }, [
        el('p', { texto: 'Já existe cadastro parecido:' }),
        lista,
        el('p', { texto: 'É outra pessoa?' }),
        el('button', { type: 'button', id: 'c-confirmar', classe: 'botao', texto: 'É outra pessoa — salvar mesmo assim' })
      ]));
    } else if (r.erro === 'dados_invalidos') {
      camposServidor = r.campos || [];
      mensagem('Confira os campos marcados.', true);
    } else if (r.erro !== 'nao_autorizado') {
      mensagem('Não foi possível salvar. Tente de novo.', true);
    }
  }

  // ---------- meta ----------
  function abrirMeta() {
    $('campo-meta').value = App.estado.meta;
    $('meta-msg').textContent = '';
    $('form-meta').hidden = false;
    $('campo-meta').focus();
  }

  function salvarMeta(e) {
    e.preventDefault();
    var meta = Number($('campo-meta').value);
    Api.chamar('definirMeta', { meta: meta }).then(function (r) {
      if (r.ok) {
        App.estado.meta = r.meta;
        App.estado.versao = null;
        App.renderAgenda();
        $('form-meta').hidden = true;
        App.aviso('Meta atualizada');
      } else if (r.erro === 'dados_invalidos') {
        $('meta-msg').textContent = 'A meta não pode ser menor que os cadastros completos';
      } else if (r.erro !== 'nao_autorizado') {
        $('meta-msg').textContent = 'Não foi possível salvar a meta.';
      }
    }, function () {
      $('meta-msg').textContent = 'Sem conexão. Tente de novo.';
    });
  }

  // ---------- ligação ----------
  function ligar() {
    montarFormulario();
    var form = $('form-cadastro');
    function aoEditar(e) {
      if (e.target.id) {
        e.target.setAttribute('data-tocado', '1');
        var campo = e.target.name;
        camposServidor = camposServidor.filter(function (c) { return c !== campo; });
      }
      atualizarFormulario();
    }
    form.addEventListener('input', aoEditar);
    form.addEventListener('change', aoEditar);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!enviando) salvar(false);
    });
    form.addEventListener('click', function (e) {
      if (e.target.id === 'c-confirmar') salvar(true);
      var ficha = e.target.closest('button[data-linha]');
      if (ficha) {
        history.replaceState({ tela: 'agenda' }, '');
        App.abrir('ficha', { linha: Number(ficha.getAttribute('data-linha')) });
      }
    });
    $('progresso').addEventListener('click', abrirMeta);
    $('form-meta').addEventListener('submit', salvarMeta);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-acao="cancelar-meta"]')) $('form-meta').hidden = true;
    });

    App.abrirCadastro = function () {
      preencherOpcoes($('c-turma'), App.estado.turmas);
      preencherOpcoes($('c-professor'), App.estado.professores);
      atualizarFormulario();
    };
  }

  return { ligar: ligar };
})();
