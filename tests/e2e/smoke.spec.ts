import { expect, test } from "@playwright/test";

test("landing page invites visitors to create an account", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ask your documents");
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test("app pages require sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/);
});

test("API rejects unauthenticated requests", async ({ request }) => {
  const res = await request.get("/api/v1/documents", { maxRedirects: 0 });
  expect(res.ok()).toBeFalsy();
});

test("health endpoint responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
});
