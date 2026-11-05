import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Auditoria | Auge Fit" };

export default async function AdminAuditPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader title="Auditoria" description="Os 200 registros mais recentes. Somente inserção." />
      {logs?.length ? (
        <Card>
          <ul className="space-y-2 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="break-words">
                <strong>{l.action}</strong> em {l.entity} · {formatDateTime(l.created_at)}
                <span className="block text-xs break-all text-muted">
                  por {l.actor_id ?? "sistema"}
                  {l.entity_id ? ` · alvo ${l.entity_id}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Nenhum registro" />
      )}
    </>
  );
}
