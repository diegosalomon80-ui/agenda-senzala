const test = require('node:test');
const assert = require('node:assert/strict');
Object.assign(globalThis, require('../api/Regras.js'), require('../api/Planilha.js'));
const F = require('../api/Ferramentas.js');

test('planilha de teste: 22 cabeçalhos mapeáveis e 6 alunos fictícios com os casos do aceite', () => {
  const { cabecalhos, linhas } = F.dadosPlanilhaTeste();
  assert.equal(cabecalhos.length, 22);
  const mapa = mapearCabecalhos(cabecalhos);
  const hoje = new Date('2026-11-26T12:00:00-03:00');
  const alunos = linhas.map((l, i) => linhaParaAluno(l, mapa, i + 2));
  assert.equal(alunos.length, 6);
  assert.equal(alunos.filter((a) => ehMenor(a.nascimento, hoje)).length, 2);
  assert.equal(alunos.filter((a) => !cadastroCompleto(a, hoje)).length, 1);
  assert.ok(linhas.some((l) => l[mapa.nascimento] instanceof Date), 'uma data como Date');
  for (const a of alunos) assert.match(a.nome, /Teste/, 'nomes claramente fictícios');
});
