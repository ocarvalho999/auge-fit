import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { createExerciseAction, setExercisePublishedAction } from "@/features/admin/actions";
import { requireRole } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Exercícios | Auge Fit" };

export default async function AdminExercisesPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: exercises } = await supabase.from("exercises").select("id, name, muscle_group, reviewed_by, published").order("name");

  return (
    <>
      <PageHeader title="Exercícios" description="Você cadastra o nome. O conteúdo técnico é escrito e assinado por um profissional." />
      <div className="space-y-4">
        <Card>
          <ActionForm action={createExerciseAction} resetOnSuccess>
            <Field name="name" label="Nome do exercício" maxLength={120} />
            <Field name="muscleGroup" label="Grupo muscular" maxLength={60} />
            <SubmitButton variant="secondary">Cadastrar</SubmitButton>
          </ActionForm>
        </Card>
        {exercises?.length ? (
          exercises.map((e) => (
            <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{e.name}</p>
                <p className="text-sm text-muted">
                  {e.muscle_group} · {e.published ? "Publicado" : e.reviewed_by ? "Revisado" : "Aguardando revisão"}
                </p>
              </div>
              {e.reviewed_by ? (
                <form action={setExercisePublishedAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="published" value={e.published ? "false" : "true"} />
                  <button type="submit" className={buttonClass(e.published ? "secondary" : "primary")}>
                    {e.published ? "Despublicar" : "Publicar"}
                  </button>
                </form>
              ) : null}
            </Card>
          ))
        ) : (
          <EmptyState title="Nenhum exercício cadastrado" />
        )}
      </div>
    </>
  );
}
