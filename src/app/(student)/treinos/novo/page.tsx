import { LinkButton } from "@/components/ui/button";
import { NoPermission, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { hasEntitlement } from "@/features/billing/entitlements";
import { createOwnPlanAction } from "@/features/workouts/actions";

export const metadata = { title: "Novo treino | Auge Fit" };

export default async function NewWorkoutPage() {
  const profile = await requireRole("student");
  const canLog = await hasEntitlement(profile.id, "log_workouts");
  return (
    <>
      <PageHeader title="Montar treino" description="Você escolhe os exercícios. O app só organiza." />
      {canLog ? (
        <ActionForm action={createOwnPlanAction}>
          <Field name="name" label="Nome do treino" placeholder="Ex.: Minha rotina" required maxLength={120} />
          <SubmitButton>Criar e adicionar exercícios</SubmitButton>
        </ActionForm>
      ) : (
        <NoPermission>
          Montar treinos exige um plano ativo.
          <div className="mt-4 flex justify-center">
            <LinkButton href="/assinatura">Ver planos</LinkButton>
          </div>
        </NoPermission>
      )}
    </>
  );
}
