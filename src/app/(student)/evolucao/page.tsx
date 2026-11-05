import { ProgressLineChart } from "@/components/progress/line-chart";
import { ConsentToggle } from "@/components/layout/consent-toggle";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { addMeasurementAction, deleteMeasurementAction } from "@/features/progress/actions";
import { loadSeries, volumeSeries } from "@/features/progress/metrics";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Evolução | Auge Fit" };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ exercicio?: string }> }) {
  const profile = await requireRole("student");
  const { exercicio } = await searchParams;
  const supabase = await createClient();
  const [{ data: logs }, { data: measurements }, { data: consent }] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("id, workout_name, started_at, finished_at, set_logs(id, exercise_id, workout_log_id, set_number, weight_kg, reps, logged_at, exercises(name))")
      .eq("student_id", profile.id)
      .order("started_at", { ascending: false })
      .limit(200),
    supabase.from("body_measurements").select("*").eq("profile_id", profile.id).order("measured_on", { ascending: false }).limit(100),
    supabase.from("consents").select("id").eq("profile_id", profile.id).eq("type", "health_data").is("revoked_at", null),
  ]);

  const sets = (logs ?? []).flatMap((l) => l.set_logs);
  const names = new Map(sets.map((s) => [s.exercise_id, s.exercises?.name ?? "Exercício"]));
  const selected = exercicio && names.has(exercicio) ? exercicio : [...names.keys()][0];
  const load = selected ? loadSeries(sets, selected) : [];
  const volume = volumeSeries(sets);
  const weight = [...(measurements ?? [])]
    .filter((m) => m.weight_kg !== null)
    .reverse()
    .map((m) => ({ date: m.measured_on, value: Number(m.weight_kg) }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Evolução" action={<LinkButton href="/evolucao/fotos" variant="secondary">Ver fotos</LinkButton>} />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-2 font-bold">Carga por exercício</h2>
          {selected ? (
            <>
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {[...names.entries()].map(([id, name]) => (
                  <a
                    key={id}
                    href={`/evolucao?exercicio=${id}`}
                    aria-current={id === selected ? "true" : undefined}
                    className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${id === selected ? "bg-accent text-on-accent" : "bg-surface-2"}`}
                  >
                    {name}
                  </a>
                ))}
              </div>
              <ProgressLineChart data={load} unit="kg" label="Carga" />
            </>
          ) : (
            <EmptyState title="Registre um treino para ver sua carga" />
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">Volume por dia</h2>
          {volume.length ? <ProgressLineChart data={volume} unit="kg" label="Volume" /> : <EmptyState title="Sem volume registrado" />}
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">Peso</h2>
          {weight.length ? <ProgressLineChart data={weight} unit="kg" label="Peso" /> : <EmptyState title="Registre seu peso nas medidas" />}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Medidas</h2>
          {consent?.length ? (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">Registrar medidas</summary>
              <ActionForm action={addMeasurementAction} resetOnSuccess className="mt-2 space-y-3">
                <Field name="measuredOn" label="Data" type="date" defaultValue={today} />
                <div className="grid grid-cols-2 gap-3">
                  <Field name="weightKg" label="Peso (kg)" inputMode="decimal" />
                  <Field name="waistCm" label="Cintura (cm)" inputMode="decimal" />
                  <Field name="chestCm" label="Peito (cm)" inputMode="decimal" />
                  <Field name="hipCm" label="Quadril (cm)" inputMode="decimal" />
                  <Field name="armCm" label="Braço (cm)" inputMode="decimal" />
                  <Field name="thighCm" label="Coxa (cm)" inputMode="decimal" />
                </div>
                <SubmitButton variant="secondary">Salvar medidas</SubmitButton>
              </ActionForm>
            </details>
          ) : (
            <ConsentToggle type="health_data" granted={false} label="Autorizo o tratamento das minhas medidas e check-ins para acompanhar meu progresso." />
          )}
          {measurements?.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {measurements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                  <span className="min-w-0">
                    <strong>{formatDate(m.measured_on)}</strong>{" "}
                    {[
                      m.weight_kg && `${m.weight_kg} kg`,
                      m.waist_cm && `cintura ${m.waist_cm}`,
                      m.chest_cm && `peito ${m.chest_cm}`,
                      m.hip_cm && `quadril ${m.hip_cm}`,
                      m.arm_cm && `braço ${m.arm_cm}`,
                      m.thigh_cm && `coxa ${m.thigh_cm}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <form action={deleteMeasurementAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className={buttonClass("ghost", "text-sm")}>
                      Apagar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Histórico</h2>
          {logs?.length ? (
            <ul className="space-y-2">
              {logs.map((l) => (
                <li key={l.id}>
                  <details className="rounded-xl bg-surface-2 px-3 py-2">
                    <summary className="min-h-7 cursor-pointer font-medium">
                      {l.workout_name ?? "Treino"} · {formatDateTime(l.started_at)}
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {[...l.set_logs]
                        .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
                        .map((s) => (
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
      </div>
    </>
  );
}
