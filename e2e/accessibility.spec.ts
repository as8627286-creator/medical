import { expect, test } from "@playwright/test";

/**
 * Accessibility checks that can be automated.
 *
 * This does not replace a manual pass with a screen reader: automation finds
 * the mechanical problems (a missing label, a missing landmark, low
 * contrast), not the ones that need a human to judge the result.
 */

test("the storefront has a main landmark, a skip link and a single h1", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => document.activeElement?.textContent ?? "");
  expect(firstFocus).toContain("Skip to main content");
});

test("the search field has a label", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Search medicines")).toBeVisible();
});

test("every form control on the sign-in page is labelled", async ({ page }) => {
  await page.goto("/login");

  const unlabelled = await page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll("input:not([type=hidden]), select, textarea"),
    );
    return controls.filter((control) => {
      const id = control.getAttribute("id");
      const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
      const hasAriaLabel = !!control.getAttribute("aria-label");
      const hasAriaLabelledBy = !!control.getAttribute("aria-labelledby");
      return !hasLabel && !hasAriaLabel && !hasAriaLabelledBy;
    }).length;
  });

  expect(unlabelled).toBe(0);
});

test("error messages are announced", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
});

test("the product card images have alternative text", async ({ page }) => {
  await page.goto("/products");

  const missingAlt = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll("img"));
    return images.filter((image) => !image.getAttribute("alt")).length;
  });

  expect(missingAlt).toBe(0);
});

test("the page can be navigated with the keyboard", async ({ page }) => {
  await page.goto("/products");

  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
  }

  const tagName = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(tagName);
});
