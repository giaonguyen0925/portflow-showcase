import { expect, test } from "@playwright/test";

test("home page responds without a session", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toBeVisible();
});

test("unknown project slug returns 404", async ({ page }) => {
  const response = await page.goto("/this-project-does-not-exist");

  expect(response?.status()).toBe(404);
});
