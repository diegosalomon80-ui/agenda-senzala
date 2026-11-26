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
      // Como o cliente real: erro vira Promise rejeitada, nunca exceção síncrona.
      return new Promise((resolve) => resolve(tratar(acao, dados)));
    }
  };
  w.eval(ler('js/cadastro.js'));
  w.eval(ler('js/app.js'));
  // O jsdom dispara DOMContentLoaded sozinho logo depois; esperar() cobre isso.
  return { w, d: w.document, chamadas };
}

const listar = (extra) => () => ({ ok: true, versao: 'v1', alunos: ALUNOS, completos: 2, meta: 84,
  professores: ['Contramestre Pouca Telha', 'Hallwan Santos', 'Dani Pinguin'],
  turmas: ['Escola de Circo', 'Academia Pura Vida'], ...extra });
const esperar = () => new Promise((r) => setTimeout(r, 50));
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

// ---------- cadastro e meta ----------
function preencher(w, d, valores) {
  for (const [campo, valor] of Object.entries(valores)) {
    const e = d.getElementById('c-' + campo);
    e.value = valor;
    e.dispatchEvent(new w.Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }
}
const ADULTO = { nome: 'Novo Ficticio', nascimento: '1995-05-05', turma: 'Escola de Circo', professor: 'Dani Pinguin',
  whatsapp: '43 99111 0010', emergenciaNome: 'Irmã Ficticia', emergenciaParentesco: 'Irmã', emergenciaWhatsapp: '(43) 99111-0011' };

function comCadastro(respostaCadastrar) {
  const fila = Array.isArray(respostaCadastrar) ? respostaCadastrar.slice() : null;
  return montar((acao, dados) => {
    if (acao === 'listar') return listar()();
    if (acao === 'cadastrar') {
      const r = fila ? fila.shift() : respostaCadastrar;
      if (r instanceof Error) throw r;
      return r;
    }
    if (acao === 'definirMeta') return dados.meta < 2 ? { ok: false, erro: 'dados_invalidos', campos: ['meta'] } : { ok: true, meta: dados.meta };
  });
}

test('cadastro: salvar só habilita com ficha completa; menor pede responsável', async () => {
  const { w, d } = comCadastro({ ok: true });
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  assert.equal(d.getElementById('tela-cadastro').hidden, false);
  const salvar = d.getElementById('c-salvar');
  assert.equal(salvar.disabled, true);
  preencher(w, d, ADULTO);
  assert.equal(salvar.disabled, false);
  assert.equal(d.getElementById('c-grupo-responsavel').hidden, true);
  preencher(w, d, { nascimento: '2015-01-01', whatsapp: '' });
  assert.equal(d.getElementById('c-grupo-responsavel').hidden, false);
  assert.equal(salvar.disabled, true);
  preencher(w, d, { responsavel: 'Mãe Ficticia', whatsappResponsavel: '43991110012' });
  assert.equal(salvar.disabled, false);
});

test('cadastro ok: envia, avisa, volta para a agenda e limpa o formulário', async () => {
  const { w, d, chamadas } = comCadastro({ ok: true, aluno: { linha: 9 } });
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  preencher(w, d, ADULTO);
  d.getElementById('form-cadastro').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  const envio = chamadas.find((c) => c.acao === 'cadastrar');
  assert.equal(envio.dados.aluno.nome, 'Novo Ficticio');
  assert.equal(envio.dados.aluno.whatsapp, '43 99111 0010');
  assert.equal(envio.dados.confirmarSemelhante, false);
  assert.equal(d.getElementById('aviso').textContent, 'Cadastro salvo');
  assert.equal(d.getElementById('tela-agenda').hidden, false);
  assert.equal(d.getElementById('c-nome').value, '');
});

test('cadastro duplicado: avisa, oferece a ficha e não apaga o formulário', async () => {
  const { w, d } = comCadastro({ ok: false, erro: 'duplicado', alunos: [ALUNOS[0]] });
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  preencher(w, d, ADULTO);
  d.getElementById('form-cadastro').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  assert.match(d.getElementById('c-msg').textContent, /Este aluno já está cadastrado/);
  assert.equal(d.getElementById('c-nome').value, 'Novo Ficticio');
  d.querySelector('#c-msg button[data-linha="2"]').click();
  assert.equal(d.getElementById('tela-ficha').hidden, false);
});

test('cadastro semelhante: confirmação reenvia com confirmarSemelhante', async () => {
  const { w, d, chamadas } = comCadastro([{ ok: false, erro: 'semelhante', alunos: [ALUNOS[0]] }, { ok: true, aluno: { linha: 9 } }]);
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  preencher(w, d, ADULTO);
  d.getElementById('form-cadastro').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  assert.match(d.getElementById('c-msg').textContent, /Bruno Ficticio/);
  d.getElementById('c-confirmar').click();
  await esperar();
  const envios = chamadas.filter((c) => c.acao === 'cadastrar');
  assert.equal(envios.length, 2);
  assert.equal(envios[1].dados.confirmarSemelhante, true);
  assert.equal(d.getElementById('aviso').textContent, 'Cadastro salvo');
});

test('cadastro sem conexão: mensagem e formulário preservado', async () => {
  const { w, d } = comCadastro(new Error('rede'));
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  preencher(w, d, ADULTO);
  d.getElementById('form-cadastro').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  assert.match(d.getElementById('c-msg').textContent, /Sem conexão/);
  assert.equal(d.getElementById('c-emergenciaNome').value, 'Irmã Ficticia');
  assert.equal(d.getElementById('c-salvar').disabled, false);
});

test('cadastro com dados_invalidos marca os campos', async () => {
  const { w, d } = comCadastro({ ok: false, erro: 'dados_invalidos', campos: ['turma'] });
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  preencher(w, d, ADULTO);
  d.getElementById('form-cadastro').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  assert.ok(d.getElementById('c-turma').closest('.campo').classList.contains('pendente'));
});

test('meta: recusa abaixo dos completos e salva valor válido', async () => {
  const { w, d } = comCadastro({ ok: true });
  await esperar();
  d.getElementById('progresso').click();
  assert.equal(d.getElementById('form-meta').hidden, false);
  assert.equal(d.getElementById('campo-meta').value, '84');
  d.getElementById('campo-meta').value = '1';
  d.getElementById('form-meta').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  assert.equal(d.getElementById('meta-msg').textContent, 'A meta não pode ser menor que os cadastros completos');
  d.getElementById('campo-meta').value = '90';
  d.getElementById('form-meta').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  assert.equal(d.getElementById('progresso-meta').textContent, '90');
  assert.equal(d.getElementById('form-meta').hidden, true);
});

test('toque duplo em salvar envia uma vez só', async () => {
  const { w, d, chamadas } = comCadastro({ ok: true, aluno: { linha: 9 } });
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  preencher(w, d, ADULTO);
  const form = d.getElementById('form-cadastro');
  form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  assert.equal(chamadas.filter((c) => c.acao === 'cadastrar').length, 1);
});

test('marcação do servidor some só quando o campo é editado', async () => {
  const { w, d } = comCadastro({ ok: false, erro: 'dados_invalidos', campos: ['turma'] });
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  preencher(w, d, ADULTO);
  d.getElementById('form-cadastro').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  const caixa = d.getElementById('c-turma').closest('.campo');
  preencher(w, d, { nome: 'Outro Nome' });
  assert.ok(caixa.classList.contains('pendente'));
  preencher(w, d, { turma: 'Academia Pura Vida' });
  assert.ok(!caixa.classList.contains('pendente'));
});

test('token expirado no meio do cadastro: renova e salva sem perder nada (api.js real)', async () => {
  const html = ler('index.html').replace(/<script[\s\S]*?<\/script>/g, '');
  const w = new JSDOM(html, { runScripts: 'outside-only', url: 'https://exemplo.test/' }).window;
  abertas.push(w);
  const enviados = [];
  let renovacoes = 0;
  w.eval(ler('js/config.js'));
  w.eval(ler('js/regras.js'));
  w.CONFIG.API_URL = 'https://api.exemplo.test/exec';
  w.Sessao = { iniciar: (cb) => cb(), token: () => (renovacoes ? 'novo' : 'velho'),
    renovar: () => { renovacoes++; return Promise.resolve('novo'); }, sair: () => {} };
  w.fetch = (url, opts) => {
    const corpo = JSON.parse(opts.body);
    enviados.push(corpo);
    let resp;
    if (corpo.idToken === 'velho' && corpo.acao === 'cadastrar') resp = { ok: false, erro: 'token_invalido' };
    else if (corpo.acao === 'listar') resp = listar()();
    else resp = { ok: true, aluno: { linha: 9 } };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(resp) });
  };
  w.eval(ler('js/api.js'));
  w.eval(ler('js/cadastro.js'));
  w.eval(ler('js/app.js'));
  const d = w.document;
  await esperar();
  d.querySelector('[data-acao="novo"]').click();
  preencher(w, d, ADULTO);
  d.getElementById('form-cadastro').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await esperar();
  const cadastros = enviados.filter((c) => c.acao === 'cadastrar');
  assert.deepEqual(cadastros.map((c) => c.idToken), ['velho', 'novo']);
  assert.equal(cadastros[1].aluno.emergenciaNome, 'Irmã Ficticia');
  assert.equal(renovacoes, 1);
  assert.equal(d.getElementById('aviso').textContent, 'Cadastro salvo');
});

test('filtros incluem valores que só existem nos dados', async () => {
  const extra = { ...ALUNOS[0], linha: 9, nome: 'Visitante Teste', professor: 'Professor Visitante', turma: 'Turma Nova' };
  const { w, d } = montar(listar({ alunos: [...ALUNOS, extra] }));
  await esperar();
  const opcoes = (id) => [...d.getElementById(id).options].map((o) => o.value);
  assert.ok(opcoes('filtro-professor').includes('Professor Visitante'));
  assert.ok(opcoes('filtro-turma').includes('Turma Nova'));
  assert.equal(opcoes('filtro-professor').filter((v) => v === 'Dani Pinguin').length, 1);
  const prof = d.getElementById('filtro-professor');
  prof.value = 'Professor Visitante';
  prof.dispatchEvent(new w.Event('change'));
  assert.deepEqual(nomesVisiveis(d), ['Visitante Teste']);
});
