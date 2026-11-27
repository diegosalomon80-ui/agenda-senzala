# Login por código de e-mail — design

Aprovado em 26/11/2026 ("perfeito, é sim").

## Por quê

Um professor usa Hotmail e não quer criar conta Google. Hoje o app só aceita login do Google.
Aproveitando a mexida, o botão do Google fica menor e mais bonito.

## O que muda para quem usa

- Tela de login com dois botões do mesmo tamanho, um embaixo do outro:
  1. botão oficial do Google, **menor** (`size: 'medium'`, largura fixa);
  2. **"Entrar com e-mail"** (botão nosso, contorno claro sobre o verde).
- "Entrar com e-mail" abre, no lugar dos botões:
  - passo 1: campo de e-mail + "Enviar código";
  - passo 2: campo do código (6 números, teclado numérico, `autocomplete="one-time-code"`)
    + "Entrar" + "Pedir outro código" + "Voltar".
- Depois de entrar por código, vale a mesma sessão persistente do Google: fica logado até "Sair".
- Tela "Acesso não autorizado" passa a falar em "este e-mail" (não só "conta Google").

## Regras do código

- Só é enviado para e-mails que estão em `PROFESSORES_EMAILS`.
  Para um e-mail fora da lista, a API responde igual (`ok`) e não envia nada — não revela quem é professor.
  A tela diz: "Se este e-mail estiver liberado, o código chega em instantes. Confira o lixo eletrônico."
- 6 dígitos, válido **10 minutos**, uso único.
- No máximo **5 tentativas erradas**; na 5ª o código é descartado.
- Novo pedido para o mesmo e-mail só depois de **1 minuto** (erro `aguarde`).
- Pedir um código novo invalida o anterior.
- No máximo 5 pedidos a cada 6 h por e-mail (erro `limite`); espera e limite valem também para e-mails fora da lista (revisão).
- Ao acertar, a lista de e-mails é conferida de novo e a sessão é criada (`criarSessao`).
- O e-mail sai pela conta dona da API/planilha (MailApp, cota grátis ~100/dia).
  Assunto: "Seu código da Agenda Senzala". Corpo curto com o código e a validade.

## Abordagens consideradas

- **Código por e-mail pela própria API (escolhida):** grátis, funciona com qualquer e-mail, nenhum serviço novo.
- Botão "Entrar com Microsoft": exige cadastro no Azure e só cobre contas Microsoft.
- Botão do Google próprio (redirecionamento OAuth): visual livre, mas exige configurar endereço de retorno.
  O usuário preferiu manter o botão oficial, só menor.

## Como (decisões técnicas)

- **API** (`api/Api.js`), duas ações novas, fora da exigência de sessão, como `entrar`:
  - `pedirCodigo { email }`
  - `entrarComCodigo { email, codigo }`
  - Estado no `CacheService` (chave `cod:<sha256 do e-mail>` → hash do código, tentativas, hora do envio),
    expiração 600 s. Só o hash do código é guardado.
  - Contador de tentativas sob o `LockService` (mesmo `comLock` do cadastro).
  - Dependências injetadas (`cache`, `enviarEmail`, `gerarCodigo`, `agora`) para testar com `node:test`.
  - Código gerado a partir de `Utilities.getUuid()` (aleatório).
- Novo escopo no `appsscript.json`: `https://www.googleapis.com/auth/script.send_mail`.
  Exige autorizar de novo no editor **antes** de reimplantar: função `autorizarEnvioDeEmail()` em `Ferramentas.js`
  manda um e-mail de teste para a própria conta.
- **App** (`web/js/sessao.js`): `pedirCodigo(email)` e `entrarComCodigo(email, codigo)`; sucesso usa o mesmo
  `concluir(sessao)`; `nao_autorizado` mostra "acesso negado". Telas em `index.html`, estilo em `estilo.css`,
  DOM só por `textContent`. Cache do service worker sobe para `casca-v9`.
- Mensagens: `aguarde` → "Espere 1 minuto para pedir outro código."; `codigo_invalido` →
  "Código errado ou vencido. Confira ou peça outro."; e-mail mal digitado é barrado no próprio app.

## Fora do escopo

- Lembrar o e-mail digitado, login por link mágico, outros provedores.
- Mudar o comportamento do login automático do Google (continua como está).

## Ativação (passos manuais do usuário)

1. Depois do `clasp push`: no editor do Apps Script, executar `autorizarEnvioDeEmail` e aceitar a permissão nova.
2. Eu reimplanto a API (mesma URL) e publico o app.
