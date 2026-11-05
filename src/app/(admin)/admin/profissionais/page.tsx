import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, CheckboxField, Field, SelectField, SubmitButton } from "@/components/ui/form";
import { inviteProfessionalAction, resendInviteAction, updateProfessionalAction } from "@/features/admin/actions";
import { requireRole } from "@/features/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profissionais | Auge Fit" };

export default async function AdminProfessionalsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, profile_id, cref_number, cref_uf, cref_verified_at, capacity, status, profiles!professionals_profile_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Profissionais e CREF" />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-bold">Convidar profissional</h2>
          <ActionForm action={inviteProfessionalAction} resetOnSuccess>
            <Field name="fullName" label="Nome completo" maxLength={120} />
            <Field name="email" label="E-mail" type="email" inputMode="email" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field name="crefNumber" label="Número do CREF" maxLength={20} />
              </div>
              <Field name="crefUf" label="UF" maxLength={2} />
            </div>
            <Field name="capacity" label="Vagas do Black" type="number" inputMode="numeric" min={0} defaultValue={15} />
            <CheckboxField name="crefChecked">Conferi manualmente o registro no CREF deste profissional.</CheckboxField>
            <SubmitButton>Enviar convite</SubmitButton>
          </ActionForm>
        </Card>
        {professionals?.length ? (
          professionals.map((p) => (
            <Card key={p.id}>
              <h2 className="font-bold">{p.profiles?.full_name || "Profissional"}</h2>
              <p className="mb-3 text-sm text-muted">
                CREF {p.cref_number}/{p.cref_uf} · conferido em {formatDate(p.cref_verified_at)}
              </p>
              <ActionForm action={updateProfessionalAction} className="space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field name="capacity" label="Vagas" type="number" inputMode="numeric" min={0} defaultValue={p.capacity} />
                  <SelectField
                    name="status"
                    label="Situação"
                    defaultValue={p.status === "active" ? "active" : "inactive"}
                    options={[
                      { value: "active", label: "Ativo" },
                      { value: "inactive", label: "Inativo" },
                    ]}
                  />
                </div>
                <SubmitButton variant="secondary">Salvar</SubmitButton>
              </ActionForm>
              <form action={resendInviteAction} className="mt-2">
                <input type="hidden" name="profileId" value={p.profile_id} />
                <button type="submit" className={buttonClass("ghost", "w-full")}>
                  Reenviar convite
                </button>
              </form>
            </Card>
          ))
        ) : (
          <EmptyState title="Nenhum profissional convidado" />
        )}
      </div>
    </>
  );
}
