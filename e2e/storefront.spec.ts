import { expect, test } from "@playwright/test";

/**
 * Storefront journey: search, product page, cart.
 *
 * The data comes from the development seed (`npm run db:seed`).
 */

test("a visitor can search for a product and open it", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByLabel("Search medicines").fill("Sample");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/products\?q=Sample/);
  await expect(page.getByRole("link", { name: /Sample Analgesic Tablet/ })).toBeVisible();
});

test("a product page shows the pack details and the warnings", async ({ page }) => {
  await page.goto("/products?q=Sample%20Analgesic%20Tablet");
  await page.getByRole("link", { name: /Sample Analgesic Tablet/ }).first().click();

  await expect(page.getByRole("heading", { name: /Sample Analgesic Tablet/ })).toBeVisible();
  await expect(page.getByText("500 mg").first()).toBeVisible();
  await expect(page.getByText(/Development placeholder/)).toBeVisible();
});

test("a product that is prohibited for online sale is not offered", async ({ page }) => {
  await page.goto("/products?q=Scheduled");

  await expect(page.getByText(/no medicines match your search/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Scheduled Product/ })).toHaveCount(0);
});

test("a signed-in customer can add a product to the cart", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("customer@example.com");
  await page.getByLabel("Password").fill("DevOnly#Password2026");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/products?q=Sample%20Analgesic%20Tablet");
  await page.getByRole("link", { name: /Sample Analgesic Tablet/ }).first().click();
  await page.getByRole("button", { name: /Add to cart/i }).click();

  await page.goto("/cart");
  await expect(page.getByText("Sample Analgesic Tablet 500 mg").first()).toBeVisible();
  await expect(page.getByText("Order summary")).toBeVisible();
});

test("the storefront is usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Medicines" })).toBeVisible();

  // No horizontal overflow on a narrow screen.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});
