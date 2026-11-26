# Sessão persistente — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O professor entra uma vez por celular e fica logado até tocar em "Sair".

**Architecture:** Depois do login Google, a API emite uma chave de sessão aleatória e guarda só o hash dela nas Script Properties. O app guarda a chave em `localStorage` e a envia em todas as chamadas. A lista de e-mails autorizados continua sendo conferida a cada chamada.

**Tech Stack:** O mesmo do projeto: JS puro, Apps Script V8, `node:test` + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-26-sessao-persistente-design.md` (e o design base `2026-11-26-agenda-professores-design.md`)

## Global Constraints
- Chave guardada no app em `localStorage['agenda.sessao']`. Na API, só o hash fica salvo: `sessao:<sha256hex>` → `{"email","criada"}` em Script Properties.
- Chave = duas `Utilities.getUuid()` concatenadas, sem hífens (64 caracteres hex).
- `PROFESSORES_EMAILS` é conferido em **toda** chamada, inclusive com sessão.
- Códigos de erro novos: `sessao_invalida`. Os existentes ficam como estão: `token_invalido`, `nao_autorizado`, `dados_invalidos`, `interno`.
- Chamadas com `idToken` continuam aceitas, para que app antigo em cache não quebre.
- Nenhum dado de aluno guardado no aparelho. Nenhum dado real em testes.

## Review Focus
1. **Professor removido da lista, mas com sessão guardada** → `nao_autorizado` na próxima chamada. *Teste na Task 1.*
2. **Sessão derrubada (emergência ou "Sair" em outro lugar) com o formulário meio preenchido** → o login aparece por cima, `entrar` gera uma chave nova, o pedido é repetido e o formulário não se perde. *Teste na Task 2.*
3. **`localStorage` indisponível** (Safari em modo privado lança exceção) → o app funciona com a chave só em memória. *Teste na Task 2.*
4. **`entrar` com e-mail não autorizado** → nenhuma sessão criada. *Teste na Task 1.*
5. **App antigo em cache mandando `idToken`** → continua funcionando. *Já coberto pelos testes atuais de `api.test.js`, que usam `idToken`.*

---

### Task 1: Sessões na API

**Files:**
- Create: `api/Sessoes.js`
- Modify: `api/Api.js` (autenticação + ações `entrar`/`sair`), `api/Ferramentas.js` (`derrubarTodasAsSessoes`)
- Test: `test/api.test.js`

**Interfaces:**
- Produces:
  - `criarSessao(email: string) -> string` (a chave);
  - `lerSessao(chave: string) -> string|null` (o e-mail);
  - `apagarSessao(chave: string) -> void`;
  - `derrubarTodasAsSessoes() -> number` (quantas apagou);
  - em `Api.js`, `deps` ganha `criarSessao`, `lerSessao` e `apagarSessao`;
  - contrato: `{acao:'entrar', idToken}` → `{ok:true, sessao}`; `{acao:'sair', sessao}` → `{ok:true}`; demais ações aceitam `sessao` **ou** `idToken`; sessão desconhecida → `{ok:false, erro:'sessao_invalida'}`.

- [ ] **Step 1: Testes que falham** em `test/api.test.js`. `criarDeps` ganha um mapa em memória para as sessões.
  - `entrar` com token válido devolve `sessao`, uma string de 64 caracteres, e `lerSessao(sessao)` devolve `'prof@gmail.com'`.
  - `entrar` com e-mail fora da lista → `nao_autorizado`, e nenhuma sessão é criada.
  - `listar` com `{sessao}` válida, sem `idToken` → `ok:true`, e `verificarProfessor` não é chamado.
  - `listar` com `{sessao:'desconhecida'}` → `{ok:false, erro:'sessao_invalida'}`.
  - Sessão válida, mas e-mail removido de `config().emails` → `nao_autorizado` (Review Focus 1).
  - `sair` com sessão → `{ok:true}`, e depois `listar` com a mesma sessão → `sessao_invalida`. `sair` com sessão inexistente → `{ok:true}`.
- [ ] **Step 2:** `npm test` — Expected: os novos testes FALHAM.
- [ ] **Step 3: Implementar.**
  - Em `Sessoes.js` (funções finas sobre `PropertiesService` e `Utilities`): hash com SHA-256 hex, reaproveitando a função de `Auth.js`.
  - Em `Api.js`, uma função `identificar_(corpo, deps) -> email`:
    - com `corpo.sessao`: chama `lerSessao`; se vier `null`, lança `ErroApi('sessao_invalida')`; senão, `autorizarEmail(email, deps.config().emails)`;
    - sem sessão: `verificarProfessor(corpo.idToken)`.
  - `sair` não exige autenticação: só apaga a sessão, se ela existir.
  - `derrubarTodasAsSessoes` em `Ferramentas.js` apaga as chaves com prefixo `sessao:` e registra no log quantas apagou.
- [ ] **Step 4:** `npm test` — Expected: PASS em todos.
- [ ] **Step 5:** Commit `feat: sessões persistentes na API`.

### Task 2: Sessão no app

**Files:**
- Modify: `web/js/sessao.js`, `web/js/api.js`, `web/sw.js` (versão `casca-v8`)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: o contrato da Task 1.
- Produces:
  - `Sessao.iniciar(aoEntrar)`: com chave guardada, chama `aoEntrar()` direto, sem mostrar o login;
  - `Sessao.token() -> string|null` (a chave);
  - `Sessao.renovar() -> Promise<string>`: apaga a chave, mostra o login por cima, faz `entrar` com o novo ID token, guarda e resolve a chave nova;
  - `Sessao.sair()`: `Api.chamar('sair')` em modo "melhor esforço", apaga a chave, `disableAutoSelect`, recarrega;
  - `Api.chamar` envia `{sessao}`; com `sessao_invalida` ou `token_invalido`, chama `renovar()` e repete uma vez.
  - `entrar` é feito dentro de `sessao.js` com um `fetch` próprio, sem passar por `Api.chamar`, para evitar recursão.

- [ ] **Step 1: Testes que falham** em `test/ui.test.js`, com o `sessao.js` e o `api.js` **reais**, um dublê de `google.accounts.id` e um `fetch` falso.
  - Com `localStorage['agenda.sessao']='abc'`: a agenda abre, `#tela-login` fica `hidden`, e o primeiro `fetch` leva `sessao:'abc'` e nenhum `idToken`.
  - Sem chave: o login aparece; o dublê GIS dispara a credencial `'idt'`; o app chama `entrar` com `idToken:'idt'`, guarda a `sessao` devolvida em `localStorage` e abre a agenda.
  - Sessão derrubada com o formulário preenchido (Review Focus 2): `cadastrar` responde `sessao_invalida`; o dublê GIS fornece credencial nova; `entrar` devolve `'nova'`; o `cadastrar` é repetido com `sessao:'nova'`; aparece "Cadastro salvo"; `localStorage` passa a ter `'nova'`.
  - `localStorage` lançando exceção (Review Focus 3): o fluxo sem chave funciona e a agenda abre.
  - `Sessao.sair()` envia `{acao:'sair', sessao}` e remove a chave.
- [ ] **Step 2:** `npm test` — Expected: os novos testes FALHAM.
- [ ] **Step 3: Implementar** em `sessao.js` e `api.js`. Todo acesso a `localStorage` fica dentro de `try/catch`, com a chave em memória como reserva.
- [ ] **Step 4:** `npm test` — Expected: PASS em todos.
- [ ] **Step 5:** Commit `feat: app mantém o professor logado até Sair`.

### Task 3: Publicar e documentar

- [ ] **Step 1: API.** Rodar `npm run sincronizar && clasp push --force && clasp update-deployment AKfycbwWts_ojD5zVmRUqWB_CpW6cNrGVcxtq9ECEDF_YlInuDhBn8Q1MUjbUfOdE9SXKuYpAA -d "v3 sessão persistente"`. Expected: `Redeployed ... @3`.
- [ ] **Step 2: Teste rápido.** `curl` com `{acao:'listar', sessao:'x'}` → `{"ok":false,"erro":"sessao_invalida"}`.
- [ ] **Step 3: Documentação.** No README, §4 (revogar), explicar que remover o e-mail bloqueia na hora e que, em caso de celular perdido, basta executar `derrubarTodasAsSessoes` no editor. Atualizar `ondeestamos.md`.
- [ ] **Step 4: App.** `git push`, acompanhar a publicação e conferir que `casca-v8` está no ar.
