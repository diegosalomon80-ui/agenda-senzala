/* Regras de negócio da Agenda Senzala Londrina.
 * Fonte única: roda em Apps Script (V8), no navegador e no Node.
 * Não usar módulos ES nem APIs exclusivas de uma plataforma. */

function normalizarNome(nome) {
  return String(nome == null ? '' : nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarTelefone(tel) {
  var d = String(tel == null ? '' : tel).replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) d = d.slice(2);
  if (d.length === 11 && d.charAt(2) === '9') {
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  if (d.length === 10 && /[2-5]/.test(d.charAt(2))) {
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  }
  return null;
}

function linkWhatsApp(tel) {
  var n = normalizarTelefone(tel);
  return n ? 'https://wa.me/55' + n.replace(/\D/g, '') : null;
}

var FUSO = 'America/Sao_Paulo';
var CAMPOS_FICHA = ['nome', 'whatsapp', 'responsavel', 'whatsappResponsavel',
  'emergenciaNome', 'emergenciaParentesco', 'emergenciaWhatsapp'];
var CAMPOS_TELEFONE = { whatsapp: true, whatsappResponsavel: true, emergenciaWhatsapp: true };

// Data civil (ano, mês, dia) de um instante no fuso de São Paulo.
var FORMATO_DATA_SP = null;
function dataCivil(instante) {
  if (!FORMATO_DATA_SP) {
    FORMATO_DATA_SP = new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit'
    });
  }
  var p = {};
  FORMATO_DATA_SP.formatToParts(instante).forEach(function (x) { p[x.type] = x.value; });
  return { a: +p.year, m: +p.month, d: +p.day };
}

function idadeEm(nascimento, hoje) {
  var r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(nascimento == null ? '' : nascimento).trim());
  if (!r) return null;
  var a = +r[1], m = +r[2], d = +r[3];
  var teste = new Date(Date.UTC(a, m - 1, d));
  if (teste.getUTCFullYear() !== a || teste.getUTCMonth() !== m - 1 || teste.getUTCDate() !== d) return null;
  var h = dataCivil(hoje);
  var idade = h.a - a - ((h.m < m || (h.m === m && h.d < d)) ? 1 : 0);
  return idade < 0 ? null : idade;
}

function ehMenor(nascimento, hoje) {
  var idade = idadeEm(nascimento, hoje);
  return idade !== null && idade < 18;
}

function preenchido(v) {
  return String(v == null ? '' : v).trim() !== '';
}

function camposFaltando(aluno, hoje) {
  var menor = ehMenor(aluno.nascimento, hoje);
  return CAMPOS_FICHA.filter(function (campo) {
    var v = aluno[campo];
    var obrigatorio = campo === 'whatsapp' ? !menor
      : (campo === 'responsavel' || campo === 'whatsappResponsavel') ? menor
      : true;
    if (!preenchido(v)) return obrigatorio;
    return CAMPOS_TELEFONE[campo] ? normalizarTelefone(v) === null : false;
  });
}

function cadastroCompleto(aluno, hoje) {
  return camposFaltando(aluno, hoje).length === 0;
}

function contarCompletos(alunos, hoje) {
  return alunos.filter(function (a) { return cadastroCompleto(a, hoje); }).length;
}

function verificarDuplicata(novo, existentes) {
  var nome = normalizarNome(novo.nome);
  var data = String(novo.nascimento || '').trim();
  var exatos = [], parecidos = [];
  existentes.forEach(function (a) {
    var mesmoNome = nome !== '' && normalizarNome(a.nome) === nome;
    var mesmaData = data !== '' && String(a.nascimento || '').trim() === data;
    if (mesmoNome && mesmaData) exatos.push(a);
    else if (mesmoNome || mesmaData) parecidos.push(a);
  });
  if (exatos.length) return { tipo: 'duplicado', alunos: exatos };
  if (parecidos.length) return { tipo: 'semelhante', alunos: parecidos };
  return { tipo: 'nenhum', alunos: [] };
}

var COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base' });

function filtrarAlunos(alunos, filtro) {
  filtro = filtro || {};
  var busca = normalizarNome(filtro.busca);
  return alunos.filter(function (a) {
    if (busca && normalizarNome(a.nome).indexOf(busca) === -1) return false;
    if (filtro.professor && a.professor !== filtro.professor) return false;
    if (filtro.turma && a.turma !== filtro.turma) return false;
    return true;
  }).sort(function (x, y) { return COLLATOR.compare(x.nome, y.nome); });
}

function resumoProgresso(completos, meta) {
  return {
    faltam: Math.max(meta - completos, 0),
    percentual: meta > 0 ? Math.min(100, Math.round(completos / meta * 100)) : 0
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    normalizarNome: normalizarNome,
    normalizarTelefone: normalizarTelefone,
    linkWhatsApp: linkWhatsApp,
    idadeEm: idadeEm,
    ehMenor: ehMenor,
    camposFaltando: camposFaltando,
    cadastroCompleto: cadastroCompleto,
    contarCompletos: contarCompletos,
    verificarDuplicata: verificarDuplicata,
    filtrarAlunos: filtrarAlunos,
    resumoProgresso: resumoProgresso
  };
}
