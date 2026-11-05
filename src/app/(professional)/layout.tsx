import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/features/auth/session";

const NAV = [
  { href: "/profissional", label: "Pendências" },
  { href: "/profissional/alunos", label: "Alunos" },
  { href: "/profissional/programas", label: "Programas" },
  { href: "/profissional/exercicios", label: "Exercícios" },
];

export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  await requireRole("professional");
  return (
    <AppShell homeHref="/profissional" items={NAV} context="Profissional">
      {children}
    </AppShell>
  );
}
