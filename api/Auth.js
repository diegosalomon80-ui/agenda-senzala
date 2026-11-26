/* Autenticação: valida o ID token do Google e confere a lista de professores autorizados. */

function ErroApi(codigo, extra) {
  this.codigo = codigo;
  this.extra = extra || {};
  this.message = codigo;
}
ErroApi.prototype = Object.create(Error.prototype);
ErroApi.prototype.constructor = ErroApi;

var EMISSORES_GOOGLE = ['accounts.google.com', 'https://accounts.google.com'];

// Valida só o token (emitido pelo Google para este app, válido, e-mail verificado).
function validarToken_(claims, clientId, agoraSeg) {
  var email = String(claims.email || '').trim().toLowerCase();
  var verificado = claims.email_verified === true || claims.email_verified === 'true';
  if (!clientId || claims.aud !== clientId) throw new ErroApi('token_invalido');
  if (EMISSORES_GOOGLE.indexOf(claims.iss) === -1) throw new ErroApi('token_invalido');
  if (!(Number(claims.exp) > agoraSeg)) throw new ErroApi('token_invalido');
  if (!verificado || !email) throw new ErroApi('token_invalido');
  return email;
}

function autorizarEmail(email, emails) {
  if (emails.indexOf(email) === -1) throw new ErroApi('nao_autorizado');
  return email;
}

function validarClaims(claims, clientId, agoraSeg, emails) {
  return autorizarEmail(validarToken_(claims, clientId, agoraSeg), emails);
}

function hashToken_(idToken) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// Cache guarda só "este token é do e-mail X"; a lista é conferida a cada chamada.
function verificarProfessor(idToken) {
  if (!idToken || typeof idToken !== 'string') throw new ErroApi('token_invalido');
  var cfg = config();
  var cache = CacheService.getScriptCache();
  var chave = 'tok:' + hashToken_(idToken);
  var email = cache.get(chave);
  if (!email) {
    var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' +
      encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new ErroApi('token_invalido');
    var claims = JSON.parse(resp.getContentText());
    var agoraSeg = Math.floor(Date.now() / 1000);
    email = validarToken_(claims, cfg.clientId, agoraSeg);
    var ttl = Math.min(Number(claims.exp) - agoraSeg, 21600);
    if (ttl > 0) cache.put(chave, email, ttl);
  }
  return autorizarEmail(email, cfg.emails);
}

if (typeof module !== 'undefined') {
  module.exports = { ErroApi: ErroApi, validarClaims: validarClaims, autorizarEmail: autorizarEmail };
}
