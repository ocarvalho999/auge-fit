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
