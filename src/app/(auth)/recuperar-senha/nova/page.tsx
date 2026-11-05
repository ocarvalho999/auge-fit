import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { updatePasswordAction } from "@/features/auth/actions";

export const metadata = { title: "Nova senha | Auge Fit" };

export default function NewPasswordPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Criar nova senha</h1>
      <ActionForm action={updatePasswordAction}>
        <Field name="password" label="Nova senha" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres." required />
        <Field name="confirm" label="Repita a senha" type="password" autoComplete="new-password" required />
        <SubmitButton>Salvar senha</SubmitButton>
      </ActionForm>
    </>
  );
}
