const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../shared/regras.js');

test('normalizarNome remove acento, caixa e espaços extras', () => {
  assert.equal(R.normalizarNome('  Ana  PEDRÃO '), 'ana pedrao');
  assert.equal(R.normalizarNome('José da Silva'), R.normalizarNome('jose  DA silva'));
  assert.equal(R.normalizarNome(''), '');
});

test('normalizarTelefone aceita formatos comuns', () => {
  for (const t of ['43991234567', '(43) 99123-4567', '+55 43 99123-4567', '55 (43) 9 9123 4567']) {
    assert.equal(R.normalizarTelefone(t), '(43) 99123-4567', t);
  }
  assert.equal(R.normalizarTelefone('4333221100'), '(43) 3322-1100');
});

test('normalizarTelefone rejeita inválidos', () => {
  for (const t of ['', '99123-4567', '123', '(43) 99123-45678', 'abc', '(43) 89123-4567']) {
    assert.equal(R.normalizarTelefone(t), null, t);
  }
});

test('linkWhatsApp monta link wa.me com DDI 55', () => {
  assert.equal(R.linkWhatsApp('(43) 99123-4567'), 'https://wa.me/5543991234567');
  assert.equal(R.linkWhatsApp(''), null);
});
