# Design: sessão persistente (ficar logado até "Sair")

Data: 2026-11-26. Aprovado pelo responsável pelo projeto. Complementa `2026-11-26-agenda-professores-design.md`.

## Intenção
Hoje o professor precisa entrar de novo depois de fechar o app ou após cerca de 1 hora, quando o ID token do Google expira. O pedido é entrar uma vez em cada celular e continuar logado **para sempre, até tocar em "Sair"**.

## Objetivos, não-objetivos e antiobjetivos
- **Objetivos:**
  - login único por aparelho;
  - "Sair" encerra a sessão no aparelho e na API;
  - tirar o e-mail de `PROFESSORES_EMAILS` bloqueia na hora, mesmo com sessão guardada;
  - uma função de emergência derruba todas as sessões.
- **Não-objetivos:**
  - expiração por tempo (o pedido foi "para sempre");
  - gerenciar sessões por aparelho pela interface.
- **Antiobjetivos:**
  - guardar dados de alunos no aparelho;
  - guardar segredo da planilha no navegador;
  - um professor removido continuar com acesso.

## Abordagens
| | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| A | Guardar o ID token do Google no aparelho | Expira em 1 h, então não resolve | Descartada |
| B | Depender só do login automático do Google (auto_select/FedCM) | Já é o que existe; às vezes pede confirmação, e é isso que incomoda | Descartada |
| **C** | **Chave de sessão própria, emitida pela API depois do login Google e guardada no aparelho** | Resolve; quem tiver o celular desbloqueado acessa a agenda (proteção = bloqueio de tela) | **Escolhida** |

## Desenho
- **Emissão:** nova ação `entrar` (com `idToken`).
  - A API valida o login como hoje (tokeninfo + lista de autorizados).
  - Gera uma chave aleatória: duas UUID v4 concatenadas, sem hífens.
  - Guarda **só o hash SHA-256** da chave em Script Properties: `sessao:<hash>` → `{"email","criada"}`.
  - Devolve a chave ao app.
- **Uso:** todas as ações aceitam `sessao` (ou `idToken`, como antes).
  - Com `sessao`: busca o hash. Se não achar, devolve `sessao_invalida`.
  - Se achar, confere o e-mail em `PROFESSORES_EMAILS` **a cada chamada** (se faltar, devolve `nao_autorizado`).
- **Sair:** a ação `sair` apaga a sessão (responde `ok` mesmo se já não existir). No aparelho: apaga a chave, desliga o login automático do Google e recarrega.
- **Emergência:** `derrubarTodasAsSessoes()` em `Ferramentas.gs`, executada à mão no editor, apaga todas as chaves `sessao:*`.
- **App:**
  - a chave fica em `localStorage['agenda.sessao']`;
  - com a chave guardada, o app abre direto na agenda, sem tela de login;
  - com `sessao_invalida` ou `token_invalido`: apaga a chave, mostra o login por cima (sem perder o formulário), faz `entrar` de novo e repete o pedido uma vez.
- **Segurança mantida:**
  - CSP restritiva;
  - dados da planilha só via `textContent` (protege a chave contra XSS);
  - a API guarda só o hash, então quem lê as Script Properties não consegue usar as chaves.

## Deixado ao construtor
Nomes internos de funções, mensagens de interface e organização dos testes.
