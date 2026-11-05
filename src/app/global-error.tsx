"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ background: "#090B0B", color: "#F4F6F6", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <h1>Algo deu errado</h1>
        <p>Não foi possível carregar agora.</p>
        <button type="button" onClick={reset} style={{ background: "#B6FF32", color: "#090B0B", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 600 }}>
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
