const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../shared/regras.js');

const hoje = new Date('2026-11-26T12:00:00-03:00');
const base = {
  nome: 'Fulano Teste', nascimento: '1990-01-01', whatsapp: '(43) 99111-1111',
  responsavel: '', whatsappResponsavel: '', emergenciaNome: 'Ciclana',
  emergenciaParentesco: 'Mãe', emergenciaWhatsapp: '(43) 99222-2222'
};

test('idade e menoridade', () => {
  assert.equal(R.idadeEm('2008-11-26', hoje), 18);
  assert.equal(R.ehMenor('2008-11-26', hoje), false); // faz 18 hoje
  assert.equal(R.ehMenor('2008-11-27', hoje), true);
  assert.equal(R.ehMenor('', hoje), false);           // sem data = adulto
  assert.equal(R.idadeEm('2026-13-40', hoje), null);
  assert.equal(R.idadeEm('2023-02-29', hoje), null);  // data inexistente
  assert.equal(R.idadeEm('2027-01-01', hoje), null);  // futura
});

test('fuso de São Paulo: 23h do dia 25 ainda é dia 25', () => {
  const quaseMeiaNoite = new Date('2026-11-26T02:30:00Z'); // 25/11 23:30 em SP
  assert.equal(R.ehMenor('2008-11-26', quaseMeiaNoite), true);
});

test('adulto completo / sem WhatsApp próprio', () => {
  assert.deepEqual(R.camposFaltando(base, hoje), []);
  assert.deepEqual(R.camposFaltando({ ...base, whatsapp: '' }, hoje), ['whatsapp']);
});

test('menor: WhatsApp próprio opcional, responsável obrigatório', () => {
  const menor = { ...base, nascimento: '2015-05-05', whatsapp: '' };
  assert.deepEqual(R.camposFaltando(menor, hoje), ['responsavel', 'whatsappResponsavel']);
  assert.equal(R.cadastroCompleto({ ...menor, responsavel: 'Pai', whatsappResponsavel: '(43) 99333-3333' }, hoje), true);
});

test('menor com WhatsApp próprio inválido conta como faltando', () => {
  const menor = { ...base, nascimento: '2015-05-05', whatsapp: '123', responsavel: 'Pai', whatsappResponsavel: '(43) 99333-3333' };
  assert.deepEqual(R.camposFaltando(menor, hoje), ['whatsapp']);
});

test('emergência sempre obrigatória e telefone inválido conta como faltando', () => {
  assert.deepEqual(
    R.camposFaltando({ ...base, emergenciaParentesco: ' ', emergenciaWhatsapp: '123' }, hoje),
    ['emergenciaParentesco', 'emergenciaWhatsapp']);
});

test('contarCompletos', () => {
  assert.equal(R.contarCompletos([base, { ...base, nome: '' }], hoje), 1);
});
