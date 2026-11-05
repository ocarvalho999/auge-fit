"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formValues, type ActionState } from "@/lib/action-state";
import { publicEnv } from "@/lib/env";
import { mercadoPago } from "@/lib/mercadopago/client";
import { isRateLimited } from "@/lib/rate-limit";
import { audit, createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/features/auth/session";
import { checkoutCopy, couponProblem, discountedCents, isWithinGuarantee } from "./domain";

const checkoutSchema = z.object({
  priceId: z.uuid(),
  coupon: z
    .string()
    .trim()
    .toUpperCase()
    .max(40)
    .optional()
    .default(""),
});

const UNAVAILABLE = "Não foi possível iniciar o pagamento agora. Tente de novo em instantes.";

async function resolveCoupon(code: string, profileId: string, admin: ReturnType<typeof createAdminClient>) {
  if (!code) return { couponId: null, percent: null, problem: null };
  const { data: coupon } = await admin
    .from("coupons")
    .select("id, active, discount_percent, expires_at, max_uses")
    .eq("code", code)
    .maybeSingle();
  const { data: uses } = coupon
    ? await admin.from("coupon_redemptions").select("profile_id").eq("coupon_id", coupon.id)
    : { data: [] };
  const problem = couponProblem(coupon, uses?.length ?? 0, Boolean(uses?.some((u) => u.profile_id === profileId)));
  return { couponId: coupon?.id ?? null, percent: coupon?.discount_percent ?? null, problem };
}

/** O valor vem sempre do banco. O formulário só informa qual preço foi escolhido. */
export async function startCheckoutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const parsed = checkoutSchema.safeParse(formValues(form));
  if (!parsed.success) return { error: "Plano inválido." };
  if (await isRateLimited("checkout", profile.id)) return { error: "Muitas tentativas. Aguarde um pouco." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email;
  if (!email) return { error: "Sessão expirada." };

  const admin = createAdminClient();
  const { data: price } = await admin
    .from("plan_prices")
    .select("id, interval, amount_cents, active, plans(code, name, active)")
    .eq("id", parsed.data.priceId)
    .maybeSingle();
  if (!price?.active || !price.plans?.active) return { error: "Este plano não está disponível." };

  // O Pro só pode ser vendido com pelo menos 3 programas revisados publicados.
  if (price.plans.code === "pro") {
    const { data: sellable } = await admin.rpc("pro_is_sellable");
    if (!sellable) return { error: "O plano Pro ainda não está disponível." };
  }

  if (parsed.data.coupon && (await isRateLimited("coupon", profile.id))) {
    return { error: "Muitas tentativas de cupom. Aguarde um pouco." };
  }
  const coupon = await resolveCoupon(parsed.data.coupon, profile.id, admin);
  if (coupon.problem) return { fieldErrors: { coupon: coupon.problem } };

  if (price.interval === "month") {
    const { data: running } = await admin
      .from("subscriptions")
      .select("id, plan_prices!inner(interval)")
      .eq("profile_id", profile.id)
      .in("status", ["active", "past_due"]);
    if (running?.some((s) => s.plan_prices?.interval === "month")) {
      return { error: "Você já tem uma assinatura mensal. Cancele a atual antes de trocar." };
    }
  }

  const amount = discountedCents(price.amount_cents, coupon.percent);

  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .insert({
      profile_id: profile.id,
      plan_price_id: price.id,
      status: "pending",
      expected_amount_cents: amount,
      coupon_id: coupon.couponId,
    })
    .select("id")
    .single();
  if (subError || !sub) return { error: UNAVAILABLE };

  const appUrl = publicEnv.appUrl();
  const returnUrl = `${appUrl}/assinatura/retorno`;
  // O provedor só aceita notificação em HTTPS; em desenvolvimento local, o campo fica de fora.
  const notificationUrl = appUrl.startsWith("https://") ? `${appUrl}/api/webhooks/mercadopago` : undefined;
  const { title, description, reason } = checkoutCopy(price.plans.code, price.plans.name);

  let reservationId: string | null = null;
  if (price.plans.code === "black") {
    const { data: reserved, error } = await admin.rpc("reserve_black_slot", { p_student_id: profile.id, p_minutes: 30 });
    if (error) return { error: UNAVAILABLE };
    if (!reserved) {
      await admin.from("subscriptions").delete().eq("id", sub.id);
      redirect("/assinatura?black=esgotado");
    }
    reservationId = reserved;
    await admin.from("black_slot_reservations").update({ subscription_id: sub.id }).eq("id", reserved);
  }

  let checkoutUrl: string | undefined;
  try {
    if (price.interval === "month") {
      // Sem card_token_id: o cartão é digitado na página do Mercado Pago e nunca passa pelo nosso servidor.
      const created = await mercadoPago.preApproval().create({
        body: {
          reason,
          external_reference: sub.id,
          payer_email: email,
          back_url: returnUrl,
          status: "pending",
          auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: amount / 100, currency_id: "BRL" },
        },
        requestOptions: { idempotencyKey: sub.id },
      });
      if (created.id) await admin.from("subscriptions").update({ provider_id: created.id }).eq("id", sub.id);
      checkoutUrl = created.init_point;
    } else {
      const created = await mercadoPago.preference().create({
        body: {
          items: [{ id: price.id, title, description, quantity: 1, unit_price: amount / 100, currency_id: "BRL" }],
          external_reference: sub.id,
          notification_url: notificationUrl,
          back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
          ...(appUrl.startsWith("https://") ? { auto_return: "approved" } : {}),
          // Pix ou cartão: tira boleto e lotérica.
          payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
          ...(reservationId
            ? { expires: true, expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
            : {}),
        },
        requestOptions: { idempotencyKey: sub.id },
      });
      checkoutUrl = created.init_point;
    }
  } catch {
    await admin.from("black_slot_reservations").update({ status: "cancelled" }).eq("subscription_id", sub.id);
    await admin.from("subscriptions").delete().eq("id", sub.id);
    return { error: UNAVAILABLE };
  }
  if (!checkoutUrl) return { error: UNAVAILABLE };
  redirect(checkoutUrl);
}

/** Tão fácil quanto assinar. O acesso segue até o fim do período pago. */
export async function cancelSubscriptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const id = z.uuid().safeParse(form.get("subscriptionId"));
  if (!id.success) return { error: "Assinatura inválida." };

  // Leitura com a sessão da pessoa: a RLS garante que a assinatura é dela.
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, provider_id, status, current_period_end")
    .eq("id", id.data)
    .in("status", ["active", "past_due"])
    .maybeSingle();
  if (!sub) return { error: "Assinatura não encontrada." };

  if (sub.provider_id) {
    try {
      await mercadoPago.preApproval().update({ id: sub.provider_id, body: { status: "cancelled" } });
    } catch {
      return { error: "Não foi possível cancelar agora. Tente de novo em instantes." };
    }
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), grace_until: sub.current_period_end })
    .eq("id", sub.id);
  if (error) return { error: "Não foi possível cancelar agora. Tente de novo em instantes." };
  await audit({ actorId: profile.id, action: "subscription.cancel", entity: "subscriptions", entityId: sub.id });
  revalidatePath("/assinatura");
  return { ok: true, message: "Assinatura cancelada. Seu acesso segue até o fim do período pago." };
}

export async function requestRefundAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const id = z.uuid().safeParse(form.get("paymentId"));
  if (!id.success) return { error: "Pagamento inválido." };
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, status, paid_at, refund_requested_at")
    .eq("id", id.data)
    .maybeSingle();
  if (!payment || payment.status !== "approved") return { error: "Pagamento não encontrado." };
  if (!isWithinGuarantee(payment.paid_at ? new Date(payment.paid_at) : null)) {
    return { error: "O prazo de 7 dias da garantia terminou." };
  }
  if (!payment.refund_requested_at) {
    const { error } = await createAdminClient()
      .from("payments")
      .update({ refund_requested_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (error) return { error: "Não foi possível registrar o pedido." };
    await audit({ actorId: profile.id, action: "refund.request", entity: "payments", entityId: payment.id });
  }
  revalidatePath("/assinatura");
  return { ok: true, message: "Pedido de reembolso registrado." };
}

/** O admin solicita pela API; o acesso só termina quando o webhook confirmar. */
export async function adminRefundAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertRole("admin");
  const id = z.uuid().safeParse(form.get("paymentId"));
  if (!id.success) return { error: "Pagamento inválido." };
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, status, provider_payment_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!payment || payment.status !== "approved") return { error: "Só pagamentos aprovados podem ser reembolsados." };
  try {
    await mercadoPago.refund().create({
      payment_id: payment.provider_payment_id,
      requestOptions: { idempotencyKey: `refund-${payment.id}` },
    });
  } catch {
    return { error: "O provedor recusou o reembolso. Confira no painel do Mercado Pago." };
  }
  await admin.from("payments").update({ refund_requested_at: new Date().toISOString() }).eq("id", payment.id);
  await audit({ actorId: me.id, action: "refund.create", entity: "payments", entityId: payment.id });
  revalidatePath("/admin/pagamentos");
  return { ok: true, message: "Reembolso solicitado. O acesso termina quando o provedor confirmar." };
}
