import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Biblioteca | Auge Fit" };

export default async function LibraryPage() {
  await requireRole("student");
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, instructions")
    .eq("published", true)
    .order("muscle_group")
    .order("name");
  const groups = Map.groupBy(exercises ?? [], (e) => e.muscle_group);

  return (
    <>
      <PageHeader title="Biblioteca de exercícios" description="Só aparecem exercícios revisados por profissional." />
      {groups.size ? (
        <div className="space-y-4">
          {[...groups.entries()].map(([group, list]) => (
            <Card key={group}>
              <h2 className="mb-2 font-bold">{group}</h2>
              <ul className="space-y-2">
                {list.map((e) => (
                  <li key={e.id}>
                    <details className="rounded-xl bg-surface-2 px-3 py-2">
                      <summary className="min-h-7 cursor-pointer font-medium">{e.name}</summary>
                      <p className="mt-2 text-sm whitespace-pre-line text-muted">{e.instructions ?? "Sem instruções cadastradas."}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="A biblioteca está sendo revisada">Os exercícios aparecem aqui depois da revisão de um profissional.</EmptyState>
      )}
    </>
  );
}
