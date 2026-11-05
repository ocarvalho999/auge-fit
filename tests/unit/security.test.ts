import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";
import { buildCsp } from "@/lib/security/csp";
import { scrubEvent, scrubText } from "@/lib/sentry-scrub";
import { renderTemplate, type TemplateName } from "@/lib/email/templates";

describe("CSP", () => {
  const csp = buildCsp({ nonce: "abc", isDev: false, supabaseUrl: "https://x.supabase.co/qualquer", https: true });
  it("scripts só com nonce, sem unsafe", () => {
    const script = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(script).toContain("'nonce-abc'");
    expect(script).not.toContain("unsafe");
  });
  it("só o Storage do projeto serve imagens externas", () => {
    expect(csp).toContain("img-src 'self' data: blob: https://x.supabase.co");
  });
  it("bloqueia ser embutido e força https em produção", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("redirecionamento", () => {
  it("só aceita caminho interno", () => {
    expect(safeNext("/onboarding")).toBe("/onboarding");
    expect(safeNext("/recuperar-senha/nova")).toBe("/recuperar-senha/nova");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/a?b=c", null, ""]) {
      expect(safeNext(bad)).toBe("/inicio");
    }
  });
});

describe("Sentry sem dados pessoais", () => {
  it("remove usuário, corpo, cookies e cabeçalhos", () => {
    const event = scrubEvent({
      user: { email: "a@b.co" },
      extra: { peso: 80 },
      breadcrumbs: [{ message: "x" }],
      request: { data: { peso: 80 }, cookies: { t: "1" }, headers: { authorization: "x" }, query_string: "a=1", url: "https://a.co/alunos/00000000-0000-4000-8000-000000000001?x=1" },
    });
    expect(event.user).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.headers).toBeUndefined();
    expect(event.request?.url).toBe("https://a.co/alunos/[removido]");
  });
  it("remove e-mail e token de texto", () => {
    expect(scrubText("falha para pessoa@exemplo.com")).toBe("falha para [removido]");
    expect(scrubText("token eyJabc.eyJdef.assinatura")).toBe("token [removido]");
  });
});

describe("e-mails", () => {
  const names: TemplateName[] = [
    "welcome", "payment_confirmed", "payment_failed", "quarter_expiring_7", "quarter_expiring_1",
    "checkin_pending", "feedback_available", "professional_invite", "inactivity_5d",
  ];
  it("todos renderizam e nenhum fala de dados de saúde", () => {
    for (const name of names) {
      const { subject, html } = renderTemplate(name, { appUrl: "https://a.co", actionUrl: "https://a.co/x" });
      expect(subject.length).toBeGreaterThan(5);
      expect(html).toContain("https://a.co");
      expect(html.toLowerCase()).not.toMatch(/\b(peso|medida|cintura|gordura|sono|energia)\b/);
    }
  });
});
