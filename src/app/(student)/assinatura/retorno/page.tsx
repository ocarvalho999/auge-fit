import { LinkButton } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";

export const metadata = { title: "Aguardando confirmação | Auge Fit" };

/** O retorno do checkout nunca libera acesso: só o webhook autenticado confirma o pagamento. */
export default async function CheckoutReturnPage() {
  await requireRole("student");
  return (
    <>
      <PageHeader title="Aguardando confirmação" />
      <Alert>Assim que o Mercado Pago confirmar seu pagamento, seu acesso é liberado e você recebe um e-mail.</Alert>
      <LinkButton href="/assinatura" variant="secondary" className="mt-4 w-full">
        Ver minha assinatura
      </LinkButton>
    </>
  );
}
