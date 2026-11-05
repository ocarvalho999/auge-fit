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
