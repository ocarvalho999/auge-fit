import { describe, expect, it } from "vitest";
import { couponSchema, inviteProfessionalSchema, parseReais, priceUpdateSchema } from "@/lib/validation/admin";

describe("parseReais", () => {
  it("converte sem erro de arredondamento", () => {
    expect(parseReais("39,90")).toBe(3990);
    expect(parseReais("19.99")).toBe(1999);
    expect(parseReais("697")).toBe(69700);
    expect(parseReais("1,5")).toBe(150);
  });
  it("recusa formato inválido", () => {
    for (const v of ["", "abc", "1,234", "-5", "1.000,00"]) expect(parseReais(v)).toBeNull();
  });
});

describe("preço", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  it("não aceita zero", () => expect(priceUpdateSchema.safeParse({ id, amount: "0" }).success).toBe(false));
  it("aceita valor válido", () => expect(priceUpdateSchema.parse({ id, amount: "97,00" }).amount).toBe(9700));
});

describe("cupom", () => {
  it("normaliza o código e limita o desconto", () => {
    expect(couponSchema.parse({ code: "tiktok-1", discountPercent: "10" }).code).toBe("TIKTOK-1");
    expect(couponSchema.safeParse({ code: "TIKTOK", discountPercent: "0" }).success).toBe(false);
    expect(couponSchema.safeParse({ code: "TIKTOK", discountPercent: "101" }).success).toBe(false);
    expect(couponSchema.safeParse({ code: "a b", discountPercent: "10" }).success).toBe(false);
  });
});

describe("convite de profissional", () => {
  const valid = { fullName: "Nome", email: "a@b.co", crefNumber: "000000-G", crefUf: "sp", capacity: "15", crefChecked: "on" };
  it("exige a conferência manual do CREF", () => {
    expect(inviteProfessionalSchema.safeParse({ ...valid, crefChecked: undefined }).success).toBe(false);
  });
  it("normaliza a UF", () => expect(inviteProfessionalSchema.parse(valid).crefUf).toBe("SP"));
});
