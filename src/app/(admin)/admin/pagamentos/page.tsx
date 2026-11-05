import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { adminRefundAction } from "@/features/billing/actions";
import { isWithinGuarantee } from "@/features/billing/domain";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pagamentos | Auge Fit" };

export default async function AdminPaymentsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("id, status, amount_cents, method, paid_at, refund_requested_at, refunded_at, created_at, subscriptions(profiles(full_name), plan_prices(plans(name)))")
    .order("created_at", { ascending: false })
    .limit(100);
  const requested = (payments ?? []).filter((p) => p.refund_requested_at && p.status === "approved");
  const inGuarantee = new Set(requested.filter((p) => isWithinGuarantee(p.paid_at ? new Date(p.paid_at) : null)).map((p) => p.id));

  return (
    <>
      <PageHeader title="Pagamentos e reembolsos" description="O acesso só termina quando o webhook confirmar o reembolso." />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-bold">Reembolsos pedidos</h2>
          {requested.length ? (
            <ul className="space-y-3">
              {requested.map((p) => (
                <li key={p.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <p className="font-semibold">
                    {p.subscriptions?.profiles?.full_name ?? "Conta excluída"} · {formatCents(p.amount_cents)}
                  </p>
                  <p className="mb-2 text-muted">
                    Pago em {formatDate(p.paid_at)} · {inGuarantee.has(p.id) ? "dentro dos 7 dias: reembolso integral" : "fora dos 7 dias"}
                  </p>
                  <ActionForm action={adminRefundAction}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <SubmitButton variant="danger">Reembolsar</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum reembolso pendente" />
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Últimos pagamentos</h2>
          {payments?.length ? (
            <ul className="space-y-2 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="rounded-xl bg-surface-2 p-3">
                  <p className="font-semibold">
                    {formatCents(p.amount_cents)} · {p.status} · {p.subscriptions?.plan_prices?.plans?.name}
                  </p>
                  <p className="text-muted">
                    {p.subscriptions?.profiles?.full_name ?? "Conta excluída"} · {formatDate(p.paid_at ?? p.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum pagamento" />
          )}
        </Card>
      </div>
    </>
  );
}
