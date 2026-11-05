import Link from "next/link";
import { ActionForm, CheckboxField, Field, SubmitButton } from "@/components/ui/form";
import { signUpAction } from "@/features/auth/actions";

export const metadata = { title: "Criar conta | Auge Fit" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Para maiores de 18 anos.</p>
      <ActionForm action={signUpAction}>
        <Field name="fullName" label="Nome" autoComplete="name" required />
        <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" required />
        <Field name="password" label="Senha" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres." required />
        <Field name="birthDate" label="Data de nascimento" type="date" autoComplete="bday" required />
        <CheckboxField name="acceptTerms">
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="underline">
            termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="underline">
            política de privacidade
          </Link>
          .
        </CheckboxField>
        <SubmitButton>Criar conta</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-text underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
