# Pendências e premissas

Decisões não críticas adotadas sem consulta (a opção mais simples e segura) e itens em aberto.

## Premissas

- **`proxy.ts` em vez de `middleware.ts`:** o Next.js 16 renomeou a convenção e marcou `middleware` como obsoleta. A especificação cita `middleware.ts`; usamos o nome atual.
- **TypeScript 5.9 e ESLint 9:** o `typescript-eslint` atual exige TypeScript abaixo de 6.1, e os plugins do `eslint-config-next` ainda dependem do ESLint 9. Atualizar quando o ecossistema permitir.

## Ambiente de desenvolvimento

- **Sem Docker nesta máquina:** `supabase start` não foi executado.
- **Testes de banco sem `supabase start`:** rodam em Postgres real com esboço de `auth` e `storage` (`supabase/tests/support/postgres.ts`). Falta rodar `supabase db reset` numa máquina com Docker antes de homologação.
- **Tipos do banco:** gerados por `npm run db:types` (script próprio), porque `supabase gen types` exige Docker.

## Premissas de banco

- **Sem `lib/supabase/browser.ts`:** todo acesso passa pelo servidor, então um cliente de navegador seria código morto. Criar quando houver uso real.
- **Conta excluída mantém o registro financeiro:** `subscriptions.profile_id` fica nulo e pagamentos permanecem, para obrigação fiscal. Confirmar na revisão jurídica.
- **Profissional não exclui a própria conta sozinho:** prescrições e feedbacks têm autoria obrigatória (`on delete restrict`). A saída é inativar pelo admin.
- **Cupom em assinatura mensal:** o desconto vale para todas as cobranças da assinatura.
- **Revisão de exercício:** o profissional ativo enxerga exercícios não publicados para poder revisá-los. Se o admin editar as instruções, a revisão cai e o exercício sai de publicação.
- **Medidas e fotos exigem assinatura vigente para novos registros**, além do consentimento. A especificação só cita treinos; como não há plano gratuito, a regra foi estendida. Leitura e exportação continuam liberadas.

## Conteúdo e landing

- **"App real em uso" na landing:** a especificação pede o app real em uso, sem nada inventado. Falta o fundador gravar a tela com conta real. A seção "Como é usar" descreve os passos em texto até lá.
- **Lista de espera ativável:** ligada por `WAITLIST_ENABLED=true`. Com ela ligada, a landing troca os botões de compra pelo formulário.
- **Fonte:** pilha de fontes do sistema, sem baixar fonte externa, para simplificar a CSP.

## Aluno

- **BLOQUEIO DE LANÇAMENTO, biblioteca vazia:** como exercício só é publicado depois de revisão, sem revisão de um profissional o aluno não consegue montar treino nenhum. É preciso ter a biblioteca mínima revisada antes de abrir vendas.
- **Limite de 10 MB x Vercel:** a Vercel limita o corpo da requisição a cerca de 4,5 MB. O app reduz a foto no aparelho antes de enviar quando ela passa de 4 MB; o limite de 10 MB continua valendo para o arquivo escolhido. Sem JavaScript, fotos acima do limite da Vercel falham.
- **Treino do dia:** rodízio simples entre os treinos do plano mais recente, com prioridade para o planejamento prescrito. Programas do catálogo são iniciados pela tela de Treinos.
- **Plano escolhido na landing:** `/cadastro?plano=` ainda não pré-seleciona o plano; a escolha acontece em Assinatura depois do onboarding.

## Profissional

- **Página inexistente com status 200:** com `loading.tsx`, o Next começa a responder antes do `notFound()`, então a rota de aluno sem vínculo devolve status 200 com a tela "Página não encontrada". Nenhum dado do aluno sai na resposta (testado). A consequência é só o código HTTP.
- **Check-in semanal:** abre manualmente pelo profissional; a abertura automática entra com as rotinas agendadas da fase 7.

## Admin

- **Conferência do CREF:** o painel exige marcar que a conferência manual foi feita, mas não consulta o CONFEF/CREF. Não há integração oficial conhecida; a conferência é humana.
- **Mensagem depois do vínculo:** ao criar o vínculo, o item sai da lista "aguardando" e a confirmação aparece como o novo item em "Vínculos ativos".
- **Dashboard de cupons:** mede usos por cupom e campanha; não há relatório por período.

## Ambiente de testes

- **Instabilidade em aberto:** em 2 de cerca de 10 execuções do E2E, o `next start` de teste parou de responder no meio da suíte, sem erro no log. Depois disso, 3 execuções seguidas passaram (incluindo a suíte completa). A causa não foi encontrada. `tests/e2e/support/stack.ts` agora grava saída de processos em `.tmp/stack.log` para a próxima ocorrência. Não há indício de relação com o código do app, mas isso não está provado.

## Pagamentos

- **Assinatura mensal sem plano no provedor:** usa `/preapproval` sem `card_token_id`. O preço fica no nosso banco, e o fluxo com plano associado exigiria token de cartão. A entrada do cartão na página do Mercado Pago sem token não está afirmada na documentação lida: confirmar em sandbox.
- **Valor de cancelamento enviado:** `cancelled`, como no SDK. O guia do Mercado Pago escreve `canceled`. Ao ler, o app aceita as duas; confirmar em sandbox qual a API aceita.
- **Trocar de plano:** para trocar de mensal, é preciso cancelar a atual e assinar outra. Sem cálculo proporcional.
- **Sem tolerância de tempo na assinatura do webhook:** o validador aceita `toleranceSeconds`, mas a documentação informa reenvios a cada 15 minutos e não diz se o `ts` é renovado. Reenvios antigos são contidos pela chave única e pela consulta à API. Reavaliar com dados reais.
- **Pagamento depois da reserva expirar:** o acesso é honrado e a vaga volta a contar, podendo exceder a capacidade. O admin resolve no vínculo ou reembolsa.
- **Assinatura pendente abandonada:** o registro fica como `pending`, sem efeito, para um pagamento tardio ainda ser reconhecido.
- **E-mail de inatividade:** só para quem aceitou marketing, por precaução. Confirmar na revisão jurídica se pode ser transacional.
