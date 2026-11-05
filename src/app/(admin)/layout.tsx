import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/features/auth/session";

const NAV = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/profissionais", label: "Profis." },
  { href: "/admin/vinculos", label: "Vínculos" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/cupons", label: "Cupons" },
  { href: "/admin/pagamentos", label: "Pagam." },
  { href: "/admin/exercicios", label: "Exerc." },
  { href: "/admin/auditoria", label: "Auditoria" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole("admin");
  return (
    <AppShell homeHref="/admin" items={NAV}>
      {children}
    </AppShell>
  );
}
