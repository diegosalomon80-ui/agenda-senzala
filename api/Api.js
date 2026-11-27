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

// ---------- login por código de e-mail ----------
var CODIGO_VALIDADE_MS = 10 * 60 * 1000;
var CODIGO_INTERVALO_MS = 60 * 1000;
var CODIGO_TENTATIVAS = 5;
var CODIGO_POR_JANELA = 5;               // pedidos de código por e-mail...
var CODIGO_JANELA_MS = 6 * 60 * 60 * 1000; // ...a cada 6 h (limite do CacheService)
var EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailDe_(bruto) {
  return typeof bruto === 'string' ? bruto.trim().toLowerCase() : '';
}

function chaveCodigo_(email, deps) {
  return 'cod:' + deps.sha256(email);
}

function lerCodigo_(chave, deps) {
  var valor = deps.cache.get(chave);
  if (!valor) return null;
  try { return JSON.parse(valor); } catch (e) { return null; }
}

// Espera, limite e respostas iguais para e-mail fora da lista: não revela quem é professor.
function acaoPedirCodigo_(corpo, deps) {
  var email = emailDe_(corpo.email);
  if (!EMAIL_VALIDO.test(email)) return invalido_(['email']);
  return deps.comLock(function () {
    var chave = chaveCodigo_(email, deps);
    var chaveDia = 'codDia:' + deps.sha256(email);
    var agora = deps.agora().getTime();
    var atual = lerCodigo_(chave, deps);
    if (atual && agora - atual.e < CODIGO_INTERVALO_MS) return { ok: false, erro: 'aguarde' };
    var dia = lerCodigo_(chaveDia, deps);
    if (!dia || agora - dia.desde > CODIGO_JANELA_MS) dia = { n: 0, desde: agora };
    if (dia.n >= CODIGO_POR_JANELA) return { ok: false, erro: 'limite' };
    if (deps.config().emails.indexOf(email) === -1) {
      deps.cache.put(chave, JSON.stringify({ e: agora }), 600);   // marca a espera, sem código
      dia.n += 1;
      deps.cache.put(chaveDia, JSON.stringify(dia), 21600);
      return { ok: true };
    }
    var codigo = deps.gerarCodigo();
    deps.enviarEmail(email, 'Seu código da Agenda Senzala',
      'Seu código para entrar na Agenda Senzala: ' + codigo +
      '\n\nEle vale por 10 minutos. Se você não pediu, ignore este e-mail.');
    // Só guarda depois do envio: se falhar, dá para pedir de novo na hora.
    deps.cache.put(chave, JSON.stringify({ h: deps.sha256(codigo), t: 0, e: agora }), 600);
    dia.n += 1;
    deps.cache.put(chaveDia, JSON.stringify(dia), 21600);
    return { ok: true };
  });
}

function acaoEntrarComCodigo_(corpo, deps) {
  var email = emailDe_(corpo.email);
  var codigo = String(corpo.codigo == null ? '' : corpo.codigo).replace(/\D/g, '');
  if (!EMAIL_VALIDO.test(email) || codigo.length !== 6) return { ok: false, erro: 'codigo_invalido' };
  var certo = deps.comLock(function () {
    var chave = chaveCodigo_(email, deps);
    var atual = lerCodigo_(chave, deps);
    if (!atual || !atual.h || atual.t >= CODIGO_TENTATIVAS) return false;
    if (deps.agora().getTime() - atual.e > CODIGO_VALIDADE_MS) return false;
    if (atual.h === deps.sha256(codigo)) {
      // Troca o código por uma marca de espera: o próximo pedido continua sujeito ao 1 minuto.
      deps.cache.put(chave, JSON.stringify({ e: atual.e }), 600);
      return true;
    }
    atual.t += 1;   // esgotado continua guardado (com a hora do envio) para manter a espera
    deps.cache.put(chave, JSON.stringify(atual), 600);
    return false;
  });
  if (!certo) return { ok: false, erro: 'codigo_invalido' };
  return { ok: true, sessao: deps.criarSessao(autorizarEmail(email, deps.config().emails)) };
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
    // Sessão nova só com login do Google: uma sessão não gera cópias que sobrevivam ao "Sair".
    if (corpo.acao === 'entrar') return { ok: true, sessao: deps.criarSessao(deps.verificarProfessor(corpo.idToken)) };
    if (corpo.acao === 'pedirCodigo') return acaoPedirCodigo_(corpo, deps);
    if (corpo.acao === 'entrarComCodigo') return acaoEntrarComCodigo_(corpo, deps);
    identificar_(corpo, deps);
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
    cache: (function () {
      var c = CacheService.getScriptCache();
      return {
        get: function (k) { return c.get(k); },
        put: function (k, v, seg) { c.put(k, v, seg); },
        remove: function (k) { c.remove(k); }
      };
    })(),
    enviarEmail: function (para, assunto, corpo) {
      MailApp.sendEmail({ to: para, subject: assunto, body: corpo, name: 'Agenda Senzala' });
    },
    gerarCodigo: function () {
      var n = parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 1000000;
      return ('000000' + n).slice(-6);
    },
    sha256: hashToken_,
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
