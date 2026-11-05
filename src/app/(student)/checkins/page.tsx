import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SelectField, SubmitButton, TextAreaField } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { hasEntitlement } from "@/features/billing/entitlements";
import { submitCheckinAction } from "@/features/checkins/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Check-ins | Auge Fit" };

const ADHERENCE = [
  { value: "", label: "Escolha" },
  { value: "all", label: "Fiz todos" },
  { value: "most", label: "Fiz a maioria" },
  { value: "some", label: "Fiz alguns" },
  { value: "none", label: "Não treinei" },
];

export default async function CheckinsPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const isBlack = await hasEntitlement(profile.id, "checkins");
  const { data: checkins } = await supabase
    .from("checkins")
    .select("id, due_on, status, submitted_at, feedbacks(id, body, published_at)")
    .order("due_on", { ascending: false })
    .limit(50);
  const pending = (checkins ?? []).filter((c) => c.status === "pending");
  const past = (checkins ?? []).filter((c) => c.status !== "pending");

  if (!isBlack && !checkins?.length) {
    return (
      <>
        <PageHeader title="Check-ins" />
        <Card className="text-center">
          <h2 className="text-lg font-bold">Acompanhamento semanal com profissional</h2>
          <p className="mt-2 text-sm text-muted">
            No Black, você responde um check-in por semana e recebe feedback de um profissional habilitado.
          </p>
          <LinkButton href="/assinatura" className="mt-4">
            Conhecer o Black
          </LinkButton>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Check-ins" />
      <div className="space-y-4">
        {pending.map((c) => (
          <Card key={c.id} className="ring-1 ring-accent">
            <h2 className="mb-3 font-bold">Check-in até {formatDate(c.due_on)}</h2>
            <ActionForm action={submitCheckinAction}>
              <input type="hidden" name="checkinId" value={c.id} />
              <SelectField name="adherence" label="Como foram os treinos da semana?" options={ADHERENCE} />
              <div className="grid grid-cols-2 gap-3">
                <Field name="energy" label="Energia (1 a 5)" type="number" inputMode="numeric" min={1} max={5} />
                <Field name="sleep" label="Sono (1 a 5)" type="number" inputMode="numeric" min={1} max={5} />
              </div>
              <TextAreaField name="notes" label="Algo que seu profissional precisa saber?" maxLength={2000} />
              <SubmitButton>Enviar check-in</SubmitButton>
            </ActionForm>
          </Card>
        ))}
        {!pending.length && !past.length ? (
          <EmptyState title="Nenhum check-in ainda">Seu profissional abre os check-ins depois do vínculo.</EmptyState>
        ) : null}
        {past.map((c) => (
          <Card key={c.id}>
            <h2 className="font-bold">Check-in de {formatDate(c.due_on)}</h2>
            <p className="text-sm text-muted">Enviado em {formatDateTime(c.submitted_at)}</p>
            {c.feedbacks.length ? (
              c.feedbacks.map((f) => (
                <div key={f.id} className="mt-3 rounded-xl bg-surface-2 p-3" data-testid="feedback">
                  <p className="text-sm font-semibold text-accent">Feedback do profissional</p>
                  <p className="mt-1 text-sm whitespace-pre-line">{f.body}</p>
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm text-muted">Aguardando feedback.</p>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
