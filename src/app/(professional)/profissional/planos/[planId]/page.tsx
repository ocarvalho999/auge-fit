import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SelectField, SubmitButton, TextAreaField } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import {
  addProExerciseAction,
  addProWorkoutAction,
  removeProExerciseAction,
  setPlanStatusAction,
} from "@/features/professionals/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Planejamento | Auge Fit" };

const STATUS: Record<string, string> = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };

export default async function ProfessionalPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  await requireRole("professional");
  const { planId } = await params;
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, name, kind, status, workouts(id, name, position, workout_exercises(id, position, sets, reps_target, rest_seconds, notes, exercises(name)))")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) notFound();

  const { data: exercises } = await supabase.from("exercises").select("id, name, muscle_group").eq("published", true).order("name");
  const options = [
    { value: "", label: "Escolha" },
    ...(exercises ?? []).map((e) => ({ value: e.id, label: `${e.name} (${e.muscle_group})` })),
  ];
  const workouts = [...plan.workouts].sort((a, b) => a.position - b.position);

  return (
    <>
      <PageHeader
        title={plan.name}
        description={`${plan.kind === "catalog" ? "Programa do catálogo" : "Planejamento individual"} · ${STATUS[plan.status]}`}
        action={
          <form action={setPlanStatusAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="status" value={plan.status === "published" ? "draft" : "published"} />
            <button type="submit" className={buttonClass(plan.status === "published" ? "secondary" : "primary")}>
              {plan.status === "published" ? "Voltar para rascunho" : "Publicar"}
            </button>
          </form>
        }
      />
      <div className="space-y-4">
        {workouts.map((w) => (
          <Card key={w.id}>
            <h2 className="mb-3 text-lg font-bold">{w.name}</h2>
            {w.workout_exercises.length ? (
              <ul className="space-y-2">
                {[...w.workout_exercises]
                  .sort((a, b) => a.position - b.position)
                  .map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium break-words">{i.exercises?.name}</p>
                        <p className="text-sm text-muted">
                          {i.sets} série(s){i.reps_target ? ` · ${i.reps_target} reps` : ""}
                          {i.rest_seconds ? ` · ${i.rest_seconds}s` : ""}
                        </p>
                        {i.notes ? <p className="mt-1 text-sm">{i.notes}</p> : null}
                      </div>
                      <form action={removeProExerciseAction}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="planId" value={plan.id} />
                        <button type="submit" className={buttonClass("ghost", "text-sm")}>
                          Remover
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
            ) : (
              <EmptyState title="Sem exercícios ainda" />
            )}
            <details className="mt-4" open={w.workout_exercises.length === 0}>
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">Adicionar exercício</summary>
              <ActionForm action={addProExerciseAction} resetOnSuccess className="mt-2 space-y-3">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="workoutId" value={w.id} />
                <SelectField name="exerciseId" label="Exercício" options={options} />
                <div className="grid grid-cols-3 gap-2">
                  <Field name="sets" label="Séries" type="number" inputMode="numeric" min={1} max={20} defaultValue={3} />
                  <Field name="repsTarget" label="Reps" maxLength={20} />
                  <Field name="restSeconds" label="Descanso (s)" type="number" inputMode="numeric" min={0} max={900} />
                </div>
                <TextAreaField name="notes" label="Observações" rows={2} maxLength={500} />
                <SubmitButton variant="secondary">Adicionar</SubmitButton>
              </ActionForm>
            </details>
          </Card>
        ))}
        <Card>
          <h2 className="mb-3 font-bold">Adicionar dia de treino</h2>
          <ActionForm action={addProWorkoutAction} resetOnSuccess>
            <input type="hidden" name="planId" value={plan.id} />
            <Field name="name" label="Nome" placeholder="Ex.: Treino A" maxLength={120} />
            <SubmitButton variant="secondary">Adicionar dia</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
