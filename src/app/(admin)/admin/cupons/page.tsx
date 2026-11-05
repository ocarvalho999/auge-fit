import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { createCouponAction, toggleCouponAction } from "@/features/admin/actions";
import { requireRole } from "@/features/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cupons | Auge Fit" };

export default async function AdminCouponsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, code, discount_percent, campaign, expires_at, max_uses, active, coupon_redemptions(id)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Cupons" description="Use a campanha para medir cada vídeo." />
      <div className="space-y-4">
        <Card>
          <ActionForm action={createCouponAction} resetOnSuccess>
            <div className="grid grid-cols-2 gap-3">
              <Field name="code" label="Código" maxLength={40} />
              <Field name="discountPercent" label="Desconto (%)" type="number" inputMode="numeric" min={1} max={100} />
              <Field name="campaign" label="Campanha" maxLength={80} />
              <Field name="maxUses" label="Limite de usos" type="number" inputMode="numeric" min={1} />
            </div>
            <Field name="expiresAt" label="Válido até" type="date" />
            <SubmitButton variant="secondary">Criar cupom</SubmitButton>
          </ActionForm>
        </Card>
        {coupons?.length ? (
          coupons.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="text-base font-bold break-all">{c.code}</p>
                <p className="text-muted">
                  {c.discount_percent}% · {c.campaign ?? "Sem campanha"} · {c.coupon_redemptions.length}
                  {c.max_uses ? ` de ${c.max_uses}` : ""} uso(s)
                  {c.expires_at ? ` · até ${formatDate(c.expires_at)}` : ""}
                </p>
              </div>
              <form action={toggleCouponAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                <button type="submit" className={buttonClass(c.active ? "danger" : "secondary")}>
                  {c.active ? "Desativar" : "Ativar"}
                </button>
              </form>
            </Card>
          ))
        ) : (
          <EmptyState title="Nenhum cupom criado" />
        )}
      </div>
    </>
  );
}
