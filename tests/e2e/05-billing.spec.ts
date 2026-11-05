import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signWebhook } from "./support/fake-mercadopago";
import { createStaff, expectNoHorizontalScroll, login, signUpAndLogin, sql, uniqueEmail } from "./support/helpers";

const FAKE = "http://127.0.0.1:54399";
const WEBHOOK = "http://localhost:3100/api/webhooks/mercadopago";

async function onboarded(page: Page, email: string) {
  await signUpAndLogin(page, email);
  await sql(
    `update public.student_profiles set onboarded_at = now(), goal = 'hypertrophy' where profile_id = (select id from auth.users where email = $1)`,
    [email],
  );
}

const planForm = (page: Page, label: RegExp) => page.locator("form", { has: page.getByRole("button", { name: label }) });

async function latestSubscription(email: string) {
  const [sub] = await sql<{ id: string; status: string; expected_amount_cents: number; provider_id: string | null }>(
    `select s.id, s.status, s.expected_amount_cents, s.provider_id from public.subscriptions s
     join auth.users u on u.id = s.profile_id where u.email = $1 order by s.created_at desc limit 1`,
    [email],
  );
  return sub!;
}

/** Simula o provedor confirmando e envia o webhook assinado, como o Mercado Pago faria. */
async function providerSays(payment: { id: string; status: string; transaction_amount: number; external_reference: string }) {
  await fetch(`${FAKE}/__test/mp/payment`, {
    method: "POST",
    body: JSON.stringify({ payment_type_id: "pix", date_approved: new Date().toISOString(), ...payment }),
  });
  const response = await fetch(`${WEBHOOK}?data.id=${payment.id}&type=payment`, {
    method: "POST",
    headers: { "content-type": "application/json", ...signWebhook(payment.id, "e2e-webhook-secret") },
    body: JSON.stringify({ id: randomUUID(), type: "payment", data: { id: payment.id } }),
  });
  expect(response.status).toBe(200);
}

test("assinatura trimestral: cupom, aguardando confirmação, webhook libera, reembolso pelo admin encerra", async ({ browser }) => {
  const code = `TIKTOK${Date.now()}`;
  await sql(`insert into public.coupons (code, discount_percent, campaign, max_uses) values ($1, 10, 'video-01', 5)`, [code]);

  const email = uniqueEmail("assinante");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await onboarded(page, email);

  await page.goto("/assinatura");
  await expectNoHorizontalScroll(page);
  await expect(page.getByText("Você ainda não tem um plano ativo")).toBeVisible();
  // Pro não pode ser vendido antes de 3 programas publicados.
  await expect(page.getByRole("button", { name: /Assinar Pro/ })).toHaveCount(0);

  const form = planForm(page, /Assinar Basic: R\$\s*99,90/);
  await form.getByLabel("Cupom (opcional)").fill("NAOEXISTE");
  await form.getByRole("button").click();
  await expect(form.getByText("Cupom inválido ou expirado.")).toBeVisible();
  await form.getByLabel("Cupom (opcional)").fill(code);
  await form.getByRole("button").click();

  // O retorno do checkout não libera nada.
  await expect(page).toHaveURL(/assinatura\/retorno/);
  await expect(page.getByRole("heading", { name: "Aguardando confirmação" })).toBeVisible();
  const sub = await latestSubscription(email);
  expect(sub.status).toBe("pending");
  expect(sub.expected_amount_cents).toBe(8991);
  await page.goto("/treinos/novo");
  await expect(page.getByText("Montar treinos exige um plano ativo.")).toBeVisible();

  // O valor enviado ao provedor veio do banco, com o desconto calculado no servidor.
  const state = (await (await fetch(`${FAKE}/__test/mp/state`)).json()) as { preferences: { external_reference: string; items: { unit_price: number; description: string }[]; payment_methods: { excluded_payment_types: { id: string }[] } }[]; refunds: string[] };
  const pref = state.preferences.find((p) => p.external_reference === sub.id);
  expect(pref?.items[0]?.unit_price).toBe(89.91);
  expect(pref?.items[0]?.description).toBe("Registro de treinos, evolução e biblioteca de exercícios");
  expect(pref?.payment_methods.excluded_payment_types.map((t) => t.id)).toContain("ticket");

  const paymentId = randomUUID();
  await providerSays({ id: paymentId, status: "approved", transaction_amount: 89.91, external_reference: sub.id });
  await page.goto("/treinos/novo");
  await expect(page.getByLabel("Nome do treino")).toBeVisible();

  await page.goto("/assinatura");
  await expect(page.getByText(/Basic · Ativa/)).toBeVisible();
  await expect(page.getByText(/R\$\s*89,91 · Aprovado/)).toBeVisible();
  const [redeemed] = await sql<{ n: string }>(`select count(*) as n from public.coupon_redemptions r join public.coupons c on c.id = r.coupon_id where c.code = $1`, [code]);
  expect(Number(redeemed?.n)).toBe(1);

  // Pedido de reembolso dentro dos 7 dias; o acesso continua até o webhook confirmar.
  await page.getByRole("button", { name: /Pedir reembolso/ }).click();
  await expect(page.getByText(/Reembolso pedido em/)).toBeVisible();

  const admin = await createStaff("admin");
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await login(adminPage, admin.email);
  await expect(adminPage).toHaveURL(/\/admin$/);
  await adminPage.goto("/admin/pagamentos");
  await expectNoHorizontalScroll(adminPage);
  await expect(adminPage.getByText("dentro dos 7 dias").first()).toBeVisible();
  await adminPage.getByRole("button", { name: "Reembolsar" }).first().click();
  await expect.poll(async () => ((await (await fetch(`${FAKE}/__test/mp/state`)).json()) as { refunds: string[] }).refunds).toContain(paymentId);

  await page.goto("/treinos/novo");
  await expect(page.getByLabel("Nome do treino")).toBeVisible();
  await providerSays({ id: paymentId, status: "refunded", transaction_amount: 89.91, external_reference: sub.id });
  await page.goto("/treinos/novo");
  await expect(page.getByText("Montar treinos exige um plano ativo.")).toBeVisible();
  await adminCtx.close();
  await ctx.close();
});

test("cancelamento: tão fácil quanto assinar, acesso até o fim do período, recorrência encerrada", async ({ browser }) => {
  const email = uniqueEmail("cancela");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await onboarded(page, email);

  await page.goto("/assinatura");
  await planForm(page, /Assinar Basic: R\$\s*39,90/).getByRole("button").click();
  await expect(page).toHaveURL(/assinatura\/retorno/);
  const sub = await latestSubscription(email);
  expect(sub.provider_id).toBeTruthy();

  await providerSays({ id: randomUUID(), status: "approved", transaction_amount: 39.9, external_reference: sub.id });
  await page.goto("/assinatura");
  await expect(page.getByText(/Basic · Ativa/)).toBeVisible();

  await page.getByRole("button", { name: "Cancelar assinatura" }).click();
  await expect(page.getByText(/Basic · Cancelada/)).toBeVisible();
  const state = (await (await fetch(`${FAKE}/__test/mp/state`)).json()) as { preapprovals: { id: string; status: string }[] };
  expect(state.preapprovals.find((p) => p.id === sub.provider_id)?.status).toBe("cancelled");

  await page.goto("/treinos/novo");
  await expect(page.getByLabel("Nome do treino")).toBeVisible();
  await ctx.close();
});

test("Black: sem vaga, lista de espera; com vaga, reserva de 30 minutos; preço adulterado no formulário não existe", async ({ browser }) => {
  await sql(`update public.professionals set status = 'inactive'`);
  const email = uniqueEmail("black-venda");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await onboarded(page, email);

  await page.goto("/assinatura");
  await planForm(page, /Assinar Black/).getByRole("button").click();
  await expect(page).toHaveURL(/black=esgotado/);
  await expect(page.getByText("As vagas do Black estão esgotadas")).toBeVisible();
  await page.getByLabel("Seu e-mail").fill(email);
  await page.getByText("Autorizo o contato por e-mail").click();
  await page.getByRole("button", { name: "Entrar na lista de espera" }).click();
  await expect(page.getByText(/Avisaremos por e-mail/)).toBeVisible();
  expect(await sql(`select id from public.waitlist_entries where email = $1 and source = 'black_sold_out'`, [email])).toHaveLength(1);
  // Sem vaga, nenhuma assinatura pendente fica para trás.
  expect(await sql(`select s.id from public.subscriptions s join auth.users u on u.id = s.profile_id where u.email = $1`, [email])).toEqual([]);

  await createStaff("professional");
  await page.goto("/assinatura");
  await planForm(page, /Assinar Black/).getByRole("button").click();
  await expect(page).toHaveURL(/assinatura\/retorno/);
  const sub = await latestSubscription(email);
  const [reservation] = await sql<{ minutes: string; subscription_id: string }>(
    `select round(extract(epoch from expires_at - now()) / 60) as minutes, subscription_id from public.black_slot_reservations where subscription_id = $1`,
    [sub.id],
  );
  expect(Number(reservation?.minutes)).toBeGreaterThanOrEqual(29);

  // Webhook com valor diferente do preço do banco não libera.
  const tampered = randomUUID();
  await providerSays({ id: tampered, status: "approved", transaction_amount: 1, external_reference: sub.id });
  expect((await latestSubscription(email)).status).toBe("pending");

  await providerSays({ id: randomUUID(), status: "approved", transaction_amount: 697, external_reference: sub.id });
  expect((await latestSubscription(email)).status).toBe("active");
  await page.goto("/assinatura");
  await expect(page.getByText("As 8 semanas começam quando o vínculo com o profissional for feito.")).toBeVisible();
  // Black não tem recorrência para cancelar.
  await expect(page.getByRole("button", { name: "Cancelar assinatura" })).toHaveCount(0);
  await ctx.close();
});

test("webhook sem assinatura válida é recusado e rotina exige segredo", async ({ request }) => {
  const r = await request.post(`${WEBHOOK}?data.id=1&type=payment`, { data: { type: "payment", data: { id: "1" } } });
  expect(r.status()).toBe(401);
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  const ok = await request.get("/api/cron/daily", { headers: { authorization: "Bearer e2e-cron-secret" } });
  expect(ok.status()).toBe(200);
});
