import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { signIn } from "./support/session";

test("the site has its own icon", async ({ page, request }) => {
  await page.goto("/");

  const href = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
  const response = await request.get(href ?? "");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
});

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(0);
}

test("signed out, the landing page explains the product and links to connect and privacy", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("checks how it fits each of your channels")).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect your Buffer account" })).toHaveAttribute(
    "href",
    "/api/auth/connect",
  );
  await expect(page.getByRole("link", { name: "Privacy" }).first()).toHaveAttribute(
    "href",
    "/privacy",
  );
  await expect(page.getByRole("link", { name: "Source on GitHub" })).toHaveAttribute(
    "href",
    /github\.com\/bernardosevero\/scroll-spark/,
  );
  await expect(page.getByText("Built on the Buffer API")).toBeVisible();
});

test("the landing page says how to install the extension without inventing a store link", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Add the extension" })).toBeVisible();
  await expect(page.getByText("coming to the Chrome Web Store")).toBeVisible();
  await expect(page.getByText("Load unpacked")).toBeVisible();
  await expect(page.locator("a[href*='chromewebstore'], a[href*='chrome.google.com']")).toHaveCount(
    0,
  );
});

test("signed in, the landing page leads to the inbox instead", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Open your inbox" }).first()).toHaveAttribute(
    "href",
    "/inbox",
  );
  await expect(page.getByRole("link", { name: "Connect your Buffer account" })).toHaveCount(0);
});

test("the privacy page lists what is stored and how to delete it", async ({ page }) => {
  await page.goto("/privacy");

  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();

  for (const title of [
    "What we store",
    "What we don't store",
    "Who else sees your data",
    "The extension",
    "Disconnect, revoke and delete",
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }

  await expect(page.getByText("encrypted tokens")).toBeVisible();
  await expect(page.getByText("1,000 characters")).toBeVisible();
  await expect(page.getByText("activeTab")).toBeVisible();
  await expect(page.getByText("sent to Anthropic")).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" }).first()).toHaveAttribute(
    "href",
    "/settings",
  );
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("nothing overflows on the landing and privacy pages", async ({ page }) => {
    for (const path of ["/", "/privacy"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
  });

  test("nothing overflows in the signed-in shell", async ({ context, page }) => {
    await signIn(context);

    for (const path of ["/inbox", "/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
  });
});
