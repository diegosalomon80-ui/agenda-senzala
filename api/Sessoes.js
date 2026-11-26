/* Sessões persistentes: o app guarda a chave; aqui fica só o hash dela.
 * Script Properties: "sessao:<sha256 hex da chave>" -> {"email","criada"}. */

var PREFIXO_SESSAO = 'sessao:';

function criarSessao(email) {
  var chave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(PREFIXO_SESSAO + hashToken_(chave),
    JSON.stringify({ email: email, criada: new Date().toISOString() }));
  return chave;
}

function lerSessao(chave) {
  if (!chave || typeof chave !== 'string') return null;
  var valor = PropertiesService.getScriptProperties().getProperty(PREFIXO_SESSAO + hashToken_(chave));
  if (!valor) return null;
  try { return JSON.parse(valor).email || null; } catch (e) { return null; }
}

function apagarSessao(chave) {
  if (!chave || typeof chave !== 'string') return;
  PropertiesService.getScriptProperties().deleteProperty(PREFIXO_SESSAO + hashToken_(chave));
}
