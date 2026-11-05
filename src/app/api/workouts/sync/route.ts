import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncPayloadSchema } from "@/lib/validation/student";

/** Recebe a fila local. A RLS confere dono e assinatura; client_uuid único impede duplicar no reenvio. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const parsed = syncPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { log, sets } = parsed.data;

  const { data: existing } = await supabase.from("workout_logs").select("id").eq("id", log.id).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("workout_logs").insert({ ...log, student_id: auth.user.id });
    // 42501 é a RLS: assinatura vencida não registra novos treinos.
    if (error) {
      return NextResponse.json({ error: "Registro recusado" }, { status: error.code === "42501" ? 403 : 400 });
    }
  } else if (log.finished_at) {
    await supabase.from("workout_logs").update({ finished_at: log.finished_at }).eq("id", log.id);
  }

  if (sets.length) {
    const { error } = await supabase
      .from("set_logs")
      .upsert(
        sets.map((s) => ({ ...s, workout_log_id: log.id })),
        { onConflict: "client_uuid", ignoreDuplicates: true },
      );
    if (error) {
      return NextResponse.json({ error: "Registro recusado" }, { status: error.code === "42501" ? 403 : 400 });
    }
  }
  return NextResponse.json({ ok: true });
}
