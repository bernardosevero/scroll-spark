import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { newSoloOrganizationUserId } from "../src/server/buffer/fakes";
import { signIn } from "./support/session";

const ANGLE = "The quiet customer who changed what you built";
const DRAFT = "One customer sent me a single sentence last month. It changed what I built next.";
const LAYERS = ["post-lift", "spark-wait", "fit-reveal", "idea-flight", "spark-burst"] as const;

async function delay(page: Page, pattern: string, ms: number) {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

async function openExample(page: Page) {
  await page.goto("/inbox");
  await page.getByRole("button", { name: "A founder story" }).click();
  await expect(page.getByRole("heading", { name: ANGLE })).toBeVisible();
}

async function writeDraft(page: Page) {
  await page.getByRole("button", { name: "Write a draft" }).click();
  await expect(page.getByLabel("Your draft")).toHaveValue(DRAFT);
}

const hasOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

test.describe("with reduced motion", () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, { userId: newSoloOrganizationUserId() });
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the whole capture-to-post flow completes, every result in words and none animated", async ({
    page,
  }) => {
    await openExample(page);
    await expect(page.getByRole("heading", { name: "How it fits your channels" })).toBeVisible();
    await expect(page.getByText(/Customer stories, 3 posts/)).toBeVisible();

    await page.getByRole("button", { name: "Save as idea" }).click();
    await expect(page.getByText("Saved to Buffer Ideas")).toBeVisible();

    await writeDraft(page);
    await page.getByRole("button", { name: "Add to LinkedIn queue" }).click();
    await expect(
      page.getByText("Added to the LinkedIn queue in Buffer for Example Studio."),
    ).toBeVisible();

    for (const layer of LAYERS) {
      await expect(page.getByTestId(layer)).toHaveCount(0);
    }
  });

  test("waiting is still said in words", async ({ page }) => {
    await delay(page, "**/api/trpc/*capture.analyze*", 600);
    await page.goto("/inbox");
    await page.getByRole("button", { name: "A founder story" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Finding the spark…" })).toBeVisible();
    await expect(page.getByText("Saved to your inbox")).toBeVisible();
    await expect(page.getByTestId("spark-wait")).toHaveCount(0);
  });
});

test.describe("with motion", () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, { userId: newSoloOrganizationUserId() });
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  test("waiting shows a turning spark and the steps it really knows", async ({ page }) => {
    await delay(page, "**/api/trpc/*capture.analyze*", 800);
    await page.goto("/inbox");
    await page.getByRole("button", { name: "A founder story" }).click();

    const waiting = page.getByRole("status").filter({ hasText: "Finding the spark…" });
    await expect(waiting).toBeVisible();
    await expect(waiting.getByText("Saved to your inbox")).toBeVisible();
    await expect(page.getByTestId("spark-wait")).toBeAttached();
    await expect(page.getByRole("heading", { name: ANGLE })).toBeVisible();
    await expect(page.getByTestId("spark-wait")).toHaveCount(0);
  });

  test("the fit reveal counts up to the real number of matching posts", async ({ page }) => {
    await openExample(page);

    const fans = page.getByTestId("fit-reveal");
    await expect(fans).toHaveText(["3", "2"]);
    await expect(
      page.getByRole("region", { name: "How it fits your channels" }).getByRole("listitem").first(),
    ).toContainText("Fits Example Studio");
  });

  test("the capture lifts off the form once it is saved, without holding up the next page", async ({
    page,
  }) => {
    await page.goto("/inbox");
    await delay(page, "**/inbox/*", 700);

    await page.getByRole("button", { name: "A founder story" }).click();

    await expect(page.getByTestId("post-lift")).toBeAttached();
    await expect(page).toHaveURL(/\/inbox\/[\w-]+/);
  });

  test("the queue burst plays after the post is queued, and controls still work meanwhile", async ({
    page,
  }) => {
    await openExample(page);
    await writeDraft(page);

    await page.getByRole("button", { name: "Add to LinkedIn queue" }).click();
    const burst = page.getByTestId("spark-burst");
    await expect(burst).toBeAttached();
    await expect(burst).toHaveCSS("pointer-events", "none");

    await page.getByLabel("Your draft").fill("Typing while sparks fly.");
    await page.getByRole("button", { name: "Save as draft" }).click();

    await expect(page.getByLabel("Your draft")).toHaveValue("Typing while sparks fly.");
    await expect(page.getByText("Saved as a draft in Buffer for Example Studio.")).toBeVisible();
  });

  test("the idea flies to its pile only after it is saved, and controls still work meanwhile", async ({
    page,
  }) => {
    await openExample(page);
    await expect(page.getByTestId("idea-flight")).toHaveCount(0);

    await page.getByRole("button", { name: "Save as idea" }).click();
    await expect(page.getByTestId("idea-flight")).toBeAttached();
    await page.getByRole("button", { name: "Write a draft" }).click();

    await expect(page.getByLabel("Your draft")).toHaveValue(DRAFT);
    await expect(page.getByText("Saved to Buffer Ideas")).toBeVisible();
  });

  test("an idea that was saved earlier doesn't fly again", async ({ page }) => {
    await openExample(page);
    await page.getByRole("button", { name: "Save as idea" }).click();
    await expect(page.getByText("Saved to Buffer Ideas")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Saved to Buffer Ideas")).toBeVisible();
    await expect(page.getByTestId("idea-flight")).toHaveCount(0);
  });

  test("a failed idea save shows the error and no celebration", async ({ page }) => {
    await openExample(page);
    await page.route("**/api/trpc/*capture.saveAsIdea*", (route) => route.abort());

    await page.getByRole("button", { name: "Save as idea" }).click();

    await expect(page.getByText("That didn't save. Your capture is safe")).toBeVisible();
    await expect(page.getByTestId("idea-flight")).toHaveCount(0);
  });

  test("a failed post shows the error and no celebration", async ({ page }) => {
    await openExample(page);
    await writeDraft(page);
    await page.route("**/api/trpc/*post.create*", (route) => route.abort());

    await page.getByRole("button", { name: "Add to LinkedIn queue" }).click();

    await expect(page.getByText("We couldn't confirm this reached Buffer")).toBeVisible();
    await expect(page.getByTestId("spark-burst")).toHaveCount(0);
  });

  test("a failed capture save shows the error and no lift", async ({ page }) => {
    await page.goto("/inbox");
    await page.route("**/api/trpc/*capture.create*", (route) => route.abort());

    await page.getByRole("button", { name: "A founder story" }).click();

    await expect(page.getByText("That didn't save.")).toBeVisible();
    await expect(page.getByTestId("post-lift")).toHaveCount(0);
  });

  test("on a phone nothing spills sideways while the moments play", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openExample(page);

    for (let sample = 0; sample < 8; sample += 1) {
      expect(await hasOverflow(page)).toBe(false);
      await page.waitForTimeout(100);
    }

    await page.getByRole("button", { name: "Save as idea" }).click();
    await writeDraft(page);
    await page.getByRole("button", { name: "Add to LinkedIn queue" }).click();

    for (let sample = 0; sample < 8; sample += 1) {
      expect(await hasOverflow(page)).toBe(false);
      await page.waitForTimeout(100);
    }
  });
});
