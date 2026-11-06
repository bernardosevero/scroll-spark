import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { SOLO_ORGANIZATION_USER_ID } from "../src/server/buffer/fakes";
import { signIn } from "./support/session";

const YEAR = String.raw`(, \d{4})?`;

async function analyzeExample(page: Page) {
  await page.goto("/inbox");
  await page.getByRole("button", { name: "A founder story" }).click();
  await expect(page.getByRole("heading", { name: "How it fits your channels" })).toBeVisible();
}

function row(page: Page, headline: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(headline, { exact: true }) });
}

test.describe("with one organization and its channels", () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, { userId: SOLO_ORGANIZATION_USER_ID });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await analyzeExample(page);
  });

  test("a capture shows one fit row per channel with the right counts and dates", async ({
    page,
  }) => {
    await expect(row(page, "Fits Example Studio")).toContainText(
      new RegExp(`Customer stories, 3 posts, last posted Sep 29${YEAR}$`),
    );
    await expect(row(page, "New for studio.example.com")).toContainText(
      "None of your 10 posts here cover this. New group idea: Customer stories",
    );
    await expect(row(page, "Fits Studio on Instagram")).toContainText(
      new RegExp(
        `Customer stories, 2 posts, last posted Aug 1${YEAR}, next scheduled [A-Z][a-z]{2} \\d{1,2}`,
      ),
    );
  });

  test("channels we can't read are left out", async ({ page }) => {
    await expect(page.getByRole("listitem").filter({ hasText: /threads|mastodon/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole("listitem").filter({ has: page.locator("b") })).toHaveCount(4);
  });

  test("a channel with thin history shows the empty state", async ({ page }) => {
    await expect(row(page, "@examplestudio")).toContainText(
      "Only 2 of 4 posts on this channel have enough text to compare, so we can't compare yet.",
    );
    await expect(page.getByText(/^Fits @examplestudio|^New for @examplestudio/)).toHaveCount(0);
  });

  test("it counts the Ideas and queued posts that already cover it", async ({ page }) => {
    await expect(
      page.getByText("You already have 2 ideas and 1 queued post on this."),
    ).toBeVisible();
  });

  test("it never predicts how a post will do", async ({ page }) => {
    const words = await page.getByRole("region", { name: "How it fits your channels" }).innerText();

    expect(words).not.toMatch(/will perform|likely to|score|engagement/i);
  });

  test("it stays readable on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(row(page, "Fits Example Studio")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});

test("without chosen channels, the card says there is no fit yet", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/inbox");
  await page.getByRole("button", { name: "A founder story" }).click();

  await expect(page.getByText("There's no fit check for this one yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose your channels" })).toHaveAttribute(
    "href",
    "/channels",
  );
});
