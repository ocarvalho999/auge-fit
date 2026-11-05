import { expect, test, type Page } from "@playwright/test";
import { createStaff, expectNoHorizontalScroll, grantPlan, login, signUpAndLogin, sql, uniqueEmail } from "./support/helpers";

async function student(page: Page, email: string, name: string) {
  await signUpAndLogin(page, email);
  await sql(
    `update public.student_profiles set onboarded_at = now(), goal = 'definition' where profile_id = (select id from auth.users where email = $1)`,
    [email],
  );
  await sql(`update public.profiles set full_name = $2 where id = (select id from auth.users where email = $1)`, [email, name]);
}

test("liberação pelo WhatsApp: número, fila do admin, acesso e remoção ao perder o direito", async ({ browser }) => {
  const email = uniqueEmail("fitbrother");
  const name = `Assinante ${Date.now()}`;
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await student(page, email, name);
  await grantPlan(email, "pro", "month");

  const admin = await createStaff("admin");
  const adminCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const adminPage = await adminCtx.newPage();
  await login(adminPage, admin.email);
  await expect(adminPage).toHaveURL(/\/admin$/);
  await adminPage.goto("/admin/fitbrother");
  await expectNoHorizontalScroll(adminPage);
  await expect(adminPage.locator("section", { hasText: "Sem número informado" }).getByText(name)).toBeVisible();

  await page.goto("/assinatura");
  await expectNoHorizontalScroll(page);
  await page.getByLabel("Seu WhatsApp com DDD").fill("123");
  await page.getByRole("button", { name: "Salvar número" }).click();
  await expect(page.getByText("Informe o WhatsApp com DDD.")).toBeVisible();
  await page.getByLabel("Seu WhatsApp com DDD").fill("(11) 91234-5678");
  await page.getByRole("button", { name: "Salvar número" }).click();
  await expect(page.getByText("Número salvo.")).toBeVisible();
  await expect(page.getByText(/Você receberá o acesso pelo WhatsApp/)).toBeVisible();

  await adminPage.reload();
  const toGrant = adminPage.locator("li", { hasText: name });
  await expect(toGrant.getByRole("link", { name: "Abrir WhatsApp" })).toHaveAttribute("href", "https://wa.me/5511912345678");
  await toGrant.getByRole("button", { name: "Marcar como liberado" }).click();
  await expect(adminPage.locator("section", { hasText: "Com acesso" }).getByText(name)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Acesso liberado em/)).toBeVisible();

  // Vencida a assinatura, a pessoa aparece para remoção; ninguém é esquecido com acesso.
  await sql(
    `update public.subscriptions set status = 'expired', current_period_end = now() - interval '10 days', grace_until = now() - interval '5 days'
     where profile_id = (select id from auth.users where email = $1)`,
    [email],
  );
  await adminPage.reload();
  const toRevoke = adminPage.locator("section", { hasText: "Para remover" }).locator("li", { hasText: name });
  await toRevoke.getByRole("button", { name: "Marcar como removido" }).click();
  await expect(adminPage.locator("li", { hasText: name })).toHaveCount(0);

  const audit = await sql<{ action: string }>(`select action from public.audit_logs where actor_id = $1 and action like 'fitbrother.%' order by created_at`, [admin.profileId]);
  expect(audit.map((a) => a.action)).toEqual(["fitbrother.grant", "fitbrother.revoke"]);
  await adminCtx.close();
  await ctx.close();
});

test("Basic não vê o pedido de WhatsApp", async ({ page }) => {
  const email = uniqueEmail("basic-fit");
  await student(page, email, "Pessoa Basic");
  await grantPlan(email, "basic", "month");
  await page.goto("/assinatura");
  await expect(page.getByRole("heading", { name: "Seu plano" })).toBeVisible();
  await expect(page.getByLabel("Seu WhatsApp com DDD")).toHaveCount(0);
});

test("conta excluída com acesso ativo segue na fila de remoção, sem nome", async ({ browser }) => {
  const email = uniqueEmail("fit-exclui");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await student(page, email, "Pessoa Exclui");
  await grantPlan(email, "pro", "month");
  const phone = "5521987654321";
  await sql(
    `insert into public.nutrition_access (profile_id, whatsapp, granted_at) select id, $2, now() from auth.users where email = $1`,
    [email, phone],
  );
  await page.goto("/configuracoes");
  await page.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page).toHaveURL(/conta=excluida/);
  await ctx.close();

  const [row] = await sql<{ profile_id: string | null }>(`select profile_id from public.nutrition_access where whatsapp = $1`, [phone]);
  expect(row?.profile_id).toBeNull();

  const admin = await createStaff("admin");
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await login(adminPage, admin.email);
  await expect(adminPage).toHaveURL(/\/admin$/);
  await adminPage.goto("/admin/fitbrother");
  const item = adminPage.locator("section", { hasText: "Para remover" }).locator("li", { hasText: "+55 21 987654321" });
  await expect(item.getByText("Conta excluída")).toBeVisible();
  await item.getByRole("button", { name: "Marcar como removido" }).click();
  await expect(adminPage.getByText("+55 21 987654321")).toHaveCount(0);
  // Removido o acesso, o número não fica guardado.
  await expect.poll(async () => (await sql(`select id from public.nutrition_access where whatsapp = $1`, [phone])).length).toBe(0);
  await adminCtx.close();
});
