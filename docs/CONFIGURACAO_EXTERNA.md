# Configuração externa

O que depende de contas, credenciais ou pessoas. Nada aqui foi feito pelo desenvolvimento.

## Mercado Pago: pontos a verificar em sandbox

Documentação lida em 2026-11-05. **Nenhum destes pontos foi testado em sandbox**, porque não há credenciais.

| # | Pergunta da especificação | O que a documentação diz | O que falta confirmar |
|---|---|---|---|
| 1 | Qual fluxo mantém o cartão fora do nosso servidor? | Assinatura com plano associado sempre exige `card_token_id` e status `authorized`. Sem plano, com status `pending`, o pagamento fica pendente e pode ser concluído depois. A resposta traz `init_point`. | Se a pessoa digita o cartão na página do `init_point` quando não há `card_token_id`. O app assume que sim. |
| 2 | Quais meios valem para a cobrança automática? | A visão geral lista dinheiro em conta, Pix, cartão, linha de crédito e boleto, sem dizer quais cobram sozinhos. | "Mensal só no cartão" segue como premissa. Testar quais meios a página oferece e quais renovam. |
| 3 | Como configurar a notificação de assinaturas? | "Este método de configuração não está disponível para integrações com QR Code e nem Assinaturas" (configuração pelo painel). `notification_url` não aparece em `POST /preapproval` nem no tipo do SDK. | **Crítico:** como receber `subscription_preapproval` e `subscription_authorized_payment`. Sem isso, a mensal não libera acesso. Testar no painel e, se preciso, abrir chamado no suporte do Mercado Pago. |

Conferir também:

- Se pagamentos recorrentes trazem `external_reference`. O app usa `preapproval_id` da fatura como caminho principal.
- O conjunto real de status de assinatura (a documentação não traz lista completa) e a grafia `cancelled` ou `canceled`.
- Se o `x-signature` chega igual em assinaturas e pagamentos. Notificações de QR Code não são assinadas, mas não usamos QR Code.

### Passo a passo

1. Crie a aplicação em **Suas integrações** e copie o Access Token de teste.
2. Em **Webhooks > Configurar notificação**, cadastre `https://SEU-DOMINIO/api/webhooks/mercadopago` e copie a assinatura secreta.
3. Em `.env.local` (ou na Vercel), preencha `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`.
4. Com usuários de teste, compre um plano de cada modalidade e confira em `/admin/pagamentos`.
5. Registre aqui o resultado dos pontos acima.

## Contas a criar

Nenhuma conta foi criada no desenvolvimento, e nenhuma credencial real foi usada.

| Serviço | Para quê | O que fazer |
|---|---|---|
| GitHub | Código e CI | Criar repositório **privado** e enviar o código |
| Vercel Pro | Hospedagem e rotina diária | Importar o repositório e cadastrar as variáveis |
| Supabase Pro | Banco, login e fotos | Um projeto de homologação e um de produção, na região de São Paulo |
| Mercado Pago | Pagamentos | Criar a aplicação; credenciais de teste e de produção |
| Resend | E-mails | Verificar o domínio por DNS |
| Sentry | Erros | Criar o projeto Next.js e copiar o DSN (opcional no início) |
| Domínio | Endereço do app | Registrar e apontar para a Vercel |

## Credenciais de produção

O fundador insere direto na Vercel, em **Settings > Environment Variables**. Nunca por chat, e-mail ou arquivo no repositório. A lista está no README.

Gere o `CRON_SECRET` com um valor longo e aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Supabase

1. Aplique as migrations no projeto:

   ```bash
   npx supabase link --project-ref SEU_PROJETO
   ```

   ```bash
   npx supabase db push
   ```

2. Rode `supabase/seed.sql` uma vez no SQL Editor. Ele só cria planos e preços.
3. Em **Authentication > URL Configuration**, ajuste **Site URL** para o domínio e inclua `https://SEU-DOMINIO/auth/confirm` nas URLs de redirecionamento.
4. Em **Authentication > Email**, mantenha a confirmação de e-mail ligada e configure o SMTP do Resend, para os e-mails de verificação e redefinição saírem do seu domínio.
5. Ajuste os modelos de e-mail do Auth para o link do app. Modelo de confirmação:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding
   ```

   Modelo de recuperação de senha:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/recuperar-senha/nova
   ```

   Sem o ajuste, o Supabase envia o link com `code`, que o app também aceita, mas só funciona no mesmo navegador onde a pessoa se cadastrou. **Não testado contra o Supabase real.**
6. Crie o primeiro admin: [PRIMEIRO_ADMIN.md](PRIMEIRO_ADMIN.md).

## E-mail

No Resend, verifique o domínio com os registros DNS indicados e preencha `RESEND_API_KEY` e `EMAIL_FROM`. Sem isso, nenhum e-mail transacional sai; o sistema registra `skipped` e o painel avisa no convite.

## Depende de pessoas

- **Marca:** disponibilidade de "Auge Fit" no INPI, em domínios e nas redes. Não foi verificada.
- **Revisão jurídica:** termos, privacidade, consentimentos, contrato de profissionais e reembolso. As páginas estão marcadas como rascunho e o app não declara conformidade legal.
- **Profissionais:** conferência do CREF e contrato, incluindo o repasse do Black (sugestão: 60%). O repasse é fora do sistema.
- **Conteúdo técnico:** exercícios e pelo menos 3 programas do Pro, escritos e revisados por profissional. O fundador não tem formação em Educação Física, então não deve escrever esse conteúdo. Nenhum conteúdo técnico foi inventado no desenvolvimento.
- **Backup:** confirmar se cobre os arquivos do Storage e fazer o teste de restauração ([OPERACAO.md](OPERACAO.md)).
- **Landing:** gravar o app real em uso.
