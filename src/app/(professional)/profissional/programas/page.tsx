import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { createCatalogPlanAction } from "@/features/professionals/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Programas | Auge Fit" };

export default async function ProgramsPage() {
  await requireRole("professional");
  const supabase = await createClient();
  const { data: professionalId } = await supabase.rpc("current_professional_id");
  const { data: plans } = professionalId
    ? await supabase.from("workout_plans").select("id, name, status").eq("kind", "catalog").eq("author_professional_id", professionalId).order("created_at", { ascending: false })
    : { data: [] };

  return (
    <>
      <PageHeader title="Programas do catálogo" description="Programas do Pro, com sua autoria e seu CREF visíveis." />
      <div className="space-y-4">
        <Card>
          <ActionForm action={createCatalogPlanAction}>
            <Field name="name" label="Novo programa" maxLength={120} />
            <SubmitButton variant="secondary">Criar programa</SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          {plans?.length ? (
            <ul className="space-y-2">
              {plans.map((p) => (
                <li key={p.id}>
                  <Link href={`/profissional/planos/${p.id}`} className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-2">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-sm text-muted">{p.status === "published" ? "Publicado" : "Rascunho"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum programa criado" />
          )}
        </Card>
      </div>
    </>
  );
}
