import { LinkButton } from "@/components/ui/button";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";
import { getCurrentSubscription, hasEntitlement } from "@/features/billing/entitlements";
import { consistency, daysAgoIso } from "@/features/progress/metrics";
import { getNextWorkout } from "@/features/workouts/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Início | Auge Fit" };

export default async function StudentHomePage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const [{ next, planName, lastLog }, canLog, subscription, recent, nextCheckin] = await Promise.all([
    getNextWorkout(profile.id),
    hasEntitlement(profile.id, "log_workouts"),
    getCurrentSubscription(profile.id),
    supabase
      .from("workout_logs")
      .select("started_at")
      .eq("student_id", profile.id)
      .gte("started_at", daysAgoIso(28)),
    supabase.from("checkins").select("id, due_on").eq("status", "pending").order("due_on").limit(1).maybeSingle(),
  ]);
  const days = consistency((recent.data ?? []).map((r) => r.started_at));
  const firstName = profile.full_name.split(" ")[0];

  return (
    <>
      <PageHeader title={firstName ? `Olá, ${firstName}` : "Olá"} />
      <div className="space-y-4">
        {!subscription ? (
          <Alert tone="warning">Você ainda não tem um plano ativo. Escolha um em Assinatura para registrar treinos.</Alert>
        ) : !canLog ? (
          <Alert tone="danger">Sua assinatura venceu. Seus dados seguem disponíveis, mas novos treinos dependem da renovação.</Alert>
        ) : subscription.status === "past_due" ? (
          <Alert tone="warning">
            Não conseguimos processar sua última cobrança. Seu acesso segue até {formatDate(subscription.grace_until)}.
          </Alert>
        ) : null}

        <Card>
          <p className="text-sm text-muted">Treino do dia</p>
          {next ? (
            <>
              <h2 className="mt-1 text-xl font-bold">{next.name}</h2>
              {planName ? <p className="text-sm text-muted">{planName}</p> : null}
              {canLog ? (
                <LinkButton href={`/treinos/executar/${next.id}`} className="mt-4 min-h-14 w-full text-lg">
                  Iniciar treino
                </LinkButton>
              ) : (
                <LinkButton href="/assinatura" className="mt-4 w-full">
                  Ver assinatura
                </LinkButton>
              )}
            </>
          ) : (
            <div className="mt-3">
              <EmptyState
                title="Nenhum treino montado ainda"
                action={<LinkButton href={canLog ? "/treinos/novo" : "/assinatura"}>{canLog ? "Montar treino" : "Escolher plano"}</LinkButton>}
              />
            </div>
          )}
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-muted">Última sessão</p>
            {lastLog ? (
              <>
                <p className="mt-1 font-semibold">{lastLog.workout_name ?? "Treino"}</p>
                <p className="text-sm text-muted">
                  {formatDateTime(lastLog.started_at)} · {lastLog.set_logs.length} série(s)
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">Nenhuma sessão registrada.</p>
            )}
          </Card>
          <Card>
            <p className="text-sm text-muted">Constância em 28 dias</p>
            <p className="mt-1 text-2xl font-bold text-accent">
              {days} <span className="text-sm font-normal text-muted">dia(s) com treino</span>
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Próximo check-in</p>
            {nextCheckin.data ? (
              <LinkButton href="/checkins" variant="secondary" className="mt-2 w-full">
                Responder até {formatDate(nextCheckin.data.due_on)}
              </LinkButton>
            ) : (
              <p className="mt-1 text-sm text-muted">Nenhum pendente.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
