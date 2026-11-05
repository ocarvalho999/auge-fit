import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LastSet = { set_number: number; weight_kg: number; reps: number };

/** Carga anterior por exercício: as séries da sessão mais recente em que ele apareceu. */
export function lastSetsByExercise(
  rows: { exercise_id: string; workout_log_id: string; set_number: number; weight_kg: number; reps: number; logged_at: string }[],
): Map<string, LastSet[]> {
  const sorted = [...rows].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const latestLog = new Map<string, string>();
  const out = new Map<string, LastSet[]>();
  for (const r of sorted) {
    if (!latestLog.has(r.exercise_id)) latestLog.set(r.exercise_id, r.workout_log_id);
    if (latestLog.get(r.exercise_id) !== r.workout_log_id) continue;
    const list = out.get(r.exercise_id) ?? [];
    list.push({ set_number: r.set_number, weight_kg: Number(r.weight_kg), reps: r.reps });
    out.set(r.exercise_id, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.set_number - b.set_number);
  return out;
}

export async function getWorkoutForExecution(workoutId: string) {
  const supabase = await createClient();
  const { data: workout, error } = await supabase
    .from("workouts")
    .select("id, name, plan_id, workout_exercises(id, position, sets, reps_target, rest_seconds, notes, exercises(id, name, muscle_group))")
    .eq("id", workoutId)
    .maybeSingle();
  if (error || !workout) return null;

  const exercises = [...workout.workout_exercises].sort((a, b) => a.position - b.position);
  const ids = exercises.flatMap((e) => (e.exercises ? [e.exercises.id] : []));
  const { data: history } = ids.length
    ? await supabase
        .from("set_logs")
        .select("exercise_id, workout_log_id, set_number, weight_kg, reps, logged_at")
        .in("exercise_id", ids)
        .order("logged_at", { ascending: false })
        .limit(300)
    : { data: [] };
  const last = lastSetsByExercise(history ?? []);

  return {
    id: workout.id,
    name: workout.name,
    planId: workout.plan_id,
    exercises: exercises.flatMap((e) =>
      e.exercises
        ? [
            {
              exerciseId: e.exercises.id,
              name: e.exercises.name,
              sets: e.sets,
              repsTarget: e.reps_target,
              restSeconds: e.rest_seconds,
              notes: e.notes,
              last: last.get(e.exercises.id) ?? [],
            },
          ]
        : [],
    ),
  };
}

/** Treino do dia: o seguinte ao último feito, em rodízio dentro do plano mais recente que tenha exercícios. */
export async function getNextWorkout(userId: string) {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("workout_plans")
    .select("id, name, kind, updated_at, workouts(id, name, position, workout_exercises(id))")
    .eq("student_id", userId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(10);
  const { data: lastLog } = await supabase
    .from("workout_logs")
    .select("id, workout_id, workout_name, started_at, finished_at, set_logs(id)")
    .eq("student_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const usable = (plans ?? [])
    .map((p) => ({
      ...p,
      workouts: p.workouts.filter((w) => w.workout_exercises.length > 0).sort((a, b) => a.position - b.position),
    }))
    .filter((p) => p.workouts.length > 0);
  // Prescrição do profissional tem prioridade sobre o treino próprio.
  const plan = usable.find((p) => p.kind === "prescribed") ?? usable[0];
  let next = plan?.workouts[0] ?? null;
  if (plan && lastLog?.workout_id) {
    const idx = plan.workouts.findIndex((w) => w.id === lastLog.workout_id);
    if (idx >= 0) next = plan.workouts[(idx + 1) % plan.workouts.length] ?? next;
  }
  return { next, planName: plan?.name ?? null, lastLog };
}
