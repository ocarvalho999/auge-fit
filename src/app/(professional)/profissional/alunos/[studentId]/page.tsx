/* eslint-disable @next/next/no-img-element -- links assinados de 60 segundos não passam pelo otimizador de imagens */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { PHOTOS_BUCKET, SIGNED_URL_SECONDS } from "@/features/progress/photo-constants";
import { createPrescribedPlanAction, openCheckinAction } from "@/features/professionals/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { audit } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Aluno | Auge Fit" };

const GOALS: Record<string, string> = {
  hypertrophy: "Hipertrofia",
  definition: "Definição",
  conditioning: "Condicionamento",
  calisthenics: "Calistenia",
  organization: "Organizar treinos",
};

export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const me = await requireRole("professional");
  const { studentId } = await params;
  const supabase = await createClient();

  // Sem vínculo ativo, a RLS não devolve o perfil e a página nem existe para este profissional.
  const { data: profile } = await supabase.from("profiles").select("id, full_name").eq("id", studentId).maybeSingle();
  if (!profile) notFound();

  const [{ data: link }, { data: student }, { data: logs }, { data: measurements }, { data: plans }, { data: photos }] = await Promise.all([
    supabase.from("professional_students").select("id, photos_allowed, ends_at").eq("student_id", studentId).eq("status", "active").maybeSingle(),
    supabase.from("student_profiles").select("goal, experience_level").eq("profile_id", studentId).maybeSingle(),
    supabase.from("workout_logs").select("id, workout_name, started_at, set_logs(id, set_number, weight_kg, reps, exercises(name))").eq("student_id", studentId).order("started_at", { ascending: false }).limit(20),
    supabase.from("body_measurements").select("id, measured_on, weight_kg, waist_cm").eq("profile_id", studentId).order("measured_on", { ascending: false }).limit(10),
    supabase.from("workout_plans").select("id, name, status").eq("student_id", studentId).eq("kind", "prescribed").order("created_at", { ascending: false }),
    supabase.from("progress_photos").select("id, storage_path, taken_on, pose").eq("profile_id", studentId).order("taken_on", { ascending: false }).limit(12),
  ]);
  if (!link) notFound();

  const paths = (photos ?? []).map((p) => p.storage_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from(PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    : { data: [] };
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  // Todo acesso de profissional a fotos fica registrado.
  if (paths.length) {
    await audit({ actorId: me.id, action: "photos.view", entity: "progress_photos", entityId: studentId, metadata: { count: paths.length } });
  }

  return (
    <>
      <PageHeader
        title={profile.full_name || "Aluno"}
        description={`${student?.goal ? GOALS[student.goal] : "Objetivo não informado"} · Vínculo até ${formatDate(link.ends_at)}`}
      />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-bold">Planejamento individual</h2>
          {plans?.length ? (
            <ul className="mb-4 space-y-2">
              {plans.map((p) => (
                <li key={p.id}>
                  <Link href={`/profissional/planos/${p.id}`} className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-2">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-sm text-muted">{p.status === "published" ? "Publicado" : p.status === "draft" ? "Rascunho" : "Arquivado"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <ActionForm action={createPrescribedPlanAction} className="space-y-3">
            <input type="hidden" name="studentId" value={studentId} />
            <Field name="name" label="Novo planejamento" placeholder="Nome do planejamento" maxLength={120} />
            <SubmitButton variant="secondary">Criar planejamento</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Abrir check-in</h2>
          <ActionForm action={openCheckinAction} className="space-y-3">
            <input type="hidden" name="linkId" value={link.id} />
            <Field name="dueOn" label="Responder até" type="date" />
            <SubmitButton variant="secondary">Abrir check-in</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Sessões recentes</h2>
          {logs?.length ? (
            <ul className="space-y-2">
              {logs.map((l) => (
                <li key={l.id}>
                  <details className="rounded-xl bg-surface-2 px-3 py-2">
                    <summary className="min-h-7 cursor-pointer font-medium">
                      {l.workout_name ?? "Treino"} · {formatDateTime(l.started_at)}
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {l.set_logs.map((s) => (
                        <li key={s.id}>
                          {s.exercises?.name}: série {s.set_number}, {s.weight_kg} kg × {s.reps}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma sessão registrada" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Medidas</h2>
          {measurements?.length ? (
            <ul className="space-y-1 text-sm">
              {measurements.map((m) => (
                <li key={m.id}>
                  {formatDate(m.measured_on)}: {m.weight_kg ? `${m.weight_kg} kg` : ""} {m.waist_cm ? `· cintura ${m.waist_cm} cm` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma medida registrada" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Fotos</h2>
          {!link.photos_allowed ? (
            <p className="text-sm text-muted">O aluno não autorizou o acesso às fotos.</p>
          ) : photos?.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <li key={p.id}>
                  {urlOf.get(p.storage_path) ? (
                    <img src={urlOf.get(p.storage_path) ?? ""} alt={`Foto de ${formatDate(p.taken_on)}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                  ) : null}
                  <p className="mt-1 text-sm text-muted">{formatDate(p.taken_on)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma foto enviada" />
          )}
        </Card>
      </div>
    </>
  );
}
