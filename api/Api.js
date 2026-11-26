/* Roteador da API. Toda ação exige um ID token de professor autorizado.
 * Apps Script não define status HTTP: o resultado vai sempre no corpo ({ ok, erro, ... }).
 * Usa as funções globais de Regras.js e Auth.js. */

var CAMPOS_CADASTRO = ['nome', 'nascimento', 'whatsapp', 'turma', 'professor', 'responsavel',
  'whatsappResponsavel', 'emergenciaNome', 'emergenciaParentesco', 'emergenciaWhatsapp'];
var CAMPOS_TEL = ['whatsapp', 'whatsappResponsavel', 'emergenciaWhatsapp'];
var META_MAXIMA = 1000;

function invalido_(campos) {
  return { ok: false, erro: 'dados_invalidos', campos: campos };
}

// Copia só os campos permitidos, apara texto e normaliza telefones válidos.
function limparAluno_(bruto) {
  var aluno = {};
  CAMPOS_CADASTRO.forEach(function (c) {
    aluno[c] = String(bruto[c] == null ? '' : bruto[c]).replace(/\s+/g, ' ').trim();
  });
  CAMPOS_TEL.forEach(function (c) {
    var n = normalizarTelefone(aluno[c]);
    if (n) aluno[c] = n;
  });
  return aluno;
}

function acaoListar_(corpo, deps) {
  var cfg = deps.config();
  var alunos = deps.lerAlunos();
  var resumo = { alunos: alunos, meta: cfg.meta, professores: cfg.professores, turmas: cfg.turmas };
  var versao = deps.hash(JSON.stringify(resumo));
  if (corpo.versao && corpo.versao === versao) return { ok: true, inalterado: true, versao: versao };
  return {
    ok: true, versao: versao, alunos: alunos,
    completos: contarCompletos(alunos, deps.agora()),
    meta: cfg.meta, professores: cfg.professores, turmas: cfg.turmas
  };
}

function acaoCadastrar_(corpo, deps) {
  if (!corpo.aluno || typeof corpo.aluno !== 'object') return invalido_(['aluno']);
  var cfg = deps.config();
  var hoje = deps.agora();
  var aluno = limparAluno_(corpo.aluno);

  var campos = [];
  if (idadeEm(aluno.nascimento, hoje) === null) campos.push('nascimento');
  if (cfg.turmas.indexOf(aluno.turma) === -1) campos.push('turma');
  if (cfg.professores.indexOf(aluno.professor) === -1) campos.push('professor');
  campos = campos.concat(camposFaltando(aluno, hoje));
  if (campos.length) return invalido_(campos);

  return deps.comLock(function () {
    var dup = verificarDuplicata(aluno, deps.lerAlunos());
    if (dup.tipo === 'duplicado') return { ok: false, erro: 'duplicado', alunos: dup.alunos };
    if (dup.tipo === 'semelhante' && corpo.confirmarSemelhante !== true) {
      return { ok: false, erro: 'semelhante', alunos: dup.alunos };
    }
    var linha = deps.anexarAluno(aluno);
    var salvo = { linha: linha };
    CAMPOS_CADASTRO.forEach(function (c) { salvo[c] = aluno[c]; });
    return { ok: true, aluno: salvo };
  });
}

function acaoDefinirMeta_(corpo, deps) {
  var meta = corpo.meta;
  var completos = contarCompletos(deps.lerAlunos(), deps.agora());
  if (typeof meta !== 'number' || meta % 1 !== 0 || meta < completos || meta > META_MAXIMA) {
    return invalido_(['meta']);
  }
  deps.salvarMeta(meta);
  return { ok: true, meta: meta };
}

var ACOES_ = { listar: acaoListar_, cadastrar: acaoCadastrar_, definirMeta: acaoDefinirMeta_ };

// Sessão guardada no app (preferida) ou ID token do Google. A lista de e-mails vale sempre.
function identificar_(corpo, deps) {
  if (corpo.sessao) {
    var email = deps.lerSessao(corpo.sessao);
    if (!email) throw new ErroApi('sessao_invalida');
    return autorizarEmail(email, deps.config().emails);
  }
  return deps.verificarProfessor(corpo.idToken);
}

function tratarRequisicao(corpo, deps) {
  try {
    corpo = corpo || {};
    if (corpo.acao === 'sair') {
      if (corpo.sessao) deps.apagarSessao(corpo.sessao);
      return { ok: true };
    }
    var email = identificar_(corpo, deps);
    if (corpo.acao === 'entrar') return { ok: true, sessao: deps.criarSessao(email) };
    var acao = ACOES_[corpo.acao];
    if (!acao || !Object.prototype.hasOwnProperty.call(ACOES_, corpo.acao)) return invalido_(['acao']);
    return acao(corpo, deps);
  } catch (e) {
    if (e instanceof ErroApi) return { ok: false, erro: e.codigo };
    console.error('Erro interno: ' + (e && e.message));
    return { ok: false, erro: 'interno' };
  }
}

function depsReais_() {
  return {
    verificarProfessor: verificarProfessor,
    criarSessao: criarSessao,
    lerSessao: lerSessao,
    apagarSessao: apagarSessao,
    config: config,
    salvarMeta: salvarMeta,
    lerAlunos: lerAlunos,
    anexarAluno: anexarAluno,
    comLock: function (fn) {
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try { return fn(); } finally { lock.releaseLock(); }
    },
    agora: function () { return new Date(); },
    hash: function (s) {
      return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
        .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
    }
  };
}

function doPost(e) {
  var corpo;
  try {
    corpo = JSON.parse(e.postData.contents);
  } catch (err) {
    return responderJson_(invalido_(['corpo']));
  }
  return responderJson_(tratarRequisicao(corpo, depsReais_()));
}

function responderJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

if (typeof module !== 'undefined') {
  module.exports = { tratarRequisicao: tratarRequisicao };
}
