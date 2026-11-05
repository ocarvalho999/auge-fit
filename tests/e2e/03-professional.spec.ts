import { expect, test } from "@playwright/test";
import { createStaff, expectNoHorizontalScroll, grantPlan, login, signUpAndLogin, sql, uniqueEmail } from "./support/helpers";

/** Aluno Black já com onboarding feito, criado pela tela de cadastro. */
async function createBlackStudent(page: import("@playwright/test").Page, email: string) {
  await signUpAndLogin(page, email);
  await grantPlan(email, "black", "package");
  await sql(`update public.student_profiles set onboarded_at = now(), goal = 'hypertrophy'
             where profile_id = (select id from auth.users where email = $1)`, [email]);
  const [row] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [email]);
  return row!.id;
}

async function linkStudent(professionalId: string, studentId: string) {
  const [row] = await sql<{ id: string }>(
    `insert into public.professional_students (professional_id, student_id, ends_at)
     values ($1, $2, now() + interval '56 days') returning id`,
    [professionalId, studentId],
  );
  return row!.id;
}

/** O status pode ser 200 por causa do streaming do loading.tsx; o que importa é nenhum dado do aluno sair na resposta. */
async function expectStudentHidden(page: import("@playwright/test").Page, studentId: string) {
  const response = await page.goto(`/profissional/alunos/${studentId}`);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  const html = (await response?.text()) ?? "";
  expect(html).not.toContain("Pessoa de Teste");
  await expect(page.getByText("Pessoa de Teste")).toHaveCount(0);
}

test("check-in com feedback e planejamento visível com CREF", async ({ browser }) => {
  const pro = await createStaff("professional");
  const studentEmail = uniqueEmail("black");
  const studentCtx = await browser.newContext();
  const studentPage = await studentCtx.newPage();
  const studentId = await createBlackStudent(studentPage, studentEmail);
  await linkStudent(pro.professionalId!, studentId);
  await sql(`insert into public.exercises (name, muscle_group, instructions, reviewed_by, published)
             values ('Exercício Prescrito', 'Teste', 'Conteúdo de teste automatizado.', $1, true)`, [pro.professionalId]);

  const proCtx = await browser.newContext();
  const proPage = await proCtx.newPage();
  await login(proPage, pro.email);
  await expect(proPage).toHaveURL(/profissional/);
  await proPage.getByRole("link", { name: "Alunos" }).first().click();
  await proPage.getByRole("link", { name: /Pessoa de Teste/ }).click();
  await expectNoHorizontalScroll(proPage);

  // Planejamento individual.
  await proPage.getByLabel("Novo planejamento").fill("Planejamento E2E");
  await proPage.getByRole("button", { name: "Criar planejamento" }).click();
  await expect(proPage.getByRole("heading", { name: "Planejamento E2E" })).toBeVisible();
  await proPage.getByLabel("Nome", { exact: true }).fill("Treino A");
  await proPage.getByRole("button", { name: "Adicionar dia" }).click();
  await expect(proPage.getByRole("heading", { name: "Treino A" })).toBeVisible();
  await proPage.getByLabel("Exercício", { exact: true }).selectOption({ label: "Exercício Prescrito (Teste)" });
  await proPage.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(proPage.getByText("3 série(s)")).toBeVisible();

  // Rascunho não aparece para o aluno.
  await studentPage.goto("/treinos");
  await expect(studentPage.getByRole("link", { name: /Planejamento E2E/ })).toHaveCount(0);
  await proPage.getByRole("button", { name: "Publicar" }).click();
  await expect(proPage.getByRole("button", { name: "Voltar para rascunho" })).toBeVisible();
  await studentPage.reload();
  await studentPage.getByRole("link", { name: /Planejamento E2E/ }).click();
  await expect(studentPage.getByText(/CREF 000000-G\/SP/)).toBeVisible();

  // Check-in: profissional abre, aluno responde, profissional dá feedback, aluno lê.
  await proPage.goto(`/profissional/alunos/${studentId}`);
  await proPage.getByLabel("Responder até").fill("2030-01-15");
  await proPage.getByRole("button", { name: "Abrir check-in" }).click();
  await expect(proPage.getByText("Check-in aberto.")).toBeVisible();

  await studentPage.goto("/checkins");
  await studentPage.getByLabel("Como foram os treinos da semana?").selectOption("most");
  await studentPage.getByLabel("Energia (1 a 5)").fill("4");
  await studentPage.getByLabel("Sono (1 a 5)").fill("3");
  await studentPage.getByRole("button", { name: "Enviar check-in" }).click();
  await expect(studentPage.getByText("Aguardando feedback.")).toBeVisible();

  await proPage.goto("/profissional");
  await proPage.getByRole("link", { name: /Pessoa de Teste/ }).click();
  await expect(proPage.getByText("Fez a maioria")).toBeVisible();
  await proPage.getByLabel("Feedback para o aluno").fill("Mensagem de teste automatizado.");
  await proPage.getByRole("button", { name: "Publicar feedback" }).click();
  await expect(proPage).toHaveURL(/\/profissional$/);

  await studentPage.reload();
  await expect(studentPage.getByTestId("feedback")).toContainText("Mensagem de teste automatizado.");
  await studentCtx.close();
  await proCtx.close();
});

test("profissional sem vínculo não acessa nada do aluno; vínculo encerrado corta na hora", async ({ browser }) => {
  const linked = await createStaff("professional");
  const outsider = await createStaff("professional");
  const studentCtx = await browser.newContext();
  const studentPage = await studentCtx.newPage();
  const studentId = await createBlackStudent(studentPage, uniqueEmail("alvo"));
  const linkId = await linkStudent(linked.professionalId!, studentId);
  await studentCtx.close();

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, outsider.email);
  await expect(page).toHaveURL(/profissional/);
  await expectStudentHidden(page, studentId);
  await page.goto("/profissional/alunos");
  await expect(page.getByText("Nenhum aluno vinculado")).toBeVisible();
  // Perfil de profissional não entra na área de aluno.
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/profissional$/);
  await ctx.close();

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await login(page2, linked.email);
  await expect(page2).toHaveURL(/profissional/);
  await page2.goto(`/profissional/alunos/${studentId}`);
  await expect(page2.getByRole("heading", { name: "Pessoa de Teste" })).toBeVisible();
  await expect(page2.getByText("O aluno não autorizou o acesso às fotos.")).toBeVisible();
  await sql(`update public.professional_students set status = 'ended', ends_at = now() where id = $1`, [linkId]);
  await expectStudentHidden(page2, studentId);
  await ctx2.close();
});

test("acesso de profissional às fotos fica na auditoria", async ({ browser }) => {
  const pro = await createStaff("professional");
  const studentCtx = await browser.newContext();
  const studentPage = await studentCtx.newPage();
  const studentId = await createBlackStudent(studentPage, uniqueEmail("foto"));
  await linkStudent(pro.professionalId!, studentId);

  await studentPage.goto("/evolucao/fotos");
  await studentPage.getByRole("checkbox").first().check();
  await studentPage.getByRole("button", { name: "Salvar autorização" }).first().click();
  await expect(studentPage.getByRole("button", { name: "Enviar foto" })).toBeVisible();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
    "base64",
  );
  await studentPage.getByLabel(/Foto \(JPEG/).setInputFiles({ name: "ok.png", mimeType: "image/png", buffer: png });
  await studentPage.getByRole("button", { name: "Enviar foto" }).click();
  await expect(studentPage.getByText("Foto enviada.")).toBeVisible();
  await expect(studentPage.getByRole("img", { name: /Foto de/ })).toBeVisible();
  await studentPage.getByRole("checkbox").first().check();
  await studentPage.getByRole("button", { name: "Salvar autorização" }).click();
  await expect(studentPage.getByText("Permitir que meu profissional veja minhas fotos")).toBeVisible();
  await studentPage.getByRole("checkbox").first().check();
  await studentPage.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(studentPage.getByText("Profissional autorizado a ver suas fotos.")).toBeVisible();
  await studentCtx.close();

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, pro.email);
  await expect(page).toHaveURL(/profissional/);
  await page.goto(`/profissional/alunos/${studentId}`);
  const photo = page.getByRole("img", { name: /Foto de/ });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const logs = await sql(`select id from public.audit_logs where action = 'photos.view' and entity_id = $1 and actor_id = $2`, [studentId, pro.profileId]);
  expect(logs.length).toBeGreaterThan(0);
  await ctx.close();
});
