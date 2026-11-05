import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { requestPasswordResetAction } from "@/features/auth/actions";

export const metadata = { title: "Recuperar senha | Auge Fit" };

export default function RecoverPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Recuperar senha</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Enviaremos um link para criar uma nova senha.</p>
      <ActionForm action={requestPasswordResetAction}>
        <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" required />
        <SubmitButton>Enviar link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm">
        <Link href="/login" className="inline-block py-2 font-semibold underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
