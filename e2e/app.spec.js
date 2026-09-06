import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/analytics", route => route.fulfill({ status:204, body:"" }));
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", route => route.fulfill({
    contentType:"application/javascript",
    body:"window.turnstile={render:(element,options)=>{element.dataset.testWidget='rendered';options.callback('test-turnstile-token');return 'test-widget';},remove:()=>{}};",
  }));
});

test("homepage and intake have no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name:/Answer 6 questions/ })).toBeVisible();
  const homeResults = await new AxeBuilder({ page }).analyze();
  expect(homeResults.violations.filter(item => ["critical","serious"].includes(item.impact))).toEqual([]);
  await page.getByRole("button", { name:/Test my idea/ }).first().click();
  await expect(page.getByText("QUESTION 01")).toBeVisible();
  const intakeResults = await new AxeBuilder({ page }).analyze();
  expect(intakeResults.violations.filter(item => ["critical","serious"].includes(item.impact))).toEqual([]);
  await expect(page).toHaveScreenshot("intake-desktop.png", { fullPage:true, animations:"disabled" });
  await page.setViewportSize({ width:390, height:844 });
  await expect(page).toHaveScreenshot("intake-mobile.png", { fullPage:true, animations:"disabled" });
});

test("six answers lead to the adaptive evidence question and survive reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name:/Test my idea/ }).first().click();
  for (let index = 0; index < 6; index += 1) {
    await page.getByPlaceholder("Type your answer...").fill(`This is sufficiently detailed answer number ${index + 1}, containing concrete context for a useful assessment.`);
    await page.getByRole("button", { name:index === 5 ? /Generate Model/ : /Next/ }).click();
  }
  await expect(page.getByText("ONE TARGETED FOLLOW-UP")).toBeVisible();
  await page.getByPlaceholder(/Be specific about/).fill("A paid pilot from three target customers within fourteen days would validate the assumption and determine whether to continue.");
  await page.reload();
  await expect(page.getByRole("heading", { name:"Check the raw material." })).toBeVisible();
  await expect(page.getByPlaceholder(/Be specific about/)).toHaveValue(/paid pilot/);
  await page.getByRole("button", { name:/Generate validation model/ }).click();
  await page.getByRole("textbox", { name:"Your work email address" }).fill("test@example.com");
  await expect(page.getByRole("button", { name:/Show my assessment/ })).toBeEnabled();
});

test("landing page explains the model and keeps one FAQ answer open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name:"The six questions" })).toBeVisible();
  await expect(page.getByText("Assumption map", { exact:true })).toBeVisible();
  const secondQuestion = page.getByRole("button", { name:/How long does it take/ });
  await secondQuestion.click();
  await expect(secondQuestion).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/About ten minutes to answer/)).toBeVisible();
  await expect(page.getByText(/Half-formed is normal/)).toBeHidden();
});

test("privacy and admin entry points render", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name:"Privacy notice" })).toBeVisible();
  await page.goto("/admin/submissions");
  await expect(page.getByRole("heading", { name:"Submission dashboard" })).toBeVisible();
});
