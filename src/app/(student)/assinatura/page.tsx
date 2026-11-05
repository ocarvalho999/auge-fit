import { Alert, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";

export const metadata = { title: "Assinatura | Auge Fit" };

export default async function SubscriptionPage() {
  await requireRole("student");
  return (
    <>
      <PageHeader title="Assinatura" />
      <Alert tone="warning">A contratação de planos ainda não está disponível.</Alert>
    </>
  );
}
