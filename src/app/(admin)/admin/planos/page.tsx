import { Card, PageHeader } from "@/components/ui/feedback";
import { ActionForm, CheckboxField, Field, SubmitButton } from "@/components/ui/form";
import { updatePriceAction } from "@/features/admin/actions";
import { requireRole } from "@/features/auth/session";
import { INTERVAL_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Planos | Auge Fit" };

export default async function AdminPlansPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("id, code, name, plan_prices(id, interval, amount_cents, active)").order("code");

  return (
    <>
      <PageHeader title="Planos e preços" description="O valor cobrado sempre vem daqui. Assinaturas mensais já criadas mantêm o valor contratado." />
      <div className="space-y-4">
        {(plans ?? []).map((plan) => (
          <Card key={plan.id}>
            <h2 className="mb-3 text-lg font-bold">{plan.name}</h2>
            <div className="space-y-4">
              {plan.plan_prices.map((price) => (
                <ActionForm key={price.id} action={updatePriceAction} className="space-y-2 rounded-xl bg-surface-2 p-3">
                  <input type="hidden" name="id" value={price.id} />
                  <Field
                    name="amount"
                    label={`Valor em reais ${INTERVAL_LABEL[price.interval]}`}
                    inputMode="decimal"
                    defaultValue={(price.amount_cents / 100).toFixed(2).replace(".", ",")}
                  />
                  <CheckboxField name="active" defaultChecked={price.active}>
                    Disponível para venda
                  </CheckboxField>
                  <SubmitButton variant="secondary">Salvar preço</SubmitButton>
                </ActionForm>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
