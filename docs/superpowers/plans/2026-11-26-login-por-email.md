# Login por código de e-mail — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** professor entra com um código de 6 números enviado ao e-mail (qualquer provedor); botão do Google fica menor.

**Architecture:** duas ações novas na API Apps Script (`pedirCodigo`, `entrarComCodigo`) com estado no CacheService e envio por MailApp; o app ganha um fluxo de e-mail na tela de login que termina na mesma sessão persistente do Google.

**Tech Stack:** Apps Script (V8, clasp), JS puro no navegador, `node:test` + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-26-login-por-email-design.md`

## Global Constraints

- Código: 6 dígitos, validade 600 s, uso único, máx. 5 tentativas erradas, novo pedido só após 60 s, pedido novo invalida o anterior.
- E-mail fora de `PROFESSORES_EMAILS`: resposta `{ ok: true }` e nada é enviado.
- Guardar só o hash do código (SHA-256 hex); nunca o código em claro.
- Escopo novo: `https://www.googleapis.com/auth/script.send_mail`.
- Assunto do e-mail: `Seu código da Agenda Senzala`.
- Mensagens do app (texto exato):
  - enviado: `Se este e-mail estiver liberado, o código chega em instantes. Confira o lixo eletrônico.`
  - `aguarde`: `Espere 1 minuto para pedir outro código.`
  - `codigo_invalido`: `Código errado ou vencido. Confira ou peça outro.`
  - e-mail mal digitado: `Digite um e-mail válido.`
- DOM só por `textContent`. Nenhum dado de aluno no aparelho. Testes só com dados fictícios.
- Cache do service worker: `casca-v9`.

## Review Focus

- E-mail com maiúsculas/espaços (`  Prof@Gmail.com `) → tratado como `prof@gmail.com` nas duas ações.
- Código digitado com espaço ou traço (`123 456`) → aceito; o app envia só os dígitos.
- Professor removido da lista entre o pedido e o código → `nao_autorizado`, sem sessão.
- Erro ao enviar o e-mail (cota esgotada) → `{ ok:false, erro:'interno' }` e o código não fica guardado (pode pedir de novo na hora).
- Toque duplo em "Enviar código"/"Entrar" → um só pedido (botão desabilitado enquanto espera).

---

### Task 1: API — pedir e conferir o código

**Files:**
- Modify: `api/Api.js` (ações novas, roteamento antes de `identificar_`, `depsReais_`)
- Modify: `api/appsscript.json` (escopo novo)
- Modify: `api/Ferramentas.js` (`autorizarEnvioDeEmail`)
- Test: `test/api.test.js`

**Interfaces:**
- Produces (rede): `{acao:'pedirCodigo', email}` → `{ok:true}` | `{ok:false, erro:'aguarde'|'dados_invalidos'|'interno'}`;
  `{acao:'entrarComCodigo', email, codigo}` → `{ok:true, sessao}` | `{ok:false, erro:'codigo_invalido'|'nao_autorizado'}`.
- Deps novas em `deps`: `cache.get(k) -> string|null`, `cache.put(k, v, segundos)`, `cache.remove(k)`,
  `enviarEmail(para, assunto, corpo)`, `gerarCodigo() -> string de 6 dígitos`, `sha256(s) -> hex`, `agora() -> Date` (já existe).
- Estado: chave `cod:` + `sha256(email)`, valor JSON `{h: sha256(codigo), t: tentativasErradas, e: msDoEnvio}`, TTL 600.

- [ ] **Step 1: testes que falham** (em `criarDeps`, adicionar `cache` em memória com Map, `enviados=[]`, `gerarCodigo: () => '123456'`, `sha256` via `crypto`, e `criarSessao: (e) => 'sess-' + e` se ainda não houver):
  - `pedirCodigo envia para professor da lista` → `{ok:true}`, 1 e-mail para `prof@gmail.com`, assunto exato, corpo contém `123456`; o cache não contém `123456` em claro.
  - `pedirCodigo normaliza o e-mail` (`'  Prof@Gmail.com '`) → envia para `prof@gmail.com`.
  - `pedirCodigo para e-mail fora da lista responde ok e não envia` → `{ok:true}`, 0 e-mails, cache vazio.
  - `pedirCodigo com e-mail mal formado` (`'abc'`) → `{ok:false, erro:'dados_invalidos', campos:['email']}`.
  - `segundo pedido antes de 60 s` → `aguarde`; avançando `agora` 61 s → ok e o código antigo deixa de valer.
  - `falha no envio não guarda o código` (`enviarEmail` lança) → `erro:'interno'` e pedido imediato seguinte é aceito (não `aguarde`).
  - `entrarComCodigo certo cria sessão e o código não vale de novo` → `{ok:true, sessao:'sess-prof@gmail.com'}`; repetir → `codigo_invalido`.
  - `código aceita espaços e traço` (`'123 456'`, `'123-456'`).
  - `5 erros descartam o código` → 5× `'000000'` = `codigo_invalido`; depois `'123456'` → `codigo_invalido`.
  - `sem pedido ou vencido` → `codigo_invalido`.
  - `professor removido depois do pedido` → `nao_autorizado`, nenhuma sessão criada.
  - `entrarComCodigo` conta tentativas dentro de `comLock` (deps.comLock espião chamado).
- [ ] **Step 2:** `npm test` → falham as novas.
- [ ] **Step 3:** implementar `acaoPedirCodigo_(corpo, deps)` e `acaoEntrarComCodigo_(corpo, deps)` em `api/Api.js`; em `tratarRequisicao`, rotear as duas logo após `entrar` (sem sessão). E-mail válido: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` após `trim().toLowerCase()`. Código: remover não-dígitos, exigir 6. Corpo do e-mail: `Seu código para entrar na Agenda Senzala: NNNNNN\n\nEle vale por 10 minutos. Se você não pediu, ignore este e-mail.` Guardar no cache **só depois** do envio dar certo. Em `depsReais_`: `cache` sobre `CacheService.getScriptCache()`, `enviarEmail` com `MailApp.sendEmail({to, subject, body, name:'Agenda Senzala'})`, `gerarCodigo` = `String(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,12),16) % 1000000)` com zeros à esquerda, `sha256` = `hashToken_`.
- [ ] **Step 4:** `api/appsscript.json`: adicionar o escopo. `api/Ferramentas.js`: `autorizarEnvioDeEmail()` manda `Teste da Agenda Senzala` para `Session.getEffectiveUser().getEmail()`.
- [ ] **Step 5:** `npm test` → tudo passa.
- [ ] **Step 6:** commit `feat(api): login por código enviado por e-mail`.

### Task 2: App — tela de login com e-mail e botão do Google menor

**Files:**
- Modify: `web/index.html` (tela-login, tela-negado), `web/css/estilo.css`, `web/js/sessao.js`, `web/sw.js`
- Test: `test/ui.test.js` (bloco "sessão persistente", usando `montarReal`)

**Interfaces:**
- Consumes: ações da Task 1.
- Produces: em `#tela-login`: `#botao-google`, `#botao-email` (button), `#form-email` (hidden) com `#login-email` (input type=email), `#login-enviar`; `#form-codigo` (hidden) com `#login-codigo` (inputmode=numeric, autocomplete=one-time-code, maxlength 7), `#login-entrar`, `#login-reenviar`, `#login-voltar`; mensagens em `#login-msg`.
- `renderButton`: `{ theme:'outline', size:'medium', text:'signin_with', shape:'pill', width: 240, locale:'pt-BR' }`; `#botao-email` com largura 240px e altura 32px, contorno claro, mesma pílula.

- [ ] **Step 1: testes que falham** (sem sessão guardada):
  - `entrar com e-mail: pede código, digita e fica logado` → clicar `#botao-email`, preencher `Prof@Gmail.com `, clicar enviar → enviado `{acao:'pedirCodigo', email:'prof@gmail.com'}`, `#form-codigo` visível, msg = texto "enviado"; digitar `123 456`, clicar entrar → enviado `{acao:'entrarComCodigo', email:'prof@gmail.com', codigo:'123456'}`; `localStorage['agenda.sessao']` = sessão devolvida; `#tela-login` oculto; `listar` enviado com essa sessão.
  - `e-mail mal digitado não chama a API` → msg `Digite um e-mail válido.`, nenhum `pedirCodigo`.
  - `aguarde` e `codigo_invalido` mostram os textos exatos e mantêm a tela.
  - `entrarComCodigo` `nao_autorizado` → `#tela-negado` visível.
  - `toque duplo em Entrar envia um pedido só`.
  - `voltar` mostra de novo os dois botões.
  - `botão do Google menor`: `renderButton` recebe `size:'medium'` e `width:240`.
- [ ] **Step 2:** `npm test` → falham.
- [ ] **Step 3:** HTML/CSS conforme Interfaces; `tela-negado` passa a dizer `Este e-mail não está na lista de professores. Entre com o seu e-mail de professor ou peça para liberar o acesso.` Em `sessao.js`: função interna `postar(corpo)` reaproveitada por `entrar`, `pedirCodigo`, `entrarComCodigo`; sucesso de `entrarComCodigo` chama `concluir(sessao)` (resolve quem estiver em `renovar`). Botões desabilitados enquanto o pedido está no ar. Mostrar o bloco de botões mesmo quando o Google não carregar (o e-mail não depende dele). `sw.js`: `casca-v9`.
- [ ] **Step 4:** `npm test` → tudo passa (incluindo os testes antigos de sessão).
- [ ] **Step 5:** conferir visualmente com Edge headless em 492 px (sem dados reais).
- [ ] **Step 6:** commit `feat(app): entrar com e-mail e botão do Google menor`.

### Task 3: Documentação e publicação

**Files:** `README.md`, `ondeestamos.md` (local, fora do git)

- [ ] **Step 1:** README: seção "Entrar com e-mail" (como funciona, limites, lixo eletrônico, passo `autorizarEnvioDeEmail`). ondeestamos.md: idem + versão da API.
- [ ] **Step 2:** `npm run sincronizar && clasp push --force`.
- [ ] **Step 3 (usuário):** no editor, executar `autorizarEnvioDeEmail` e aceitar a permissão; confirmar que o e-mail de teste chegou.
- [ ] **Step 4:** `clasp update-deployment AKfycbwWts_ojD5zVmRUqWB_CpW6cNrGVcxtq9ECEDF_YlInuDhBn8Q1MUjbUfOdE9SXKuYpAA -d "v4 login por e-mail"`; teste de fumaça com curl: `pedirCodigo` para e-mail fictício fora da lista → `{"ok":true}`; `entrarComCodigo` sem pedido → `codigo_invalido`.
- [ ] **Step 5:** commit + `git push`; conferir o deploy do Pages e `casca-v9` no ar.
