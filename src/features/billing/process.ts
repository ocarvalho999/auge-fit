import "server-only";
import { notify } from "@/lib/email";
import { mercadoPago } from "@/lib/mercadopago/client";
import { audit, createAdminClient } from "@/lib/supabase/admin";
import {
  addDays,
  GRACE_DAYS,
  mapPaymentStatus,
  mapPreapprovalStatus,
  periodAfterPayment,
  toCents,
  type Interval,
} from "./domain";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProviderPayment = {
  id?: number | string;
  status?: string;
  transaction_amount?: number;
  external_reference?: string;
  payment_type_id?: string;
  date_approved?: string;
};

async function loadSubscription(id: string) {
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .select("id, profile_id, status, expected_amount_cents, coupon_id, current_period_end, provider_id, plan_prices(interval)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler assinatura: ${error.code}`);
  return data;
}

type Sub = NonNullable<Awaited<ReturnType<typeof loadSubscription>>>;

async function latestEndForRenewal(sub: Sub, interval: Interval): Promise<Date | null> {
  if (interval !== "quarter" || !sub.profile_id) {
    return sub.current_period_end ? new Date(sub.current_period_end) : null;
  }
  // Renovação do trimestre é um novo pagamento: soma ao período que ainda estiver vigente.
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("current_period_end")
    .eq("profile_id", sub.profile_id)
    .eq("status", "active")
    .neq("id", sub.id)
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.current_period_end ? new Date(data.current_period_end) : null;
}

async function grantAccess(sub: Sub, paidAt: Date, paymentRowId: string, providerPaymentId: string) {
  const admin = createAdminClient();
  const interval = (sub.plan_prices?.interval ?? "month") as Interval;
  const { periodEnd, graceUntil } = periodAfterPayment(interval, paidAt, await latestEndForRenewal(sub, interval));

  const { error } = await admin
    .from("subscriptions")
    .update(
      interval === "package"
        ? { status: "active" }
        : { status: "active", current_period_end: periodEnd?.toISOString(), grace_until: graceUntil?.toISOString() },
    )
    .eq("id", sub.id);
  if (error) throw new Error(`Falha ao ativar assinatura: ${error.code}`);

  if (interval === "package") {
    // Pagamento pode chegar depois dos 30 minutos: a vaga volta a contar, e o admin resolve se houver excesso.
    await admin
      .from("black_slot_reservations")
      .update({ status: "paid" })
      .eq("subscription_id", sub.id)
      .in("status", ["pending", "expired"]);
  }
  if (sub.coupon_id && sub.profile_id) {
    await admin.rpc("redeem_coupon", { p_coupon_id: sub.coupon_id, p_profile_id: sub.profile_id, p_payment_id: paymentRowId });
  }
  if (sub.profile_id) {
    await notify({ profileId: sub.profile_id, template: "payment_confirmed", dedupeKey: `payment_confirmed:${providerPaymentId}` });
  }
}

export async function endAccess(subscriptionId: string, providerId: string | null) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("subscriptions")
    .update({ status: "refunded", current_period_end: now, grace_until: null })
    .eq("id", subscriptionId);
  if (error) throw new Error(`Falha ao encerrar acesso: ${error.code}`);
  await admin
    .from("professional_students")
    .update({ status: "ended", ends_at: now, photos_allowed: false })
    .eq("subscription_id", subscriptionId)
    .eq("status", "active");
  await admin
    .from("black_slot_reservations")
    .update({ status: "cancelled" })
    .eq("subscription_id", subscriptionId)
    .in("status", ["pending", "paid"]);
  // Reembolso de mensal não pode continuar gerando cobrança.
  if (providerId) {
    await mercadoPago.preApproval().update({ id: providerId, body: { status: "cancelled" } });
  }
}

/** Aplica o estado atual informado pela API. Por sempre consultar a API, evento repetido ou fora de ordem não regride nada. */
export async function applyProviderPayment(mp: ProviderPayment, knownSubscriptionId?: string): Promise<string> {
  const providerPaymentId = String(mp.id ?? "");
  const subscriptionId = knownSubscriptionId ?? mp.external_reference;
  if (!providerPaymentId || !subscriptionId || !UUID.test(subscriptionId)) return "ignored";

  const sub = await loadSubscription(subscriptionId);
  if (!sub) return "ignored";

  const admin = createAdminClient();
  const { data: previous } = await admin
    .from("payments")
    .select("id, status")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();

  const amount = toCents(mp.transaction_amount) ?? 0;
  const mapped = mapPaymentStatus(mp.status);
  // Valor adulterado: nunca libera acesso, mesmo com o pagamento aprovado no provedor.
  const status = mapped === "approved" && amount !== sub.expected_amount_cents ? "amount_mismatch" : mapped;
  const paidAt = mp.date_approved ? new Date(mp.date_approved) : new Date();

  const { data: row, error } = await admin
    .from("payments")
    .upsert(
      {
        subscription_id: sub.id,
        status,
        amount_cents: amount,
        method: mp.payment_type_id ?? null,
        provider_payment_id: providerPaymentId,
        paid_at: mapped === "approved" || mapped === "refunded" ? paidAt.toISOString() : null,
        ...(status === "refunded" ? { refunded_at: new Date().toISOString() } : {}),
      },
      { onConflict: "provider_payment_id" },
    )
    .select("id")
    .single();
  if (error || !row) throw new Error(`Falha ao gravar pagamento: ${error?.code}`);

  if (status === previous?.status) return "unchanged";

  if (status === "amount_mismatch") {
    await audit({
      actorId: null,
      action: "payment.amount_mismatch",
      entity: "payments",
      entityId: row.id,
      metadata: { expected_cents: sub.expected_amount_cents, received_cents: amount },
    });
    return status;
  }
  if (status === "approved") await grantAccess(sub, paidAt, row.id, providerPaymentId);
  if (status === "refunded") {
    await endAccess(sub.id, sub.provider_id);
    await audit({ actorId: null, action: "payment.refunded", entity: "payments", entityId: row.id });
  }
  if (status === "rejected") {
    if (sub.status === "active") {
      await admin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
    }
    if (sub.profile_id) {
      await notify({ profileId: sub.profile_id, template: "payment_failed", dedupeKey: `payment_failed:${providerPaymentId}` });
    }
  }
  return status;
}

async function subscriptionForPreapproval(preapprovalId: string, externalReference?: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("subscriptions").select("id").eq("provider_id", preapprovalId).maybeSingle();
  if (data) return loadSubscription(data.id);
  return externalReference && UUID.test(externalReference) ? loadSubscription(externalReference) : null;
}

/** A autorização da assinatura não libera acesso: só um pagamento aprovado libera. */
export async function applyPreapproval(id: string): Promise<string> {
  const pre = await mercadoPago.preApproval().get({ id });
  const sub = await subscriptionForPreapproval(id, pre.external_reference);
  if (!sub) return "ignored";
  const admin = createAdminClient();
  const status = mapPreapprovalStatus(pre.status);
  const charged = toCents(pre.auto_recurring?.transaction_amount);

  if (charged !== null && charged !== sub.expected_amount_cents) {
    await audit({
      actorId: null,
      action: "subscription.amount_mismatch",
      entity: "subscriptions",
      entityId: sub.id,
      metadata: { expected_cents: sub.expected_amount_cents, received_cents: charged },
    });
    return "amount_mismatch";
  }

  if (status === "cancelled" && sub.status !== "refunded") {
    await admin
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), grace_until: sub.current_period_end })
      .eq("id", sub.id);
    return status;
  }
  if (status === "paused" && sub.status === "active") {
    await admin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
    return status;
  }
  if (status === "authorized" && sub.status === "active" && pre.next_payment_date) {
    const end = new Date(pre.next_payment_date);
    await admin
      .from("subscriptions")
      .update({ current_period_end: end.toISOString(), grace_until: addDays(end, GRACE_DAYS).toISOString() })
      .eq("id", sub.id);
  }
  return status;
}

/** Cobrança recorrente: liga a fatura à assinatura e aplica o pagamento correspondente. */
export async function applyAuthorizedPayment(id: string): Promise<string> {
  const invoice = await mercadoPago.invoice().get({ id });
  if (!invoice.preapproval_id) return "ignored";
  const sub = await subscriptionForPreapproval(invoice.preapproval_id, invoice.external_reference);
  if (!sub) return "ignored";
  const paymentId = invoice.payment?.id;
  if (!paymentId) return "pending";
  const payment = await mercadoPago.payment().get({ id: paymentId });
  return applyProviderPayment(payment, sub.id);
}

export async function applyPaymentById(id: string): Promise<string> {
  return applyProviderPayment(await mercadoPago.payment().get({ id }));
}
