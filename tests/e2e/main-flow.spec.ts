import { expect, test, type Page } from "@playwright/test";

const OWNER = { name: "Owner Test", email: "owner@example.com", password: "a-strong-password-123" };
const EXAMPLE_TXT = "context/reference/02_EXEMPLO_CAMPANHA_IMPORTAVEL.txt";
const PERSONA_MD = "context/reference/brands/cool-season/Guia_Persona_Cool_Season_para_IA.md";
const VIDEO = "tests/e2e/fixtures/test-video.mp4";

test.describe.configure({ mode: "serial" });

// Better Auth rate-limits sign-in (3 per 10 s in production), so we log in once and reuse the cookies.
let sessionCookies: Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>> | null = null;

async function login(page: Page) {
  if (sessionCookies) {
    await page.context().addCookies(sessionCookies);
    return;
  }
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(OWNER.email);
  await page.getByLabel("Senha").fill(OWNER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  sessionCookies = await page.context().cookies();
}

test("first access creates the owner and asks for a brand", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login|\/setup/);
  await page.goto("/setup");
  await page.getByLabel("Nome").fill(OWNER.name);
  await page.getByLabel("E-mail").fill(OWNER.email);
  await page.getByLabel(/Senha/).fill(OWNER.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/brands\?new=1/);
  await expect(page.getByRole("heading", { name: "Nova marca" })).toBeVisible();
});

test("second sign-up is refused (single owner install)", async ({ page }) => {
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/login/);
});

test("create Cool Season brand with persona and forbidden terms", async ({ page }) => {
  await login(page);
  await page.goto("/brands");
  await page.getByLabel("Nome da marca").fill("Cool Season");
  await page.getByLabel("Segmento").fill("HVAC residencial");
  await page.getByLabel("Termos proibidos nos anúncios desta marca").fill("financing\n0% APR");
  await page.getByRole("button", { name: "Criar marca" }).click();
  await expect(page.getByRole("heading", { name: "Cool Season" })).toBeVisible();

  await page.getByLabel("Nome da persona").fill("The Careful Homeowner");
  await page.getByLabel("Carregar de arquivo (.md ou .txt)").setInputFiles(PERSONA_MD);
  await expect(page.getByLabel("Texto da persona / brand kit")).toHaveValue(/PERSONA MESTRA/);
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page.getByText(/salva como versão 1/)).toBeVisible();

  await page.getByLabel("Nome", { exact: true }).fill("Cool Season Ads");
  await page.getByLabel("ID da conta / página").fill("act_000000001");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByRole("cell", { name: "act_000000001" })).toBeVisible();
  await expect(page.getByText("Desconectado").first()).toBeVisible();
});

test("dashboard shows N/D, never fake numbers, before any data", async ({ page }) => {
  await login(page);
  await page.goto("/");
  await expect(page.getByText("Marca ativa:")).toContainText("Cool Season");
  for (const label of ["CPL real", "CPQL", "CAC de mídia", "Gasto em anúncios", "Após custos + mídia"]) {
    await expect(page.locator("div.rounded-xl", { has: page.getByText(label, { exact: true }) })).toContainText("N/D");
  }
  await expect(page.getByText("Meta API: não conectada")).toBeVisible();
});

test("download the AI template, personalized for the brand, and import an AI answer wrapped in a code block", async ({ page }) => {
  await login(page);
  await page.goto("/import");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "↓ Baixar modelo (.txt)" }).click()]);
  expect(download.suggestedFilename()).toBe("modelo-campanha-cool-season.txt");
  const template = (await (await download.createReadStream()).toArray()).join("");
  expect(template).toContain('para a marca "Cool Season"');
  expect(template).toContain("PERSONA: The Careful Homeowner");
  expect(template).toContain("- financing");
  expect(template).toContain("PERSONA MESTRA"); // persona text goes along

  // Simulate the AI answer: the example block from the template, wrapped in ```txt.
  const example = template.split("EXEMPLO DO FORMATO (substitua pelo conteúdo real)")[1];
  const block = example.slice(example.indexOf("CSCAMP/1"), example.indexOf("END_CAMPAIGN") + "END_CAMPAIGN".length);
  await page.getByText("…ou cole o texto").click();
  await page.locator("textarea").fill(["```txt", block, "```"].join("\n"));
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(page.getByText("Campanha nova")).toBeVisible();
  await expect(page.locator("li", { hasText: "BRAND-SERVICE-ANGLE-2026-11-A01" })).toContainText("Short headline");
  await expect(page.getByRole("button", { name: "Importar como rascunho" })).toBeEnabled();
});

test("import the example TXT: preview, commit, and re-import without duplicates", async ({ page }) => {
  await login(page);
  await page.goto("/import");
  await page.getByLabel("Arquivo TXT").setInputFiles(EXAMPLE_TXT);
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(page.getByText("3. Confira antes de importar")).toBeVisible();
  await expect(page.getByText("Campanha nova")).toBeVisible();
  await expect(page.getByText("Novo", { exact: true })).toHaveCount(3);
  await page.getByRole("button", { name: "Importar como rascunho" }).click();
  await expect(page.getByText("3 anúncio(s) novo(s)")).toBeVisible();

  await page.getByRole("link", { name: /Abrir campanha/ }).click();
  await expect(page.getByRole("heading", { name: "Mini Split - Quality vs Clarity vs Support" })).toBeVisible();
  await expect(page.getByText("CS-MS-QUALITY-2026-11-A01")).toBeVisible();
  await expect(page.getByText("CS-MS-QUALITY-2026-11-B01")).toBeVisible();
  await expect(page.getByText("CS-MS-QUALITY-2026-11-C01")).toBeVisible();
  await expect(page.getByText("The Careful Homeowner (v1)")).toBeVisible();

  // Re-import: everything unchanged, nothing to commit.
  await page.goto("/import");
  await page.getByLabel("Arquivo TXT").setInputFiles(EXAMPLE_TXT);
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(page.locator("li", { hasText: "CS-MS-QUALITY-2026-11-" }).getByText("Sem mudança", { exact: true })).toHaveCount(3);
  await expect(page.getByText("Tudo já está importado e igual.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Importar como rascunho" })).toBeDisabled();

  await page.goto("/campaigns");
  await expect(page.getByRole("link", { name: "Mini Split - Quality vs Clarity vs Support" })).toHaveCount(1);
});

test("import with a missing required field shows the error line", async ({ page }) => {
  await login(page);
  await page.goto("/import");
  await page.getByText("…ou cole o texto").click();
  await page.locator("textarea").fill("CSCAMP/1\nCAMPAIGN\nCAMPAIGN_KEY: X\nEND_CAMPAIGN\n");
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(page.getByText(/Linha 2: Campanha sem campo obrigatório BRAND/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Importar como rascunho" })).toBeDisabled();
});

test("upload a video to an ad, watch it, and it stays private", async ({ page, browser }) => {
  await login(page);
  await page.goto("/campaigns");
  await page.getByRole("link", { name: "Mini Split - Quality vs Clarity vs Support" }).click();
  await page.getByRole("link", { name: /CS-MS-QUALITY-2026-11-A01/ }).click();
  await expect(page.getByText("A mini split is only as good as the installation behind it.")).toBeVisible();
  await expect(page.getByText("INSTALLATION QUALITY")).toBeVisible();

  await page.getByLabel("Arquivos de mídia").setInputFiles(VIDEO);
  await expect(page.getByText("test-video.mp4")).toBeVisible({ timeout: 30_000 });
  const video = page.locator("video").first();
  await expect(video).toBeVisible();
  const src = await video.getAttribute("src");
  expect(src).toMatch(/^\/api\/media\//);

  // Logged-in: served as video with range support.
  const full = await page.request.get(src!);
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe("video/mp4");
  const part = await page.request.get(src!, { headers: { Range: "bytes=0-99" } });
  expect(part.status()).toBe(206);

  // Anonymous: refused.
  const anon = await browser.newContext();
  const res = await anon.request.get(`http://localhost:3100${src}`);
  expect(res.status()).toBe(401);
  await anon.close();

  await page.goto("/library");
  await expect(page.getByText("test-video.mp4")).toBeVisible();
});

test("a non-media file renamed to .mp4 is rejected", async ({ page }) => {
  await login(page);
  await page.goto("/library");
  await page.getByLabel("Arquivos de mídia").setInputFiles({ name: "evil.mp4", mimeType: "video/mp4", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await expect(page.getByText(/Tipo de arquivo não aceito/)).toBeVisible();
});

test("link a real Meta ad ID to the variant and add daily metrics", async ({ page }) => {
  await login(page);
  await page.goto("/published");
  await page.getByLabel("ID do anúncio na plataforma *").fill("120200000000000001");
  await page.getByLabel("Anúncio interno (variante)").selectOption({ label: "CS-MS-QUALITY-2026-11-A01" });
  await page.getByLabel("Status na plataforma (manual)").fill("Ativo");
  await page.getByRole("button", { name: "Salvar publicação" }).click();
  await expect(page.getByText("Publicação vinculada.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("120200000000000001").first()).toBeVisible();

  await page.getByLabel("Dia").fill("2026-11-13");
  await page.getByLabel("Gasto (USD)").fill("50.00");
  await page.getByLabel("Impressões").fill("2000");
  await page.getByLabel("Cliques link").fill("40");
  await page.getByRole("button", { name: "Salvar dia" }).click();
  await expect(page.getByText(/Métricas de 2026-11-13 salvas/)).toBeVisible();

  // Saving the same day again replaces it (no double counting).
  await page.getByLabel("Dia").fill("2026-11-13");
  await page.getByLabel("Gasto (USD)").fill("50.00");
  await page.getByLabel("Impressões").fill("2000");
  await page.getByRole("button", { name: "Salvar dia" }).click();
  await expect(page.getByText(/Métricas de 2026-11-13 salvas/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("$50.00").first()).toBeVisible();
});

test("lead from the ad goes to a won contract and the dashboard computes real metrics", async ({ page }) => {
  await login(page);
  await page.goto("/leads");
  await page.getByLabel("Nome *").fill("Test Lead");
  await page.getByLabel("Telefone", { exact: true }).fill("+1 555 0100");
  await page.getByLabel("Origem", { exact: true }).selectOption("META");
  await page.getByLabel("Certeza da origem").selectOption("CONFIRMED");
  await page.getByLabel("Anúncio interno", { exact: true }).selectOption({ label: "CS-MS-QUALITY-2026-11-A01" });
  await page.getByRole("button", { name: "Cadastrar lead" }).click();
  await expect(page.getByRole("heading", { name: "Test Lead" })).toBeVisible();

  await page.getByLabel("Etapa", { exact: true }).selectOption("QUALIFIED");
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.getByText("Etapa atualizada.")).toBeVisible();

  await page.getByLabel("Valor (USD)").fill("3100.00");
  await page.getByRole("button", { name: "Adicionar orçamento" }).click();
  await expect(page.getByText("Orçamento registrado.")).toBeVisible();

  await page.getByLabel("Valor do contrato (USD)").fill("3100.00");
  await page.getByLabel("Custos diretos").fill("2000.00");
  await page.getByRole("button", { name: "Registrar contrato" }).click();
  await expect(page.getByText("Contrato registrado.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ganho").first()).toBeVisible();

  // Duplicate phone is flagged, not silently merged or duplicated.
  await page.goto("/leads");
  await page.getByLabel("Nome *").fill("Same Phone");
  await page.getByLabel("Telefone", { exact: true }).fill("+1 555 0100");
  await page.getByRole("button", { name: "Cadastrar lead" }).click();
  await expect(page.getByText(/Já existe um lead com esse telefone/)).toBeVisible();

  await page.goto("/?days=90");
  const card = (label: string) => page.locator("div.rounded-xl", { has: page.getByText(label, { exact: true }) });
  await expect(card("Leads")).toContainText("1");
  await expect(card("Qualificados")).toContainText("1");
  await expect(card("Contratos")).toContainText("1");
  await expect(card("CPL real")).toContainText("$50.00");
  await expect(card("CPQL")).toContainText("$50.00");
  await expect(card("CAC de mídia")).toContainText("$50.00");
  await expect(card("Após custos + mídia")).toContainText("$1,050.00");
  await expect(page.getByText("INSTALLATION QUALITY").first()).toBeVisible();
});

test("setting the real landing page generates the UTM link of the published ad", async ({ page }) => {
  await login(page);
  await page.goto("/campaigns");
  await page.getByRole("link", { name: "Mini Split - Quality vs Clarity vs Support" }).click();
  await page.getByLabel("Landing page (URL real)").fill("https://example.com/estimate");
  await page.getByRole("button", { name: "Salvar landing page" }).click();
  await expect(page.getByText("Landing page salva.")).toBeVisible();
  await page.getByRole("link", { name: /CS-MS-QUALITY-2026-11-A01/ }).click();
  await expect(
    page.getByText("https://example.com/estimate?utm_source=facebook&utm_medium=paid_social&utm_campaign=cs_ms_quality_2026_11&utm_content=cs_ms_quality_2026_11_a01"),
  ).toBeVisible();
});

test("a second brand has its own, empty data", async ({ page }) => {
  await login(page);
  await page.goto("/brands");
  await page.getByLabel("Nome da marca").fill("Other Business");
  await page.getByRole("button", { name: "Criar marca" }).click();
  await expect(page.getByRole("heading", { name: "Other Business" })).toBeVisible();
  await page.goto("/campaigns");
  await expect(page.getByText("Nenhuma campanha nesta marca.")).toBeVisible();
  await page.goto("/leads");
  await expect(page.getByText("Nenhum lead ainda")).toBeVisible();

  // Switch back: Cool Season data is still there.
  await page.getByLabel("Marca ativa").selectOption({ label: "Cool Season" });
  await expect(page.getByText("Marca ativa:")).toContainText("Cool Season");
  await expect(page.getByRole("link", { name: "Test Lead" })).toBeVisible();
});

test("results: set brand targets, see the day-3 verdict with the strategy, cancel and keep the learning", async ({ page }) => {
  await login(page);
  await page.goto("/brands");
  await page.getByRole("link", { name: /Cool Season/ }).first().click();
  await page.getByLabel("Custo máximo por visita marcada").fill("120.00");
  await page.getByLabel("Gasto máximo por dia da marca").fill("40.00");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Marca salva.")).toBeVisible();

  // The ad from the earlier test spent $50 on 2026-11-13 and brought no lead linked to it: past day 3 → cancel.
  await page.goto("/results");
  await expect(page.getByRole("heading", { name: "Resultados dos anúncios" })).toBeVisible();
  await expect(page.getByText(/Hoje: cancelar 1 teste sem resultado/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Em teste (1)" })).toBeVisible();
  await page.getByRole("link", { name: "CS-MS-QUALITY-2026-11-A01" }).first().click();

  await expect(page.getByRole("heading", { name: "Estratégia" })).toBeVisible();
  await expect(page.getByText("INSTALLATION_QUALITY").first()).toBeVisible();
  const stat = (label: string) => page.locator("div.rounded-xl", { has: page.getByText(label, { exact: true }) }).first();
  await expect(stat("Gasto")).toContainText("$50.00");
  await expect(stat("Custo por visita")).toContainText("N/D");
  await expect(page.getByText("Não deu resultado: cancelar").first()).toBeVisible();

  await page.getByLabel("Registrar decisão").selectOption("CANCEL");
  await page.getByLabel("Aprendizado (opcional)").fill("Quality angle got impressions but no contact. Try a clearer CTA.");
  await page.getByRole("button", { name: "Salvar decisão" }).click();
  await expect(page.getByText(/Anúncio encerrado em/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Quality angle got impressions but no contact. Try a clearer CTA.")).toBeVisible();
  await expect(page.getByText(/app sugeria: Não deu resultado: cancelar/)).toBeVisible();
  await expect(page.getByLabel("Registrar decisão")).toHaveCount(0);

  await page.goto("/results");
  await expect(page.getByRole("heading", { name: "Encerrados (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Placar por ângulo" })).toBeVisible();
});
