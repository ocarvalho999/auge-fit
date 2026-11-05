import { expect, type Page } from "@playwright/test";

const FAKE = "http://127.0.0.1:54399";

export async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const r = await fetch(`${FAKE}/__test/sql`, { method: "POST", body: JSON.stringify({ sql: query, params }) });
  if (!r.ok) throw new Error(`SQL falhou: ${await r.text()}`);
  return (await r.json()) as T[];
}

export async function tokenFor(email: string, type: string): Promise<string> {
  const r = await fetch(`${FAKE}/__test/link?email=${encodeURIComponent(email)}&type=${type}`);
  const { token } = (await r.json()) as { token: string | null };
  if (!token) throw new Error(`Sem link para ${email}`);
  return token;
}

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.invalid`;

/** Rolagem horizontal é a régua da fase 3: a página não pode ser mais larga que a tela. */
export async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `largura da página em ${page.url()}`).toBeLessThanOrEqual(client);
}

/** Cadastro real pela tela, confirmação pelo link e login. */
export async function signUpAndLogin(page: Page, email: string, password = "senha-de-teste-1") {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa de Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByLabel("Data de nascimento").fill("1990-05-10");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/cadastro\/confirme/);

  const token = await tokenFor(email, "signup");
  await page.goto(`/auth/confirm?token_hash=${token}&type=signup&next=/onboarding`);
  await expect(page).toHaveURL(/onboarding/);
}

export async function login(page: Page, email: string, password = "senha-de-teste-1") {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function grantPlan(email: string, code: "basic" | "pro" | "black", interval: string) {
  await sql(
    `insert into public.subscriptions (profile_id, plan_price_id, status, expected_amount_cents, current_period_end, grace_until)
     select u.id, pp.id, 'active', pp.amount_cents, now() + interval '30 days', now() + interval '35 days'
     from auth.users u, public.plan_prices pp join public.plans p on p.id = pp.plan_id
     where u.email = $1 and p.code = $2 and pp.interval = $3`,
    [email, code, interval],
  );
}

const SERVICE = "e2e-service-key";

/** Cria profissional ou admin pela API de administração, como o servidor faria. Só para testes. */
export async function createStaff(role: "professional" | "admin", password = "senha-de-teste-1") {
  const email = uniqueEmail(role);
  const r = await fetch(`${FAKE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { invited: true }, user_metadata: { full_name: `${role} de teste` } }),
  });
  if (!r.ok) throw new Error(`Falha ao criar ${role}: ${await r.text()}`);
  const { id } = (await r.json()) as { id: string };
  await sql(`update public.profiles set role = $2 where id = $1`, [id, role]);
  let professionalId: string | null = null;
  if (role === "professional") {
    const [p] = await sql<{ id: string }>(
      `insert into public.professionals (profile_id, cref_number, cref_uf, cref_verified_at, status)
       values ($1, '000000-G', 'SP', now(), 'active') returning id`,
      [id],
    );
    professionalId = p!.id;
  }
  return { email, profileId: id, professionalId };
}
