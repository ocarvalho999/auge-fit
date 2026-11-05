// Regras de cobrança sem dependências externas, para serem testadas isoladamente.

export const GRACE_DAYS = 5;
export const GUARANTEE_DAYS = 7;
export const BLACK_DAYS = 56;

export type LocalPaymentStatus = "pending" | "approved" | "rejected" | "refunded" | "cancelled" | "amount_mismatch";
export type Interval = "month" | "quarter" | "package";

export function mapPaymentStatus(providerStatus: string | undefined): Exclude<LocalPaymentStatus, "amount_mismatch"> {
  switch (providerStatus) {
    case "approved":
      return "approved";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "rejected":
      return "rejected";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "pending";
  }
}

/** O guia do Mercado Pago escreve "canceled" e o SDK "cancelled"; aceitamos as duas formas ao ler. */
export function mapPreapprovalStatus(providerStatus: string | undefined): "authorized" | "paused" | "cancelled" | "pending" {
  if (providerStatus === "authorized") return "authorized";
  if (providerStatus === "paused") return "paused";
  if (providerStatus === "cancelled" || providerStatus === "canceled") return "cancelled";
  return "pending";
}

export const toCents = (amount: number | undefined | null) => (amount == null ? null : Math.round(amount * 100));

/** O valor cobrado vem sempre do banco; aqui só aplica o cupom validado no servidor. */
export function discountedCents(priceCents: number, discountPercent: number | null): number {
  if (!discountPercent) return priceCents;
  return Math.round((priceCents * (100 - discountPercent)) / 100);
}

export function addMonths(date: Date, months: number): Date {
  const out = new Date(date);
  const day = out.getUTCDate();
  out.setUTCMonth(out.getUTCMonth() + months);
  // 31/01 + 1 mês não pode virar março.
  if (out.getUTCDate() !== day) out.setUTCDate(0);
  return out;
}

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 864e5);

/** Fim do período pago. Black não tem fim aqui: as 8 semanas começam no vínculo. */
export function periodAfterPayment(
  interval: Interval,
  paidAt: Date,
  currentEnd: Date | null,
): { periodEnd: Date | null; graceUntil: Date | null } {
  if (interval === "package") return { periodEnd: null, graceUntil: null };
  const start = currentEnd && currentEnd > paidAt ? currentEnd : paidAt;
  const periodEnd = addMonths(start, interval === "quarter" ? 3 : 1);
  return { periodEnd, graceUntil: addDays(periodEnd, GRACE_DAYS) };
}

export function isWithinGuarantee(paidAt: Date | null, now: Date = new Date()): boolean {
  return Boolean(paidAt) && now.getTime() - paidAt!.getTime() <= GUARANTEE_DAYS * 864e5;
}

export type CouponRow = {
  active: boolean;
  discount_percent: number;
  expires_at: string | null;
  max_uses: number | null;
};

/** Devolve o motivo da recusa ou null. A mensagem é a mesma para não revelar quais cupons existem. */
export function couponProblem(
  coupon: CouponRow | null,
  usedCount: number,
  alreadyUsedByProfile: boolean,
  now: Date = new Date(),
): string | null {
  const invalid = "Cupom inválido ou expirado.";
  if (!coupon || !coupon.active) return invalid;
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return invalid;
  if (coupon.max_uses !== null && usedCount >= coupon.max_uses) return invalid;
  // Cobrança de valor zero não existe no provedor.
  if (coupon.discount_percent >= 100) return invalid;
  if (alreadyUsedByProfile) return "Você já usou este cupom.";
  return null;
}

/** Chave de deduplicação: o id da notificação quando existe; senão o id da requisição. */
export function webhookEventKey(input: { notificationId?: string | number | null; requestId: string; topic: string; dataId: string }): string {
  return input.notificationId ? `notification:${input.notificationId}` : `request:${input.requestId}:${input.topic}:${input.dataId}`;
}
