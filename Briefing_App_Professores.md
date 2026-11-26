# Briefing — Agenda de contatos dos professores

## Objetivo

Criar um aplicativo web instalável no celular (PWA) para os três professores do Grupo Senzala Londrina. O aplicativo será uma agenda de contatos de alunos, fácil de consultar durante a rotina das aulas. Não é uma agenda de datas nem um calendário.

O projeto será desenvolvido no VS Code e deve buscar custo recorrente zero, usando planos gratuitos e respeitando suas cotas e limites.

## Interface e identidade visual

- Usar a paleta visual oficial do Grupo Senzala Londrina: verde escuro, vinho, dourado/amarelo e tons claros de papel.
- Manter contraste acessível, tipografia legível e navegação simples no celular.
- A aparência deve combinar com o site atual da Senzala, sem criar uma identidade visual independente.

## Agenda de contatos

- Exibir a lista de alunos em ordem alfabética, com busca por nome.
- Permitir filtros por professor e turma.
- Os três professores podem consultar todos os contatos, cada um com seu próprio acesso individual; não usar conta ou senha compartilhada.
- Ao tocar no nome, abrir a ficha de contato do aluno.

## Campos da ficha

- Nome do aluno.
- Telefone/WhatsApp do aluno.
- Para menores: nome e telefone/WhatsApp do responsável legal.
- Nome, parentesco e telefone/WhatsApp do contato de emergência.

Exibir apenas esses dados no MVP. E-mail, observações e outros campos ficam para uma etapa posterior, após decisão da equipe.

## Progresso dos cadastros

- Na tela inicial, mostrar o progresso, inicialmente **16 de 84 cadastros completos**, e quantos ainda faltam.
- Tratar 84 como meta inicial editável, baseada no número de membros informado para o grupo de WhatsApp; nem todos os membros necessariamente são alunos.
- Como não há uma lista importada com os nomes restantes, permitir que os professores adicionem os alunos conforme conferem o grupo manualmente.
- Incluir uma ação clara para cadastrar o próximo aluno. A contagem só avança quando a ficha exigida estiver completa; evitar duplicatas.
- O sistema não precisa adivinhar nem exibir nomes pendentes que ainda não foram inseridos.

## Dados, integração e segurança

- Manter a planilha atual como fonte oficial de dados e não apagar nem reestruturar seus registros.
- Usar a planilha Google existente para alimentar o aplicativo e salvar os novos cadastros. As mudanças devem aparecer para os três professores em tempo real ou, se a arquitetura exigir, com atualização automática em poucos segundos; não criar cópias independentes dos dados.
- Preservar o Google Forms existente e o fluxo atual do formulário do site.
- Os três professores podem consultar toda a agenda; alterações devem ficar limitadas ao cadastro de contatos planejado para este aplicativo.
- Implementar a comunicação com a planilha por uma camada de servidor autenticada. Não colocar tokens, segredos ou credenciais da planilha no código executado no navegador.
- Validar autorização em cada operação e proteger os dados de alunos, responsáveis e contatos de emergência.
- Evitar duplicidade de alunos e preservar os registros originais. Definir uma regra segura de correspondência antes de mesclar qualquer dado.

## Escopo do MVP

1. Login individual dos professores.
2. Agenda de contatos alfabética com busca e filtros.
3. Ficha do aluno com os campos acordados.
4. Cadastro manual de contatos ausentes.
5. Indicador de progresso dos cadastros, com meta editável.

Deixar presença, anotações pedagógicas, acompanhamento de graduação, exportação de dados e edição ampla da planilha fora do MVP.

## Publicação e custo

- Entregar como PWA instalável pelo navegador, sem publicação em lojas de aplicativos.
- Planejar para os níveis gratuitos dos serviços escolhidos e confirmar cotas, autenticação e limites antes da publicação.
- Não habilitar cobrança, upgrade ou serviço pago sem aprovação da responsável pelo projeto.
- Documentar como atualizar, fazer backup e revogar o acesso de um professor.

## Critérios de aceite

- Os três professores conseguem acessar com contas individuais.
- A busca, ordenação alfabética e filtros funcionam no celular.
- Tocar em um aluno abre a ficha correspondente com os contatos definidos.
- Um novo contato completo atualiza o progresso sem duplicar registros.
- O Google Forms, o cadastro do site e os dados existentes continuam funcionando.
- Nenhum segredo da integração aparece no navegador ou no repositório.
- A solução pode ser usada dentro das cotas gratuitas verificadas, sem serviço pago habilitado.
