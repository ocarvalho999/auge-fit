import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { setUserStatusAction } from "@/features/admin/actions";
import { requireRole } from "@/features/auth/session";
import { formatDate } from "@/lib/format";
import { audit, createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Usuários | Auge Fit" };

const ROLE: Record<string, string> = { student: "Aluno", professional: "Profissional", admin: "Admin" };

export default async function AdminUsersPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  // E-mail fica no Auth e exige a chave de serviço; o uso é auditado.
  const { data: list } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 200 });
  await audit({ actorId: me.id, action: "users.list", entity: "auth.users" });
  const emails = new Map((list?.users ?? []).map((u) => [u.id, u.email]));

  return (
    <>
      <PageHeader title="Usuários" description="Os 100 cadastros mais recentes." />
      {profiles?.length ? (
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{p.full_name || "Sem nome"}</p>
                  <p className="text-sm break-all text-muted">{emails.get(p.id) ?? "—"}</p>
                  <p className="text-sm text-muted">
                    {ROLE[p.role]} · {p.status === "active" ? "Ativa" : "Suspensa"} · desde {formatDate(p.created_at)}
                  </p>
                </div>
                {p.id !== me.id ? (
                  <form action={setUserStatusAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === "active" ? "suspended" : "active"} />
                    <button type="submit" className={buttonClass(p.status === "active" ? "danger" : "secondary")}>
                      {p.status === "active" ? "Suspender" : "Reativar"}
                    </button>
                  </form>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum usuário" />
      )}
    </>
  );
}
