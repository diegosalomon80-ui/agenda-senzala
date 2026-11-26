const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../api/Planilha.js');
const C = require('../api/Config.js');

// Os 22 cabeçalhos da aba "Alunos" (spec §3), em ordem.
const CABECALHOS = [
  'Nome completo', 'Nome de capoeira', 'Data de nascimento', 'WhatsApp', 'E-mail', 'Turma', 'Horário',
  'Professor responsável', 'Graduação atual', 'Data de entrada', 'Situação', 'Responsável legal (menores)',
  'WhatsApp do responsável', 'Última atualização', 'Contato de emergência — nome',
  'Contato de emergência — parentesco', 'Contato de emergência — WhatsApp', 'ID do envio do site',
  'Origem do cadastro', 'Tipo de envio do site', 'Ano de início', 'Aviso de matrícula'
];
const EMBARALHADOS = CABECALHOS.slice().reverse();
const m = P.mapearCabecalhos(CABECALHOS);
const idx = (h) => CABECALHOS.indexOf(h);

const alunoFicticio = {
  nome: 'Teste da Silva', nascimento: '2015-05-05', whatsapp: '', turma: 'Escola de Circo',
  professor: 'Dani Pinguin', responsavel: 'Mãe Teste', whatsappResponsavel: '(43) 99000-0001',
  emergenciaNome: 'Tia Teste', emergenciaParentesco: 'Tia', emergenciaWhatsapp: '(43) 99000-0002'
};

test('mapeia por texto, não por posição', () => {
  const me = P.mapearCabecalhos(EMBARALHADOS);
  assert.equal(EMBARALHADOS[me.emergenciaWhatsapp], 'Contato de emergência — WhatsApp');
  assert.equal(EMBARALHADOS[me.nome], 'Nome completo');
});

test('tolera espaços em volta do cabeçalho', () => {
  const comEspaco = CABECALHOS.map((h) => ' ' + h + ' ');
  assert.equal(P.mapearCabecalhos(comEspaco).turma, idx('Turma'));
});

test('falha com coluna ausente', () => {
  assert.throws(() => P.mapearCabecalhos(CABECALHOS.filter((h) => h !== 'WhatsApp do responsável')),
    /Coluna ausente: WhatsApp do responsável/);
});

test('Date do Sheets vira AAAA-MM-DD sem deslocar dia', () => {
  const linha = Array(22).fill('');
  linha[m.nascimento] = new Date('2015-05-05T03:00:00Z'); // meia-noite em São Paulo
  linha[m.nome] = ' Teste ';
  linha[m.whatsapp] = 43991234567;
  const aluno = P.linhaParaAluno(linha, m, 7);
  assert.equal(aluno.nascimento, '2015-05-05');
  assert.equal(aluno.nome, 'Teste');
  assert.equal(aluno.whatsapp, '43991234567');
  assert.equal(aluno.linha, 7);
});

test('alunoParaLinha preenche só o permitido', () => {
  const l = P.alunoParaLinha(alunoFicticio, m, 22, '26/11/2026 10:00:00');
  assert.equal(l.length, 22);
  assert.equal(l[m.origem], 'App professores');
  assert.equal(l[m.situacao], 'Cadastro para confirmar');
  assert.equal(l[m.ultimaAtualizacao], "'26/11/2026 10:00:00");
  assert.equal(l[idx('Nome completo')], 'Teste da Silva');
  assert.equal(l[idx('Data de nascimento')], "'2015-05-05");
  assert.equal(l[idx('ID do envio do site')], '');
  assert.equal(l[idx('E-mail')], '');
});

test('alunoParaLinha neutraliza fórmulas digitadas', () => {
  const l = P.alunoParaLinha({ ...alunoFicticio, nome: '=IMPORTRANGE("x")', emergenciaParentesco: '+Tio' }, m, 22, 'x');
  assert.equal(l[idx('Nome completo')], "'=IMPORTRANGE(\"x\")");
  assert.equal(l[idx('Contato de emergência — parentesco')], "'+Tio");
});

test('montarConfig: padrões e listas', () => {
  const c = C.montarConfig({ PLANILHA_ID: 'abc', CLIENT_ID: 'cli', PROFESSORES_EMAILS: ' A@Gmail.com , b@gmail.com,' });
  assert.deepEqual(c.emails, ['a@gmail.com', 'b@gmail.com']);
  assert.deepEqual(c.professores, ['Contramestre Pouca Telha', 'Hallwan Santos', 'Dani Pinguin']);
  assert.equal(c.turmas.length, 4);
  assert.equal(c.meta, 84);
  const d = C.montarConfig({ TURMAS: 'X | Y', META_CADASTROS: '90' });
  assert.deepEqual(d.turmas, ['X', 'Y']);
  assert.equal(d.meta, 90);
  assert.deepEqual(d.emails, []);
});

test('Date lido no fuso da planilha, não fixo em São Paulo', () => {
  const linha = Array(22).fill('');
  linha[m.nome] = 'Teste';
  linha[m.nascimento] = new Date('2015-05-05T00:00:00Z'); // meia-noite numa planilha em UTC
  assert.equal(P.linhaParaAluno(linha, m, 2, 'Etc/UTC').nascimento, '2015-05-05');
});

test('Última atualização gravada como texto exato (sem conversão pelo Sheets)', () => {
  const l = P.alunoParaLinha(alunoFicticio, m, 22, '05/11/2026 10:00:00');
  assert.equal(l[m.ultimaAtualizacao], "'05/11/2026 10:00:00");
});
