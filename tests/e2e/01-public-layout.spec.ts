import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./support/helpers";

const PAGES = ["/", "/termos", "/privacidade", "/login", "/cadastro", "/cadastro/confirme", "/recuperar-senha", "/recuperar-senha/nova"];

for (const viewport of [
  { name: "375 px", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test.describe(`telas públicas em ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    for (const path of PAGES) {
      test(`${path} sem rolagem horizontal`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        await expectNoHorizontalScroll(page);
      });
    }
  });
}

test("landing mostra preços do banco, garantia e Pro em breve", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: ".tmp/shots/landing.png", fullPage: true });
  await expect(page.getByText("R$ 39,90")).toBeVisible();
  await expect(page.getByText("R$ 697,00")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Garantia de 7 dias" })).toBeVisible();
  // Sem 3 programas revisados publicados, o Pro não pode ser vendido.
  await expect(page.getByText("Em breve")).toBeVisible();
  await expect(page.getByRole("link", { name: "Assinar Pro" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Assinar Basic" })).toBeVisible();
});

test("documentos legais estão marcados como rascunho", async ({ page }) => {
  for (const path of ["/termos", "/privacidade"]) {
    await page.goto(path);
    await expect(page.getByText("Rascunho pendente de revisão jurídica.")).toBeVisible();
  }
});

test("manifesto da PWA é servido", async ({ request }) => {
  const r = await request.get("/manifest.webmanifest");
  expect(r.ok()).toBe(true);
  expect((await r.json()).name).toBe("Auge Fit");
});

test("área logada redireciona para o login", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/login/);
});
