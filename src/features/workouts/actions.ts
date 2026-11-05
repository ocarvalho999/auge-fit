"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { addExerciseSchema, planNameSchema, workoutNameSchema } from "@/lib/validation/student";
import { assertRole } from "@/features/auth/session";
import { hasEntitlement } from "@/features/billing/entitlements";

const NO_PLAN = "Sua assinatura não permite novos registros. Confira em Assinatura.";

export async function createOwnPlanAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const parsed = planNameSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  if (!(await hasEntitlement(profile.id, "log_workouts"))) return { error: NO_PLAN };

  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("workout_plans")
    .insert({ kind: "own", name: parsed.data.name, student_id: profile.id, status: "published" })
    .select("id")
    .single();
  if (error || !plan) return { error: "Não foi possível criar o treino." };
  const { error: workoutError } = await supabase.from("workouts").insert({ plan_id: plan.id, name: "Treino A", position: 0 });
  if (workoutError) return { error: "Não foi possível criar o treino." };
  redirect(`/treinos/${plan.id}`);
}

export async function addWorkoutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("student");
  const parsed = workoutNameSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { count } = await supabase
    .from("workouts")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", parsed.data.planId);
  const { error } = await supabase
    .from("workouts")
    .insert({ plan_id: parsed.data.planId, name: parsed.data.name, position: count ?? 0 });
  if (error) return { error: "Não foi possível adicionar." };
  revalidatePath(`/treinos/${parsed.data.planId}`);
  return { ok: true };
}

export async function addExerciseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("student");
  const parsed = addExerciseSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { count } = await supabase
    .from("workout_exercises")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", parsed.data.workoutId);
  const { error } = await supabase.from("workout_exercises").insert({
    workout_id: parsed.data.workoutId,
    exercise_id: parsed.data.exerciseId,
    sets: parsed.data.sets,
    reps_target: parsed.data.repsTarget || null,
    rest_seconds: parsed.data.restSeconds ?? null,
    position: count ?? 0,
  });
  if (error) return { error: "Não foi possível adicionar o exercício." };
  revalidatePath("/treinos", "layout");
  return { ok: true };
}

export async function removeExerciseAction(form: FormData): Promise<void> {
  await assertRole("student");
  const id = String(form.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("workout_exercises").delete().eq("id", id);
  revalidatePath("/treinos", "layout");
}

export async function deleteOwnPlanAction(form: FormData): Promise<void> {
  await assertRole("student");
  const id = String(form.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("workout_plans").delete().eq("id", id).eq("kind", "own");
  redirect("/treinos");
}
