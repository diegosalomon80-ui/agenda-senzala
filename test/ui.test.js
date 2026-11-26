// Testes de interface num DOM simulado (jsdom). Login e API são substituídos por dublês.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const web = path.join(__dirname, '..', 'web');
const ler = (p) => fs.readFileSync(path.join(web, p), 'utf8');

const ALUNOS = [
  { linha: 2, nome: 'Bruno Ficticio', nascimento: '1990-02-02', whatsapp: '(43) 99111-0002', turma: 'Escola de Circo',
    professor: 'Hallwan Santos', responsavel: '', whatsappResponsavel: '', emergenciaNome: 'Mãe Ficticia',
    emergenciaParentesco: 'Mãe', emergenciaWhatsapp: '(43) 99111-0003' },
  { linha: 3, nome: 'Ana Pedrão Teste', nascimento: '2016-03-03', whatsapp: '', turma: 'Academia Pura Vida',
    professor: 'Dani Pinguin', responsavel: 'Pai Ficticio', whatsappResponsavel: '(43) 99111-0004',
    emergenciaNome: 'Avó Ficticia', emergenciaParentesco: 'Avó', emergenciaWhatsapp: '(43) 99111-0005' },
  { linha: 4, nome: 'Carla <b>Sem</b> Emergencia', nascimento: '1985-04-04', whatsapp: '(43) 99111-0006',
    turma: 'Escola de Circo', professor: 'Dani Pinguin', responsavel: '', whatsappResponsavel: '',
    emergenciaNome: '', emergenciaParentesco: '', emergenciaWhatsapp: '' }
];

const abertas = [];
test.afterEach(() => { while (abertas.length) abertas.pop().close(); });

function montar(tratar) {
  const html = ler('index.html').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://exemplo.test/' });
  const w = dom.window;
  abertas.push(w);
  const chamadas = [];
  w.eval(ler('js/config.js'));
  w.eval(ler('js/regras.js'));
  w.Sessao = { iniciar: (cb) => cb(), token: () => 'tok', renovar: () => Promise.resolve('tok'), sair: () => {} };
  w.Api = {
    chamar: (acao, dados) => {
      chamadas.push({ acao, dados });
      return Promise.resolve(tratar(acao, dados));
    }
  };
  if (fs.existsSync(path.join(web, 'js/cadastro.js'))) w.eval(ler('js/cadastro.js'));
  w.eval(ler('js/app.js'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return { w, d: w.document, chamadas };
}

const listar = (extra) => () => ({ ok: true, versao: 'v1', alunos: ALUNOS, completos: 2, meta: 84,
  professores: ['Contramestre Pouca Telha', 'Hallwan Santos', 'Dani Pinguin'],
  turmas: ['Escola de Circo', 'Academia Pura Vida'], ...extra });
const esperar = () => new Promise((r) => setTimeout(r, 20));
const nomesVisiveis = (d) => [...d.querySelectorAll('#lista button')].map((b) => b.querySelector('span span').textContent);

test('agenda: progresso, ordem alfabética e etiqueta de incompleto', async () => {
  const { d } = montar(listar());
  await esperar();
  assert.equal(d.getElementById('progresso-completos').textContent, '2');
  assert.equal(d.getElementById('progresso-meta').textContent, '84');
  assert.equal(d.getElementById('progresso-faltam').textContent, 'faltam 82');
  assert.deepEqual(nomesVisiveis(d), ['Ana Pedrão Teste', 'Bruno Ficticio', 'Carla <b>Sem</b> Emergencia']);
  const incompletos = [...d.querySelectorAll('#lista .etiqueta')].map((e) => e.closest('button').dataset.linha);
  assert.deepEqual(incompletos, ['4']);
});

test('texto da planilha não vira HTML', async () => {
  const { d } = montar(listar());
  await esperar();
  assert.equal(d.querySelectorAll('#lista b').length, 0);
});

test('busca sem acento e filtros combinados', async () => {
  const { w, d } = montar(listar());
  await esperar();
  const busca = d.getElementById('busca');
  busca.value = 'pedrao';
  busca.dispatchEvent(new w.Event('input'));
  assert.deepEqual(nomesVisiveis(d), ['Ana Pedrão Teste']);
  busca.value = '';
  busca.dispatchEvent(new w.Event('input'));
  const prof = d.getElementById('filtro-professor');
  prof.value = 'Dani Pinguin';
  prof.dispatchEvent(new w.Event('change'));
  const turma = d.getElementById('filtro-turma');
  turma.value = 'Escola de Circo';
  turma.dispatchEvent(new w.Event('change'));
  assert.deepEqual(nomesVisiveis(d), ['Carla <b>Sem</b> Emergencia']);
});

test('ficha de menor mostra responsável; de adulto não', async () => {
  const { d } = montar(listar());
  await esperar();
  d.querySelector('#lista button[data-linha="3"]').click();
  assert.equal(d.getElementById('tela-ficha').hidden, false);
  const titulos = () => [...d.querySelectorAll('#ficha-corpo h3')].map((h) => h.textContent);
  assert.deepEqual(titulos(), ['WhatsApp do aluno', 'Responsável legal', 'Contato de emergência']);
  assert.ok(d.querySelector('#ficha-corpo a[href="https://wa.me/5543991110004"]'));
  d.querySelector('[data-acao="voltar"]');
  d.defaultView.history.replaceState({ tela: 'ficha', linha: 2 }, '');
  d.defaultView.dispatchEvent(new d.defaultView.PopStateEvent('popstate', { state: { tela: 'ficha', linha: 2 } }));
  assert.deepEqual(titulos(), ['WhatsApp do aluno', 'Contato de emergência']);
  assert.ok(d.querySelector('#ficha-corpo a[href="tel:+5543991110002"]'));
});

test('ficha mostra "não informado" para campo vazio', async () => {
  const { d } = montar(listar());
  await esperar();
  d.querySelector('#lista button[data-linha="4"]').click();
  assert.ok([...d.querySelectorAll('#ficha-corpo .vazio')].some((p) => p.textContent === 'não informado'));
});

test('atualização envia a versão conhecida e mantém a busca digitada', async () => {
  const { w, d, chamadas } = montar(listar());
  await esperar();
  const busca = d.getElementById('busca');
  busca.value = 'bru';
  busca.dispatchEvent(new w.Event('input'));
  await w.App.atualizar();
  assert.equal(chamadas.at(-1).dados.versao, 'v1');
  assert.equal(busca.value, 'bru');
  assert.deepEqual(nomesVisiveis(d), ['Bruno Ficticio']);
});
