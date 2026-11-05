import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Direito do titular: exporta os próprios dados. A RLS limita tudo ao dono, mesmo com assinatura vencida. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const id = auth.user.id;

  const { data: ownLogs } = await supabase.from("workout_logs").select("id").eq("student_id", id);
  const logIds = (ownLogs ?? []).map((l) => l.id);

  const [profile, student, consents, plans, logs, sets, measurements, photos, subscriptions, payments] = await Promise.all([
    supabase.from("profiles").select("full_name, birth_date, created_at").eq("id", id).maybeSingle(),
    supabase.from("student_profiles").select("goal, experience_level, onboarded_at").eq("profile_id", id).maybeSingle(),
    supabase.from("consents").select("type, document_version, granted_at, revoked_at").eq("profile_id", id),
    supabase.from("workout_plans").select("id, kind, name, status, created_at, workouts(name, position)").eq("student_id", id),
    supabase.from("workout_logs").select("id, workout_name, started_at, finished_at").eq("student_id", id),
    logIds.length
      ? supabase.from("set_logs").select("workout_log_id, exercise_id, set_number, weight_kg, reps, logged_at").in("workout_log_id", logIds)
      : Promise.resolve({ data: [] }),
    supabase.from("body_measurements").select("*").eq("profile_id", id),
    supabase.from("progress_photos").select("pose, taken_on, created_at").eq("profile_id", id),
    supabase.from("subscriptions").select("id, status, current_period_end, created_at").eq("profile_id", id),
    supabase.from("payments").select("status, amount_cents, method, paid_at, refunded_at"),
  ]);

  const { data: nutrition } = await supabase.from("nutrition_access").select("whatsapp, granted_at, revoked_at").eq("profile_id", id).maybeSingle();

  const body = {
    exported_at: new Date().toISOString(),
    email: auth.user.email,
    profile: profile.data,
    student_profile: student.data,
    consents: consents.data,
    workout_plans: plans.data,
    workout_logs: logs.data,
    set_logs: sets.data,
    body_measurements: measurements.data,
    progress_photos: photos.data,
    subscriptions: subscriptions.data,
    payments: payments.data,
    nutrition_access: nutrition,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="auge-fit-meus-dados.json"',
      "cache-control": "no-store",
    },
  });
}
