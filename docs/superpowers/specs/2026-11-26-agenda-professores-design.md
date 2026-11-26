# Design — Agenda de contatos dos professores (Senzala Londrina)

Data: 2026-11-26 · Fonte: `Briefing_App_Professores.md` + estrutura da aba "Alunos" (PDF exportado da planilha)

## 1. Intenção

Os três professores do Grupo Senzala Londrina precisam, durante a rotina das aulas, achar em segundos o contato de um aluno, do responsável (menores) ou do contato de emergência, pelo celular. Ao mesmo tempo, querem completar os cadastros que faltam (hoje 16 de ~84) conferindo o grupo de WhatsApp manualmente — sem mexer nos registros existentes, no Google Forms ou no formulário do site, e sem custo recorrente.

## 2. Objetivos, não-objetivos, antiobjetivos

**Objetivos (MVP)**
1. Login individual de cada professor com a própria conta Google.
2. Agenda alfabética com busca por nome e filtros por professor e turma.
3. Ficha do aluno com apenas os campos acordados.
4. Cadastro manual de alunos ausentes, sem duplicatas.
5. Indicador de progresso "X de META cadastros completos · faltam N", com meta editável (inicial 84).
6. PWA instalável pelo navegador.

**Não-objetivos (fora do MVP)**
Presença, anotações pedagógicas, graduação, exportação, edição de registros existentes, edição ampla da planilha, exibição de e-mail/observações/outros campos, publicação em lojas, uso offline dos dados.

**Antiobjetivos (falha mesmo que "funcione")**
- Apagar, reordenar ou reestruturar dados/colunas da aba "Alunos".
- Quebrar o Google Forms ou o fluxo do formulário do site que hoje grava nessa planilha.
- Qualquer token, segredo ou credencial no código do navegador ou no repositório.
- Dados de alunos acessíveis a quem não for um dos três professores.
- Habilitar cobrança ou serviço pago.
- Criar cópia independente dos dados (a planilha é a única fonte).

## 3. Restrições conhecidas

- **Planilha oficial:** aba `Alunos`, 22 colunas, cabeçalhos (texto exato):
  `Nome completo`, `Nome de capoeira`, `Data de nascimento` (AAAA-MM-DD), `WhatsApp` (formato `(43) 99999-9999`), `E-mail`, `Turma`, `Horário`, `Professor responsável`, `Graduação atual`, `Data de entrada`, `Situação`, `Responsável legal (menores)`, `WhatsApp do responsável`, `Última atualização` (DD/MM/AAAA HH:MM:SS), `Contato de emergência — nome`, `Contato de emergência — parentesco`, `Contato de emergência — WhatsApp`, `ID do envio do site`, `Origem do cadastro` (hoje "Site"), `Tipo de envio do site` (new/existing), `Ano de início`, `Aviso de matrícula`.
- O site já grava nessa aba (por isso existem `ID do envio do site`, `Origem do cadastro`, `Situação`).
- Valores atuais de `Turma`: Projeto Usina Cultural, Academia Pura Vida, Escola de Circo, 2D Centro Aquático e Treinamento Funcional. Valores atuais de `Professor responsável`: Contramestre Pouca Telha, Hallwan Santos (o terceiro professor ainda não aparece).
- A planilha contém dados pessoais reais: não usar dados reais em código, testes, fixtures, capturas ou páginas publicadas.
- Custo zero: só planos gratuitos (GitHub Pages, Google Apps Script em conta consumidor, Google Identity Services). Confirmar cotas antes de publicar.

## 4. Abordagens consideradas

| | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| A | Tudo em Google Apps Script (HtmlService) | Uma peça só, login automático; mas a página roda em iframe do Google → não é PWA instalável de verdade e exibe aviso do Google | Descartada |
| **B** | **PWA estática no GitHub Pages + Apps Script como API** | Instalável, grátis, sem segredo no navegador, acesso à planilha fica no Google; sincronização por atualização automática (~10 s), não push | **Escolhida** |
| C | PWA + Cloudflare Workers + conta de serviço Google | Um pouco mais rápida; mas exige guardar chave da conta de serviço fora do Google e manter três serviços | Descartada |
| — | Firebase Functions / similares | Exigem plano pago (Blaze) | Descartada |

## 5. Decisões já tomadas (com o responsável pelo projeto)

- **Arquitetura B.**
- **Login:** conta Google de cada professor. Acesso liberado por lista de e-mails autorizados.
- **Menor de idade:** calculado pela `Data de nascimento` (< 18 anos na data de hoje).
- **Regra de "cadastro completo":**
  - sempre: `Nome completo`, `Contato de emergência — nome`, `— parentesco`, `— WhatsApp`;
  - adulto: `WhatsApp` do aluno obrigatório;
  - menor: `Responsável legal (menores)` e `WhatsApp do responsável` obrigatórios; `WhatsApp` do aluno opcional.
- **Duplicatas:** chave = nome normalizado (sem acento, minúsculas, espaços colapsados) + data de nascimento.
  - nome **e** data batem → bloqueia o cadastro e mostra a ficha existente;
  - só um dos dois bate → avisa e pede confirmação explícita; nunca mescla automaticamente.
- **Novos cadastros pelo app** gravam `Origem do cadastro = "App professores"`, sem tocar no fluxo do site.

### 5.1 Decisões do designer (revisáveis)

- **A regra bate com o "16":** aplicada às 16 linhas atuais, a regra da seção 5 dá 16 completos (os dois menores têm responsável; todos têm contato de emergência). Hoje não há linha incompleta.
- **Linhas existentes incompletas (futuras):** aparecem na lista com marcador "incompleto" e não contam no progresso. O app **não** as edita no MVP; a correção segue pelo fluxo "existing" do site. Tentar cadastrar o mesmo aluno pelo app cai na regra de duplicata e mostra a ficha existente.
- **Quem aparece e conta:** todas as linhas da aba com `Nome completo` preenchido. Os valores atuais de `Situação` ("Atualização para conferir", "Cadastro para confirmar") não indicam inatividade, então não filtram nada.
- **Data de nascimento ausente ou inválida em linha existente:** o aluno é tratado como adulto (o WhatsApp próprio passa a ser exigido para contar como completo). No app, a data é obrigatória no cadastro.
- **Cadastros feitos pelo app** só são salvos completos, então contam no progresso imediatamente.
- **Testes de integração:** contra uma **cópia da planilha com dados fictícios**, nunca a planilha real.
- **Convivência com o site/Forms (não confirmado):** não sabemos como o site grava na aba. Defesa padrão: o app só usa `appendRow` (operação atômica do Google) dentro de `LockService`, nunca calcula "próxima linha" nem toca em células existentes. O README inclui uma verificação antes de publicar: abrir *Extensões → Apps Script* da planilha e checar se algum script grava por posição fixa, ou se a aba "Alunos" é a aba de respostas do Forms. Se for, revisar antes de liberar o app.
- **Tipo de conta:** assumir Gmail comum (limites gratuitos mais baixos, a estimativa mais conservadora). A configuração no Google Cloud e a publicação são feitas pelo dono da planilha, seguindo o README.
- **Listas de professores e turmas:** listas fixas guardadas em Script Properties (`PROFESSORES_NOMES`, `TURMAS`), editáveis sem mexer no código. Ponto de partida — professores: `Contramestre Pouca Telha`, `Hallwan Santos`, `Dani Pinguin`; turmas: os quatro valores atuais da planilha.

## 6. Desenho técnico (proposta)

### 6.1 Componentes
1. **Front-end PWA** — HTML/CSS/JS puro, sem etapa de build, hospedado no GitHub Pages. `manifest.webmanifest` + service worker que guarda **apenas o "casco" do app** (HTML/CSS/JS/ícones), nunca dados de alunos.
2. **API Apps Script** — projeto *standalone* (separado do script que o site usa), publicado como Web App com "Executar como: eu (dono da planilha)" e "Acesso: qualquer pessoa"; a autorização real é feita no código (6.3). Versionado no repositório via `clasp`.
3. **Google Identity Services** no navegador para obter o ID token (JWT) do professor. O Client ID OAuth é público por natureza (não é segredo).

### 6.2 Contrato da API
Uma rota `doPost`, corpo JSON enviado como `text/plain` (evita preflight CORS). Toda requisição leva `idToken`.

| ação | entrada | saída |
|---|---|---|
| `listar` | — | lista de alunos (só campos necessários: nome, data nasc., turma, professor, campos da ficha), `completos`, `meta`, `versao` |
| `cadastrar` | dados do novo aluno, `confirmarSemelhante?` | `ok` + aluno, ou `duplicado` + ficha existente, ou `semelhante` + candidatos |
| `definirMeta` | `meta` (inteiro ≥ completos) | nova meta |

`versao` = hash/carimbo da última leitura, para o front só redesenhar quando algo mudou.

### 6.3 Autorização (em toda chamada)
1. Validar o ID token em `https://oauth2.googleapis.com/tokeninfo`: `aud` = Client ID, `iss` Google, `exp` futuro, `email_verified = true`.
2. `email` precisa estar em `PROFESSORES_EMAILS` (Script Properties). Fora da lista → 403 sem dados.
3. Cachear validação no `CacheService` pelo hash do token até o `exp`, para poupar cota de UrlFetch.
4. Nenhuma ação lê/escreve fora da aba `Alunos`; nenhuma ação altera linha existente.

### 6.4 Acesso à planilha
- `SpreadsheetApp.openById(ID)` com ID em Script Properties.
- Colunas localizadas **pelo texto do cabeçalho**, não pela posição; se algum cabeçalho esperado sumir, a API falha com erro claro em vez de gravar errado.
- `cadastrar` usa `LockService` (evita dois professores gravando ao mesmo tempo), revalida duplicata dentro do lock e faz **apenas `appendRow`**, preenchendo: `Nome completo`, `Data de nascimento`, `WhatsApp`, `Turma`, `Professor responsável`, `Responsável legal (menores)`, `WhatsApp do responsável`, os três de emergência, `Última atualização` (formato da planilha), `Origem do cadastro = "App professores"`, `Situação = "Cadastro para confirmar"`. Demais colunas vazias.
- Telefones normalizados para `(DD) 9XXXX-XXXX`, igual ao padrão existente.
- Meta guardada em Script Properties (`META_CADASTROS`, padrão 84) — não cria aba nova.

### 6.5 Telas (celular primeiro)
1. **Entrar** — botão "Entrar com Google"; e-mail não autorizado vê mensagem de acesso negado.
2. **Início/Agenda** — cartão de progresso ("16 de 84 cadastros completos · faltam 68", tocar edita a meta); botão principal "Cadastrar próximo aluno"; campo de busca; filtros Professor e Turma (valores vindos dos dados); lista alfabética (ordenação `pt-BR`, ignorando acento/maiúsculas). Itens incompletos com marcador discreto.
3. **Ficha** — nome; WhatsApp do aluno; (menor) responsável + WhatsApp; emergência nome · parentesco · WhatsApp. Cada número com ações "Ligar" (`tel:`) e "WhatsApp" (`https://wa.me/55…`).
4. **Cadastro** — campos: nome, data de nascimento, turma, professor, WhatsApp do aluno, (aparece se menor) responsável + WhatsApp, emergência (nome, parentesco, WhatsApp). Botão salvar só habilita com a ficha completa pela regra da seção 5. Data de nascimento, turma e professor são coletados porque são necessários para regra de menor, duplicata e filtros, mas não aparecem na ficha.

### 6.6 Sincronização
`listar` a cada ~10 s enquanto a aba está visível (`visibilitychange` pausa em segundo plano) e imediatamente após um cadastro. Nada persistido no aparelho além da sessão de login do Google.

### 6.7 Visual
Paleta do site Senzala Londrina (verde escuro, vinho, dourado/amarelo, tons de papel) como variáveis CSS; contraste mínimo WCAG AA; alvos de toque ≥ 44 px; fonte legível ≥ 16 px.

### 6.8 Documentação entregue
`README.md` em português com: configuração inicial (Client ID no Google Cloud, deploy do Apps Script, GitHub Pages), como liberar/revogar um professor (editar `PROFESSORES_EMAILS`), backup (cópia da planilha / histórico de versões), como atualizar o app, e verificação de cotas.

## 7. Cotas (verificar antes de publicar)
Uso estimado: 3 professores × 6 chamadas/min × ~3 h/dia ≈ 3.300 execuções/dia; chamadas a `tokeninfo` reduzidas a poucas por hora com cache. Conferir na documentação vigente do Apps Script (conta consumidor): UrlFetch/dia, execuções simultâneas, tempo por execução; e limites do GitHub Pages.

## 8. Deixado ao construtor
Estrutura de pastas e nomes de arquivos; bibliotecas mínimas (preferir nenhuma); estratégia de testes (lógica pura — normalização, regra de completo, duplicata, cálculo de menor — testável em Node); ícones do PWA; textos de interface; tratamento de erros de rede; intervalo exato de atualização (5–15 s).
