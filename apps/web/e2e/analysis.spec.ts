import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { signIn } from "./support/session";

const ANGLE = "The quiet customer who changed what you built";

async function paste(page: Page, text: string) {
  await page.getByLabel("Paste a post or a link").fill(text);
  await page.getByRole("button", { name: "Find the spark" }).click();
}

test.describe("signed in", () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context);
    await page.goto("/inbox");
  });

  test("an example reaches its analysis in one click", async ({ page }) => {
    await page.getByRole("button", { name: "A founder story" }).click();

    await expect(page.getByRole("heading", { name: ANGLE })).toBeVisible();
    await expect(page.getByText("Listening to customers")).toBeVisible();
    await expect(page.getByText("Small fixes can matter more")).toBeVisible();
    await expect(page.getByRole("link", { name: "customer feedback" })).toHaveAttribute(
      "href",
      "https://trends.google.com/trends/explore?q=customer%20feedback&date=today%2012-m&geo=US",
    );
    await expect(page.getByRole("link", { name: "Compare all" })).toHaveAttribute(
      "href",
      /q=customer%20feedback,product%20market%20fit/,
    );
    await expect(page.getByText("What you captured")).toBeVisible();
  });

  test("a saved analysis opens from the inbox", async ({ page }) => {
    await page.getByRole("button", { name: "A founder story" }).click();
    await expect(page.getByRole("heading", { name: ANGLE })).toBeVisible();

    await page.getByRole("link", { name: "Back to your inbox" }).click();
    await page.getByRole("link", { name: /^Open/ }).click();

    await expect(page.getByRole("heading", { name: ANGLE })).toBeVisible();
  });

  test("a refusal explains itself, and the capture stays in the inbox", async ({ page }) => {
    await paste(page, "[refuse] A post the model won't touch.");

    await expect(page.getByText("We couldn't analyze this one.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    await page.goto("/inbox");

    await expect(page.getByText("A post the model won't touch.")).toBeVisible();
  });

  test("a failed analysis can be tried again", async ({ page }) => {
    await page.route("**/api/trpc/*capture.analyze*", (route) => route.abort());

    await paste(page, "A post worth trying again.");

    await expect(page.getByText("That didn't work this time.")).toBeVisible();

    await page.unroute("**/api/trpc/*capture.analyze*");
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByRole("heading", { name: ANGLE })).toBeVisible();
  });

  test("opening an old capture never spends without asking", async ({ page }) => {
    await page.route("**/api/trpc/*capture.analyze*", (route) => route.abort());
    await paste(page, "Analyze me only when asked.");
    await expect(page.getByText("That didn't work this time.")).toBeVisible();
    await page.unroute("**/api/trpc/*capture.analyze*");

    await page.goto("/inbox");
    await page.getByRole("link", { name: /^Open/ }).click();

    await expect(page.getByRole("button", { name: "Find the spark" })).toBeVisible();
    await expect(page.getByRole("heading", { name: ANGLE })).toBeHidden();

    await page.getByRole("button", { name: "Find the spark" }).click();

    await expect(page.getByRole("heading", { name: ANGLE })).toBeVisible();
  });

  test("the chosen country changes the links, and is remembered", async ({ page }) => {
    await page.getByRole("button", { name: "A founder story" }).click();
    const link = page.getByRole("link", { name: "customer feedback" });
    await expect(link).toHaveAttribute("href", /geo=US/);

    await page.getByLabel("Country").selectOption("BR");

    await expect(link).toHaveAttribute("href", /geo=BR/);

    await page.reload();

    await expect(link).toHaveAttribute("href", /geo=BR/);
    await expect(page.getByLabel("Country")).toHaveValue("BR");
  });

  test("a YouTube capture searches YouTube on Trends", async ({ page }) => {
    await page.getByLabel("Paste a post or a link").fill("https://youtu.be/e2e");
    await page.getByRole("button", { name: "Read this link" }).click();
    await expect(page.getByText("From Example Channel")).toBeVisible();
    await page.getByRole("button", { name: "Find the spark" }).click();

    await expect(page.getByRole("link", { name: "customer feedback" })).toHaveAttribute(
      "href",
      /gprop=youtube/,
    );
  });

  test("a capture that isn't there says so", async ({ page }) => {
    await page.goto("/inbox/00000000-0000-4000-8000-000000000000");

    await expect(page.getByText("We can't find that capture.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to your inbox" })).toBeVisible();
  });

  test("a broken capture address says so too", async ({ page }) => {
    await page.goto("/inbox/not-a-capture");

    await expect(page.getByText("We can't find that capture.")).toBeVisible();
  });
});

test("someone else's capture looks like it isn't there", async ({ browser }) => {
  const owner = await browser.newContext();
  await signIn(owner);
  const ownerPage = await owner.newPage();
  await ownerPage.goto("/inbox");
  await ownerPage.getByRole("button", { name: "A founder story" }).click();
  await expect(ownerPage.getByRole("heading", { name: ANGLE })).toBeVisible();
  const { pathname } = new URL(ownerPage.url());

  const stranger = await browser.newContext();
  await signIn(stranger);
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(pathname);

  await expect(strangerPage.getByText("We can't find that capture.")).toBeVisible();
  await expect(strangerPage.getByRole("heading", { name: ANGLE })).toBeHidden();

  await owner.close();
  await stranger.close();
});

test("signed out, a capture sends you to connect", async ({ page }) => {
  await page.goto("/inbox/00000000-0000-4000-8000-000000000000");

  await expect(page).toHaveURL("/");
});
