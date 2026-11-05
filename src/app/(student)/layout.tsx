import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { QueueFlusher } from "@/components/workouts/queue-flusher";
import { requireRole } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/inicio", label: "Início" },
  { href: "/treinos", label: "Treinos" },
  { href: "/evolucao", label: "Evolução" },
  { href: "/checkins", label: "Check-ins" },
  { href: "/assinatura", label: "Assinatura" },
  { href: "/configuracoes", label: "Ajustes" },
];

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const { data } = await supabase.from("student_profiles").select("onboarded_at").eq("profile_id", profile.id).maybeSingle();
  if (!data?.onboarded_at) redirect("/onboarding");
  return (
    <AppShell homeHref="/inicio" items={NAV}>
      <QueueFlusher />
      {children}
    </AppShell>
  );
}
