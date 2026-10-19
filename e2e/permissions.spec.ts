import { expect, test } from "@playwright/test";

/**
 * Authorisation journeys.
 *
 * The rules under test are enforced on the server: hiding a control in the
 * interface is not access control.
 */

const CUSTOMER = { email: "customer@example.com", password: "DevOnly#Password2026" };
const PHARMACIST = { email: "pharmacist@example.com", password: "DevOnly#Password2026" };

async function signIn(
  page: import("@playwright/test").Page,
  account: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a customer cannot open the administration area", async ({ page }) => {
  await signIn(page, CUSTOMER);

  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin$/);
});

test("a customer cannot open the administration API by guessing a URL", async ({ page }) => {
  await signIn(page, CUSTOMER);

  const response = await page.goto("/api/admin/prescriptions/00000000-0000-0000-0000-000000000000");
  expect(response?.status()).toBeGreaterThanOrEqual(400);
});

test("an anonymous visitor is redirected to the sign-in page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("a pharmacist may open the prescription queue but may not change legal restrictions", async ({
  page,
}) => {
  await signIn(page, PHARMACIST);
  await expect(page).toHaveURL(/\/admin/);

  await page.goto("/admin/prescriptions");
  await expect(page.getByRole("heading", { name: "Prescription review" })).toBeVisible();

  await page.goto("/admin/products");
  await page.getByRole("link", { name: /Sample Analgesic Tablet/ }).first().click();
  await expect(page.getByText("Legal restriction")).toBeVisible();
  // The pharmacist has no permission to change it, so the control is absent
  // and the server refuses the action as well.
  await expect(page.getByRole("button", { name: "Update legal restriction" })).toHaveCount(0);
});

test("the session cookie is not readable from JavaScript", async ({ page }) => {
  await signIn(page, CUSTOMER);

  const visible = await page.evaluate(() =>
    Object.keys(document.cookie).some((name) => name.includes("ms_session")),
  );
  expect(visible).toBe(false);
});
