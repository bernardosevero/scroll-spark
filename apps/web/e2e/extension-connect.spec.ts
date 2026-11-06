import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

import { EXTENSION_ID, signIn } from "./support/session";

interface Sent {
  id: string;
  message: { type: string; token: string; expiresAt: string };
}

/** Stands in for Chrome's messaging: tests never load the real extension here. */
async function stubExtension(context: BrowserContext, behaviour: "installed" | "missing") {
  await context.addInitScript((mode) => {
    const sent: unknown[] = [];
    Object.assign(window, { __sent: sent });
    if (mode === "missing") {
      return;
    }
    Object.assign(window, {
      chrome: {
        runtime: {
          lastError: undefined,
          sendMessage(id: string, message: unknown, callback: (reply: unknown) => void) {
            sent.push({ id, message });
            callback({ ok: true });
          },
        },
      },
    });
  }, behaviour);
}

const sentMessages = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sent: Sent[] }).__sent);

const connect = (page: Page) => page.getByRole("button", { name: "Connect the side panel" });

test("signed out, the page asks you to connect your account first", async ({ page }) => {
  await page.goto("/extension/connect");

  await expect(page.getByRole("link", { name: "Connect your Buffer account" })).toBeVisible();
  await expect(connect(page)).toBeHidden();
});

test.describe("signed in", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("connecting hands the token to the extension, which then works as a bearer token", async ({
    context,
    page,
    playwright,
  }) => {
    await stubExtension(context, "installed");
    await page.goto("/extension/connect");

    await expect(page.getByText("Nothing is connected yet.")).toBeVisible();
    await connect(page).click();

    await expect(page.getByRole("status")).toContainText("Side panel connected");
    const [sent] = await sentMessages(page);
    expect(sent?.id).toBe(EXTENSION_ID);
    expect(sent?.message).toMatchObject({ type: "scroll-spark.connect" });
    const token = String(sent?.message.token);
    expect(token).toMatch(/^ssx_/);
    await expect(page.getByRole("list", { name: "Connected browsers" })).toContainText("Expires");
    await expect(page.locator("body")).not.toContainText(token);

    // The token alone, with no cookie, reaches the same inbox as the website.
    const panel = await playwright.request.newContext({
      baseURL: page.url().replace(/\/extension\/connect$/, ""),
      extraHTTPHeaders: { authorization: `Bearer ${token}` },
    });
    const created = await panel.post("/api/trpc/capture.create", {
      data: { text: "From the side panel.", sourceUrl: null, platform: "web", sourceName: null },
    });
    expect(created.status()).toBe(200);
    expect(await (await panel.get("/api/trpc/capture.inbox")).text()).toContain(
      "From the side panel.",
    );

    // A token can't mint another, so a stolen one can't renew itself.
    const minted = await panel.post("/api/trpc/extension.connect", { data: {} });
    expect(minted.status()).toBe(401);

    await page.getByRole("button", { name: /^Revoke/ }).click();

    await expect(page.getByText("Nothing is connected yet.")).toBeVisible();
    expect((await panel.get("/api/trpc/capture.inbox")).status()).toBe(401);
    await panel.dispose();
  });

  test("a bad token is refused", async ({ playwright, baseURL }) => {
    const panel = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { authorization: "Bearer ssx_not-a-real-token" },
    });

    expect((await panel.get("/api/trpc/capture.inbox")).status()).toBe(401);
    await panel.dispose();
  });

  test("when the extension can't be reached, nothing stays connected", async ({
    context,
    page,
  }) => {
    await stubExtension(context, "missing");
    await page.goto("/extension/connect");

    await connect(page).click();

    await expect(page.getByText("We couldn't reach the side panel.")).toBeVisible();
    await expect(page.getByText("Nothing is connected yet.")).toBeVisible();
  });
});
