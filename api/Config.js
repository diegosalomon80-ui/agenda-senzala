/* Configuração da API, lida das Script Properties (Projeto › Configurações › Propriedades do script).
 * PLANILHA_ID, CLIENT_ID, PROFESSORES_EMAILS (vírgula), PROFESSORES_NOMES e TURMAS (barra "|"), META_CADASTROS. */

var PROFESSORES_PADRAO = ['Contramestre Pouca Telha', 'Hallwan Santos', 'Dani Pinguin'];
var TURMAS_PADRAO = ['Projeto Usina Cultural', 'Academia Pura Vida', 'Escola de Circo',
  '2D Centro Aquático e Treinamento Funcional'];
var META_PADRAO = 84;

function lerLista_(texto, separador) {
  return String(texto || '').split(separador)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s !== ''; });
}

function montarConfig(props) {
  var professores = lerLista_(props.PROFESSORES_NOMES, '|');
  var turmas = lerLista_(props.TURMAS, '|');
  var meta = parseInt(props.META_CADASTROS, 10);
  return {
    planilhaId: props.PLANILHA_ID || '',
    clientId: props.CLIENT_ID || '',
    emails: lerLista_(props.PROFESSORES_EMAILS, ',').map(function (e) { return e.toLowerCase(); }),
    professores: professores.length ? professores : PROFESSORES_PADRAO.slice(),
    turmas: turmas.length ? turmas : TURMAS_PADRAO.slice(),
    meta: isNaN(meta) ? META_PADRAO : meta
  };
}

function config() {
  return montarConfig(PropertiesService.getScriptProperties().getProperties());
}

function salvarMeta(n) {
  PropertiesService.getScriptProperties().setProperty('META_CADASTROS', String(n));
}

if (typeof module !== 'undefined') {
  module.exports = { montarConfig: montarConfig };
}
