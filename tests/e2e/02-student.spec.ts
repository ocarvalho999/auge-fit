import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, grantPlan, signUpAndLogin, sql, uniqueEmail } from "./support/helpers";

const EXERCISE = "Exercício E2E";

test.beforeAll(async () => {
  // Fixture de teste: profissional verificado e exercício revisado, porque o seed não cria dados falsos.
  await sql(`
    do $$
    declare v_user uuid := gen_random_uuid(); v_pro uuid;
    begin
      if not exists (select 1 from public.exercises where name = '${EXERCISE}') then
        insert into public.staff_invites (email) values ('revisor-' || v_user || '@teste.invalid');
        insert into auth.users (id, email, raw_user_meta_data)
        values (v_user, 'revisor-' || v_user || '@teste.invalid', '{"full_name": "Revisor E2E"}');
        update public.profiles set role = 'professional' where id = v_user;
        insert into public.professionals (profile_id, cref_number, cref_uf, cref_verified_at, status)
        values (v_user, '000001-G', 'SP', now(), 'active') returning id into v_pro;
        insert into public.exercises (name, muscle_group, instructions, reviewed_by, published)
        values ('${EXERCISE}', 'Teste', 'Conteúdo de teste automatizado.', v_pro, true);
      end if;
    end $$;`);
});

async function onboard(page: import("@playwright/test").Page) {
  await page.getByLabel("Seu objetivo principal").selectOption("hypertrophy");
  await page.getByLabel("Sua experiência com treino").selectOption("beginner");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Passo 2 de 3")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Salvar autorização" }).click();
  await expect(page.getByText("Consentimento registrado.")).toBeVisible();
  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(page.getByText("Passo 3 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Ir para o primeiro treino" }).click();
  // Espera sair do onboarding: navegar antes disso disputa com o redirecionamento da ação.
  await expect(page).not.toHaveURL(/onboarding/);
}

test("cadastro, onboarding, primeiro treino, reenvio sem duplicar, gráfico", async ({ page, context }) => {
  const email = uniqueEmail("aluno");
  await signUpAndLogin(page, email);
  await grantPlan(email, "basic", "month");
  await onboard(page);

  // Monta o treino.
  await expect(page).toHaveURL(/treinos\/novo/);
  await page.getByLabel("Nome do treino").fill("Minha rotina");
  await page.getByRole("button", { name: "Criar e adicionar exercícios" }).click();
  await expect(page.getByRole("heading", { name: "Minha rotina" })).toBeVisible();
  await page.getByLabel("Exercício", { exact: true }).selectOption({ label: `${EXERCISE} (Teste)` });
  await page.getByLabel("Séries").fill("2");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("2 série(s)")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Executa: dois toques por série são suficientes depois do primeiro preenchimento.
  await page.getByRole("link", { name: "Iniciar treino" }).click();
  await expect(page.getByText("Primeira vez neste exercício.")).toBeVisible();
  await page.getByRole("textbox", { name: "Carga" }).fill("40");
  await page.getByRole("textbox", { name: "Repetições" }).fill("10");
  await page.getByRole("button", { name: "Confirmar série" }).click();
  await expect(page.getByText("Série 1: 40 kg × 10")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: ".tmp/shots/registro.png", fullPage: true });

  // Sem conexão: a série fica guardada e nada se perde.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Aumentar Carga" }).click();
  await page.getByRole("button", { name: "Confirmar série" }).click();
  await expect(page.getByText("Série 2: 42.5 kg × 10")).toBeVisible();
  await expect(page.getByText(/guardado\(s\) neste aparelho/)).toBeVisible();
  const logsOffline = await sql<{ n: string }>(
    `select count(*) as n from public.set_logs s join public.workout_logs l on l.id = s.workout_log_id
     join auth.users u on u.id = l.student_id where u.email = $1`,
    [email],
  );
  expect(Number(logsOffline[0]?.n)).toBe(1);

  // Conexão volta: reenvia sozinho.
  await context.setOffline(false);
  await expect(page.getByText(/guardado\(s\) neste aparelho/)).toHaveCount(0, { timeout: 30_000 });
  const count = async () =>
    Number(
      (
        await sql<{ n: string }>(
          `select count(*) as n from public.set_logs s join public.workout_logs l on l.id = s.workout_log_id
           join auth.users u on u.id = l.student_id where u.email = $1`,
          [email],
        )
      )[0]?.n,
    );
  expect(await count()).toBe(2);

  // Reenvio do mesmo client_uuid não duplica.
  const [row] = await sql<{ client_uuid: string; exercise_id: string; id: string; started_at: string; workout_id: string }>(
    `select s.client_uuid, s.exercise_id, l.id, l.started_at, l.workout_id
     from public.set_logs s join public.workout_logs l on l.id = s.workout_log_id
     join auth.users u on u.id = l.student_id where u.email = $1 order by s.logged_at limit 1`,
    [email],
  );
  const status = await page.evaluate(async (r) => {
    const res = await fetch("/api/workouts/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        log: { id: r.id, workout_id: r.workout_id, workout_name: "Treino A", started_at: new Date(r.started_at).toISOString(), finished_at: null },
        sets: [{ client_uuid: r.client_uuid, exercise_id: r.exercise_id, set_number: 1, weight_kg: 40, reps: 10 }],
      }),
    });
    return res.status;
  }, row!);
  expect(status).toBe(200);
  expect(await count()).toBe(2);

  // Conclui e vê no gráfico.
  await page.getByRole("button", { name: "Concluir treino" }).click();
  await expect(page).toHaveURL(/evolucao/);
  await expect(page.getByTestId("grafico-Carga")).toBeVisible();
  // Com um só dia o gráfico mostra um ponto; com um dia anterior, precisa desenhar a linha.
  await expect(page.getByTestId("grafico-Carga").locator(".recharts-dot").first()).toBeAttached();
  await sql(
    `with l as (
       insert into public.workout_logs (student_id, workout_name, started_at, finished_at)
       select id, 'Sessão anterior', now() - interval '3 days', now() - interval '3 days' from auth.users where email = $1
       returning id)
     insert into public.set_logs (workout_log_id, exercise_id, set_number, weight_kg, reps, client_uuid, logged_at)
     select l.id, e.id, 1, 35, 10, gen_random_uuid(), now() - interval '3 days'
     from l, public.exercises e where e.name = $2`,
    [email, EXERCISE],
  );
  await page.reload();
  await expect(page.getByTestId("grafico-Carga").locator("path.recharts-line-curve")).toBeAttached();
  await page.screenshot({ path: ".tmp/shots/evolucao.png", fullPage: true });
  await expect(page.getByTestId("grafico-Volume")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Na próxima sessão, a carga anterior aparece.
  await page.goto("/inicio");
  await page.screenshot({ path: ".tmp/shots/inicio.png", fullPage: true });
  await page.getByRole("link", { name: "Iniciar treino" }).click();
  await expect(page.getByTestId("carga-anterior")).toContainText("40 kg × 10");
});

test("medidas, fotos sem metadados e configurações", async ({ page }) => {
  const email = uniqueEmail("medidas");
  await signUpAndLogin(page, email);
  await grantPlan(email, "basic", "month");
  await onboard(page);

  await page.goto("/evolucao");
  await page.getByText("Registrar medidas").click();
  await page.getByLabel("Peso (kg)").fill("80,5");
  await page.getByRole("button", { name: "Salvar medidas" }).click();
  await expect(page.getByTestId("grafico-Peso")).toBeVisible();

  await page.goto("/evolucao/fotos");
  await expect(page.getByRole("heading", { name: "Fotos de progresso" })).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Salvar autorização" }).click();
  await expect(page.getByRole("button", { name: "Enviar foto" })).toBeVisible();

  // Arquivo que finge ser imagem é recusado pelo conteúdo, não pela extensão.
  await page.getByLabel(/Foto \(JPEG/).setInputFiles({ name: "falsa.png", mimeType: "image/png", buffer: Buffer.from("isto não é imagem") });
  await page.getByRole("button", { name: "Enviar foto" }).click();
  await expect(page.getByText("Envie uma imagem JPEG, PNG ou WebP válida.")).toBeVisible();

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel(/Foto \(JPEG/).setInputFiles({ name: "ok.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Enviar foto" }).click();
  await expect(page.getByText("Foto enviada.")).toBeVisible();
  const stored = await sql<{ name: string; content_type: string }>(
    `select o.name, o.content_type from storage.objects o join auth.users u on o.name like u.id::text || '/%' where u.email = $1`,
    [email],
  );
  expect(stored[0]?.name).toMatch(/\.webp$/);
  expect(stored[0]?.content_type).toBe("image/webp");

  await page.goto("/configuracoes");
  await expectNoHorizontalScroll(page);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar meus dados" }).click();
  expect((await download).suggestedFilename()).toBe("auge-fit-meus-dados.json");

  await page.goto("/treinos");
  await expectNoHorizontalScroll(page);
  await page.goto("/treinos/biblioteca");
  await expect(page.getByText(EXERCISE).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.goto("/checkins");
  await expect(page.getByText("Conhecer o Black")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("sem assinatura: lê, mas não registra", async ({ page }) => {
  const email = uniqueEmail("semplano");
  await signUpAndLogin(page, email);
  await onboard(page);
  await expect(page).toHaveURL(/assinatura/);
  await page.goto("/inicio");
  await expect(page.getByText("Você ainda não tem um plano ativo")).toBeVisible();
  await page.goto("/treinos/novo");
  await expect(page.getByText("Montar treinos exige um plano ativo.")).toBeVisible();
});

test("excluir conta apaga dados e arquivos", async ({ page }) => {
  const email = uniqueEmail("excluir");
  await signUpAndLogin(page, email);
  await grantPlan(email, "basic", "month");
  await onboard(page);
  await page.goto("/evolucao/fotos");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Salvar autorização" }).click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel(/Foto \(JPEG/).setInputFiles({ name: "ok.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Enviar foto" }).click();
  await expect(page.getByText("Foto enviada.")).toBeVisible();
  const [{ id } = { id: "" }] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [email]);

  await page.goto("/configuracoes");
  await page.getByLabel("Digite EXCLUIR para confirmar").fill("errado");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page.getByText("Digite EXCLUIR para confirmar.")).toBeVisible();
  await page.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page).toHaveURL(/conta=excluida/);

  expect(await sql(`select id from auth.users where id = $1`, [id])).toEqual([]);
  expect(await sql(`select id from public.profiles where id = $1`, [id])).toEqual([]);
  expect(await sql(`select name from storage.objects where name like $1`, [`${id}/%`])).toEqual([]);
});
