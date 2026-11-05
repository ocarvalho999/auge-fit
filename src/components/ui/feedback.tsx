import type { ReactNode } from "react";

const TONES = {
  danger: "border-danger/60 text-danger",
  warning: "border-warning/60 text-warning",
  success: "border-accent/60 text-accent",
  info: "border-line text-text",
} as const;

export function Alert({ tone = "info", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-xl border bg-surface px-3 py-2.5 text-sm ${TONES[tone]}`}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-surface p-4 sm:p-5 ${className}`}>{children}</section>;
}

/** Estado vazio nunca mostra números de exemplo. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 py-4">
      <span className="sr-only">{label}</span>
      <div className="h-6 w-1/2 animate-pulse rounded-lg bg-surface" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}

export function ErrorState({ message = "Não foi possível carregar agora.", retry }: { message?: string; retry?: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/60 px-4 py-8 text-center">
      <p className="font-semibold text-danger">{message}</p>
      {retry ? <div className="mt-4 flex justify-center">{retry}</div> : null}
    </div>
  );
}

export function NoPermission({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-8 text-center">
      <p className="font-semibold">Seu plano não inclui este recurso</p>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
    </div>
  );
}
