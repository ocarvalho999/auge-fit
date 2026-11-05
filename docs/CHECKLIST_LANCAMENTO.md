# Checklist de lançamento

Situação em 2026-11-05: **o app não foi publicado.** Os itens marcados foram executados e vistos funcionando localmente. Os demais dependem de contas, credenciais ou pessoas. Não venda antes de concluir os bloqueios.

## Já conferido localmente

- [x] Typecheck, lint, testes e build passando
- [x] RLS por perfil, incluindo acesso cruzado, em Postgres real
- [x] Telas públicas sem rolagem horizontal em 375 px e desktop
- [x] Fluxos E2E: cadastro, onboarding, primeiro treino, assinatura, check-in com feedback, cancelamento e exclusão de conta
- [x] Webhook: assinatura inválida, evento repetido, fora de ordem, valor adulterado, reembolso, carência, vencimento, corrida pela última vaga
- [x] Nenhum segredo no repositório nem no JavaScript do navegador
- [x] `vercel.json` com a rotina diária e região de São Paulo

## Bloqueios: sem eles não dá para vender

- [ ] **Mensal:** confirmar em sandbox como receber as notificações de assinatura. Sem isso, a mensal não libera acesso ([detalhes](CONFIGURACAO_EXTERNA.md#mercado-pago-pontos-a-verificar-em-sandbox))
- [ ] **Compra de ponta a ponta no sandbox real**, em cada modalidade: mensal, trimestral, Black
- [ ] **Reembolso real no sandbox**, até o acesso terminar
- [ ] **Migrations no Supabase real** (`supabase db reset` local com Docker ou homologação), porque os testes usam um esboço de `auth` e `storage`
- [ ] **Fluxo real de autenticação:** cadastro com e-mail de verdade, recuperação de senha, convite de profissional
- [ ] **Upload e exibição de foto** no Storage real, e exclusão de conta apagando os arquivos
- [ ] **Revisão jurídica** de termos, privacidade, consentimentos, contrato de profissionais e reembolso; depois, tirar o aviso de rascunho em `src/components/layout/legal-page.tsx` e atualizar `DOCUMENT_VERSION` em `src/lib/legal.ts`
- [ ] **FitBrother no Pro e no Black:** formalizar por escrito a parceria entre as empresas e confirmar com o nutricionista responsável o que pode ser anunciado. A liberação é manual, pelo WhatsApp, com fila em `/admin/fitbrother`; testar um ciclo real de liberar e remover
- [ ] **Biblioteca de exercícios revisada:** sem ela, ninguém monta treino
- [ ] **Profissional com CREF conferido e contrato assinado**, antes de vender o Black
- [ ] **Teste de restauração de backup**, confirmando se cobre as fotos

## Publicação

- [x] Código no repositório público `ocarvalho999/auge-fit`, com CI verde, inclusive o E2E no Linux
- [x] Projeto de homologação no Supabase, em São Paulo, com migrations e seed aplicados e conferidos
- [x] Projeto na Vercel com as variáveis de homologação, publicado em https://auge-fit.vercel.app
- [ ] URLs do Supabase Auth (Site URL e redirecionamento) apontando para a Vercel
- [ ] Repetir todos os bloqueios em homologação
- [ ] Projeto de produção no Supabase, na região de São Paulo: `supabase db push` e rodar `supabase/seed.sql` uma vez
- [ ] Variáveis de produção inseridas pelo fundador direto na Vercel
- [ ] Domínio apontado e HTTPS ativo; atualizar `NEXT_PUBLIC_APP_URL` e o **Site URL** do Supabase
- [ ] Webhook de produção no Mercado Pago e `MERCADOPAGO_WEBHOOK_SECRET` de produção
- [ ] Domínio de e-mail verificado no Resend; SMTP e modelos configurados no Supabase Auth
- [ ] Sentry recebendo um erro de teste, conferindo que não vai dado pessoal
- [ ] Primeiro admin criado ([PRIMEIRO_ADMIN.md](PRIMEIRO_ADMIN.md))
- [ ] Rotina diária aparecendo na Vercel, com a primeira execução conferida

## Conferir no dia

- [ ] Preços em `/admin/planos` iguais aos anunciados
- [ ] Pro "em breve" até haver 3 programas revisados publicados
- [ ] Landing sem depoimento, resultado ou número inventado; gravar o app real em uso
- [ ] PWA instalada em um iPhone e um Android reais
- [ ] Registro de treino testado em celular real, com a internet caindo
- [ ] Uma compra real de baixo valor, seguida de reembolso
- [ ] Marca "Auge Fit" checada no INPI, em domínios e nas redes
