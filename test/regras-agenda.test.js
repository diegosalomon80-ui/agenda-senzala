const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../shared/regras.js');

const a = { linha: 2, nome: 'Ana Pedrão', nascimento: '2000-01-01', professor: 'Hallwan Santos', turma: 'Escola de Circo' };
const b = { linha: 3, nome: 'bruno Álvares', nascimento: '', professor: 'Dani Pinguin', turma: 'Academia Pura Vida' };
const c = { linha: 4, nome: 'Carla Souza', nascimento: '2000-01-01', professor: 'Hallwan Santos', turma: 'Academia Pura Vida' };

test('duplicado: nome normalizado + data', () => {
  assert.deepEqual(R.verificarDuplicata({ nome: 'ANA  PEDRAO ', nascimento: '2000-01-01' }, [a, b]),
    { tipo: 'duplicado', alunos: [a] });
});

test('semelhante: só nome ou só data', () => {
  assert.equal(R.verificarDuplicata({ nome: 'Ana Pedrão', nascimento: '1999-01-01' }, [a]).tipo, 'semelhante');
  assert.deepEqual(R.verificarDuplicata({ nome: 'Zé Novo', nascimento: '2000-01-01' }, [a, c]).alunos, [a, c]);
  assert.equal(R.verificarDuplicata({ nome: 'Bruno Alvares', nascimento: '2001-02-02' }, [b]).tipo, 'semelhante');
});

test('data vazia não casa com data vazia', () => {
  assert.equal(R.verificarDuplicata({ nome: 'Outro', nascimento: '' }, [b]).tipo, 'nenhum');
  assert.deepEqual(R.verificarDuplicata({ nome: 'Outro', nascimento: '' }, [b]).alunos, []);
});

test('ordem alfabética pt-BR ignorando acento/caixa', () => {
  assert.deepEqual(R.filtrarAlunos([c, b, a], {}).map(x => x.linha), [2, 3, 4]);
});

test('filtrarAlunos não altera a lista original', () => {
  const lista = [c, b, a];
  R.filtrarAlunos(lista, {});
  assert.deepEqual(lista.map(x => x.linha), [4, 3, 2]);
});

test('busca ignora acento e caixa; filtros combinam', () => {
  assert.deepEqual(R.filtrarAlunos([a, b, c], { busca: 'pedrao' }).map(x => x.linha), [2]);
  assert.deepEqual(R.filtrarAlunos([a, b, c], { busca: '  ÁLVA' }).map(x => x.linha), [3]);
  assert.deepEqual(R.filtrarAlunos([a, b, c], { professor: 'Hallwan Santos', turma: 'Academia Pura Vida' }).map(x => x.linha), [4]);
});

test('resumoProgresso', () => {
  assert.deepEqual(R.resumoProgresso(16, 84), { faltam: 68, percentual: 19 });
  assert.deepEqual(R.resumoProgresso(90, 84), { faltam: 0, percentual: 100 });
  assert.deepEqual(R.resumoProgresso(0, 0), { faltam: 0, percentual: 0 });
});
