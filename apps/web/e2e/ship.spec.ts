import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { newSoloOrganizationUserId } from "../src/server/buffer/fakes";
import { signIn } from "./support/session";

const DRAFT = "One customer sent me a single sentence last month. It changed what I built next.";

async function analyzeExample(page: Page) {
  await page.goto("/inbox");
  await page.getByRole("button", { name: "A founder story" }).click();
  await expect(
    page.getByRole("heading", { name: "The quiet customer who changed what you built" }),
  ).toBeVisible();
}

async function draftForLinkedIn(page: Page) {
  await page.getByRole("button", { name: "Write a draft" }).click();
  await expect(page.getByLabel("Your draft")).toHaveValue(DRAFT);
}

test.describe("with one organization", () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, { userId: newSoloOrganizationUserId() });
    await analyzeExample(page);
  });

  test("analyze, save the idea, draft, edit and save as a draft, with each step confirmed", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Save as idea" }).click();
    await expect(page.getByText("Saved to Buffer Ideas")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save as idea" })).toBeHidden();

    await draftForLinkedIn(page);
    await expect(page.getByRole("heading", { name: "Sounds like you?" })).toBeVisible();
    await expect(page.getByText("Written from your last 8 posts on this channel.")).toBeVisible();

    await page.getByLabel("Your draft").fill(`${DRAFT} What did yours say?`);
    await page.getByRole("button", { name: "Save as draft" }).click();

    await expect(page.getByText("Saved as a draft in Buffer for Example Studio.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save as draft" })).toBeDisabled();
  });

  test("the idea stays saved after a reload, and can't be saved twice", async ({ page }) => {
    await page.getByRole("button", { name: "Save as idea" }).click();
    await expect(page.getByText("Saved to Buffer Ideas")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Saved to Buffer Ideas")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save as idea" })).toBeHidden();
  });

  test("Add to queue names the channel and confirms", async ({ page }) => {
    await draftForLinkedIn(page);

    await page.getByRole("button", { name: "Add to LinkedIn queue" }).click();

    await expect(
      page.getByText("Added to the LinkedIn queue in Buffer for Example Studio."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to LinkedIn queue" })).toBeDisabled();
  });

  test("Save as draft is the main action, and the queue is second", async ({ page }) => {
    const draft = page.getByRole("button", { name: "Save as draft" });
    const queue = page.getByRole("button", { name: "Add to LinkedIn queue" });

    await expect(draft).toHaveClass(/bg-spark/);
    await expect(queue).not.toHaveClass(/bg-spark/);
  });

  test("channels that can't be posted to are disabled, with their reason", async ({ page }) => {
    const instagram = page.getByRole("radio", { name: /Studio on Instagram/ });
    await expect(instagram).toBeDisabled();
    await expect(instagram).toHaveAccessibleDescription(/Needs an image or video/);
    await expect(page.getByRole("radio", { name: /threads/i })).toBeDisabled();
    await expect(page.getByText("This channel is locked on your Buffer plan.")).toBeVisible();
    await expect(page.getByRole("radio", { name: /mastodon/i })).toBeDisabled();
    await expect(page.getByText("Reconnect this channel in Buffer to use it.")).toBeVisible();
    await expect(page.getByRole("radio", { name: /Example Studio/ })).toBeChecked();
  });

  test("the editor enforces the channel's character limit", async ({ page }) => {
    await page.getByRole("radio", { name: /@examplestudio/ }).check();
    await page.getByLabel("Your draft").fill("a".repeat(281));

    await expect(page.getByText("281 of 280 characters. That's 1 over")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save as draft" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Add to X queue" })).toBeDisabled();

    await page.getByLabel("Your draft").fill("a".repeat(280));

    await expect(page.getByRole("button", { name: "Add to X queue" })).toBeEnabled();
  });

  test("a draft that copies the post gets a warning, and an original one doesn't", async ({
    page,
  }) => {
    await draftForLinkedIn(page);
    const warning = page.getByText("close to the post you captured");
    await expect(warning).toBeHidden();

    const captured = await page.locator("#source-title + p").innerText();
    await page.getByLabel("Your draft").fill(captured);

    await expect(warning).toBeVisible();
  });

  test("a plan limit is explained, and the text stays", async ({ page }) => {
    await page.getByLabel("Your draft").fill("A post for a full plan [limit]");

    await page.getByRole("button", { name: "Add to LinkedIn queue" }).click();

    await expect(page.getByText("Your Buffer plan has reached its limit for posts")).toBeVisible();
    await expect(page.getByLabel("Your draft")).toHaveValue("A post for a full plan [limit]");
  });

  test("a failed post isn't retried, and the text stays", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/trpc/*post.create*", (route) => {
      attempts += 1;
      return route.abort();
    });
    await page.getByLabel("Your draft").fill("My careful post.");

    await page.getByRole("button", { name: "Add to LinkedIn queue" }).click();

    await expect(page.getByText("We couldn't confirm this reached Buffer")).toBeVisible();
    await expect(page.getByLabel("Your draft")).toHaveValue("My careful post.");
    await expect(page.getByRole("button", { name: "Add to LinkedIn queue" })).toBeEnabled();
    expect(attempts).toBe(1);
  });

  test("a failed draft keeps what you typed", async ({ page }) => {
    await page.route("**/api/trpc/*draft.create*", (route) => route.abort());
    await page.getByLabel("Your draft").fill("Typed before asking for help.");

    await page.getByRole("button", { name: "Write a draft" }).click();

    await expect(page.getByText("That didn't work this time.")).toBeVisible();
    await expect(page.getByLabel("Your draft")).toHaveValue("Typed before asking for help.");
  });

  test("a failed draft offers a prompt for your own assistant, without the original post", async ({
    page,
  }) => {
    await page.getByLabel("Write in").selectOption("german");

    await page.getByRole("button", { name: "Write a draft" }).click();

    await expect(page.getByText("That didn't work this time.")).toBeVisible();
    const panel = page.getByRole("region", { name: "Write it with your own assistant" });
    await expect(panel.getByRole("button", { name: "Copy prompt" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Open Claude" })).toHaveAttribute(
      "href",
      "https://claude.ai/new",
    );
    await expect(panel.getByRole("link", { name: "Open ChatGPT" })).toHaveAttribute(
      "href",
      "https://chatgpt.com/",
    );

    await panel.getByText("See the prompt").click();
    const prompt = panel.locator("pre");
    await expect(prompt).toContainText("The quiet customer who changed what you built");
    await expect(prompt).toContainText("Write it in German.");
    await expect(prompt).not.toContainText("We spent eight months");

    await page.getByLabel("Your draft").fill("Pasted from my own assistant.");
    await expect(page.getByRole("button", { name: "Save as draft" })).toBeEnabled();
  });

  test("the draft can be written in another language", async ({ page }) => {
    await page.getByLabel("Write in").selectOption("portuguese");

    await page.getByRole("button", { name: "Write a draft" }).click();

    await expect(page.getByLabel("Your draft")).toHaveValue(/Um cliente me mandou/);
  });

  test("a channel with too few posts says so instead of faking a voice", async ({ page }) => {
    await page.getByRole("radio", { name: /@examplestudio/ }).check();

    await page.getByRole("button", { name: "Write a draft" }).click();

    await expect(page.getByText("We found only 2 usable posts on this channel")).toBeVisible();
  });
});

test("with two organizations, saving asks for the organization first", async ({
  context,
  page,
}) => {
  await signIn(context);
  await analyzeExample(page);

  await expect(page.getByRole("link", { name: "Choose organization" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Write a draft" })).toBeHidden();
});
