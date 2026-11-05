import type { ReactNode } from "react";
import { Alert } from "@/components/ui/feedback";
import { Logo } from "@/components/ui/logo";
import { DOCUMENT_VERSION } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4">
      <Logo />
      <main className="mt-6 pb-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 mb-4 text-sm text-muted">Versão {DOCUMENT_VERSION}</p>
        <Alert tone="warning">
          <strong>Rascunho pendente de revisão jurídica.</strong> Este texto mostra a estrutura do documento e ainda não
          foi aprovado por advogado.
        </Alert>
        <div className="mt-6 space-y-5 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted [&_ul]:space-y-1 [&_ul]:text-muted">
          {children}
        </div>
      </main>
    </div>
  );
}
