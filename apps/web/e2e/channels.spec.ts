import { expect, test } from "@playwright/test";

import { newSoloOrganizationUserId } from "../src/server/buffer/fakes";
import { signIn } from "./support/session";

test.describe("with two organizations", () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context);
    await page.goto("/channels");
  });

  test("asks which organization first, then shows its channels", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Your channels" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Which organization?" })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    await page.getByRole("button", { name: "Example Studio" }).click();

    await expect(page.getByRole("checkbox", { name: /Example Studio/ })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Which organization?" })).toBeHidden();
  });

  test("unsupported channels are disabled and say why", async ({ page }) => {
    await page.getByRole("button", { name: "Example Studio" }).click();

    const instagram = page.getByRole("checkbox", { name: /Studio on Instagram/ });
    await expect(instagram).toBeDisabled();
    await expect(page.getByText("Needs an image or video")).toBeVisible();
    await expect(instagram).toHaveAccessibleDescription(/Needs an image or video/);

    await expect(page.getByRole("checkbox", { name: /threads/i })).toBeDisabled();
    await expect(page.getByText("This channel is locked on your Buffer plan.")).toBeVisible();

    await expect(page.getByRole("checkbox", { name: /mastodon/i })).toBeDisabled();
    await expect(page.getByText("Reconnect this channel in Buffer to use it.")).toBeVisible();
  });

  test("default channels are saved and remembered", async ({ page }) => {
    await page.getByRole("button", { name: "Example Studio" }).click();
    await page.getByRole("checkbox", { name: /Example Studio/ }).check();
    await page.getByRole("checkbox", { name: /bluesky/i }).check();

    await page.getByRole("button", { name: "Save default channels" }).click();
    await expect(page.getByText("Saved. We'll start with these.")).toBeVisible();

    await page.reload();

    await expect(page.getByRole("checkbox", { name: /Example Studio/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /bluesky/i })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /@examplestudio/ })).not.toBeChecked();
  });

  test("another organization can be chosen later, with its own channels", async ({ page }) => {
    await page.getByRole("button", { name: "Example Studio" }).click();
    await expect(page.getByRole("checkbox", { name: /Example Studio/ })).toBeVisible();

    await page.getByLabel("Organization").selectOption({ label: "Side Projects" });

    await expect(page.getByRole("checkbox", { name: /side-project/ })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Example Studio/ })).toBeHidden();
  });
});

test("one organization skips that step", async ({ context, page }) => {
  await signIn(context, { userId: newSoloOrganizationUserId() });
  await page.goto("/channels");

  await expect(page.getByRole("checkbox", { name: /Example Studio/ })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Which organization?" })).toBeHidden();
  await expect(page.getByLabel("Organization")).toBeHidden();
});

test("a failed load can be tried again", async ({ context, page }) => {
  await signIn(context);
  await page.route("**/api/trpc/*buffer.account*", (route) => route.abort());
  await page.goto("/channels");

  await expect(page.getByText("We couldn't open your channels.")).toBeVisible();

  await page.unroute("**/api/trpc/*buffer.account*");
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByRole("heading", { name: "Which organization?" })).toBeVisible();
});

test("signed out, channels sends you to connect", async ({ page }) => {
  await page.goto("/channels");

  await expect(page).toHaveURL("/");
});
