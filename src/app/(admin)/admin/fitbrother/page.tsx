import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";
import { markGrantedAction, markRevokedAction } from "@/features/fitbrother/actions";
import { classifyAccess, type AccessRow } from "@/features/fitbrother/queue";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "FitBrother | Auge Fit" };

const formatPhone = (n: string | null) => (n ? `+${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4)}` : "Sem número");

export default async function AdminFitBrotherPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: rows }, { data: subs }] = await Promise.all([
    supabase.from("nutrition_access").select("id, profile_id, whatsapp, granted_at, revoked_at"),
    supabase.from("subscriptions").select("profile_id").in("status", ["active", "past_due", "cancelled"]),
  ]);

  const candidates = [...new Set((subs ?? []).flatMap((s) => (s.profile_id ? [s.profile_id] : [])))];
  const checks = await Promise.all(
    candidates.map(async (id) => {
      const { data } = await supabase.rpc("has_entitlement", { p_user_id: id, p_feature: "nutrition_app" });
      return data === true ? id : null;
    }),
  );
  const entitled = new Set(checks.filter((id): id is string => id !== null));
  const access: AccessRow[] = rows ?? [];
  const queue = classifyAccess(access, entitled);

  const ids = [...new Set([...access.flatMap((r) => (r.profile_id ? [r.profile_id] : [])), ...queue.awaitingNumber])];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nameOf = (id: string | null) => {
    if (!id) return "Conta excluída";
    return profiles?.find((p) => p.id === id)?.full_name || "Sem nome";
  };

  return (
    <>
      <PageHeader title="Acesso ao FitBrother" description="Liberação manual pelo WhatsApp. Marque aqui depois de fazer no app." />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-bold">Para liberar ({queue.toGrant.length})</h2>
          {queue.toGrant.length ? (
            <ul className="space-y-2">
              {queue.toGrant.map((r) => (
                <li key={r.id} className="rounded-xl bg-surface-2 p-3">
                  <p className="font-semibold">{nameOf(r.profile_id)}</p>
                  <p className="mb-2 text-sm text-muted">{formatPhone(r.whatsapp)}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`https://wa.me/${r.whatsapp}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                      Abrir WhatsApp
                    </a>
                    <form action={markGrantedAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={buttonClass("primary")}>
                        Marcar como liberado
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Ninguém para liberar" />
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">Para remover ({queue.toRevoke.length})</h2>
          <p className="mb-3 text-sm text-muted">Perderam o direito ao app. Remova o acesso no FitBrother e marque aqui.</p>
          {queue.toRevoke.length ? (
            <ul className="space-y-2">
              {queue.toRevoke.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{nameOf(r.profile_id)}</p>
                    <p className="text-sm text-muted">{formatPhone(r.whatsapp)}</p>
                  </div>
                  <form action={markRevokedAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={buttonClass("danger")}>
                      Marcar como removido
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Ninguém para remover" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Sem número informado ({queue.awaitingNumber.length})</h2>
          {queue.awaitingNumber.length ? (
            <ul className="space-y-1 text-sm">
              {queue.awaitingNumber.map((id) => (
                <li key={id}>{nameOf(id)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Todos os assinantes informaram o número.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Com acesso ({queue.active.length})</h2>
          {queue.active.length ? (
            <ul className="space-y-1 text-sm">
              {queue.active.map((r) => (
                <li key={r.id}>
                  {nameOf(r.profile_id)} · desde {formatDate(r.granted_at)}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Ninguém com acesso" />
          )}
        </Card>
      </div>
    </>
  );
}
