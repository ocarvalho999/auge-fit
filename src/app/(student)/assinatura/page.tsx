import { WaitlistForm } from "@/components/layout/waitlist-form";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { cancelSubscriptionAction, requestRefundAction, startCheckoutAction } from "@/features/billing/actions";
import { FEATURE_LABELS, getCatalog } from "@/features/billing/catalog";
import { isWithinGuarantee } from "@/features/billing/domain";
import { getCurrentSubscription } from "@/features/billing/entitlements";
import { formatCents, formatDate, INTERVAL_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Assinatura | Auge Fit" };

const SUB_STATUS: Record<string, string> = {
  active: "Ativa",
  past_due: "Cobrança pendente",
  cancelled: "Cancelada",
  expired: "Vencida",
  refunded: "Reembolsada",
};
const PAY_STATUS: Record<string, string> = {
  pending: "Aguardando",
  approved: "Aprovado",
  rejected: "Recusado",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
  amount_mismatch: "Em análise",
};

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ black?: string }> }) {
  const profile = await requireRole("student");
  const { black } = await searchParams;
  const supabase = await createClient();
  const [subscription, catalog, { data: payments }] = await Promise.all([
    getCurrentSubscription(profile.id),
    getCatalog(),
    supabase.from("payments").select("id, status, amount_cents, method, paid_at, created_at, refund_requested_at").order("created_at", { ascending: false }).limit(50),
  ]);
  // Calculado aqui para o React não reclamar de valor que muda entre renderizações.
  const refundable = new Set((payments ?? []).filter((p) => p.status === "approved" && isWithinGuarantee(p.paid_at ? new Date(p.paid_at) : null)).map((p) => p.id));
  const canCancel = subscription && ["active", "past_due"].includes(subscription.status) && subscription.plan_prices?.interval !== "package";

  return (
    <>
      <PageHeader title="Assinatura" />
      <div className="space-y-4">
        {black === "esgotado" ? (
          <Card>
            <Alert tone="warning">As vagas do Black estão esgotadas no momento. Entre na lista de espera e avisaremos.</Alert>
            <div className="mt-4">
              <WaitlistForm source="black_sold_out" planCode="black" />
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-2 font-bold">Seu plano</h2>
          {subscription ? (
            <>
              <p className="text-lg font-semibold">
                {subscription.plan_prices?.plans?.name} · {SUB_STATUS[subscription.status] ?? subscription.status}
              </p>
              <p className="text-sm text-muted">
                {subscription.current_period_end
                  ? `Acesso pago até ${formatDate(subscription.current_period_end)}`
                  : "As 8 semanas começam quando o vínculo com o profissional for feito."}
              </p>
              {canCancel ? (
                <div className="mt-4">
                  <ActionForm action={cancelSubscriptionAction}>
                    <input type="hidden" name="subscriptionId" value={subscription.id} />
                    <SubmitButton variant="danger">Cancelar assinatura</SubmitButton>
                  </ActionForm>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title="Você ainda não tem um plano ativo" />
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">{subscription ? "Trocar ou renovar plano" : "Escolha um plano"}</h2>
          <p className="mb-3 text-sm text-muted">Garantia de 7 dias em todos os planos. O pagamento acontece na página do Mercado Pago.</p>
          {catalog ? (
            <div className="grid gap-4 md:grid-cols-3">
              {catalog.plans.map((plan) => {
                const unavailable = plan.code === "pro" && !catalog.proSellable;
                return (
                  <div key={plan.id} className="rounded-xl bg-surface-2 p-3">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <ul className="my-2 space-y-1 text-sm text-muted">
                      {FEATURE_LABELS.filter((f) => plan.features[f.key]).map((f) => (
                        <li key={f.key}>{f.label}</li>
                      ))}
                    </ul>
                    {unavailable ? (
                      <p className="font-semibold text-muted">Em breve</p>
                    ) : (
                      plan.prices.map((price) => (
                        <ActionForm key={price.id} action={startCheckoutAction} className="mt-3 space-y-2">
                          <input type="hidden" name="priceId" value={price.id} />
                          <Field name="coupon" label="Cupom (opcional)" maxLength={40} autoComplete="off" />
                          <SubmitButton pendingLabel="Abrindo pagamento...">
                            {`Assinar ${plan.name}: ${formatCents(price.amount_cents)} ${INTERVAL_LABEL[price.interval]}`}
                          </SubmitButton>
                        </ActionForm>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Alert tone="warning">Não foi possível carregar os planos agora.</Alert>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Pagamentos</h2>
          {payments?.length ? (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li key={p.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <p className="font-semibold">
                    {formatCents(p.amount_cents)} · {PAY_STATUS[p.status] ?? p.status}
                  </p>
                  <p className="text-muted">
                    {formatDate(p.paid_at ?? p.created_at)}
                    {p.method ? ` · ${p.method}` : ""}
                  </p>
                  {p.refund_requested_at && p.status === "approved" ? (
                    <p className="mt-1 text-warning">Reembolso pedido em {formatDate(p.refund_requested_at)}.</p>
                  ) : refundable.has(p.id) ? (
                    <div className="mt-2">
                      <ActionForm action={requestRefundAction}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <SubmitButton variant="secondary">Pedir reembolso (garantia de 7 dias)</SubmitButton>
                      </ActionForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum pagamento ainda" />
          )}
        </Card>
      </div>
    </>
  );
}
