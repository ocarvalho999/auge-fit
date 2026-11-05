import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { webhookEventKey } from "@/features/billing/domain";
import { applyAuthorizedPayment, applyPaymentById, applyPreapproval } from "@/features/billing/process";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.looseObject({
  id: z.union([z.string(), z.number()]).nullish(),
  type: z.string().nullish(),
  topic: z.string().nullish(),
  action: z.string().nullish(),
  data: z.looseObject({ id: z.union([z.string(), z.number()]).nullish() }).nullish(),
});

/** Acesso só muda por aqui: assinatura validada, evento único e consulta à API antes de qualquer mudança. */
export async function POST(request: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 });

  const params = request.nextUrl.searchParams;
  const dataId = params.get("data.id") ?? params.get("id");
  const requestId = request.headers.get("x-request-id");
  try {
    WebhookSignatureValidator.validate({
      xSignature: request.headers.get("x-signature"),
      xRequestId: requestId,
      dataId,
      secret,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
    throw error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || !dataId || !requestId) {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  }
  const topic = parsed.data.type ?? parsed.data.topic ?? params.get("type") ?? params.get("topic") ?? "desconhecido";

  const admin = createAdminClient();
  const key = webhookEventKey({ notificationId: parsed.data.id, requestId, topic, dataId });
  const { error: insertError } = await admin
    .from("webhook_events")
    .insert({ provider_event_key: key, topic, payload: parsed.data as Json });
  if (insertError && insertError.code !== "23505") {
    return NextResponse.json({ error: "Falha ao registrar" }, { status: 500 });
  }
  if (insertError) {
    // Reenvio: descarta se já foi processado; senão, tenta de novo, porque a tentativa anterior falhou.
    const { data: seen } = await admin.from("webhook_events").select("processed_at").eq("provider_event_key", key).maybeSingle();
    if (seen?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (topic === "payment") await applyPaymentById(dataId);
    else if (topic === "subscription_preapproval") await applyPreapproval(dataId);
    else if (topic === "subscription_authorized_payment") await applyAuthorizedPayment(dataId);
    // subscription_preapproval_plan: não usamos planos no provedor, então só registramos.
  } catch {
    // 500 faz o provedor reenviar. Sem detalhes do erro: podem conter dados da pessoa.
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }

  await admin.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("provider_event_key", key);
  return NextResponse.json({ ok: true });
}
