import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, NoPermission, PageHeader } from "@/components/ui/feedback";
import { WorkoutLogger } from "@/components/workouts/workout-logger";
import { requireRole } from "@/features/auth/session";
import { hasEntitlement } from "@/features/billing/entitlements";
import { getWorkoutForExecution } from "@/features/workouts/queries";

export const metadata = { title: "Treino em andamento | Auge Fit" };

export default async function ExecuteWorkoutPage({ params }: { params: Promise<{ workoutId: string }> }) {
  const profile = await requireRole("student");
  const { workoutId } = await params;
  const workout = await getWorkoutForExecution(workoutId);
  if (!workout) notFound();
  const canLog = await hasEntitlement(profile.id, "log_workouts");

  return (
    <>
      <PageHeader title={workout.name} />
      {!canLog ? (
        <NoPermission>
          Novos registros dependem de uma assinatura ativa. Seu histórico segue disponível.
          <div className="mt-4 flex justify-center">
            <LinkButton href="/assinatura">Ver assinatura</LinkButton>
          </div>
        </NoPermission>
      ) : workout.exercises.length ? (
        <WorkoutLogger workoutId={workout.id} workoutName={workout.name} exercises={workout.exercises} />
      ) : (
        <EmptyState title="Este treino ainda não tem exercícios" action={<LinkButton href={`/treinos/${workout.planId}`}>Adicionar exercícios</LinkButton>} />
      )}
    </>
  );
}
