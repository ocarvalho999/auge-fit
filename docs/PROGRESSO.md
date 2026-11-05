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

## Fase 4. Funcionalidades do aluno

- Onboarding em 3 passos, dashboard, montagem de treino, biblioteca, registro de séries com carga anterior, fila local com reenvio, evolução com gráficos de carga, volume e peso, medidas, fotos privadas com reprocessamento no servidor, check-ins, configurações, exportação e exclusão de conta.
- E2E em viewport de 375 px passando no Edge: cadastro, onboarding, primeiro treino, queda de conexão, reenvio automático, reenvio repetido do mesmo `client_uuid` sem duplicar, gráfico com linha desenhada, carga anterior na sessão seguinte, arquivo falso recusado pelo conteúdo, exclusão apagando conta, perfil e arquivos.
- Telas conferidas por captura. A conferência revelou e corrigiu: aviso de conexão piscando online, "Série 3 de 2", navegação inferior apertada, agrupamento por dia em UTC e fila que só reenviava durante o treino.
- **Não verificado:** e-mail de boas-vindas real (sem Resend, o envio fica como `skipped`); upload e links assinados contra o Storage real do Supabase; PWA instalada em iPhone real.

## Fase 5. Funcionalidades profissionais

- Painel com fila de pendências, alunos vinculados, planejamento individual, programas do catálogo, abertura e análise de check-ins, feedback e revisão de exercícios.
- E2E passando: planejamento (rascunho oculto, publicado visível com CREF), check-in com feedback de ponta a ponta, acesso a fotos registrado em `audit_logs`, foto carregada de fato no navegador.
- **Critério da fase:** profissional sem vínculo não acessa nada do aluno, e vínculo encerrado corta o acesso na hora. Comprovado por E2E e pelos testes de RLS: nenhum dado do aluno aparece na resposta HTML.
- O convite de profissional entra na fase 6, junto do painel do admin, que é quem convida.

## Fase 6. Painel administrativo

- Usuários, profissionais e CREF, convite, vínculos e vagas, lista de espera, planos e preços, cupons, exercícios e auditoria.
- **Critério da fase:** admin barrado em prescrição e fotos, comprovado em três camadas por E2E: as rotas redirecionam, o painel não oferece a ação, e chamadas diretas à API com o token do admin são recusadas (fotos vazias, link assinado negado, criação e edição de prescrição sem efeito). Também coberto pelos testes de RLS.
- E2E passando: convite com CREF conferido até a criação da senha, preço editado refletindo na landing, cupom, exercício só publicável depois da revisão, vínculo do Black iniciando as 8 semanas.
- **Correção importante:** o React 19 limpava os campos dos formulários depois de cada envio, então um erro de validação apagava o que a pessoa digitou, inclusive no cadastro. Corrigido no `ActionForm` e coberto por teste.
- **Mudança de projeto:** o convite passou a usar a tabela `staff_invites`, gravada só pelo servidor, em vez de `app_metadata`, para não depender da ordem interna de gravação do Supabase Auth.
- **Não verificado:** envio real do convite por e-mail (sem Resend, o painel avisa que não enviou) e `generateLink` contra o Supabase Auth real.

## Fase 7. Pagamentos e assinaturas

- Checkout (assinatura mensal sem token de cartão, pagamento único Pix ou cartão), webhook com validador oficial do SDK, carência, cancelamento em autoatendimento, reembolso, histórico, cupons, vagas do Black com reserva de 30 minutos, lista de espera e rotina diária protegida por segredo.
- **Critério da fase, na alternativa sem credenciais:** testes com assinatura simulada e pendência declarada. **Nada foi testado no sandbox real do Mercado Pago**, porque não há credenciais. Veja `docs/CONFIGURACAO_EXTERNA.md`.
- Testes passando, com Postgres real e só o Mercado Pago simulado: assinatura inválida, ausente e de outro `data.id`, evento repetido, evento fora de ordem, valor adulterado, recusa, falha do provedor com reprocessamento, reembolso, carência, vencimento, idempotência da rotina e corrida pela última vaga do Black com 12 conexões simultâneas.
- E2E passando: assinatura com cupom, "aguardando confirmação" sem liberar acesso, liberação só pelo webhook, reembolso pelo admin, cancelamento, Black esgotado com lista de espera.

## Fase 8. Segurança e testes

- CSP com nonce por resposta, HSTS e demais cabeçalhos; sessão em cookie `HttpOnly` e `SameSite=Lax`; limites de uso separados por IP e por pessoa; varredura de segredos em gancho de commit e no CI; Sentry com toda a coleta desligada e filtro antes do envio.
- Testes passando: nonce único e aplicado, fluxo do aluno sem bloqueio da CSP, sessão inacessível ao JavaScript, nenhum segredo no JavaScript enviado ao navegador, erro genérico de login, limite de tentativas, recuperação e cadastro sem revelar e-mail, menor de 18 anos, conta suspensa, redirecionamento aberto.
- **Achados corrigidos na revisão de permissões:**
  - A exportação de dados dependia só da RLS em `set_logs`; um profissional receberia dados dos alunos vinculados. Agora filtra pelo dono, com teste.
  - Conta suspensa só era barrada na tela. Agora perde o direito também no banco (`has_entitlement`), com teste.
  - No Sentry 11, `sendDefaultPii` não existe mais e o padrão coleta cookies, cabeçalhos e corpos. A coleta foi desligada item por item.
  - Pagamento do Black depois de a reserva expirar não voltava a ocupar a vaga.
- **Auditoria de dependências (`npm audit`):** 0 vulnerabilidades nas dependências de produção. 8 moderadas nas de desenvolvimento, todas ligadas a `minimatch` nas ferramentas de lint; não vão para o servidor nem para o navegador.
- **Não verificado:** recebimento real de erros no Sentry (sem DSN); cabeçalhos e HSTS sobre HTTPS real.

## Fase 9. Documentação

- README com instalação, variáveis, estrutura e limites dos testes; `docs/OPERACAO.md` com rotina, incidentes e restauração de backup; `docs/CONFIGURACAO_EXTERNA.md` completo.
- **Critério da fase:** o README foi seguido em um clone limpo, em outra pasta: `npm ci`, typecheck, lint, testes e build passaram. A parte "subir o app de verdade" exige Docker ou Supabase e **não pôde ser executada nesta máquina**.

## Fase 10. Deploy

- **Preparado:** `vercel.json` com rotina diária e região de São Paulo, job de E2E no CI e `docs/CHECKLIST_LANCAMENTO.md`.
- **Não executado, porque depende de contas e credenciais do fundador:** publicação no GitHub, projeto na Vercel, migrations em homologação e produção, webhook de produção e domínio. O critério "checklist de lançamento conferido" **não está cumprido**: só a parte local foi conferida.

### Publicação no GitHub

- Código enviado ao repositório privado `ocarvalho999/auge-fit`, branch `main`. As branches `fase/*` ficaram só na máquina local; o conteúdo delas está todo na `main`.
- CI verde na primeira execução no GitHub, nos jobs `check` e `e2e`. Foi a primeira vez que a suíte rodou no Linux, com Chromium.
- O primeiro envio foi recusado com `fatal error in commit_refs_rules`. Um envio sem arquivo de workflow passou e o mesmo envio com workflow foi recusado. Depois da autorização do fundador, o envio passou pelo Gerenciador de Credenciais do Windows. O token do `gh` continua sem o escopo `workflow`, e o motivo exato da mudança não foi confirmado.
- Vercel, Supabase, Mercado Pago, Resend e domínio seguem pendentes: dependem das contas do fundador.
