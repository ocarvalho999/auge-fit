import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createStaff, grantPlan, login, signUpAndLogin, sql, uniqueEmail } from "./support/helpers";

test("cabeçalhos de segurança e nonce único por resposta", async ({ request }) => {
  const a = await request.get("/");
  const b = await request.get("/");
  const headers = a.headers();
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBeTruthy();
  expect(headers["x-powered-by"]).toBeUndefined();
  const script = headers["content-security-policy"]?.split("; ").find((d) => d.startsWith("script-src"));
  expect(script).toContain("'nonce-");
  expect(script).not.toContain("unsafe-inline");
  expect(headers["content-security-policy"]).not.toBe(b.headers()["content-security-policy"]);
  // O próprio Next aplica o nonce aos scripts da página.
  const nonce = script?.match(/'nonce-([^']+)'/)?.[1];
  expect(await a.text()).toContain(`nonce="${nonce}"`);
});

test("o app funciona sob a CSP: nenhum bloqueio no fluxo do aluno", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|violates/i.test(m.text())) violations.push(m.text());
  });
  const email = uniqueEmail("csp");
  await signUpAndLogin(page, email);
  await grantPlan(email, "basic", "month");
  await sql(`update public.student_profiles set onboarded_at = now(), goal = 'definition' where profile_id = (select id from auth.users where email = $1)`, [email]);
  await page.goto("/evolucao/fotos");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Salvar autorização" }).click();
  await expect(page.getByRole("button", { name: "Enviar foto" })).toBeVisible();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel(/Foto \(JPEG/).setInputFiles({ name: "ok.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Enviar foto" }).click();
  const photo = page.getByRole("img", { name: /Foto de/ });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  for (const p of ["/inicio", "/treinos", "/evolucao", "/checkins", "/assinatura", "/configuracoes", "/"]) {
    await page.goto(p);
    await expect(page.locator("h1").first()).toBeVisible();
  }
  expect(violations).toEqual([]);
});

test("sessão em cookie protegido", async ({ page, context }) => {
  const email = uniqueEmail("cookie");
  await signUpAndLogin(page, email);
  const session = (await context.cookies()).filter((c) => c.name.includes("auth-token"));
  expect(session.length).toBeGreaterThan(0);
  for (const c of session) {
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("Lax");
  }
  expect(await page.evaluate(() => document.cookie)).not.toContain("auth-token");
});

test("nenhum segredo no JavaScript enviado ao navegador", () => {
  const dir = path.join(process.cwd(), ".next-e2e", "static");
  expect(existsSync(dir)).toBe(true);
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = path.join(d, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const files = walk(dir);
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const text = readFileSync(f, "latin1");
    for (const secret of ["e2e-service-key", "e2e-webhook-secret", "e2e-cron-secret", "e2e-token", "SUPABASE_SERVICE_ROLE_KEY", "MERCADOPAGO_ACCESS_TOKEN"]) {
      expect(text.includes(secret), `${secret} em ${f}`).toBe(false);
    }
  }
});

test("login: erro genérico e limite de uso; recuperação não revela se o e-mail existe", async ({ page }) => {
  const email = uniqueEmail("limite");
  await signUpAndLogin(page, email);
  await page.context().clearCookies();
  const generic = "E-mail ou senha incorretos, ou e-mail ainda não confirmado.";

  await login(page, email, "senha-errada");
  await expect(page.getByText(generic)).toBeVisible();
  await login(page, uniqueEmail("nao-existe"), "senha-errada");
  await expect(page.getByText(generic)).toBeVisible();

  await sql(`delete from public.rate_limits`);
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-errada");
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(generic)).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  }
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/Muitas tentativas/)).toBeVisible();

  await sql(`delete from public.rate_limits`);
  const sent = "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.";
  for (const target of [email, uniqueEmail("nao-existe")]) {
    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail").fill(target);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText(sent)).toBeVisible();
  }
});

test("cadastro com e-mail já usado não revela que ele existe", async ({ page }) => {
  const email = uniqueEmail("repetido");
  await signUpAndLogin(page, email);
  await page.context().clearCookies();
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Outra Pessoa");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("outra-senha-123");
  await page.getByLabel("Data de nascimento").fill("1992-02-02");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/cadastro\/confirme/);
});

test("menor de 18 anos é barrado na tela", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Menor de Idade");
  await page.getByLabel("E-mail").fill(uniqueEmail("menor"));
  await page.getByLabel("Senha").fill("senha-de-teste-1");
  await page.getByLabel("Data de nascimento").fill(`${new Date().getUTCFullYear() - 16}-01-01`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("O Auge Fit é para maiores de 18 anos.")).toBeVisible();
  // O digitado continua no formulário.
  await expect(page.getByLabel("Nome")).toHaveValue("Menor de Idade");
});

test("exportação traz só os dados de quem pediu, mesmo para o profissional", async ({ browser }) => {
  const pro = await createStaff("professional");
  const studentCtx = await browser.newContext();
  const studentPage = await studentCtx.newPage();
  const studentEmail = uniqueEmail("exporta");
  await signUpAndLogin(studentPage, studentEmail);
  await studentCtx.close();
  const [student] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [studentEmail]);
  await sql(`insert into public.professional_students (professional_id, student_id, ends_at) values ($1, $2, now() + interval '30 days')`, [pro.professionalId, student!.id]);
  await sql(
    `with l as (insert into public.workout_logs (student_id, workout_name) values ($1, 'Sessão') returning id),
          e as (insert into public.exercises (name, muscle_group, reviewed_by, published) values ('Exercício export', 'Teste', $2, true) returning id)
     insert into public.set_logs (workout_log_id, exercise_id, set_number, weight_kg, reps, client_uuid)
     select l.id, e.id, 1, 50, 5, gen_random_uuid() from l, e`,
    [student!.id, pro.professionalId],
  );

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, pro.email);
  await expect(page).toHaveURL(/profissional/);
  const body = (await (await page.request.get("/api/account/export")).json()) as { set_logs: unknown[]; workout_logs: unknown[]; email: string };
  expect(body.email).toBe(pro.email);
  expect(body.set_logs).toEqual([]);
  expect(body.workout_logs).toEqual([]);
  await ctx.close();
});

test("conta suspensa não entra nem registra", async ({ page }) => {
  const email = uniqueEmail("suspensa");
  await signUpAndLogin(page, email);
  await sql(`update public.profiles set status = 'suspended' where id = (select id from auth.users where email = $1)`, [email]);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/suspensa=1/);
  await expect(page.getByText("Esta conta está suspensa.")).toBeVisible();
});

test("redirecionamento aberto é recusado", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=invalido&type=signup&next=//evil.example");
  expect(new URL(page.url()).host).toBe("localhost:3100");
});
