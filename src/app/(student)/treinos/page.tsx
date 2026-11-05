import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, NoPermission, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";
import { hasEntitlement } from "@/features/billing/entitlements";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Treinos | Auge Fit" };

function PlanLink({ id, name, count }: { id: string; name: string; count: number }) {
  return (
    <li>
      <Link href={`/treinos/${id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
        <span className="min-w-0 font-semibold break-words">{name}</span>
        <span className="shrink-0 text-sm text-muted">{count} treino(s)</span>
      </Link>
    </li>
  );
}

export default async function WorkoutsPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const [canLog, hasPrograms, hasIndividual] = await Promise.all([
    hasEntitlement(profile.id, "log_workouts"),
    hasEntitlement(profile.id, "programs"),
    hasEntitlement(profile.id, "individual_plan"),
  ]);
  const { data: mine } = await supabase
    .from("workout_plans")
    .select("id, name, kind, workouts(id)")
    .eq("student_id", profile.id)
    .order("created_at", { ascending: false });
  const { data: catalog } = hasPrograms
    ? await supabase.from("workout_plans").select("id, name, workouts(id)").eq("kind", "catalog").eq("status", "published")
    : { data: [] };
  const own = (mine ?? []).filter((p) => p.kind === "own");
  const prescribed = (mine ?? []).filter((p) => p.kind === "prescribed");

  return (
    <>
      <PageHeader
        title="Treinos"
        action={
          canLog ? (
            <LinkButton href="/treinos/novo">Novo treino</LinkButton>
          ) : (
            <LinkButton href="/assinatura" variant="secondary">
              Ver planos
            </LinkButton>
          )
        }
      />
      <div className="space-y-4">
        {hasIndividual || prescribed.length ? (
          <Card className="ring-1 ring-accent">
            <h2 className="mb-3 font-bold">Seu planejamento individual</h2>
            {prescribed.length ? (
              <ul className="space-y-2">
                {prescribed.map((p) => (
                  <PlanLink key={p.id} id={p.id} name={p.name} count={p.workouts.length} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Seu profissional publicará seu planejamento aqui depois do vínculo.</p>
            )}
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-3 font-bold">Meus treinos</h2>
          {own.length ? (
            <ul className="space-y-2">
              {own.map((p) => (
                <PlanLink key={p.id} id={p.id} name={p.name} count={p.workouts.length} />
              ))}
            </ul>
          ) : (
            <EmptyState title="Você ainda não montou um treino" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Programas revisados</h2>
          {!hasPrograms ? (
            <NoPermission>Programas prontos fazem parte do Pro e do Black.</NoPermission>
          ) : catalog?.length ? (
            <ul className="space-y-2">
              {catalog.map((p) => (
                <PlanLink key={p.id} id={p.id} name={p.name} count={p.workouts.length} />
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum programa publicado ainda" />
          )}
        </Card>

        <LinkButton href="/treinos/biblioteca" variant="secondary" className="w-full">
          Biblioteca de exercícios
        </LinkButton>
      </div>
    </>
  );
}
