# Operação

Nenhum procedimento abaixo foi executado em produção, porque o app ainda não foi publicado. Revise cada um no primeiro uso.

## Rotina diária

`/api/cron/daily` roda às 8h de Brasília (`vercel.json`), protegida por `CRON_SECRET`, e pode rodar mais de uma vez sem repetir efeito. Ela:

- expira reservas de vaga do Black;
- vence assinaturas depois do fim do período e da carência;
- encerra vínculos com prazo vencido;
- envia avisos do trimestre (7 dias e 1 dia antes) e de inatividade de 5 dias (só para quem aceitou marketing);
- abre o check-in semanal dos vínculos ativos.

Para rodar à mão:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU-DOMINIO/api/cron/daily
```

## Tarefas do admin

| Tarefa | Onde | Observação |
|---|---|---|
| Vincular comprador do Black | `/admin/vinculos` | **As 8 semanas começam aqui.** Vincule logo depois da compra |
| Reembolsar | `/admin/pagamentos` | O acesso termina quando o webhook confirmar |
| Convidar profissional | `/admin/profissionais` | Confira o CREF antes |
| Publicar exercício | `/admin/exercicios` | Só depois da revisão do profissional |
| Editar preço | `/admin/planos` | Assinaturas mensais já criadas mantêm o valor contratado |
| Criar cupom | `/admin/cupons` | Use a campanha para medir cada vídeo |

## Incidentes

| Sintoma | Onde olhar | O que fazer |
|---|---|---|
| Pagou e o acesso não liberou | `webhook_events` e `payments`; painel do Mercado Pago | Confira se o evento chegou e tem `processed_at`. Evento sem `processed_at` é reprocessado no reenvio |
| Pagamento com status "Em análise" | `audit_logs`, ação `payment.amount_mismatch` | O valor pago difere do esperado. Confira no Mercado Pago e reembolse se for o caso |
| Webhook devolvendo 401 | `MERCADOPAGO_WEBHOOK_SECRET` | Segredo diferente do painel |
| E-mail não chega | `notifications` | `skipped`: sem Resend configurado. `failed`: erro no provedor |
| Black vendido além da capacidade | `/admin/vinculos` | Pode ocorrer com pagamento depois de a reserva expirar. Aumente a capacidade ou reembolse |
| Muitas tentativas no login | `rate_limits` | A janela expira sozinha |

Consultas às tabelas no SQL Editor do Supabase usam acesso total: não copie dados de saúde para fora do banco.

## Backup e restauração

**Atenção:** confirme no painel do Supabase o que o seu plano cobre. Em geral, o backup do banco **não inclui os arquivos do Storage**, ou seja, as fotos de progresso. Este é um item em aberto de [CONFIGURACAO_EXTERNA.md](CONFIGURACAO_EXTERNA.md).

### Restaurar o banco

1. Avise que o sistema entrará em manutenção e desligue o cron na Vercel.
2. No Supabase, em **Database > Backups**, escolha o ponto de restauração. A restauração sobrescreve o banco atual.
3. Eventos do Mercado Pago ocorridos depois do ponto restaurado se perdem. Compare os pagamentos do período no painel do Mercado Pago com a tabela `payments` e corrija o que faltar.
4. Confira: login, um aluno, `plans`, `plan_prices`, e se `select count(*) from pg_tables where schemaname = 'public' and not rowsecurity` devolve 0.
5. Religue o cron.

### Teste de restauração

Faça antes do lançamento e depois a cada trimestre, em um projeto separado de homologação, nunca em produção. Anote a data e o tempo gasto aqui:

| Data | Ponto restaurado | Tempo | Fotos cobertas? | Responsável |
|---|---|---|---|---|
| | | | | |

## Direitos do titular

Exportação e exclusão são em autoatendimento, em Ajustes. Se alguém pedir por outro canal, confirme a identidade e oriente a usar o app. A exclusão apaga dados e arquivos e mantém registros financeiros sem vínculo com a pessoa.

## Atualizar dependências

Depois de atualizar, rode `npm run check` e `npm run test:e2e`. Depois de alterar migrations, rode `npm run db:types`.
