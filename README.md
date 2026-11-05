# Auge Fit

SaaS fitness brasileiro: a pessoa registra cada treino, enxerga a própria evolução e, quando quiser, conta com um profissional habilitado. O produto promete organização e clareza de progresso, nunca resultado físico.

O sistema **não gera prescrições**. Treino individual, ajuste de carga e recomendação técnica só existem com um profissional habilitado responsável, e o perfil de administrador não cria nem edita prescrições. Isso é garantido no banco, não só na tela.

## Situação do projeto

O código está pronto e testado localmente, mas **nunca rodou contra o Supabase real nem contra o Mercado Pago real**, e **não foi publicado** (o código está em repositório privado no GitHub, com CI verde, mas o app não está no ar). Veja [docs/PROGRESSO.md](docs/PROGRESSO.md) para o que foi verificado e [docs/CHECKLIST_LANCAMENTO.md](docs/CHECKLIST_LANCAMENTO.md) para o que falta antes de vender.

## Stack

| Item | Versão | Observação |
|---|---|---|
| Node.js | 22 ou superior | |
| Next.js | 16 (App Router) | `src/proxy.ts` substitui o antigo `middleware.ts` |
| TypeScript | 5.9, modo estrito | O `typescript-eslint` atual exige abaixo de 6.1 |
| Tailwind CSS | 4 | Tokens em `src/app/globals.css` |
| Zod | 4 | Valida toda entrada no servidor |
| Recharts | 3 | Gráficos de evolução |
| Supabase | `@supabase/ssr` 0.12, `supabase-js` 2 | PostgreSQL, Auth e Storage |
| Mercado Pago | SDK oficial 3 | Inclui o validador de webhook |
| Resend | 6 | Atrás da interface em `src/lib/email` |
| Sentry | `@sentry/nextjs` 11 | Toda a coleta de dados pessoais desligada |
| sharp | 0.35 | Reprocessa fotos no servidor |
| Vitest e Playwright | 5 e 1.64 | |

## Rodar os testes (não precisa de nenhuma conta)

Precisa só de Node.js e Git. Os testes de banco usam um Postgres real instalado pelo npm, sem Docker.

```bash
npm ci
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run test
```

```bash
npm run build
```

Os testes E2E sobem sozinhos o Postgres, um emulador do Supabase e o app. No Windows usam o Edge já instalado. Em outros sistemas, instale antes o navegador:

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

### O que os testes não provam

`tests/e2e/support/fake-supabase.ts` emula só o HTTP do Supabase, sobre Postgres real e com RLS real. `fake-mercadopago.ts` simula o Mercado Pago. As tabelas `auth` e `storage` dos testes são um esboço das originais. Por isso, é preciso repetir a verificação nos serviços reais antes do lançamento.

## Subir o app de verdade em desenvolvimento

Exige Docker (para o Supabase local) ou um projeto no Supabase.

1. Copie o arquivo de variáveis e preencha conforme a tabela abaixo:

   ```bash
   cp .env.example .env.local
   ```

2. Suba o Supabase local e aplique migrations e seed:

   ```bash
   npx supabase start
   ```

   ```bash
   npx supabase db reset
   ```

   O comando `start` mostra a URL e as chaves para o `.env.local`.

3. Inicie o app:

   ```bash
   npm run dev
   ```

4. Abra `http://localhost:3000`, crie uma conta e confirme o e-mail. No Supabase local, o e-mail aparece na ferramenta de caixa de entrada indicada pelo `supabase start`.
5. Crie o primeiro admin: [docs/PRIMEIRO_ADMIN.md](docs/PRIMEIRO_ADMIN.md).

Sem exercícios revisados, ninguém consegue montar treino. Como admin, cadastre os exercícios em `/admin/exercicios`; um profissional convidado revisa; depois você publica.

## Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Navegador e servidor | URL pública do app |
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador e servidor | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Navegador e servidor | Chave pública; quem protege os dados é a RLS |
| `NEXT_PUBLIC_SENTRY_DSN` | Navegador (opcional) | Erros no navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | **Só servidor** | Ignora a RLS. Usada só em `src/lib/supabase/admin.ts`, com auditoria |
| `MERCADOPAGO_ACCESS_TOKEN` | **Só servidor** | API do Mercado Pago |
| `MERCADOPAGO_WEBHOOK_SECRET` | **Só servidor** | Assinatura do webhook |
| `RESEND_API_KEY` | **Só servidor** | Sem ela, nenhum e-mail sai e o registro fica como `skipped` |
| `EMAIL_FROM` | Só servidor | Remetente, em domínio verificado |
| `CRON_SECRET` | **Só servidor** | Protege `/api/cron/daily` |
| `SENTRY_DSN` | Só servidor (opcional) | Erros no servidor |
| `WAITLIST_ENABLED` | Só servidor (opcional) | `true` troca os botões de compra da landing pela lista de espera |

Nunca coloque segredo em variável `NEXT_PUBLIC_`: ela vai para o navegador. A varredura de segredos roda antes de cada commit e no CI (`npm run secrets:scan`).

## Estrutura

```
src/
  app/
    (public)/        landing, termos, privacidade
    (auth)/          cadastro, login, recuperar-senha
    (onboarding)/    primeiros passos
    (student)/       inicio, treinos, evolucao, checkins, assinatura, configuracoes
    (professional)/  profissional/...
    (admin)/         admin/...
    api/             webhook do Mercado Pago, rotina diária, reenvio de treino, exportação
  components/        ui/ e componentes por domínio
  features/          auth, workouts, progress, checkins, billing, professionals, admin, account
  lib/               supabase/, mercadopago/, email/, validation/, security/
  proxy.ts           sessão, rotas protegidas e CSP
supabase/
  migrations/        tabelas, funções, RLS, Storage
  tests/             testes de RLS
  seed.sql           só planos e preços; nunca usuários
tests/
  unit/              regras puras
  integration/       webhook e rotinas com Postgres real
  e2e/               fluxos completos em viewport de celular
docs/                PROGRESSO, PENDENCIAS, CONFIGURACAO_EXTERNA, OPERACAO, CHECKLIST_LANCAMENTO, PRIMEIRO_ADMIN
```

## Autorização em três camadas

1. **Rota:** os layouts conferem o perfil (`requireRole`).
2. **Ação de servidor:** confere perfil e plano (`assertRole`, `hasEntitlement`).
3. **Banco:** a RLS decide. RLS ligada em todas as tabelas do schema `public`.

O acesso pago só muda pelo webhook autenticado. O retorno do checkout mostra apenas "aguardando confirmação", e o valor cobrado vem sempre do banco.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run check` | Typecheck, lint, testes e build |
| `npm run test:unit` | Só testes unitários |
| `npm run test:db` | RLS e integração, com Postgres real |
| `npm run test:e2e` | Fluxos completos |
| `npm run db:types` | Regenera os tipos do banco a partir das migrations |
| `npm run secrets:scan` | Varredura de segredos |

Depois de alterar uma migration, rode `npm run db:types`.

## Documentação

- [docs/PROGRESSO.md](docs/PROGRESSO.md): o que foi feito e verificado, por fase.
- [docs/PENDENCIAS.md](docs/PENDENCIAS.md): premissas adotadas e itens em aberto.
- [docs/CONFIGURACAO_EXTERNA.md](docs/CONFIGURACAO_EXTERNA.md): tudo que depende de contas, credenciais ou pessoas.
- [docs/OPERACAO.md](docs/OPERACAO.md): rotina, incidentes e restauração de backup.
- [docs/CHECKLIST_LANCAMENTO.md](docs/CHECKLIST_LANCAMENTO.md): o que conferir antes de vender.
