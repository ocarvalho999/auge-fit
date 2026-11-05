export type SetRow = {
  exercise_id: string;
  workout_log_id: string;
  weight_kg: number;
  reps: number;
  logged_at: string;
};

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/** Dia civil no Brasil: treino às 22h não pode cair no dia seguinte por causa do UTC. */
const dayOf = (iso: string) => DAY.format(new Date(iso));

/** Maior carga de cada dia para um exercício. */
export function loadSeries(rows: SetRow[], exerciseId: string): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (r.exercise_id !== exerciseId) continue;
    const d = dayOf(r.logged_at);
    byDay.set(d, Math.max(byDay.get(d) ?? 0, Number(r.weight_kg)));
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

/** Volume (carga x repetições) somado por dia, em todos os exercícios. */
export function volumeSeries(rows: SetRow[]): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const d = dayOf(r.logged_at);
    byDay.set(d, (byDay.get(d) ?? 0) + Number(r.weight_kg) * r.reps);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
}

/** Constância: dias distintos com treino nos últimos N dias. */
export function consistency(startedAt: string[], now: Date = new Date(), days = 28): number {
  const min = now.getTime() - days * 864e5;
  return new Set(startedAt.filter((d) => new Date(d).getTime() >= min).map(dayOf)).size;
}

export const daysAgoIso = (days: number, now: Date = new Date()) => new Date(now.getTime() - days * 864e5).toISOString();
