# Agenda de contatos dos professores — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA instalável em que os três professores consultam e completam os contatos dos alunos, lendo e gravando na planilha Google oficial por uma API Apps Script autenticada.

**Architecture:** Front-end estático (HTML/CSS/JS puro, sem build) publicado no GitHub Pages; login com Google Identity Services gera um ID token que acompanha cada chamada a um Web App Apps Script *standalone*. A API valida o token, confere o e-mail numa lista de autorizados e só então lê a aba `Alunos` ou acrescenta uma linha. As regras de negócio vivem num único arquivo JS puro (`shared/regras.js`), testado em Node e copiado para a API e para o front.

**Tech Stack:** JavaScript (ES2019, sem módulos ES — precisa rodar em Apps Script V8, navegador e Node), Node ≥ 20 com `node:test` (sem dependências npm de runtime), `@google/clasp` (CLI, para publicar a API), Google Identity Services, GitHub Pages via GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-26-agenda-professores-design.md`

## Global Constraints

- Nunca alterar nem apagar linhas existentes da aba `Alunos`; a única escrita permitida é `appendRow` dentro de `LockService`.
- Colunas localizadas pelo texto exato do cabeçalho (lista na spec §3), nunca por posição.
- Nenhum segredo no front-end nem no repositório. Client ID OAuth e URL do Web App são públicos; `PLANILHA_ID`, e-mails autorizados e listas ficam em Script Properties.
- Nenhum dado real de aluno em código, testes, fixtures, capturas ou commits. Usar nomes inventados.
- Nenhum dado de aluno persistido no aparelho (sem localStorage/IndexedDB/cache do service worker para respostas da API).
- `Origem do cadastro = "App professores"`, `Situação = "Cadastro para confirmar"` em todo cadastro do app.
- Telefones gravados no formato `(DD) 9XXXX-XXXX` (celular) ou `(DD) XXXX-XXXX` (fixo).
- `Última atualização` no formato `dd/MM/yyyy HH:mm:ss`, fuso `America/Sao_Paulo`.
- Menor = menos de 18 anos completos na data de hoje (fuso `America/Sao_Paulo`).
- Meta inicial `84`, editável, nunca menor que o número de completos.
- Listas iniciais — professores: `Contramestre Pouca Telha`, `Hallwan Santos`, `Dani Pinguin`; turmas: `Projeto Usina Cultural`, `Academia Pura Vida`, `Escola de Circo`, `2D Centro Aquático e Treinamento Funcional`.
- Textos da interface em português do Brasil. Contraste WCAG AA, alvos de toque ≥ 44 px, fonte base ≥ 16 px.
- Somente serviços gratuitos; nenhuma etapa pode habilitar cobrança.

## Review Focus

1. **Telefone digitado de qualquer jeito** (`43991234567`, `+55 43 99123-4567`, `(43)9123-4567`, com espaços) → normalizado para o padrão ou rejeitado com mensagem clara; nunca gravado cru. *Teste na Task 1.*
2. **Data de nascimento vinda do Sheets como objeto `Date`** (célula formatada como data) em vez de texto → lida corretamente como `AAAA-MM-DD`, sem deslocar um dia por fuso. *Teste na Task 4.*
3. **Mesmo nome com grafia diferente** (acento, maiúsculas, espaços duplos/no fim: "Pedrão" × "PEDRAO ") → reconhecido como o mesmo nome na busca e na regra de duplicata. *Testes nas Tasks 1 e 3.*
4. **Token expirado no meio do uso** (sessão > 1 h, professor preenchendo o cadastro) → API responde `token_invalido`, o front renova o login em silêncio e reenvia; o formulário não é perdido. *Teste da API na Task 6; verificação manual na Task 9.*
5. **Dois professores cadastrando o mesmo aluno ao mesmo tempo** → o segundo recebe `duplicado` (checagem refeita dentro do lock). *Teste na Task 6.*

---

## Estrutura de arquivos

```
shared/regras.js          regras puras (fonte única)
scripts/sincronizar.js    copia shared/regras.js → api/Regras.js e web/js/regras.js
api/appsscript.json       manifesto do Web App
api/Regras.js             (gerado — não editar)
api/Config.js             leitura de Script Properties
api/Planilha.js           mapeamento de colunas + leitura/escrita na aba
api/Auth.js               validação do ID token + lista de autorizados
api/Api.js                roteador doPost
web/index.html            casca única (3 telas + login)
web/css/estilo.css        paleta e layout
web/js/config.js          API_URL e CLIENT_ID (públicos)
web/js/regras.js          (gerado — não editar)
web/js/sessao.js          login Google
web/js/api.js             cliente da API
web/js/app.js             telas e estado
web/manifest.webmanifest, web/sw.js, web/icons/
test/*.test.js            testes Node
.github/workflows/pages.yml
README.md
```

Padrão de exportação dos arquivos JS compartilhados com Node (em `shared/` e `api/`): declarações no escopo global + no fim
`if (typeof module !== 'undefined') module.exports = { ... };` — funciona em Apps Script, navegador e Node.

**Formato do objeto `Aluno`** (usado em todas as tasks):
`{ linha: number, nome, nascimento /* 'AAAA-MM-DD' ou '' */, whatsapp, turma, professor, responsavel, whatsappResponsavel, emergenciaNome, emergenciaParentesco, emergenciaWhatsapp }` — todos os campos não numéricos são `string` (vazio = `''`).

---

### Task 1: Repositório, sincronização e normalização de texto/telefone

**Files:**
- Create: `package.json`, `.gitignore`, `shared/regras.js`, `scripts/sincronizar.js`, `test/regras-texto.test.js`, `test/sincronizar.test.js`

**Interfaces:**
- Produces: `normalizarNome(nome: string) -> string`, `normalizarTelefone(tel: string) -> string|null`, `linkWhatsApp(tel: string) -> string|null`; comando `npm run sincronizar`; `npm test`.

- [ ] **Step 1: Inicializar o repositório**

`git init -b main`; `package.json` com `"private": true`, scripts `"test": "node --test test/"` e `"sincronizar": "node scripts/sincronizar.js"`, sem dependências. `.gitignore`: `node_modules/`, `.clasprc.json`, `*.pdf`, `*.xlsx`, `*.csv` (impede commitar exportações da planilha real).

- [ ] **Step 2: Escrever testes que falham** em `test/regras-texto.test.js`

```js
const R = require('../shared/regras.js');
test('normalizarNome', () => {
  assert.equal(R.normalizarNome('  Ana  PEDRÃO '), 'ana pedrao');
  assert.equal(R.normalizarNome('José da Silva'), R.normalizarNome('jose  DA silva'));
  assert.equal(R.normalizarNome(''), '');
});
test('normalizarTelefone aceita formatos comuns', () => {
  for (const t of ['43991234567', '(43) 99123-4567', '+55 43 99123-4567', '55 (43) 9 9123 4567'])
    assert.equal(R.normalizarTelefone(t), '(43) 99123-4567');
  assert.equal(R.normalizarTelefone('4333221100'), '(43) 3322-1100');
});
test('normalizarTelefone rejeita inválidos', () => {
  for (const t of ['', '99123-4567', '123', '(43) 99123-45678', 'abc']) assert.equal(R.normalizarTelefone(t), null);
});
test('linkWhatsApp', () => {
  assert.equal(R.linkWhatsApp('(43) 99123-4567'), 'https://wa.me/5543991234567');
  assert.equal(R.linkWhatsApp(''), null);
});
```

- [ ] **Step 3: Rodar `npm test`** — Expected: FAIL (`Cannot find module '../shared/regras.js'`).

- [ ] **Step 4: Implementar em `shared/regras.js`**

`normalizarNome`: `normalize('NFD')`, remove diacríticos, minúsculas, `trim`, colapsa espaços. `normalizarTelefone`: só dígitos; remove prefixo `55` se sobrarem 12–13 dígitos; aceita 10 (fixo) ou 11 dígitos com terceiro dígito `9` (celular); senão `null`.

- [ ] **Step 5: Teste e implementação de `scripts/sincronizar.js`**

Teste `test/sincronizar.test.js`: depois de executar o script, `api/Regras.js` e `web/js/regras.js` devem ser iguais a `shared/regras.js` precedido da linha `// GERADO por scripts/sincronizar.js — edite shared/regras.js`. O script cria as pastas se não existirem.

- [ ] **Step 6: Rodar `npm test`** — Expected: PASS.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: regras de nome e telefone + sincronização"`

---

### Task 2: Menor de idade e cadastro completo

**Files:**
- Modify: `shared/regras.js`
- Test: `test/regras-completo.test.js`

**Interfaces:**
- Consumes: `normalizarTelefone` (Task 1).
- Produces: `idadeEm(nascimento: string, hoje: Date) -> number|null`, `ehMenor(nascimento: string, hoje: Date) -> boolean`, `camposFaltando(aluno: Aluno, hoje: Date) -> string[]` (chaves do `Aluno`), `cadastroCompleto(aluno, hoje) -> boolean`, `contarCompletos(alunos: Aluno[], hoje: Date) -> number`.

- [ ] **Step 1: Escrever testes que falham**

```js
const hoje = new Date('2026-11-26T12:00:00-03:00');
const base = { nome: 'Fulano Teste', nascimento: '1990-01-01', whatsapp: '(43) 99111-1111',
  responsavel: '', whatsappResponsavel: '', emergenciaNome: 'Ciclana', emergenciaParentesco: 'Mãe',
  emergenciaWhatsapp: '(43) 99222-2222' };
test('idade e menoridade', () => {
  assert.equal(R.idadeEm('2008-11-26', hoje), 18);
  assert.equal(R.ehMenor('2008-11-26', hoje), false);   // faz 18 hoje
  assert.equal(R.ehMenor('2008-11-27', hoje), true);
  assert.equal(R.ehMenor('', hoje), false);             // sem data = adulto
  assert.equal(R.idadeEm('2026-13-40', hoje), null);
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
test('emergência sempre obrigatória e telefone inválido conta como faltando', () => {
  assert.deepEqual(R.camposFaltando({ ...base, emergenciaParentesco: ' ', emergenciaWhatsapp: '123' }, hoje),
    ['emergenciaParentesco', 'emergenciaWhatsapp']);
});
test('contarCompletos', () => {
  assert.equal(R.contarCompletos([base, { ...base, nome: '' }], hoje), 1);
});
```

- [ ] **Step 2: Rodar `npm test`** — Expected: FAIL (`R.idadeEm is not a function`).

- [ ] **Step 3: Implementar** — `idadeEm` interpreta `AAAA-MM-DD` como data civil (sem fuso) e compara com o ano/mês/dia de `hoje` em `America/Sao_Paulo` (`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`); data inexistente ou futura → `null`. `camposFaltando` retorna as chaves na ordem `nome, whatsapp, responsavel, whatsappResponsavel, emergenciaNome, emergenciaParentesco, emergenciaWhatsapp`; campos de telefone contam como faltando se `normalizarTelefone` der `null`.

- [ ] **Step 4: Rodar `npm test`** — Expected: PASS.

- [ ] **Step 5: Commit** — `feat: regra de menor e de cadastro completo`

---

### Task 3: Duplicatas e filtro/ordenação da agenda

**Files:**
- Modify: `shared/regras.js`
- Test: `test/regras-agenda.test.js`

**Interfaces:**
- Consumes: `normalizarNome` (Task 1).
- Produces: `verificarDuplicata(novo: {nome, nascimento}, existentes: Aluno[]) -> { tipo: 'duplicado'|'semelhante'|'nenhum', alunos: Aluno[] }`; `filtrarAlunos(alunos: Aluno[], filtro: { busca?: string, professor?: string, turma?: string }) -> Aluno[]` (nova lista, ordenada).

- [ ] **Step 1: Escrever testes que falham**

```js
const a = { linha: 2, nome: 'Ana Pedrão', nascimento: '2000-01-01', professor: 'Hallwan Santos', turma: 'Escola de Circo' };
const b = { linha: 3, nome: 'bruno Álvares', nascimento: '', professor: 'Dani Pinguin', turma: 'Academia Pura Vida' };
const c = { linha: 4, nome: 'Carla Souza', nascimento: '2000-01-01', professor: 'Hallwan Santos', turma: 'Academia Pura Vida' };
test('duplicado: nome normalizado + data', () => {
  assert.deepEqual(R.verificarDuplicata({ nome: 'ANA  PEDRAO ', nascimento: '2000-01-01' }, [a, b]), { tipo: 'duplicado', alunos: [a] });
});
test('semelhante: só nome ou só data', () => {
  assert.equal(R.verificarDuplicata({ nome: 'Ana Pedrão', nascimento: '1999-01-01' }, [a]).tipo, 'semelhante');
  assert.deepEqual(R.verificarDuplicata({ nome: 'Zé Novo', nascimento: '2000-01-01' }, [a, c]).alunos, [a, c]);
  assert.equal(R.verificarDuplicata({ nome: 'Bruno Alvares', nascimento: '2001-02-02' }, [b]).tipo, 'semelhante');
});
test('data vazia não casa com data vazia', () => {
  assert.equal(R.verificarDuplicata({ nome: 'Outro', nascimento: '' }, [b]).tipo, 'nenhum');
});
test('ordem alfabética pt-BR ignorando acento/caixa', () => {
  assert.deepEqual(R.filtrarAlunos([c, b, a], {}).map(x => x.linha), [2, 3, 4]);
});
test('busca ignora acento e caixa; filtros combinam', () => {
  assert.deepEqual(R.filtrarAlunos([a, b, c], { busca: 'pedrao' }).map(x => x.linha), [2]);
  assert.deepEqual(R.filtrarAlunos([a, b, c], { professor: 'Hallwan Santos', turma: 'Academia Pura Vida' }).map(x => x.linha), [4]);
});
```

- [ ] **Step 2: Rodar `npm test`** — Expected: FAIL.
- [ ] **Step 3: Implementar** — ordenação com `Intl.Collator('pt-BR', { sensitivity: 'base' })`; busca = `normalizarNome(aluno.nome).includes(normalizarNome(busca))`; filtro vazio/ausente não filtra.
- [ ] **Step 4: Rodar `npm test`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: duplicatas e filtro da agenda`

---

### Task 4: Mapeamento da planilha e configuração da API

**Files:**
- Create: `api/appsscript.json`, `api/Config.js`, `api/Planilha.js`
- Test: `test/planilha.test.js`

**Interfaces:**
- Produces:
  - `COLUNAS`: objeto `chave do Aluno -> texto do cabeçalho` para os 10 campos do `Aluno` + `ultimaAtualizacao`, `origem`, `situacao` (textos exatos da spec §3).
  - `mapearCabecalhos(cabecalhos: string[]) -> { [chave]: indice0 }` — lança `Error('Coluna ausente: <texto>')`; compara com `trim()`.
  - `linhaParaAluno(valores: any[], mapa, numeroLinha: number) -> Aluno` — `Date` → `AAAA-MM-DD` usando `Utilities.formatDate` quando disponível, senão `Intl` com `America/Sao_Paulo`; números → string; tudo `trim()`.
  - `alunoParaLinha(aluno: Aluno, mapa, totalColunas: number, carimbo: string) -> string[]` — array de tamanho `totalColunas`, preenche só as colunas do `Aluno` (exceto `linha`) + `ultimaAtualizacao = carimbo`, `origem = 'App professores'`, `situacao = 'Cadastro para confirmar'`; demais `''`. Nascimento gravado como texto prefixado com `'` (apóstrofo) para o Sheets não converter.
  - `lerAlunos() -> Aluno[]` (ignora linhas com nome vazio) e `anexarAluno(aluno: Aluno) -> number` (número da linha) — finos, sobre `SpreadsheetApp`, não testados em Node.
  - `config() -> { planilhaId, clientId, emails: string[], professores: string[], turmas: string[], meta: number }` e `salvarMeta(n: number)` em `api/Config.js`. Script Properties: `PLANILHA_ID`, `CLIENT_ID`, `PROFESSORES_EMAILS` (separado por vírgula, comparado em minúsculas), `PROFESSORES_NOMES` e `TURMAS` (separados por `|`), `META_CADASTROS` (padrão `84`).

- [ ] **Step 1: Escrever testes que falham** (cabeçalhos com fixture de 22 colunas copiada da spec, em ordem diferente da real para provar que a posição não importa)

```js
test('mapeia por texto, não por posição', () => {
  const m = P.mapearCabecalhos(CABECALHOS_EMBARALHADOS);
  assert.equal(CABECALHOS_EMBARALHADOS[m.emergenciaWhatsapp], 'Contato de emergência — WhatsApp');
});
test('falha com coluna ausente', () => {
  assert.throws(() => P.mapearCabecalhos(CABECALHOS.filter(h => h !== 'WhatsApp do responsável')), /Coluna ausente: WhatsApp do responsável/);
});
test('Date do Sheets vira AAAA-MM-DD sem deslocar dia', () => {
  const linha = Array(22).fill(''); linha[m.nascimento] = new Date('2015-05-05T03:00:00Z'); linha[m.nome] = ' Teste ';
  assert.equal(P.linhaParaAluno(linha, m, 7).nascimento, '2015-05-05');
  assert.equal(P.linhaParaAluno(linha, m, 7).nome, 'Teste');
});
test('alunoParaLinha preenche só o permitido', () => {
  const l = P.alunoParaLinha(alunoFicticio, m, 22, '26/11/2026 10:00:00');
  assert.equal(l.length, 22);
  assert.equal(l[m.origem], 'App professores');
  assert.equal(l[m.situacao], 'Cadastro para confirmar');
  assert.equal(l[idx('ID do envio do site')], '');
});
```

- [ ] **Step 2: Rodar `npm test`** — Expected: FAIL.
- [ ] **Step 3: Implementar** `api/Planilha.js` e `api/Config.js`. `appsscript.json`: `"runtimeVersion": "V8"`, `"timeZone": "America/Sao_Paulo"`, `"webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }`, `"oauthScopes": ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/script.external_request"]`.
- [ ] **Step 4: Rodar `npm test`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: mapeamento da aba Alunos e configuração`

---

### Task 5: Autenticação dos professores

**Files:**
- Create: `api/Auth.js`
- Test: `test/auth.test.js`

**Interfaces:**
- Consumes: `config()` (Task 4).
- Produces: `validarClaims(claims: object, clientId: string, agoraSeg: number, emails: string[]) -> string` (e-mail em minúsculas) — lança `ErroApi('token_invalido')` ou `ErroApi('nao_autorizado')`; classe `ErroApi(codigo: string, extra?: object)`; `verificarProfessor(idToken: string) -> string` (fino: o cache guarda só o e-mail já validado pelo Google — chave `tok:` + SHA-256 hex do token, TTL `min(exp - agora, 21600)` s —, e a lista `config().emails` é conferida **a cada chamada**, mesmo com cache, para a revogação valer na hora; sem cache, `UrlFetchApp` em `https://oauth2.googleapis.com/tokeninfo?id_token=…` com `muteHttpExceptions`, status ≠ 200 → `token_invalido`).

- [ ] **Step 1: Escrever testes que falham** — claims válidos (`aud` = clientId, `iss` ∈ {`accounts.google.com`, `https://accounts.google.com`}, `exp` futuro, `email_verified` `true` ou `'true'`, e-mail `Prof@Gmail.com` na lista `['prof@gmail.com']`) → `'prof@gmail.com'`; cada violação isolada: `aud` errado, `iss` errado, `exp` passado, `email_verified` `'false'` → `token_invalido`; e-mail fora da lista → `nao_autorizado`.
- [ ] **Step 2: Rodar `npm test`** — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar `npm test`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: validação do login dos professores`

---

### Task 6: Roteador da API

**Files:**
- Create: `api/Api.js`
- Test: `test/api.test.js`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `tratarRequisicao(corpo: object, deps) -> object`, com `deps = { verificarProfessor, config, salvarMeta, lerAlunos, anexarAluno, comLock(fn), agora: () => Date, carimbo: () => string }` (injeção para testes).
  - `doPost(e)` — `JSON.parse(e.postData.contents)`, chama `tratarRequisicao` com as deps reais (`comLock` = `LockService.getScriptLock().waitLock(10000)` + `releaseLock` em `finally`), devolve `ContentService` JSON. Erro inesperado → `{ ok:false, erro:'interno' }` e `console.error` (sem dados do aluno no log).
  - Contrato (todas exigem `idToken`; Apps Script não define status HTTP, o erro vai no corpo):
    - `{ acao:'listar', versao? }` → `{ ok:true, versao, alunos: Aluno[], completos, meta, professores, turmas }`, ou `{ ok:true, inalterado:true, versao }` quando `versao` bate. `versao` = MD5 hex de `JSON.stringify({ alunos, meta })`.
    - `{ acao:'cadastrar', aluno, confirmarSemelhante? }` → `{ ok:true, aluno }` | `{ ok:false, erro:'dados_invalidos', campos: string[] }` | `{ ok:false, erro:'duplicado', alunos }` | `{ ok:false, erro:'semelhante', alunos }`.
    - `{ acao:'definirMeta', meta }` → `{ ok:true, meta }` | `{ ok:false, erro:'dados_invalidos', campos:['meta'] }`.
    - Erros de auth → `{ ok:false, erro:'token_invalido'|'nao_autorizado' }`.

- [ ] **Step 1: Escrever testes que falham** (deps falsas em memória, alunos fictícios)
  - `nao_autorizado` não devolve `alunos`.
  - `listar` devolve `completos` correto e `inalterado:true` quando recebe a `versao` atual.
  - `cadastrar` normaliza telefones antes de gravar (`'43991234567'` → `'(43) 99123-4567'` no objeto passado a `anexarAluno`).
  - `cadastrar` incompleto → `dados_invalidos` com `campos` de `camposFaltando`; `nascimento` vazio, inválido ou futuro, `professor` fora de `config().professores` e `turma` fora de `config().turmas` também entram em `campos`.
  - `semelhante` sem `confirmarSemelhante` → recusa; com `confirmarSemelhante:true` → grava. `duplicado` com `confirmarSemelhante:true` → continua recusado.
  - **Concorrência (Review Focus 5):** `comLock` falso que, antes de chamar `fn`, insere o mesmo aluno em `lerAlunos` (simula o outro professor) → resposta `duplicado` e `anexarAluno` não é chamado.
  - **Token expirado (Review Focus 4):** `verificarProfessor` lança `ErroApi('token_invalido')` → `{ ok:false, erro:'token_invalido' }`.
  - `definirMeta` abaixo de `completos`, não inteiro ou > 1000 → `dados_invalidos`; válido chama `salvarMeta`.
- [ ] **Step 2: Rodar `npm test`** — Expected: FAIL.
- [ ] **Step 3: Implementar** — em `cadastrar`, a checagem de duplicata e o `anexarAluno` rodam **dentro** de `comLock`, com `lerAlunos()` relido ali dentro.
- [ ] **Step 4: Rodar `npm test`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: API listar/cadastrar/definirMeta`

---

### Task 7: Casca do PWA, login e cliente da API

**Files:**
- Create: `web/index.html`, `web/css/estilo.css`, `web/js/config.js`, `web/js/sessao.js`, `web/js/api.js`, `web/manifest.webmanifest`, `web/sw.js`, `web/icons/icone-192.png`, `web/icons/icone-512.png`, `web/icons/icone-maskable-512.png`

**Interfaces:**
- Consumes: `web/js/regras.js` (gerado), contrato da Task 6.
- Produces:
  - `config.js`: `window.CONFIG = { API_URL: '', CLIENT_ID: '' }` (preenchidos na Task 10).
  - `sessao.js`: `Sessao.iniciar(aoEntrar: () => void)`, `Sessao.token() -> string|null`, `Sessao.renovar() -> Promise<string>` (GIS `google.accounts.id` com `auto_select: true`; token só em memória), `Sessao.sair()`.
  - `api.js`: `Api.chamar(acao: string, dados: object) -> Promise<object>` — `fetch(API_URL, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body })`; se a resposta for `token_invalido`, chama `Sessao.renovar()` e repete **uma** vez; `nao_autorizado` dispara a tela "Acesso não autorizado" com botão "Sair".
  - `estilo.css`: variáveis `--verde`, `--vinho`, `--dourado`, `--papel`, `--tinta`. Valores provisórios: `#1f4d2b`, `#6b1e2e`, `#d4a017`, `#f6f0e1`, `#1d1d1b` — **trocar pelos do site Senzala Londrina quando o link for informado**; verificar contraste AA de texto sobre cada fundo usado.
  - `sw.js`: pré-cache só dos arquivos de `web/` (versão `casca-v1`); requisições para `API_URL` e `accounts.google.com` passam direto, sem cache.

- [ ] **Step 1: Implementar os arquivos acima.** `index.html` tem quatro seções (`#tela-login`, `#tela-agenda`, `#tela-ficha`, `#tela-cadastro`), carrega GIS (`https://accounts.google.com/gsi/client`), `regras.js`, `config.js`, `sessao.js`, `api.js` e `app.js` (`app.js` pode estar vazio nesta task). `manifest`: `name` "Agenda Senzala Londrina", `short_name` "Agenda Senzala", `display: standalone`, `start_url: "./"`, `theme_color` = `--verde`.
- [ ] **Step 2: Verificar** — `npm run sincronizar && npx --yes http-server web -p 8080 -c-1`, abrir `http://localhost:8080` no Chrome. Expected: tela de login com a paleta; DevTools › Application mostra o manifest sem erros e o service worker ativo; o Lighthouse indica que o app é instalável.
- [ ] **Step 3: Commit** — `feat: casca do PWA, login e cliente da API`

---

### Task 8: Agenda, progresso e ficha

**Files:**
- Create: `web/js/app.js`

**Interfaces:**
- Consumes: `Api.chamar`, `filtrarAlunos`, `cadastroCompleto`, `ehMenor`, `linkWhatsApp`.
- Produces: `App.iniciar()`, estado `{ alunos, versao, completos, meta, professores, turmas, filtro }`, `App.atualizar()` (chama `listar` com `versao`); intervalo de 10 s com `setInterval`, pausado quando `document.visibilityState !== 'visible'` e retomado com atualização imediata.

- [ ] **Step 1: Implementar a agenda** — cartão de progresso com o texto exato `"{completos} de {meta} cadastros completos"` e `"faltam {max(meta - completos, 0)}"`; botão principal "Cadastrar próximo aluno"; campo "Buscar por nome"; seletores "Professor" e "Turma" (opção "Todos"/"Todas"), alimentados por `professores`/`turmas` da API; lista de `filtrarAlunos`, com a etiqueta "incompleto" nos que não passam em `cadastroCompleto`. Redesenhar sem perder o foco nem o texto da busca quando o polling trouxer dados novos.
- [ ] **Step 2: Implementar a ficha** — mostra apenas: nome; WhatsApp do aluno; se `ehMenor`, responsável e WhatsApp do responsável; contato de emergência (nome · parentesco · WhatsApp). Cada telefone com botões "Ligar" (`tel:`) e "WhatsApp" (`linkWhatsApp`). Campo vazio aparece como "não informado". Botão "Voltar" + suporte ao voltar do celular (`history.pushState`/`popstate`).
- [ ] **Step 3: Verificar** contra a API de teste (Task 10, Step 2) ou um stub local de `Api.chamar` com 5 alunos fictícios: busca "pedrao" acha "Pedrão"; filtros combinam; a ficha de um menor mostra o responsável; a de um adulto não mostra.
- [ ] **Step 4: Commit** — `feat: agenda, progresso e ficha`

---

### Task 9: Cadastro e edição da meta

**Files:**
- Modify: `web/js/app.js`, `web/index.html`, `web/css/estilo.css`

**Interfaces:**
- Consumes: `camposFaltando`, `ehMenor`, `normalizarTelefone`, `Api.chamar('cadastrar' | 'definirMeta')`.

- [ ] **Step 1: Implementar o formulário** — campos na ordem: Nome completo, Data de nascimento (`type="date"`), Turma (select), Professor responsável (select), WhatsApp do aluno ("opcional para menores" quando `ehMenor`), [se menor] Responsável legal e WhatsApp do responsável, Contato de emergência — nome, parentesco, WhatsApp. Telefones com `inputmode="tel"`. O botão "Salvar" só fica ativo quando `camposFaltando` está vazio, o nascimento é válido e turma/professor foram escolhidos; os campos pendentes ficam marcados.
- [ ] **Step 2: Tratar respostas** — `ok` → volta à agenda com atualização imediata e o aviso "Cadastro salvo"; `duplicado` → aviso "Este aluno já está cadastrado" com link para a ficha existente, sem salvar; `semelhante` → lista os parecidos e pergunta "É outra pessoa? Salvar mesmo assim", reenviando com `confirmarSemelhante:true`; `dados_invalidos` → marca os `campos`; erro de rede → mensagem e o formulário **preservado**.
- [ ] **Step 3: Editar a meta** — tocar no cartão de progresso abre um campo numérico; `definirMeta`; recusa → mensagem "A meta não pode ser menor que os cadastros completos".
- [ ] **Step 4: Verificar (Review Focus 4)** — com o formulário meio preenchido, forçar o token expirado (DevTools: `Sessao` com um token inválido) e salvar. Expected: login renovado em silêncio, cadastro salvo e nenhum campo perdido.
- [ ] **Step 5: Commit** — `feat: cadastro de alunos e meta editável`

---

### Task 10: Publicação, planilha de teste e documentação

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`, `api/.clasp.json` (só o `scriptId`, que não é segredo)

- [ ] **Step 1: Workflow do Pages** — ao dar push em `main`: `actions/checkout`, `node scripts/sincronizar.js`, `npm test`, `actions/upload-pages-artifact` com `path: web`, `actions/deploy-pages`. Permissões `pages: write`, `id-token: write`.
- [ ] **Step 2: Planilha de teste** — o dono cria uma planilha com a aba `Alunos` e os 22 cabeçalhos da spec §3, mais ~6 linhas **fictícias** (2 menores, 1 incompleta, 1 com data como `Date`). Criar o projeto Apps Script standalone (`clasp create --type webapp --rootDir api`), `npm run sincronizar && clasp push`, preencher Script Properties apontando para a planilha de **teste**, publicar o Web App e colocar a URL em `web/js/config.js`. Criar o Client ID OAuth (tipo "Aplicativo da Web") com origens `http://localhost:8080` e `https://<usuario>.github.io`.
- [ ] **Step 3: Teste de aceite na planilha de teste** (no celular, após publicar no Pages):
  1. três contas autorizadas entram; uma conta fora da lista vê "Acesso não autorizado";
  2. busca, ordenação e filtros funcionam no celular;
  3. tocar num aluno abre a ficha certa;
  4. um cadastro completo aumenta o contador em 1 e aparece no outro aparelho em ≤ 15 s;
  5. repetir o mesmo aluno → bloqueado;
  6. as linhas antigas continuam idênticas (comparar com uma cópia feita antes);
  7. `git grep -nE "AIza|client_secret|PLANILHA_ID *=|@gmail.com"` não encontra segredo nem e-mail;
  8. app instalado na tela inicial do Android e do iPhone.
- [ ] **Step 4: README.md** (português) — seções: *O que é*; *Configuração inicial* (passo a passo do Step 2); *Antes de ligar na planilha oficial* — abrir *Extensões → Apps Script* da planilha oficial e conferir se algum script grava por posição fixa (`getLastRow()+1`, `getRange(n, …)` com número calculado) e se a aba `Alunos` é a aba de respostas do Forms; se for, **parar** e revisar; *Trocar para a planilha oficial* (só mudar `PLANILHA_ID` e reimplantar); *Liberar ou revogar um professor* (editar `PROFESSORES_EMAILS`; vale na próxima chamada); *Editar listas de professores/turmas e a meta*; *Backup* (Arquivo › Fazer uma cópia; histórico de versões); *Atualizar o app* (push em `main` / `clasp push` + nova versão da implantação); *Cotas gratuitas* (conferir nas páginas oficiais de cotas do Apps Script e do GitHub Pages; estimativa de uso da spec §7); *Nunca habilitar cobrança*.
- [ ] **Step 5: Commit** — `docs: publicação, aceite e README`
