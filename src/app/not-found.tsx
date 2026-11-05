import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 mb-6 text-muted">O endereço pode estar errado ou a página não existe mais.</p>
      <LinkButton href="/">Voltar ao início</LinkButton>
    </main>
  );
}
