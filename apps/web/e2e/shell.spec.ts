import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { signIn } from "./support/session";

const main = (page: Page) => page.getByRole("navigation", { name: "Main" });

test.describe("signed in", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("the shell shows nav and sign out, and reaches the inbox and settings", async ({ page }) => {
    await page.goto("/settings");

    await expect(main(page).getByRole("link", { name: "Inbox" })).toHaveAttribute("href", "/inbox");
    await expect(main(page).getByRole("link", { name: "Your channels" })).toHaveAttribute(
      "href",
      "/channels",
    );
    await expect(main(page).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(main(page).getByRole("link", { name: "Inbox" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    await main(page).getByRole("link", { name: "Inbox" }).click();

    await expect(page).toHaveURL("/inbox");
    await expect(main(page).getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("signing out returns to the landing page", async ({ page }) => {
    await page.goto("/inbox");
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "Connect your Buffer account" })).toBeVisible();
  });

  test("a grant that needs renewing offers Reconnect Buffer", async ({ page }) => {
    await page.route("**/api/trpc/account.status*", (route) =>
      route.fulfill({
        contentType: "application/json",
        // Sent alone, never in a batch, so the answer is a single result.
        body: JSON.stringify({ result: { data: { needsReconnect: true } } }),
      }),
    );

    await page.goto("/inbox");

    await expect(page.getByRole("link", { name: "Reconnect Buffer" })).toHaveAttribute(
      "href",
      "/api/auth/connect",
    );
  });

  test("a connected account shows no reconnect notice", async ({ page }) => {
    await page.goto("/inbox");

    await expect(main(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "Reconnect Buffer" })).toHaveCount(0);
  });

  test("a call that fails with RECONNECT_REQUIRED raises the notice", async ({ page }) => {
    await page.route("**/api/trpc/capture.inbox*", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify([
          {
            error: {
              message: "RECONNECT_REQUIRED",
              code: -32001,
              data: {
                code: "UNAUTHORIZED",
                httpStatus: 401,
                path: "capture.inbox",
                appCode: "RECONNECT_REQUIRED",
              },
            },
          },
        ]),
      }),
    );

    await page.goto("/inbox");

    await expect(page.getByRole("link", { name: "Reconnect Buffer" })).toBeVisible();
  });

  test("delete my data asks first, then signs out and the data is gone", async ({
    context,
    page,
  }) => {
    const [session] = await context.cookies();

    await page.goto("/inbox");
    await page.getByRole("button", { name: "A founder story" }).click();
    await expect(page).toHaveURL(/\/inbox\/[\w-]+/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete my data" }).click();

    // Asked first: nothing has happened yet.
    await expect(page.getByText("This can't be undone.")).toBeVisible();
    await page.getByRole("button", { name: "Keep my data" }).click();
    await expect(page.getByText("This can't be undone.")).toBeHidden();
    await page.goto("/inbox");
    await expect(
      page.getByRole("region", { name: "Your captures" }).getByRole("article"),
    ).toHaveCount(1);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete my data" }).click();
    await page.getByRole("button", { name: "Yes, delete my data" }).click();

    await expect(page).toHaveURL("/?deleted=1");
    await expect(page.getByText("Your data is deleted.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Connect your Buffer account" })).toBeVisible();

    // The same user coming back finds nothing.
    await context.addCookies([session ?? { name: "", value: "", url: "http://localhost" }]);
    await page.goto("/inbox");
    await expect(page.getByText("Nothing here yet.")).toBeVisible();
  });

  test("settings leads to the side panel's connections", async ({ page }) => {
    await page.goto("/settings");

    await page.getByRole("link", { name: "Manage connections" }).click();

    await expect(page).toHaveURL("/extension/connect");
  });

  test("the delete page says the Buffer side is the user's to remove", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText("Buffer account settings")).toBeVisible();
  });

  test("a failed deletion says so and offers another try", async ({ page }) => {
    await page.route("**/api/trpc/account.deleteMyData*", (route) => route.abort());

    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete my data" }).click();
    await page.getByRole("button", { name: "Yes, delete my data" }).click();

    await expect(page.getByText("That didn't finish")).toBeVisible();
    await expect(page.getByRole("button", { name: "Yes, delete my data" })).toBeEnabled();
  });
});

test("signed out, settings sends you to the landing page", async ({ page }) => {
  await page.goto("/settings");

  await expect(page).toHaveURL("/");
});
