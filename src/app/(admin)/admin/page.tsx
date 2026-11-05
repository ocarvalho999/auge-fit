import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Painel | Auge Fit" };

const STATUS: Record<string, string> = { pending: "Pendente", submitted: "Enviado", reviewed: "Analisado" };

export default async function AdminHomePage() {
  await requireRole("admin");
  const supabase = await createClient();
  const count = async (table: "profiles" | "professionals" | "waitlist_entries") =>
    (await supabase.from(table).select("id", { count: "exact", head: true })).count ?? 0;
  const [users, professionals, waitlist, { data: sellable }, { data: checkins }] = await Promise.all([
    count("profiles"),
    count("professionals"),
    count("waitlist_entries"),
    supabase.rpc("pro_is_sellable"),
    // Só status: a função do banco não devolve as respostas.
    supabase.rpc("admin_checkin_status"),
  ]);

  return (
    <>
      <PageHeader title="Painel" description="O perfil de administrador não cria prescrições e não vê fotos." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Contas</p>
          <p className="text-2xl font-bold">{users}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Profissionais</p>
          <p className="text-2xl font-bold">{professionals}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Lista de espera</p>
          <p className="text-2xl font-bold">{waitlist}</p>
        </Card>
      </div>
      <div className="mt-4 space-y-4">
        <Card>
          <h2 className="font-bold">Venda do Pro</h2>
          <p className="mt-1 text-sm text-muted">
            {sellable ? "Liberada: há pelo menos 3 programas revisados publicados." : "Bloqueada: faltam programas revisados publicados (mínimo de 3)."}
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Check-ins</h2>
          {checkins?.length ? (
            <ul className="space-y-1 text-sm">
              {checkins.slice(0, 20).map((c) => (
                <li key={c.id}>
                  Prazo {formatDate(c.due_on)}: {STATUS[c.status] ?? c.status}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhum check-in" />
          )}
        </Card>
      </div>
    </>
  );
}
