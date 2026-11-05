import { expect, test } from "@playwright/test";
import { createStaff, expectNoHorizontalScroll, login, signUpAndLogin, sql, tokenFor, uniqueEmail } from "./support/helpers";

test("convite de profissional: CREF conferido, senha criada, painel aberto, sem privilégio pelo cadastro público", async ({ browser }) => {
  const admin = await createStaff("admin");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await login(page, admin.email);
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/admin/profissionais");
  const email = uniqueEmail("convidado");
  await page.getByLabel("Nome completo").fill("Profissional Convidado");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Número do CREF").fill("123456-G");
  await page.getByLabel("UF").fill("rj");
  await page.getByRole("button", { name: "Enviar convite", exact: true }).click();
  await expect(page.getByText("Confira o CREF antes de convidar.")).toBeVisible();
  // Erro de validação não pode apagar o que a pessoa digitou.
  await expect(page.getByLabel("Número do CREF")).toHaveValue("123456-G");
  await page.getByLabel("Conferi manualmente").check();
  await page.getByRole("button", { name: "Enviar convite", exact: true }).click();
  // Sem Resend no ambiente de teste: o sistema não pode fingir que enviou.
  await expect(page.getByText(/o e-mail não foi enviado/)).toBeVisible();
  await expect(page.getByText("CREF 123456-G/RJ")).toBeVisible();
  await expectNoHorizontalScroll(page);

  const proCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const proPage = await proCtx.newPage();
  const token = await tokenFor(email, "recovery");
  await proPage.goto(`/auth/confirm?token_hash=${token}&type=recovery&next=/recuperar-senha/nova`);
  await proPage.getByLabel("Nova senha").fill("senha-do-profissional");
  await proPage.getByLabel("Repita a senha").fill("senha-do-profissional");
  await proPage.getByRole("button", { name: "Salvar senha" }).click();
  await expect(proPage).toHaveURL(/\/profissional$/);
  await expect(proPage.getByRole("heading", { name: "Pendências" })).toBeVisible();
  await proPage.goto("/admin");
  await expect(proPage).toHaveURL(/\/profissional$/);

  const audit = await sql(`select id from public.audit_logs where action = 'professional.invite' and actor_id = $1`, [admin.profileId]);
  expect(audit.length).toBe(1);
  await proCtx.close();
  await ctx.close();
});

test("admin é barrado em prescrição e fotos", async ({ browser }) => {
  const admin = await createStaff("admin");
  const pro = await createStaff("professional");

  const studentCtx = await browser.newContext();
  const studentPage = await studentCtx.newPage();
  const studentEmail = uniqueEmail("alvo-admin");
  await signUpAndLogin(studentPage, studentEmail);
  await studentCtx.close();
  const [student] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [studentEmail]);
  await sql(`insert into public.progress_photos (profile_id, storage_path, pose, taken_on) values ($1, $2, 'front', current_date)`, [student!.id, `${student!.id}/x.webp`]);
  await sql(`insert into storage.objects (bucket_id, name) values ('progress-photos', $1)`, [`${student!.id}/x.webp`]);
  const [plan] = await sql<{ id: string }>(
    `insert into public.workout_plans (kind, name, student_id, author_professional_id, status) values ('prescribed', 'Prescrição alheia', $1, $2, 'published') returning id`,
    [student!.id, pro.professionalId],
  );

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, admin.email);
  await expect(page).toHaveURL(/\/admin$/);

  // As telas de prescrição e de fotos não abrem para o admin.
  for (const path of [`/profissional/planos/${plan!.id}`, `/profissional/alunos/${student!.id}`, "/profissional/programas", "/evolucao/fotos", "/treinos/novo"]) {
    await page.goto(path);
    await expect(page, `admin em ${path}`).toHaveURL(/\/admin$/);
  }
  // O painel não oferece nada de prescrição nem de fotos.
  for (const path of ["/admin", "/admin/usuarios", "/admin/profissionais", "/admin/vinculos", "/admin/planos", "/admin/cupons", "/admin/exercicios", "/admin/auditoria"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("img", { name: /Foto/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Criar planejamento|Prescrever/ })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  }

  // Mesmo com o token do admin, a API do banco recusa: é a terceira camada.
  const cookies = await ctx.cookies();
  const session = cookies.filter((c) => c.name.includes("auth-token")).sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.value).join("");
  const raw = session.startsWith("base64-") ? Buffer.from(session.slice(7), "base64url").toString() : decodeURIComponent(session);
  const token = (JSON.parse(raw) as { access_token: string }).access_token;
  const headers = { apikey: "e2e-anon-key", authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation" };
  const api = "http://127.0.0.1:54399";

  const photos = await fetch(`${api}/rest/v1/progress_photos?select=id`, { headers });
  expect(await photos.json()).toEqual([]);
  const signed = await fetch(`${api}/storage/v1/object/sign/progress-photos/${student!.id}/x.webp`, {
    method: "POST", headers, body: JSON.stringify({ expiresIn: 60 }),
  });
  expect(signed.ok).toBe(false);
  const create = await fetch(`${api}/rest/v1/workout_plans`, {
    method: "POST", headers,
    body: JSON.stringify({ kind: "prescribed", name: "Tentativa do admin", student_id: student!.id, author_professional_id: pro.professionalId }),
  });
  expect(create.ok).toBe(false);
  const edit = await fetch(`${api}/rest/v1/workout_plans?id=eq.${plan!.id}`, { method: "PATCH", headers, body: JSON.stringify({ name: "Alterado" }) });
  expect(await edit.json()).toEqual([]);
  const [after] = await sql<{ name: string }>(`select name from public.workout_plans where id = $1`, [plan!.id]);
  expect(after?.name).toBe("Prescrição alheia");
  await ctx.close();
});

test("preço editado vale na landing; cupom, exercício e vínculo do Black pelo painel", async ({ browser }) => {
  const admin = await createStaff("admin");
  const pro = await createStaff("professional");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, admin.email);
  await expect(page).toHaveURL(/\/admin$/);

  // Preço: muda no painel, aparece na landing, e volta.
  await page.goto("/admin/planos");
  const field = page.getByLabel("Valor em reais por 8 semanas");
  await field.fill("701,50");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Salvar preço" }).click();
  await expect(page.getByText("Preço salvo.")).toBeVisible();
  const anon = await browser.newContext();
  const landing = await anon.newPage();
  await landing.goto("/");
  await expect(landing.getByText("R$ 701,50")).toBeVisible();
  await sql(`update public.plan_prices set amount_cents = 69700 where interval = 'package'`);
  await anon.close();

  // Cupom.
  await page.goto("/admin/cupons");
  const code = `E2E${Date.now()}`;
  await page.getByLabel("Código").fill(code);
  await page.getByLabel("Desconto (%)").fill("10");
  await page.getByLabel("Campanha").fill("video-01");
  await page.getByLabel("Limite de usos").fill("5");
  await page.getByRole("button", { name: "Criar cupom" }).click();
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByText(/10% · video-01 · 0 de 5 uso/)).toBeVisible();

  // Exercício: sem revisão não há botão de publicar.
  await page.goto("/admin/exercicios");
  const name = `Exercício ${Date.now()}`;
  await page.getByLabel("Nome do exercício").fill(name);
  await page.getByLabel("Grupo muscular").fill("Teste");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  const card = page.locator("section", { hasText: name });
  await expect(card.getByText("Aguardando revisão")).toBeVisible();
  await expect(card.getByRole("button", { name: "Publicar" })).toHaveCount(0);

  const proCtx = await browser.newContext();
  const proPage = await proCtx.newPage();
  await login(proPage, pro.email);
  await expect(proPage).toHaveURL(/\/profissional$/);
  await proPage.goto("/profissional/exercicios");
  const proCard = proPage.locator("section", { hasText: name });
  await proCard.getByLabel(`Instruções de ${name}`).fill("Conteúdo de teste automatizado, revisado.");
  await proCard.getByRole("button", { name: "Registrar revisão" }).click();
  await expect(proCard.getByText(/Revisão registrada/)).toBeVisible();
  await proCtx.close();

  await page.reload();
  await card.getByRole("button", { name: "Publicar" }).click();
  await expect(card.getByText("Publicado")).toBeVisible();

  // Vínculo do Black: as 8 semanas começam aqui.
  const studentEmail = uniqueEmail("black-admin");
  const sCtx = await browser.newContext();
  await signUpAndLogin(await sCtx.newPage(), studentEmail);
  await sCtx.close();
  await sql(
    `insert into public.subscriptions (profile_id, plan_price_id, status, expected_amount_cents)
     select u.id, pp.id, 'active', pp.amount_cents from auth.users u, public.plan_prices pp
     where u.email = $1 and pp.interval = 'package'`,
    [studentEmail],
  );
  await page.goto("/admin/vinculos");
  const pending = page.locator("li", { hasText: "Pessoa de Teste" }).filter({ hasText: "Compra em" }).first();
  await pending.getByLabel("Profissional").selectOption({ value: pro.professionalId! });
  await pending.getByRole("button", { name: "Criar vínculo" }).click();
  await expect
    .poll(async () => (await sql(`select ps.id from public.professional_students ps join auth.users u on u.id = ps.student_id where u.email = $1`, [studentEmail])).length)
    .toBe(1);
  const [sub] = await sql<{ days: string; status: string }>(
    `select round(extract(epoch from s.current_period_end - now()) / 86400) as days, ps.status
     from public.subscriptions s join public.professional_students ps on ps.subscription_id = s.id
     join auth.users u on u.id = s.profile_id where u.email = $1`,
    [studentEmail],
  );
  expect(Number(sub?.days)).toBe(56);
  expect(sub?.status).toBe("active");
  await ctx.close();
});
