import { expect, test } from "@playwright/test";

test("the website reaches the API through every layer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Scroll Spark" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("pong, website");
});
