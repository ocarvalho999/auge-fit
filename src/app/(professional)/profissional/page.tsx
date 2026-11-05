import Link from "next/link";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pendências | Auge Fit" };

export default async function ProfessionalQueuePage() {
  await requireRole("professional");
  const supabase = await createClient();
  const { data: professionalId } = await supabase.rpc("current_professional_id");
  const { data: links } = await supabase
    .from("professional_students")
    .select("id, ends_at, profiles(full_name)")
    .eq("status", "active");
  const names = new Map((links ?? []).map((l) => [l.id, l.profiles?.full_name ?? "Aluno"]));
  const { data: checkins } = await supabase
    .from("checkins")
    .select("id, due_on, submitted_at, professional_student_id")
    .eq("status", "submitted")
    .order("submitted_at")
    .limit(100);
  const { data: waiting } = await supabase
    .from("checkins")
    .select("id")
    .eq("status", "pending");

  return (
    <>
      <PageHeader title="Pendências" description={`${links?.length ?? 0} aluno(s) com vínculo ativo · ${waiting?.length ?? 0} check-in(s) aguardando o aluno`} />
      {!professionalId ? (
        <div className="mb-4">
          <Alert tone="warning">Seu cadastro não está ativo ou o CREF ainda não foi verificado. Fale com a administração.</Alert>
        </div>
      ) : null}
      <Card>
        <h2 className="mb-3 font-bold">Check-ins para analisar</h2>
        {checkins?.length ? (
          <ul className="space-y-2">
            {checkins.map((c) => (
              <li key={c.id}>
                <Link href={`/profissional/checkins/${c.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-3">
                  <span className="font-semibold">{names.get(c.professional_student_id) ?? "Aluno"}</span>
                  <span className="text-sm text-muted">
                    Prazo {formatDate(c.due_on)} · enviado {formatDateTime(c.submitted_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhum check-in para analisar" />
        )}
      </Card>
    </>
  );
}
