import { describe, expect, it } from "vitest";
import { ageOn, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";

const valid = {
  fullName: "Pessoa Teste",
  email: "Pessoa@Exemplo.com",
  password: "senha-segura",
  birthDate: "1990-05-10",
  acceptTerms: "on",
};

describe("ageOn", () => {
  const today = new Date("2026-11-05T12:00:00Z");
  it("conta aniversário no próprio dia", () => expect(ageOn("2008-11-05", today)).toBe(18));
  it("não conta antes do aniversário", () => expect(ageOn("2008-11-06", today)).toBe(17));
});

describe("signUpSchema", () => {
  it("aceita dados válidos e normaliza o e-mail", () => {
    const r = signUpSchema.parse(valid);
    expect(r.email).toBe("pessoa@exemplo.com");
  });
  it("recusa menor de 18 anos", () => {
    const y = new Date().getUTCFullYear() - 17;
    expect(signUpSchema.safeParse({ ...valid, birthDate: `${y}-01-01` }).success).toBe(false);
  });
  it("recusa sem aceite dos termos", () => {
    expect(signUpSchema.safeParse({ ...valid, acceptTerms: undefined }).success).toBe(false);
  });
  it("recusa senha curta e e-mail inválido", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "123" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, email: "x" }).success).toBe(false);
  });
  it("ignora role enviado pelo cliente", () => {
    expect(signUpSchema.parse({ ...valid, role: "admin" })).not.toHaveProperty("role");
  });
});

describe("demais esquemas", () => {
  it("login exige senha", () => expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false));
  it("nova senha precisa coincidir", () => {
    expect(newPasswordSchema.safeParse({ password: "12345678", confirm: "87654321" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "12345678", confirm: "12345678" }).success).toBe(true);
  });
});
