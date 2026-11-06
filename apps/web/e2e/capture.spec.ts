import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { signIn } from "./support/session";

const inbox = (page: Page) => page.getByRole("region", { name: "Your captures" });
const field = (page: Page) => page.getByLabel("Paste a post or a link");
const spark = (page: Page) => page.getByRole("button", { name: "Find the spark" });

/** Saving moves on to the capture's page, so come back to see the list. */
async function saveThenReturn(page: Page) {
  await spark(page).click();
  await expect(page).toHaveURL(/\/inbox\/[\w-]+/);
  await page.goto("/inbox");
}

test("signed out, the inbox sends you to connect", async ({ page }) => {
  await page.goto("/inbox");

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Connect your Buffer account" })).toBeVisible();
});

test.describe("signed in", () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context);
    await page.goto("/inbox");
  });

  test("an empty inbox offers an example, which lands in one click", async ({ page }) => {
    await expect(page.getByText("Nothing here yet.")).toBeVisible();

    await page.getByRole("button", { name: "A founder story" }).click();
    await expect(page).toHaveURL(/\/inbox\/[\w-]+/);
    await page.goto("/inbox");

    await expect(inbox(page).getByRole("article")).toHaveCount(1);
    await expect(inbox(page).getByText("Example", { exact: false })).toBeVisible();
    await expect(page.getByText("Nothing here yet.")).toBeHidden();
  });

  test("pasted text can be corrected, saved, and survives a reload", async ({ page }) => {
    await field(page).fill("Consistancy beats talent when you post every week.");
    await field(page).fill("Consistency beats talent when you post every week.");
    await saveThenReturn(page);

    await expect(inbox(page).getByText("Consistency beats talent")).toBeVisible();
    await expect(field(page)).toHaveValue("");

    await page.reload();

    await expect(inbox(page).getByText("Consistency beats talent")).toBeVisible();
  });

  test("a YouTube link fills the field, names its source, and saves with a link", async ({
    page,
  }) => {
    const url = "https://www.youtube.com/watch?v=e2e";

    await field(page).fill(url);
    await page.getByRole("button", { name: "Read this link" }).click();

    await expect(field(page)).toHaveValue("How I plan a month of posts in one afternoon");
    await expect(page.getByText("From Example Channel")).toBeVisible();

    await saveThenReturn(page);

    const source = inbox(page).getByRole("link", { name: "Example Channel" });
    await expect(source).toHaveAttribute("href", url);
    await expect(source).toHaveAttribute("rel", /noopener/);
  });

  test("a LinkedIn link asks for the text, and saving keeps the link", async ({ page }) => {
    const url = "https://www.linkedin.com/posts/someone-123";

    await field(page).fill(url);
    await page.getByRole("button", { name: "Read this link" }).click();

    await expect(page.getByText("We can't read that page.")).toBeVisible();
    await expect(field(page)).toHaveValue("");
    await expect(field(page)).toBeFocused();

    await field(page).fill("The text I copied from the post.");
    await expect(page.getByText("We can't read that page.")).toBeHidden();
    await saveThenReturn(page);

    await expect(inbox(page).getByRole("link", { name: "linkedin.com" })).toHaveAttribute(
      "href",
      url,
    );
  });

  test("text over the limit is flagged, then saved at the limit", async ({ page }) => {
    await field(page).fill("a".repeat(1_200));

    await expect(page.getByText("We keep the first 1,000 characters.")).toBeVisible();

    await saveThenReturn(page);

    const saved = inbox(page).getByRole("article");
    await expect(saved).toHaveCount(1);
    await expect(saved).toContainText("a".repeat(1_000));
    await expect(saved).not.toContainText("a".repeat(1_001));
  });

  test("a failed save keeps the text", async ({ page }) => {
    await page.route("**/api/trpc/capture.create*", (route) => route.abort());

    await field(page).fill("Please keep this.");
    await spark(page).click();

    await expect(page.getByText("That didn't save.")).toBeVisible();
    await expect(field(page)).toHaveValue("Please keep this.");
  });

  test("a finished session offers to connect again, keeping the text", async ({
    context,
    page,
  }) => {
    await expect(page.getByText("Nothing here yet.")).toBeVisible();

    await context.clearCookies();
    await field(page).fill("Worth keeping.");
    await spark(page).click();

    await expect(page.getByRole("link", { name: "Connect your Buffer account" })).toBeVisible();
    await expect(field(page)).toHaveValue("Worth keeping.");
  });
});

test("a failed inbox offers another try", async ({ context, page }) => {
  await signIn(context);
  await page.route("**/api/trpc/capture.inbox*", (route) => route.abort());

  await page.goto("/inbox");

  await expect(page.getByText("We couldn't open your inbox.")).toBeVisible();

  await page.unroute("**/api/trpc/capture.inbox*");
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByText("Nothing here yet.")).toBeVisible();
});
