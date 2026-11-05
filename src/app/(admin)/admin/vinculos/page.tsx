import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, SelectField, SubmitButton } from "@/components/ui/form";
import { endLinkAction, linkBlackAction } from "@/features/admin/actions";
import { requireRole } from "@/features/auth/session";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Vínculos e vagas | Auge Fit" };

export default async function AdminLinksPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: professionals }, { data: subs }, { data: links }, { data: waitlist }] = await Promise.all([
    supabase.from("professionals").select("id, capacity, cref_number, cref_uf, status, cref_verified_at, profiles!professionals_profile_id_fkey(full_name)").eq("status", "active"),
    supabase.from("subscriptions").select("id, created_at, profile_id, profiles(full_name), plan_prices(plans(code))").eq("status", "active").is("current_period_end", null),
    supabase.from("professional_students").select("id, starts_at, ends_at, profiles(full_name), professionals(cref_number, cref_uf)").eq("status", "active").order("starts_at", { ascending: false }),
    supabase.from("waitlist_entries").select("id, email, source, created_at").eq("source", "black_sold_out").order("created_at"),
  ]);
  const admin = createAdminClient();
  const slots = await Promise.all(
    (professionals ?? []).map(async (p) => {
      const { data } = await admin.rpc("black_slots_used", { p_professional_id: p.id });
      return { ...p, used: data ?? 0 };
    }),
  );
  const awaiting = (subs ?? []).filter((s) => s.plan_prices?.plans?.code === "black");
  const options = [
    { value: "", label: "Escolha" },
    ...slots
      .filter((p) => p.cref_verified_at)
      .map((p) => ({ value: p.id, label: `${p.profiles?.full_name ?? "Profissional"} (${p.used}/${p.capacity})` })),
  ];

  return (
    <>
      <PageHeader title="Vínculos e vagas" description="As 8 semanas do Black começam no vínculo." />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-bold">Vagas por profissional</h2>
          {slots.length ? (
            <ul className="space-y-1 text-sm">
              {slots.map((p) => (
                <li key={p.id}>
                  {p.profiles?.full_name}: {p.used} de {p.capacity} em uso
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum profissional ativo" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Black aguardando vínculo</h2>
          {awaiting.length ? (
            <ul className="space-y-3">
              {awaiting.map((s) => (
                <li key={s.id} className="rounded-xl bg-surface-2 p-3">
                  <p className="font-semibold">{s.profiles?.full_name || "Aluno"}</p>
                  <p className="mb-2 text-sm text-muted">Compra em {formatDate(s.created_at)}</p>
                  <ActionForm action={linkBlackAction} className="space-y-2">
                    <input type="hidden" name="subscriptionId" value={s.id} />
                    <SelectField name="professionalId" label="Profissional" options={options} />
                    <SubmitButton variant="secondary">Criar vínculo</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma compra aguardando vínculo" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Vínculos ativos</h2>
          {links?.length ? (
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">{l.profiles?.full_name || "Aluno"}</p>
                    <p className="text-muted">
                      CREF {l.professionals?.cref_number}/{l.professionals?.cref_uf} · até {formatDate(l.ends_at)}
                    </p>
                  </div>
                  <form action={endLinkAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" className={buttonClass("danger")}>
                      Encerrar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum vínculo ativo" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Lista de espera do Black</h2>
          {waitlist?.length ? (
            <ul className="space-y-1 text-sm">
              {waitlist.map((w) => (
                <li key={w.id} className="break-all">
                  {w.email} · {formatDate(w.created_at)}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Ninguém na lista de espera" />
          )}
        </Card>
      </div>
    </>
  );
}
