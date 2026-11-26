const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../api/Auth.js');

const CLIENT = 'cliente.apps.googleusercontent.com';
const agora = 1_800_000_000;
const ok = { aud: CLIENT, iss: 'https://accounts.google.com', exp: String(agora + 600),
  email: 'Prof@Gmail.com', email_verified: 'true' };
const lista = ['prof@gmail.com'];

function codigo(fn) {
  try { fn(); } catch (e) { assert.ok(e instanceof A.ErroApi, 'deveria ser ErroApi'); return e.codigo; }
  assert.fail('não lançou');
}

test('claims válidos devolvem e-mail em minúsculas', () => {
  assert.equal(A.validarClaims(ok, CLIENT, agora, lista), 'prof@gmail.com');
  assert.equal(A.validarClaims({ ...ok, iss: 'accounts.google.com', email_verified: true }, CLIENT, agora, lista), 'prof@gmail.com');
});

test('cada violação do token dá token_invalido', () => {
  for (const ruim of [{ aud: 'outro' }, { iss: 'https://evil.example' }, { exp: String(agora - 1) },
    { email_verified: 'false' }, { email: '' }]) {
    assert.equal(codigo(() => A.validarClaims({ ...ok, ...ruim }, CLIENT, agora, lista)), 'token_invalido', JSON.stringify(ruim));
  }
});

test('e-mail fora da lista dá nao_autorizado', () => {
  assert.equal(codigo(() => A.validarClaims(ok, CLIENT, agora, ['outro@gmail.com'])), 'nao_autorizado');
});

test('autorizarEmail: revogação vale mesmo para e-mail já validado (cache)', () => {
  assert.equal(A.autorizarEmail('prof@gmail.com', lista), 'prof@gmail.com');
  assert.equal(codigo(() => A.autorizarEmail('prof@gmail.com', [])), 'nao_autorizado');
});
