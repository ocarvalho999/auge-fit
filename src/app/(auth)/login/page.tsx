import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { signInAction } from "@/features/auth/actions";

export const metadata = { title: "Entrar | Auge Fit" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string; suspensa?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Entrar</h1>
      {params.link ? (
        <div className="mb-4">
          <Alert tone="warning">Esse link expirou ou já foi usado. Entre ou peça um novo link.</Alert>
        </div>
      ) : null}
      {params.suspensa ? (
        <div className="mb-4">
          <Alert tone="warning">Esta conta está suspensa. Fale com o suporte.</Alert>
        </div>
      ) : null}
      <ActionForm action={signInAction}>
        <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" required />
        <Field name="password" label="Senha" type="password" autoComplete="current-password" required />
        <SubmitButton>Entrar</SubmitButton>
      </ActionForm>
      <div className="mt-6 space-y-2 text-sm text-muted">
        <p>
          <Link href="/recuperar-senha" className="inline-block py-2 font-semibold text-text underline">
            Esqueci minha senha
          </Link>
        </p>
        <p>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-semibold text-text underline">
            Criar conta
          </Link>
        </p>
      </div>
    </>
  );
}
