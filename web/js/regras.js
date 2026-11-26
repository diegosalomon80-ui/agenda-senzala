// GERADO por scripts/sincronizar.js — edite shared/regras.js
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

if (typeof module !== 'undefined') {
  module.exports = {
    normalizarNome: normalizarNome,
    normalizarTelefone: normalizarTelefone,
    linkWhatsApp: linkWhatsApp
  };
}
