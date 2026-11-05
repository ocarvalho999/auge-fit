"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/action-state";
import { notify } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import {
  catalogPlanSchema,
  exerciseReviewSchema,
  feedbackSchema,
  openCheckinSchema,
  planStatusSchema,
  prescribedPlanSchema,
  proExerciseSchema,
  proWorkoutSchema,
} from "@/lib/validation/professional";
import { assertRole } from "@/features/auth/session";

async function currentProfessionalId() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_professional_id");
  return data as string | null;
}

export async function createPrescribedPlanAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("professional");
  const parsed = prescribedPlanSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const author = await currentProfessionalId();
  if (!author) return { error: "Seu cadastro precisa estar ativo e com CREF verificado." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .insert({ kind: "prescribed", name: parsed.data.name, student_id: parsed.data.studentId, author_professional_id: author })
    .select("id")
    .single();
  if (error || !data) return { error: "Só é possível prescrever para aluno com vínculo ativo." };
  redirect(`/profissional/planos/${data.id}`);
}

export async function createCatalogPlanAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("professional");
  const parsed = catalogPlanSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const author = await currentProfessionalId();
  if (!author) return { error: "Seu cadastro precisa estar ativo e com CREF verificado." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .insert({ kind: "catalog", name: parsed.data.name, author_professional_id: author })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar o programa." };
  redirect(`/profissional/planos/${data.id}`);
}

export async function addProWorkoutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("professional");
  const parsed = proWorkoutSchema.safeParse(formValues(form));
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
  revalidatePath(`/profissional/planos/${parsed.data.planId}`);
  return { ok: true };
}

export async function addProExerciseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("professional");
  const parsed = proExerciseSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { count } = await supabase
    .from("workout_exercises")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", d.workoutId);
  const { error } = await supabase.from("workout_exercises").insert({
    workout_id: d.workoutId,
    exercise_id: d.exerciseId,
    sets: d.sets,
    reps_target: d.repsTarget || null,
    rest_seconds: d.restSeconds ?? null,
    notes: d.notes || null,
    position: count ?? 0,
  });
  if (error) return { error: "Não foi possível adicionar o exercício." };
  revalidatePath(`/profissional/planos/${d.planId}`);
  return { ok: true };
}

export async function removeProExerciseAction(form: FormData): Promise<void> {
  await assertRole("professional");
  const supabase = await createClient();
  await supabase.from("workout_exercises").delete().eq("id", String(form.get("id") ?? ""));
  revalidatePath(`/profissional/planos/${String(form.get("planId") ?? "")}`);
}

export async function setPlanStatusAction(form: FormData): Promise<void> {
  await assertRole("professional");
  const parsed = planStatusSchema.safeParse(formValues(form));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("workout_plans").update({ status: parsed.data.status }).eq("id", parsed.data.planId);
  revalidatePath(`/profissional/planos/${parsed.data.planId}`);
}

export async function openCheckinAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("professional");
  const parsed = openCheckinSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("checkins")
    .insert({ professional_student_id: parsed.data.linkId, due_on: parsed.data.dueOn });
  if (error) {
    return { error: error.code === "23505" ? "Já existe um check-in nessa data." : "Não foi possível abrir o check-in." };
  }
  const { data: link } = await supabase
    .from("professional_students")
    .select("student_id")
    .eq("id", parsed.data.linkId)
    .maybeSingle();
  if (link) {
    await notify({
      profileId: link.student_id,
      template: "checkin_pending",
      dedupeKey: `checkin:${parsed.data.linkId}:${parsed.data.dueOn}`,
    });
    revalidatePath(`/profissional/alunos/${link.student_id}`);
  }
  return { ok: true, message: "Check-in aberto." };
}

export async function publishFeedbackAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("professional");
  const parsed = feedbackSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const author = await currentProfessionalId();
  if (!author) return { error: "Seu cadastro precisa estar ativo e com CREF verificado." };
  const supabase = await createClient();
  const { error } = await supabase.from("feedbacks").insert({
    checkin_id: parsed.data.checkinId,
    body: parsed.data.body,
    author_professional_id: author,
    published_at: new Date().toISOString(),
  });
  if (error) return { error: "Não foi possível publicar. Confira o vínculo com o aluno." };
  await supabase.from("checkins").update({ status: "reviewed" }).eq("id", parsed.data.checkinId);

  const { data: studentId } = await supabase.rpc("checkin_student", { p_checkin_id: parsed.data.checkinId });
  if (studentId) {
    await notify({
      profileId: studentId,
      template: "feedback_available",
      dedupeKey: `feedback:${parsed.data.checkinId}`,
    });
  }
  redirect("/profissional");
}

export async function proposeExerciseReviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("professional");
  const parsed = exerciseReviewSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_exercise_review", {
    p_exercise_id: parsed.data.exerciseId,
    p_instructions: parsed.data.instructions,
  });
  if (error) return { error: "Não foi possível registrar a revisão." };
  revalidatePath("/profissional/exercicios");
  return { ok: true, message: "Revisão registrada. A publicação fica com a administração." };
}
