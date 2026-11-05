# Pendências e premissas

Decisões não críticas adotadas sem consulta (a opção mais simples e segura) e itens em aberto.

## Premissas

- **`proxy.ts` em vez de `middleware.ts`:** o Next.js 16 renomeou a convenção e marcou `middleware` como obsoleta. A especificação cita `middleware.ts`; usamos o nome atual.
- **TypeScript 5.9 e ESLint 9:** o `typescript-eslint` atual exige TypeScript abaixo de 6.1, e os plugins do `eslint-config-next` ainda dependem do ESLint 9. Atualizar quando o ecossistema permitir.

## Ambiente de desenvolvimento

- **Sem Docker nesta máquina:** `supabase start` não foi executado.
