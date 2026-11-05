import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Alunos | Auge Fit" };

export default async function StudentsPage() {
  await requireRole("professional");
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("professional_students")
    .select("id, student_id, starts_at, ends_at, profiles(full_name)")
    .eq("status", "active")
    .order("starts_at", { ascending: false });

  return (
    <>
      <PageHeader title="Alunos" description="Só aparecem alunos com vínculo ativo." />
      <Card>
        {links?.length ? (
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.id}>
                <Link href={`/profissional/alunos/${l.student_id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-3">
                  <span className="font-semibold">{l.profiles?.full_name || "Aluno"}</span>
                  <span className="text-sm text-muted">Até {formatDate(l.ends_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhum aluno vinculado">A administração faz os vínculos depois da compra do Black.</EmptyState>
        )}
      </Card>
    </>
  );
}
