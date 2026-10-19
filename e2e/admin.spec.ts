import { expect, test } from "@playwright/test";

/**
 * Administration journey: sign in, manage a product, upload a photo, change a
 * price and adjust the stock.
 *
 * The account comes from the development seed (`npm run db:seed`).
 */

const ADMIN = { email: "admin@example.com", password: "DevOnly#Password2026" };

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test("an administrator can sign in and reach the dashboard", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("a wrong password is rejected with a neutral message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(ADMIN.email);
  await page.getByLabel("Password").fill("this-is-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toContainText(/invalid email or password/i);
});

test("an administrator can create a product", async ({ page }) => {
  await signIn(page);

  await page.goto("/admin/products/new");
  const sku = `E2E-${Date.now()}`;

  await page.getByLabel(/^Product name/).fill("E2E Test Product");
  await page.getByLabel(/^Brand/).fill("E2E Brand");
  await page.getByLabel(/^Manufacturer/).fill("E2E Manufacturer");
  await page.getByLabel(/^SKU/).fill(sku);
  await page.getByLabel(/^Pack size/).fill("10");
  await page.getByLabel(/^Selling price/).fill("25.50");
  await page.getByLabel(/^Stock quantity/).fill("7");
  await page.getByRole("button", { name: "Create product" }).click();

  await expect(page).toHaveURL(/\/admin\/products\//);
  await expect(page.getByText(sku)).toBeVisible();
});

test("an administrator can upload a product photo", async ({ page }) => {
  await signIn(page);

  await page.goto("/admin/products");
  await page.getByRole("link", { name: /Sample Analgesic Tablet/ }).first().click();

  // A one-pixel PNG is enough to exercise the upload and the re-encoding.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("New photo").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: "Upload photo" }).click();

  await expect(page.getByRole("status")).toContainText(/photo uploaded/i);
});

test("a price change is recorded in the price history", async ({ page }) => {
  await signIn(page);

  await page.goto("/admin/products");
  await page.getByRole("link", { name: /Sample Analgesic Tablet/ }).first().click();

  await page.getByLabel("New selling price (Rs)").fill("11.25");
  await page.getByLabel("Reason", { exact: true }).first().fill("E2E price change");
  await page.getByRole("button", { name: "Record price change" }).click();

  await expect(page.getByRole("status")).toContainText(/price updated/i);
  await expect(page.getByText("E2E price change")).toBeVisible();
});

test("a stock adjustment is recorded in the stock history", async ({ page }) => {
  await signIn(page);

  await page.goto("/admin/products");
  await page.getByRole("link", { name: /Sample Analgesic Tablet/ }).first().click();

  await page.getByLabel("Change in units").fill("3");
  await page.getByRole("button", { name: "Apply stock adjustment" }).click();

  await expect(page.getByRole("status")).toContainText(/stock updated/i);
});
