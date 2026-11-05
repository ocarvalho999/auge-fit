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

## Fase 3. Design system e frontend

- Tokens de cor, componentes (`Button`, `ActionForm`, estados de vazio, erro, carregando e sem permissão), `AppShell` com navegação inferior no celular, landing com preços vindos do banco, termos e privacidade marcados como rascunho, manifesto e ícones da PWA.
- 20 testes E2E passando no Edge: 8 telas públicas em 375 px e 1280 px sem rolagem horizontal, Pro "em breve" sem botão de compra, redirecionamento da área logada.
- **Correção:** o commit da Fase 2 entrou com 4 erros de lint em `database.types.ts`, porque o comando seguiu mesmo com o lint falhando. Corrigido no gerador nesta fase.
- **Ambiente E2E:** `tests/e2e/support/fake-supabase.ts` emula só o HTTP do Supabase (Auth, PostgREST, Storage) sobre Postgres real, com RLS real. Não substitui o teste contra o Supabase de verdade.
