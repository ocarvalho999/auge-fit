import { notFound } from "next/navigation";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SelectField, SubmitButton } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { hasEntitlement } from "@/features/billing/entitlements";
import {
  addExerciseAction,
  addWorkoutAction,
  deleteOwnPlanAction,
  removeExerciseAction,
} from "@/features/workouts/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Treino | Auge Fit" };

export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const profile = await requireRole("student");
  const { planId } = await params;
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select(
      "id, name, kind, author_professional_id, workouts(id, name, position, workout_exercises(id, position, sets, reps_target, rest_seconds, notes, exercises(id, name)))",
    )
    .eq("id", planId)
    .maybeSingle();
  if (!plan) notFound();

  const editable = plan.kind === "own";
  const canLog = await hasEntitlement(profile.id, "log_workouts");
  const { data: exercises } = editable
    ? await supabase.from("exercises").select("id, name, muscle_group").eq("published", true).order("name")
    : { data: [] };
  const { data: authorRows } = plan.author_professional_id
    ? await supabase.rpc("professional_public", { p_professional_id: plan.author_professional_id })
    : { data: [] };
  const author = authorRows?.[0];
  const options = [
    { value: "", label: "Escolha" },
    ...(exercises ?? []).map((e) => ({ value: e.id, label: `${e.name} (${e.muscle_group})` })),
  ];
  const workouts = [...plan.workouts].sort((a, b) => a.position - b.position);

  return (
    <>
      <PageHeader
        title={plan.name}
        description={author ? `Por ${author.full_name} · CREF ${author.cref_number}/${author.cref_uf}` : undefined}
      />
      <div className="space-y-4">
        {workouts.map((w) => {
          const items = [...w.workout_exercises].sort((a, b) => a.position - b.position);
          return (
            <Card key={w.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{w.name}</h2>
                {canLog && items.length ? <LinkButton href={`/treinos/executar/${w.id}`}>Iniciar treino</LinkButton> : null}
              </div>
              {items.length ? (
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium break-words">{i.exercises?.name}</p>
                        <p className="text-sm text-muted">
                          {i.sets} série(s){i.reps_target ? ` · ${i.reps_target} reps` : ""}
                          {i.rest_seconds ? ` · ${i.rest_seconds}s` : ""}
                        </p>
                        {i.notes ? <p className="mt-1 text-sm">{i.notes}</p> : null}
                      </div>
                      {editable ? (
                        <form action={removeExerciseAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <button type="submit" className={buttonClass("ghost", "text-sm")} aria-label={`Remover ${i.exercises?.name}`}>
                            Remover
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Sem exercícios ainda" />
              )}
              {editable ? (
                exercises?.length ? (
                  <details className="mt-4" open={items.length === 0}>
                    <summary className="min-h-11 cursor-pointer py-2 font-semibold">Adicionar exercício</summary>
                    <ActionForm action={addExerciseAction} resetOnSuccess className="mt-2 space-y-3">
                      <input type="hidden" name="workoutId" value={w.id} />
                      <SelectField name="exerciseId" label="Exercício" options={options} />
                      <div className="grid grid-cols-2 gap-3">
                        <Field name="sets" label="Séries" type="number" inputMode="numeric" min={1} max={20} defaultValue={3} />
                        <Field name="repsTarget" label="Repetições" placeholder="Ex.: 10" maxLength={20} />
                      </div>
                      <SubmitButton variant="secondary">Adicionar</SubmitButton>
                    </ActionForm>
                  </details>
                ) : (
                  <p className="mt-3 text-sm text-muted">A biblioteca ainda não tem exercícios revisados para adicionar.</p>
                )
              ) : null}
            </Card>
          );
        })}

        {editable ? (
          <>
            <Card>
              <h2 className="mb-3 font-bold">Adicionar dia de treino</h2>
              <ActionForm action={addWorkoutAction} resetOnSuccess>
                <input type="hidden" name="planId" value={plan.id} />
                <Field name="name" label="Nome" placeholder="Ex.: Treino B" maxLength={120} />
                <SubmitButton variant="secondary">Adicionar dia</SubmitButton>
              </ActionForm>
            </Card>
            <form action={deleteOwnPlanAction}>
              <input type="hidden" name="id" value={plan.id} />
              <button type="submit" className={buttonClass("danger", "w-full")}>
                Excluir este treino
              </button>
            </form>
          </>
        ) : null}
      </div>
    </>
  );
}
