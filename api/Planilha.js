/* Acesso à aba "Alunos". Colunas sempre localizadas pelo texto do cabeçalho.
 * Única escrita permitida: anexarAluno (appendRow). Nunca altera linhas existentes. */

var ABA_ALUNOS = 'Alunos';
var COLUNAS = {
  nome: 'Nome completo',
  nascimento: 'Data de nascimento',
  whatsapp: 'WhatsApp',
  turma: 'Turma',
  professor: 'Professor responsável',
  responsavel: 'Responsável legal (menores)',
  whatsappResponsavel: 'WhatsApp do responsável',
  emergenciaNome: 'Contato de emergência — nome',
  emergenciaParentesco: 'Contato de emergência — parentesco',
  emergenciaWhatsapp: 'Contato de emergência — WhatsApp',
  ultimaAtualizacao: 'Última atualização',
  origem: 'Origem do cadastro',
  situacao: 'Situação'
};
var CAMPOS_ALUNO = ['nome', 'nascimento', 'whatsapp', 'turma', 'professor', 'responsavel',
  'whatsappResponsavel', 'emergenciaNome', 'emergenciaParentesco', 'emergenciaWhatsapp'];
var ORIGEM_APP = 'App professores';
var SITUACAO_APP = 'Cadastro para confirmar';

function mapearCabecalhos(cabecalhos) {
  var limpos = cabecalhos.map(function (h) { return String(h).trim(); });
  var mapa = {};
  Object.keys(COLUNAS).forEach(function (chave) {
    var i = limpos.indexOf(COLUNAS[chave]);
    if (i === -1) throw new Error('Coluna ausente: ' + COLUNAS[chave]);
    mapa[chave] = i;
  });
  return mapa;
}

// O Sheets devolve células de data como meia-noite NO FUSO DA PLANILHA: formatar nesse fuso.
function formatarData_(d, fuso) {
  if (typeof Utilities !== 'undefined') return Utilities.formatDate(d, fuso, 'yyyy-MM-dd');
  var p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}

function celulaParaTexto_(v, fuso) {
  if (v instanceof Date) return formatarData_(v, fuso);
  return String(v == null ? '' : v).trim();
}

function linhaParaAluno(valores, mapa, numeroLinha, fuso) {
  fuso = fuso || 'America/Sao_Paulo';
  var aluno = { linha: numeroLinha };
  CAMPOS_ALUNO.forEach(function (campo) { aluno[campo] = celulaParaTexto_(valores[mapa[campo]], fuso); });
  return aluno;
}

// Evita que texto digitado vire fórmula na planilha.
function textoSeguro_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function alunoParaLinha(aluno, mapa, totalColunas, carimbo) {
  var linha = [];
  for (var i = 0; i < totalColunas; i++) linha.push('');
  CAMPOS_ALUNO.forEach(function (campo) { linha[mapa[campo]] = textoSeguro_(aluno[campo]); });
  if (aluno.nascimento) linha[mapa.nascimento] = "'" + aluno.nascimento;
  linha[mapa.ultimaAtualizacao] = carimbo; // Date, como o script do site grava
  linha[mapa.origem] = ORIGEM_APP;
  linha[mapa.situacao] = SITUACAO_APP;
  return linha;
}

function abaAlunos_() {
  var aba = SpreadsheetApp.openById(config().planilhaId).getSheetByName(ABA_ALUNOS);
  if (!aba) throw new Error('Aba ausente: ' + ABA_ALUNOS);
  return aba;
}

function lerAlunos() {
  var aba = abaAlunos_();
  var fuso = aba.getParent().getSpreadsheetTimeZone();
  var valores = aba.getDataRange().getValues();
  var mapa = mapearCabecalhos(valores[0]);
  var alunos = [];
  for (var i = 1; i < valores.length; i++) {
    var aluno = linhaParaAluno(valores[i], mapa, i + 1, fuso);
    if (aluno.nome !== '') alunos.push(aluno);
  }
  return alunos;
}

function anexarAluno(aluno) {
  var aba = abaAlunos_();
  var cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var mapa = mapearCabecalhos(cabecalhos);
  var carimbo = new Date();
  aba.appendRow(alunoParaLinha(aluno, mapa, cabecalhos.length, carimbo));
  return aba.getLastRow();
}

if (typeof module !== 'undefined') {
  module.exports = {
    COLUNAS: COLUNAS,
    mapearCabecalhos: mapearCabecalhos,
    linhaParaAluno: linhaParaAluno,
    alunoParaLinha: alunoParaLinha
  };
}
