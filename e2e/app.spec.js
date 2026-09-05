import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/analytics", route => route.fulfill({ status:204, body:"" }));
});

test("homepage and intake have no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name:"Test My Idea" })).toBeVisible();
  const homeResults = await new AxeBuilder({ page }).analyze();
  expect(homeResults.violations.filter(item => ["critical","serious"].includes(item.impact))).toEqual([]);
  await page.getByRole("button", { name:/Test my idea/ }).click();
  await expect(page.getByText("QUESTION 01")).toBeVisible();
  const intakeResults = await new AxeBuilder({ page }).analyze();
  expect(intakeResults.violations.filter(item => ["critical","serious"].includes(item.impact))).toEqual([]);
  await expect(page).toHaveScreenshot("intake-desktop.png", { fullPage:true, animations:"disabled" });
  await page.setViewportSize({ width:390, height:844 });
  await expect(page).toHaveScreenshot("intake-mobile.png", { fullPage:true, animations:"disabled" });
});

test("six answers lead to the adaptive evidence question and survive reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name:/Test my idea/ }).click();
  for (let index = 0; index < 6; index += 1) {
    await page.getByPlaceholder("Type your answer...").fill(`This is sufficiently detailed answer number ${index + 1}, containing concrete context for a useful assessment.`);
    await page.getByRole("button", { name:index === 5 ? /Generate Model/ : /Next/ }).click();
  }
  await expect(page.getByText("ONE TARGETED FOLLOW-UP")).toBeVisible();
  await page.getByPlaceholder(/Be specific about/).fill("A paid pilot from three target customers within fourteen days would validate the assumption and determine whether to continue.");
  await page.reload();
  await expect(page.getByRole("heading", { name:"Check the raw material." })).toBeVisible();
  await expect(page.getByPlaceholder(/Be specific about/)).toHaveValue(/paid pilot/);
});

test("privacy and admin entry points render", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name:"Privacy notice" })).toBeVisible();
  await page.goto("/admin/submissions");
  await expect(page.getByRole("heading", { name:"Submission dashboard" })).toBeVisible();
});
