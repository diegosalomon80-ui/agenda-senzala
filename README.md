# Agenda Senzala Londrina

Aplicativo de celular (PWA) com a agenda de contatos dos alunos para os três professores do Grupo Senzala Londrina. Com ele, cada professor:

- entra com a própria conta Google;
- busca um aluno pelo nome e filtra por professor ou turma;
- abre a ficha do aluno, com o WhatsApp dele, o do responsável (para menores) e o contato de emergência, e liga ou abre o WhatsApp com um toque;
- cadastra os alunos que faltam e acompanha o progresso ("16 de 84 cadastros completos").

Os dados ficam **somente na planilha Google oficial**. O app não guarda cópia dos dados nem no celular nem em outro serviço.

## Como funciona

```
Celular (app no GitHub Pages)  ──login Google──▶  ID token
        │
        └── pedido + ID token ──▶  API (Google Apps Script, conta da dona da planilha)
                                       ├─ confere o token com o Google
                                       ├─ confere se o e-mail é de um professor autorizado
                                       └─ lê a aba "Alunos" ou acrescenta uma linha no fim
```

- **`web/`**: o app. HTML, CSS e JavaScript puros, publicado no GitHub Pages.
- **`api/`**: a API em Apps Script, enviada ao Google com o `clasp`.
- **`shared/regras.js`**: as regras (menor de idade, cadastro completo, duplicatas, telefones). É a fonte única: `npm run sincronizar` copia o arquivo para `api/` e `web/`. **Edite só o arquivo em `shared/`.**

O que a API **nunca** faz: apagar, mudar ou reordenar linhas e colunas existentes. A única escrita é acrescentar uma linha nova no fim da aba "Alunos", com `Origem do cadastro = App professores` e `Situação = Cadastro para confirmar`.

## Custo

Tudo roda nos planos gratuitos: GitHub Pages, Google Apps Script e login do Google. **Não habilite cobrança** em nenhum desses serviços, nem crie conta de faturamento no Google Cloud. O login não precisa disso.

---

## 1. Configuração inicial (uma vez só)

Faça estes passos com a **conta Google dona da planilha oficial**.

### 1.1 Repositório e GitHub Pages
1. Crie um repositório no GitHub e envie este projeto (`git push`).
2. No GitHub, abra **Settings → Pages → Build and deployment → Source** e escolha **GitHub Actions**.
3. A cada `push` na branch `main`, os testes rodam e o app é publicado em **https://agenda.senzalalondrina.com** (domínio próprio: registro CNAME `agenda` → `diegosalomon80-ui.github.io` na Cloudflare, com a nuvem **cinza / Somente DNS**; configurado em *Settings → Pages → Custom domain*, com *Enforce HTTPS* ligado).

### 1.2 Login do Google (Client ID)
1. Abra o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto, por exemplo "Agenda Senzala". **Não ative faturamento.**
2. Em **APIs e serviços → Tela de permissão OAuth**, escolha tipo **Externo**, informe o nome "Agenda Senzala Londrina" e o seu e-mail. Os escopos ficam só os básicos (e-mail e perfil).
   - Se o app ficar em modo **Teste**, adicione os e-mails dos três professores em **Usuários de teste**.
3. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha o tipo **Aplicativo da Web**.
   - **Origens JavaScript autorizadas:** `https://agenda.senzalalondrina.com`, `https://diegosalomon80-ui.github.io` e `http://localhost:8080` (para testes no computador).
4. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`). Ele é público e não é segredo.

### 1.3 API no Apps Script
1. Instale o Node.js (versão 20 ou mais nova) e o clasp: `npm install -g @google/clasp`
2. Ative a "Google Apps Script API" em <https://script.google.com/home/usersettings>.
3. Na pasta do projeto, rode:
   ```
   npm install
   clasp login
   clasp create --type standalone --title "API Agenda Senzala" --rootDir api
   npm run sincronizar
   clasp push
   ```
   O `clasp create` gera o arquivo `.clasp.json` com o ID do script. Esse arquivo pode ir para o repositório.
4. Rode `clasp open` para abrir o editor do script.

### 1.4 Planilha de teste (dados fictícios)
Antes de usar a planilha oficial, teste tudo numa planilha de mentira:
1. No editor do Apps Script, escolha a função **`criarPlanilhaDeTeste`** e clique em **Executar**. Autorize quando o Google pedir.
2. O **Registro de execução** mostra o **ID** e o link da planilha de teste, que tem 6 alunos fictícios.

### 1.5 Propriedades do script
No editor: **Configurações do projeto (engrenagem) → Propriedades do script**. Adicione:

| Propriedade | Valor |
|---|---|
| `PLANILHA_ID` | ID da planilha de **teste** (depois, da oficial) |
| `CLIENT_ID` | ID do cliente do passo 1.2 |
| `PROFESSORES_EMAILS` | e-mails dos 3 professores, separados por vírgula |
| `PROFESSORES_NOMES` | `Contramestre Pouca Telha\|Hallwan Santos\|Dani Pinguin` (opcional: esse já é o padrão) |
| `TURMAS` | `Projeto Usina Cultural\|Academia Pura Vida\|Escola de Circo\|2D Centro Aquático e Treinamento Funcional` (opcional: esse já é o padrão) |
| `META_CADASTROS` | `84` (opcional; os professores também mudam a meta pelo app) |

### 1.6 Publicar a API
1. No editor, clique em **Implantar → Nova implantação → Tipo: App da Web**.
2. Configure **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**.
   Isso é necessário para o app conseguir chamar a API. A proteção fica no código: sem o login de um professor autorizado, a API não devolve nenhum dado.
3. Copie a **URL do app da Web** (termina em `/exec`).

### 1.7 Ligar o app à API
Em `web/js/config.js`, preencha:
```js
API_URL: 'https://script.google.com/macros/s/.../exec',
CLIENT_ID: '....apps.googleusercontent.com',
```
Depois faça commit e `git push`. O GitHub publica o app sozinho.

### 1.8 Testar no computador (opcional)
```
npm run sincronizar
npx --yes http-server web -p 8080 -c-1
```
Depois abra `http://localhost:8080`.

---

## 2. Teste de aceite (na planilha de TESTE)

Confira no celular, com o app publicado:

1. [ ] Os três professores entram com as próprias contas. Uma conta fora da lista vê "Acesso não autorizado".
2. [ ] A lista aparece em ordem alfabética, e a busca ("crianca" acha "Criança") e os filtros funcionam.
3. [ ] Tocar num aluno abre a ficha certa. Criança/Jovem mostram o responsável; adultos não.
4. [ ] Os botões "Ligar" e "WhatsApp" abrem o número certo.
5. [ ] Cadastrar um aluno completo aumenta o contador em 1 e o aluno aparece no celular de outro professor em até ~15 segundos.
6. [ ] Tentar cadastrar o mesmo aluno de novo (mesmo nome e data) é bloqueado.
7. [ ] As linhas antigas da planilha continuam idênticas. Compare com uma cópia feita antes do teste.
8. [ ] Mudar a meta funciona, e uma meta menor que os completos é recusada.
9. [ ] O app pode ser instalado na tela inicial: no Android, "Instalar app" no menu do Chrome; no iPhone, Compartilhar → "Adicionar à Tela de Início" no Safari.
10. [ ] Nenhum segredo no repositório: `git grep -nE "client_secret|AIza|PLANILHA_ID *[:=] *'[^']"` não encontra nada.

## 3. Antes de ligar na planilha OFICIAL

O site e o Google Forms já gravam na planilha oficial. Antes de trocar, confira que o app não vai atrapalhar esse fluxo:

1. Na planilha oficial, abra **Extensões → Apps Script** e leia o script do site.
   - Se ele grava usando **`appendRow`**, tudo certo.
   - Se ele calcula a linha sozinho (por exemplo `getLastRow() + 1` com `getRange(...)`), **pare** e ajuste antes: dois cadastros ao mesmo tempo podem cair na mesma linha.
2. Confirme se a aba **"Alunos"** não é a aba de respostas do Google Forms (as abas de respostas costumam se chamar "Respostas ao formulário 1"). Se for, **pare** e reveja antes de seguir.
3. Faça uma cópia de segurança (veja a seção 6).

Depois, troque a propriedade `PLANILHA_ID` pelo ID da planilha oficial. O ID é o trecho entre `/d/` e `/edit` no link. Não precisa reimplantar: a mudança vale na próxima chamada.

## 4. Liberar ou revogar um professor

Edite a propriedade **`PROFESSORES_EMAILS`** no editor do Apps Script: acrescente ou remova o e-mail. A mudança vale **na próxima ação** do professor, sem reimplantar.

## 5. Mudar listas de professores ou turmas

Edite `PROFESSORES_NOMES` ou `TURMAS`, com os nomes separados por `|`. Use exatamente a mesma grafia que aparece na planilha, porque os filtros comparam o texto exato.

## 6. Backup

- **Cópia completa:** na planilha, use **Arquivo → Fazer uma cópia**. Faça uma antes de ligar o app e depois uma vez por mês.
- **Desfazer:** **Arquivo → Histórico de versões** mostra e restaura versões anteriores.

## 7. Atualizar o app

- **Mudança no app (pasta `web/`):** commit e `git push` na `main`. O GitHub testa e publica.
  - Se mudar a lista de arquivos, aumente a versão `casca-vN` em `web/sw.js` para os celulares baixarem a versão nova.
- **Mudança na API (pasta `api/` ou `shared/`):** `npm test`, `npm run sincronizar`, `clasp push`. Depois, no editor: **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**. A URL continua a mesma.

## 8. Cotas gratuitas

Uso estimado: 3 professores com o app aberto ~3 h por dia dá cerca de 3.300 chamadas por dia. A conferência do login com o Google fica guardada em cache, então gera poucas chamadas por hora.

Antes de publicar, confira os limites atuais nas páginas oficiais:
- Apps Script: <https://developers.google.com/apps-script/guides/services/quotas> (veja "URL Fetch calls", "Simultaneous executions" e o tempo de execução por chamada, numa conta Gmail comum).
- GitHub Pages: <https://docs.github.com/pages/getting-started-with-github-pages/github-pages-limits>

Se uma cota estourar, o app mostra "Não foi possível atualizar" até o dia seguinte. **Não habilite cobrança para resolver isso:** em vez disso, aumente `INTERVALO_MS` em `web/js/config.js`, por exemplo para `20000`.

## 9. Cores

As cores e fontes em `web/css/estilo.css` vêm do site <https://www.senzalalondrina.com/>, das mesmas variáveis do CSS do site: verde `#123a30`, vinho `#80343a`, amarelo `#f3c943`, papel `#f5f1e8`, texto `#171b18`, títulos em Impact e texto em Arial. O contraste foi conferido (WCAG AA). Se o site mudar de cores, atualize as variáveis no topo do arquivo e regere os ícones em `web/icons/`.

## Desenvolvimento

```
npm install          # instala o jsdom (só para os testes)
npm test             # regras, API e telas (DOM simulado)
npm run sincronizar  # copia shared/regras.js para api/ e web/
```

Os testes usam **somente dados fictícios**. Nunca coloque dados reais de alunos em testes, código ou commits.
