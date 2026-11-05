import "server-only";
import { notify } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays } from "./domain";

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

/** Rotina diária. Idempotente: rodar duas vezes não repete efeito nem e-mail. */
export async function runDailyRoutine(now: Date = new Date()) {
  const admin = createAdminClient();
  const iso = now.toISOString();
  const summary = { reservations: 0, expired: 0, links: 0, warnings: 0, inactivity: 0, checkins: 0 };

  const { data: reservations } = await admin
    .from("black_slot_reservations")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lte("expires_at", iso)
    .select("id");
  summary.reservations = reservations?.length ?? 0;

  // Vencimento depois da carência: leitura e exportação continuam, novos registros não.
  const { data: active } = await admin
    .from("subscriptions")
    .select("id, current_period_end, grace_until")
    .in("status", ["active", "past_due", "cancelled"])
    .not("current_period_end", "is", null);
  for (const s of active ?? []) {
    const limit = s.grace_until ?? s.current_period_end!;
    if (new Date(limit) < now) {
      await admin.from("subscriptions").update({ status: "expired" }).eq("id", s.id);
      summary.expired += 1;
    }
  }

  const { data: links } = await admin
    .from("professional_students")
    .update({ status: "ended", photos_allowed: false })
    .eq("status", "active")
    .lte("ends_at", iso)
    .select("id");
  summary.links = links?.length ?? 0;

  // Avisos do trimestre, 7 dias e 1 dia antes.
  const { data: quarters } = await admin
    .from("subscriptions")
    .select("id, profile_id, current_period_end, plan_prices!inner(interval)")
    .eq("status", "active")
    .not("current_period_end", "is", null);
  for (const s of quarters ?? []) {
    if (s.plan_prices?.interval !== "quarter" || !s.profile_id) continue;
    const daysLeft = (new Date(s.current_period_end!).getTime() - now.getTime()) / 864e5;
    const template = daysLeft > 0 && daysLeft <= 1 ? "quarter_expiring_1" : daysLeft > 6 && daysLeft <= 7 ? "quarter_expiring_7" : null;
    if (!template) continue;
    const r = await notify({ profileId: s.profile_id, template, dedupeKey: `${template}:${s.id}:${s.current_period_end}` });
    if (r !== "duplicate") summary.warnings += 1;
  }

  // Inatividade de 5 dias: só para quem aceitou e-mails de marketing.
  const { data: opted } = await admin.from("profiles").select("id").eq("role", "student").eq("marketing_emails", true);
  for (const p of opted ?? []) {
    const { data: last } = await admin
      .from("workout_logs")
      .select("started_at")
      .eq("student_id", p.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) continue;
    const idle = (now.getTime() - new Date(last.started_at).getTime()) / 864e5;
    if (idle >= 5 && idle < 6) {
      const r = await notify({ profileId: p.id, template: "inactivity_5d", dedupeKey: `inactivity:${p.id}:${dateKey(new Date(last.started_at))}` });
      if (r !== "duplicate") summary.inactivity += 1;
    }
  }

  // Check-in semanal do Black: abre um novo quando não há nenhum em aberto na semana.
  const { data: activeLinks } = await admin
    .from("professional_students")
    .select("id, student_id, starts_at")
    .eq("status", "active");
  for (const link of activeLinks ?? []) {
    if (now.getTime() - new Date(link.starts_at).getTime() < 6 * 864e5) continue;
    const { data: recent } = await admin
      .from("checkins")
      .select("id")
      .eq("professional_student_id", link.id)
      .gte("due_on", dateKey(addDays(now, -6)))
      .limit(1);
    if (recent?.length) continue;
    const dueOn = dateKey(addDays(now, 3));
    const { error } = await admin.from("checkins").insert({ professional_student_id: link.id, due_on: dueOn });
    if (!error) {
      summary.checkins += 1;
      await notify({ profileId: link.student_id, template: "checkin_pending", dedupeKey: `checkin:${link.id}:${dueOn}` });
    }
  }
  return summary;
}
