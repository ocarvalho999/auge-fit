import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/feedback";
import { ActionForm, SubmitButton, TextAreaField } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { publishFeedbackAction } from "@/features/professionals/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Check-in | Auge Fit" };

const ADHERENCE: Record<string, string> = { all: "Fez todos", most: "Fez a maioria", some: "Fez alguns", none: "Não treinou" };

type Answers = { adherence?: string; energy?: number; sleep?: number; notes?: string };

export default async function ProfessionalCheckinPage({ params }: { params: Promise<{ checkinId: string }> }) {
  await requireRole("professional");
  const { checkinId } = await params;
  const supabase = await createClient();
  const { data: checkin } = await supabase
    .from("checkins")
    .select("id, due_on, submitted_at, answers, status, feedbacks(id, body, published_at), professional_students(profiles(full_name))")
    .eq("id", checkinId)
    .maybeSingle();
  if (!checkin) notFound();
  const a = (checkin.answers ?? {}) as Answers;

  return (
    <>
      <PageHeader title={checkin.professional_students?.profiles?.full_name || "Check-in"} description={`Prazo ${formatDate(checkin.due_on)} · enviado ${formatDateTime(checkin.submitted_at)}`} />
      <div className="space-y-4">
        <Card>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Treinos da semana</dt>
              <dd className="font-semibold">{a.adherence ? ADHERENCE[a.adherence] : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Energia</dt>
              <dd className="font-semibold">{a.energy ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Sono</dt>
              <dd className="font-semibold">{a.sleep ?? "—"}</dd>
            </div>
          </dl>
          {a.notes ? <p className="mt-3 text-sm whitespace-pre-line">{a.notes}</p> : null}
        </Card>
        {checkin.feedbacks.map((f) => (
          <Card key={f.id}>
            <h2 className="mb-1 font-bold">Feedback publicado</h2>
            <p className="text-sm whitespace-pre-line">{f.body}</p>
          </Card>
        ))}
        {checkin.status === "submitted" ? (
          <Card>
            <ActionForm action={publishFeedbackAction}>
              <input type="hidden" name="checkinId" value={checkin.id} />
              <TextAreaField name="body" label="Feedback para o aluno" rows={6} maxLength={5000} />
              <SubmitButton>Publicar feedback</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
