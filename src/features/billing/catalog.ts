import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type PlanWithPrices = {
  id: string;
  code: "basic" | "pro" | "black";
  name: string;
  features: Record<string, boolean>;
  prices: { id: string; interval: string; amount_cents: number }[];
};

const ORDER = ["basic", "pro", "black"];

/** Preços sempre vêm do banco. Devolve null quando não for possível carregar. */
export async function getCatalog(): Promise<{ plans: PlanWithPrices[]; proSellable: boolean } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plans")
      .select("id, code, name, features, plan_prices(id, interval, amount_cents, active)")
      .eq("active", true);
    if (error || !data) return null;
    const { data: proSellable } = await supabase.rpc("pro_is_sellable");
    const plans = data
      .map(
        (p): PlanWithPrices => ({
          id: p.id,
          code: p.code as PlanWithPrices["code"],
          name: p.name,
          features: (p.features ?? {}) as Record<string, boolean>,
          prices: p.plan_prices
            .filter((x) => x.active)
            .sort((a, b) => a.amount_cents - b.amount_cents)
            .map(({ id, interval, amount_cents }) => ({ id, interval, amount_cents })),
        }),
      )
      .sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code));
    return { plans, proSellable: proSellable === true };
  } catch {
    return null;
  }
}

export const FEATURE_LABELS: { key: string; label: string }[] = [
  { key: "log_workouts", label: "Registro de treinos, cargas e histórico" },
  { key: "progress", label: "Medidas, fotos e gráficos" },
  { key: "library", label: "Biblioteca de exercícios" },
  { key: "programs", label: "Programas prontos revisados por profissional" },
  { key: "individual_plan", label: "Planejamento individual" },
  { key: "checkins", label: "Check-in semanal e feedback" },
];
