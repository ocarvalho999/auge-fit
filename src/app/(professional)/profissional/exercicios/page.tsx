import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, SubmitButton, TextAreaField } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { proposeExerciseReviewAction } from "@/features/professionals/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Exercícios | Auge Fit" };

export default async function ExerciseReviewPage() {
  await requireRole("professional");
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, instructions, reviewed_by, published")
    .order("published")
    .order("name");

  return (
    <>
      <PageHeader title="Revisão de exercícios" description="Sua revisão assina o conteúdo técnico. A publicação fica com a administração." />
      {exercises?.length ? (
        <div className="space-y-4">
          {exercises.map((e) => (
            <Card key={e.id}>
              <h2 className="font-bold">{e.name}</h2>
              <p className="mb-3 text-sm text-muted">
                {e.muscle_group} · {e.published ? "Publicado" : e.reviewed_by ? "Revisado, aguardando publicação" : "Aguardando revisão"}
              </p>
              <ActionForm action={proposeExerciseReviewAction}>
                <input type="hidden" name="exerciseId" value={e.id} />
                <TextAreaField name="instructions" label={`Instruções de ${e.name}`} defaultValue={e.instructions ?? ""} maxLength={5000} />
                <SubmitButton variant="secondary">Registrar revisão</SubmitButton>
              </ActionForm>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum exercício cadastrado">A administração cadastra os exercícios para sua revisão.</EmptyState>
      )}
    </>
  );
}
