import { describe, expect, it } from "vitest";
import {
  addMonths,
  couponProblem,
  discountedCents,
  isWithinGuarantee,
  mapPaymentStatus,
  mapPreapprovalStatus,
  periodAfterPayment,
  toCents,
  webhookEventKey,
} from "@/features/billing/domain";

describe("status do provedor", () => {
  it("mapeia pagamento", () => {
    expect(mapPaymentStatus("approved")).toBe("approved");
    expect(mapPaymentStatus("charged_back")).toBe("refunded");
    expect(mapPaymentStatus("in_process")).toBe("pending");
    expect(mapPaymentStatus(undefined)).toBe("pending");
  });
  it("aceita as duas grafias de cancelado", () => {
    expect(mapPreapprovalStatus("canceled")).toBe("cancelled");
    expect(mapPreapprovalStatus("cancelled")).toBe("cancelled");
    expect(mapPreapprovalStatus("algo-novo")).toBe("pending");
  });
});

describe("valores", () => {
  it("converte sem erro de ponto flutuante", () => {
    expect(toCents(39.9)).toBe(3990);
    expect(toCents(99.9)).toBe(9990);
    expect(toCents(0.07)).toBe(7);
  });
  it("aplica desconto arredondado", () => {
    expect(discountedCents(3990, 10)).toBe(3591);
    expect(discountedCents(3990, null)).toBe(3990);
  });
});

describe("período", () => {
  const paid = new Date("2026-01-31T12:00:00Z");
  it("não pula mês em 31/01", () => {
    expect(addMonths(paid, 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
  it("trimestre: 3 meses mais 5 dias de carência", () => {
    const { periodEnd, graceUntil } = periodAfterPayment("quarter", new Date("2026-03-01T12:00:00Z"), null);
    expect(periodEnd?.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(graceUntil?.toISOString().slice(0, 10)).toBe("2026-06-06");
  });
  it("renovação soma ao período vigente", () => {
    const { periodEnd } = periodAfterPayment("quarter", new Date("2026-03-01T12:00:00Z"), new Date("2026-03-20T12:00:00Z"));
    expect(periodEnd?.toISOString().slice(0, 10)).toBe("2026-06-20");
  });
  it("período já vencido não é somado", () => {
    const { periodEnd } = periodAfterPayment("month", new Date("2026-03-01T12:00:00Z"), new Date("2026-01-01T12:00:00Z"));
    expect(periodEnd?.toISOString().slice(0, 10)).toBe("2026-04-01");
  });
  it("Black não tem fim até o vínculo", () => {
    expect(periodAfterPayment("package", paid, null)).toEqual({ periodEnd: null, graceUntil: null });
  });
});

describe("garantia de 7 dias", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  it("dentro e fora do prazo", () => {
    expect(isWithinGuarantee(new Date("2026-11-01T12:00:00Z"), now)).toBe(true);
    expect(isWithinGuarantee(new Date("2026-11-01T11:59:00Z"), now)).toBe(false);
    expect(isWithinGuarantee(null, now)).toBe(false);
  });
});

describe("cupom", () => {
  const ok = { active: true, discount_percent: 10, expires_at: null, max_uses: 2 };
  const now = new Date("2026-11-05T12:00:00Z");
  it("aceita válido", () => expect(couponProblem(ok, 1, false, now)).toBeNull());
  it("recusa inexistente, inativo, expirado, esgotado e de 100%", () => {
    expect(couponProblem(null, 0, false, now)).not.toBeNull();
    expect(couponProblem({ ...ok, active: false }, 0, false, now)).not.toBeNull();
    expect(couponProblem({ ...ok, expires_at: "2026-11-04T00:00:00Z" }, 0, false, now)).not.toBeNull();
    expect(couponProblem(ok, 2, false, now)).not.toBeNull();
    expect(couponProblem({ ...ok, discount_percent: 100 }, 0, false, now)).not.toBeNull();
  });
  it("recusa segundo uso da mesma pessoa", () => expect(couponProblem(ok, 1, true, now)).toBe("Você já usou este cupom."));
});

describe("chave do evento", () => {
  it("prefere o id da notificação", () => {
    expect(webhookEventKey({ notificationId: 9, requestId: "r", topic: "payment", dataId: "1" })).toBe("notification:9");
    expect(webhookEventKey({ requestId: "r", topic: "payment", dataId: "1" })).toBe("request:r:payment:1");
  });
});
