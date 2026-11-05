import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Confirme seu e-mail | Auge Fit" };

export default function ConfirmEmailPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Confirme seu e-mail</h1>
      <p className="mt-2 mb-6 text-muted">
        Se o cadastro puder ser concluído com esse e-mail, enviamos um link de confirmação. Abra o link para entrar no
        Auge Fit. Confira também a caixa de spam.
      </p>
      <LinkButton href="/login" variant="secondary" className="w-full">
        Ir para o login
      </LinkButton>
    </>
  );
}
