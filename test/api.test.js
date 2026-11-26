const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Em Apps Script tudo é global; aqui reproduzimos isso antes de carregar a API.
Object.assign(globalThis, require('../api/Regras.js'), require('../api/Auth.js'));
const { tratarRequisicao } = require('../api/Api.js');
const { ErroApi } = require('../api/Auth.js');

const CFG = { emails: ['prof@gmail.com'], professores: ['Dani Pinguin', 'Hallwan Santos'],
  turmas: ['Escola de Circo'], meta: 84, clientId: 'c', planilhaId: 'p' };

function adulto(extra) {
  return { nome: 'Fulano Ficticio', nascimento: '1990-01-01', whatsapp: '(43) 99111-1111', turma: 'Escola de Circo',
    professor: 'Dani Pinguin', responsavel: '', whatsappResponsavel: '', emergenciaNome: 'Ciclana',
    emergenciaParentesco: 'Mãe', emergenciaWhatsapp: '(43) 99222-2222', ...extra };
}

function criarDeps(opcoes = {}) {
  const estado = { alunos: (opcoes.alunos || []).map((a, i) => ({ linha: i + 2, ...a })), anexados: [], meta: CFG.meta };
  const deps = {
    verificarProfessor: opcoes.verificarProfessor || ((t) => {
      if (t !== 'tok') throw new ErroApi('nao_autorizado');
      return 'prof@gmail.com';
    }),
    config: () => ({ ...CFG, meta: estado.meta }),
    salvarMeta: (n) => { estado.meta = n; },
    lerAlunos: () => estado.alunos.slice(),
    anexarAluno: (a) => {
      estado.anexados.push(a);
      estado.alunos.push({ ...a, linha: estado.alunos.length + 2 });
      return estado.alunos.length + 1;
    },
    comLock: opcoes.comLock || ((fn) => fn()),
    agora: () => new Date('2026-11-26T12:00:00-03:00'),
    hash: (s) => crypto.createHash('md5').update(s).digest('hex')
  };
  return { deps, estado };
}

const cadastrar = (deps, aluno, extra) => tratarRequisicao({ acao: 'cadastrar', idToken: 'tok', aluno, ...extra }, deps);

test('não autorizado não devolve alunos', () => {
  const { deps } = criarDeps({ alunos: [adulto()] });
  assert.deepEqual(tratarRequisicao({ acao: 'listar', idToken: 'outro' }, deps), { ok: false, erro: 'nao_autorizado' });
});

test('token expirado devolve token_invalido', () => {
  const { deps } = criarDeps({ verificarProfessor: () => { throw new ErroApi('token_invalido'); } });
  assert.deepEqual(tratarRequisicao({ acao: 'listar', idToken: 'velho' }, deps), { ok: false, erro: 'token_invalido' });
});

test('listar devolve completos, meta, listas e versão; inalterado quando versão bate', () => {
  const { deps } = criarDeps({ alunos: [adulto(), adulto({ nome: 'Incompleto', emergenciaNome: '' })] });
  const r = tratarRequisicao({ acao: 'listar', idToken: 'tok' }, deps);
  assert.equal(r.ok, true);
  assert.equal(r.alunos.length, 2);
  assert.equal(r.completos, 1);
  assert.equal(r.meta, 84);
  assert.deepEqual(r.professores, CFG.professores);
  assert.deepEqual(r.turmas, CFG.turmas);
  assert.deepEqual(tratarRequisicao({ acao: 'listar', idToken: 'tok', versao: r.versao }, deps),
    { ok: true, inalterado: true, versao: r.versao });
});

test('cadastrar normaliza telefones e nome, e grava', () => {
  const { deps, estado } = criarDeps();
  const r = cadastrar(deps, adulto({ whatsapp: '43991234567', nome: '  Novo   Aluno ' }));
  assert.equal(r.ok, true);
  assert.equal(estado.anexados[0].whatsapp, '(43) 99123-4567');
  assert.equal(estado.anexados[0].nome, 'Novo Aluno');
  assert.equal(r.aluno.linha, 2);
});

test('cadastrar ignora campos extras enviados pelo navegador', () => {
  const { deps, estado } = criarDeps();
  cadastrar(deps, adulto({ email: 'x@y', linha: 99, situacao: 'Ativo' }));
  assert.deepEqual(Object.keys(estado.anexados[0]).sort(),
    ['emergenciaNome', 'emergenciaParentesco', 'emergenciaWhatsapp', 'nascimento', 'nome', 'professor',
      'responsavel', 'turma', 'whatsapp', 'whatsappResponsavel']);
});

test('cadastrar incompleto ou inválido devolve campos', () => {
  const { deps, estado } = criarDeps();
  const r = cadastrar(deps, adulto({ whatsapp: '', emergenciaWhatsapp: '12', professor: 'Fulano', turma: 'Outra' }));
  assert.equal(r.erro, 'dados_invalidos');
  assert.deepEqual(r.campos.sort(), ['emergenciaWhatsapp', 'professor', 'turma', 'whatsapp']);
  for (const nascimento of ['', '2026-02-30', '2030-01-01']) {
    assert.deepEqual(cadastrar(deps, adulto({ nascimento })).campos, ['nascimento'], nascimento);
  }
  assert.equal(cadastrar(deps, null).erro, 'dados_invalidos');
  assert.equal(estado.anexados.length, 0);
});

test('semelhante: recusa sem confirmação, grava com confirmação', () => {
  const { deps, estado } = criarDeps({ alunos: [adulto()] });
  const novo = adulto({ nascimento: '1991-01-01' });
  const r = cadastrar(deps, novo);
  assert.equal(r.erro, 'semelhante');
  assert.equal(r.alunos.length, 1);
  assert.equal(estado.anexados.length, 0);
  assert.equal(cadastrar(deps, novo, { confirmarSemelhante: true }).ok, true);
});

test('duplicado é recusado mesmo com confirmação', () => {
  const { deps, estado } = criarDeps({ alunos: [adulto()] });
  const r = cadastrar(deps, adulto({ nome: 'FULANO FICTÍCIO' }), { confirmarSemelhante: true });
  assert.equal(r.erro, 'duplicado');
  assert.equal(estado.anexados.length, 0);
});

test('concorrência: outro professor grava o mesmo aluno antes do lock', () => {
  let estado;
  const criado = criarDeps({ comLock: (fn) => { estado.alunos.push({ ...adulto(), linha: 2 }); return fn(); } });
  estado = criado.estado;
  const r = cadastrar(criado.deps, adulto());
  assert.equal(r.erro, 'duplicado');
  assert.equal(estado.anexados.length, 0);
});

test('definirMeta valida e salva', () => {
  const { deps, estado } = criarDeps({ alunos: [adulto(), adulto({ nome: 'Outro', nascimento: '1980-01-01' })] });
  for (const meta of [1, 2.5, 1001, 'abc', null]) {
    assert.deepEqual(tratarRequisicao({ acao: 'definirMeta', idToken: 'tok', meta }, deps),
      { ok: false, erro: 'dados_invalidos', campos: ['meta'] }, String(meta));
  }
  assert.deepEqual(tratarRequisicao({ acao: 'definirMeta', idToken: 'tok', meta: 90 }, deps), { ok: true, meta: 90 });
  assert.equal(estado.meta, 90);
});

test('ação desconhecida e erro inesperado', () => {
  const { deps } = criarDeps();
  assert.deepEqual(tratarRequisicao({ acao: 'apagar', idToken: 'tok' }, deps),
    { ok: false, erro: 'dados_invalidos', campos: ['acao'] });
  deps.lerAlunos = () => { throw new Error('Coluna ausente: Turma'); };
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(tratarRequisicao({ acao: 'listar', idToken: 'tok' }, deps), { ok: false, erro: 'interno' });
  } finally {
    console.error = original;
  }
});

// ---------- sessões persistentes ----------
function comSessoes(opcoes) {
  const criado = criarDeps(opcoes);
  const sessoes = new Map();
  let chamadasGoogle = 0;
  const verificar = criado.deps.verificarProfessor;
  criado.deps.verificarProfessor = (t) => { chamadasGoogle++; return verificar(t); };
  criado.deps.criarSessao = (email) => { const k = 'k'.repeat(63) + sessoes.size; sessoes.set(k, email); return k; };
  criado.deps.lerSessao = (k) => (sessoes.has(k) ? sessoes.get(k) : null);
  criado.deps.apagarSessao = (k) => { sessoes.delete(k); };
  return { ...criado, sessoes, google: () => chamadasGoogle };
}

test('entrar devolve sessão do professor autorizado', () => {
  const { deps, sessoes } = comSessoes();
  const r = tratarRequisicao({ acao: 'entrar', idToken: 'tok' }, deps);
  assert.equal(r.ok, true);
  assert.equal(typeof r.sessao, 'string');
  assert.equal(r.sessao.length, 64);
  assert.equal(sessoes.get(r.sessao), 'prof@gmail.com');
});

test('entrar com e-mail não autorizado não cria sessão', () => {
  const { deps, sessoes } = comSessoes();
  assert.deepEqual(tratarRequisicao({ acao: 'entrar', idToken: 'outro' }, deps), { ok: false, erro: 'nao_autorizado' });
  assert.equal(sessoes.size, 0);
});

test('listar com sessão válida não consulta o Google', () => {
  const { deps, google } = comSessoes();
  const { sessao } = tratarRequisicao({ acao: 'entrar', idToken: 'tok' }, deps);
  const antes = google();
  assert.equal(tratarRequisicao({ acao: 'listar', sessao }, deps).ok, true);
  assert.equal(google(), antes);
});

test('sessão desconhecida devolve sessao_invalida', () => {
  const { deps } = comSessoes();
  assert.deepEqual(tratarRequisicao({ acao: 'listar', sessao: 'desconhecida' }, deps), { ok: false, erro: 'sessao_invalida' });
});

test('professor removido da lista perde o acesso mesmo com sessão', () => {
  const { deps } = comSessoes();
  const { sessao } = tratarRequisicao({ acao: 'entrar', idToken: 'tok' }, deps);
  const config = deps.config;
  deps.config = () => ({ ...config(), emails: [] });
  assert.deepEqual(tratarRequisicao({ acao: 'listar', sessao }, deps), { ok: false, erro: 'nao_autorizado' });
});

test('sair apaga a sessão; sair de novo continua ok', () => {
  const { deps } = comSessoes();
  const { sessao } = tratarRequisicao({ acao: 'entrar', idToken: 'tok' }, deps);
  assert.deepEqual(tratarRequisicao({ acao: 'sair', sessao }, deps), { ok: true });
  assert.deepEqual(tratarRequisicao({ acao: 'listar', sessao }, deps), { ok: false, erro: 'sessao_invalida' });
  assert.deepEqual(tratarRequisicao({ acao: 'sair', sessao }, deps), { ok: true });
});

test('entrar exige login do Google: uma sessão não gera outra (Sair encerra de verdade)', () => {
  const { deps, sessoes } = comSessoes();
  const { sessao } = tratarRequisicao({ acao: 'entrar', idToken: 'tok' }, deps);
  const r = tratarRequisicao({ acao: 'entrar', sessao }, deps);
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'nao_autorizado');
  assert.equal(sessoes.size, 1);
});
