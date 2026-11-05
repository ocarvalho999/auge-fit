# Progresso

Só consta aqui o que foi executado e visto passando.

## Fase 1. Estrutura e configuração

- Next.js 16 (App Router), TypeScript estrito, Tailwind 4, ESLint, Vitest, Playwright, CI do GitHub Actions, Git, `.env.example` e varredura de segredos.

## Fase 2. Banco de dados e autenticação

- Migrations de tabelas, funções, RLS e Storage; `seed.sql` só com planos e preços.
- 45 testes de RLS passando em Postgres 18 real (`embedded-postgres`), com aluno A contra aluno B, profissional sem vínculo, vínculo encerrado, fotos sem permissão, admin em prescrição e usuário alterando o próprio `role`.
- Conferido que os testes falham de verdade: duas políticas enfraquecidas de propósito derrubaram 6 testes.
- Cadastro, login, recuperação de senha e perfis escritos; validação Zod testada.
- **Não verificado nesta fase:** o fluxo de autenticação contra o Supabase Auth, e as migrations sobre as tabelas `auth` e `storage` originais do Supabase. Os testes usam um esboço mínimo delas, porque esta máquina não tem Docker.
