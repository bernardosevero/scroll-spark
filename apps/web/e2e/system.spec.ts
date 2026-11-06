import { expect, test } from "@playwright/test";

test("the design system page shows every specimen", async ({ page }) => {
  await page.goto("/system");

  await expect(page.getByRole("heading", { name: "Riso Print" })).toBeVisible();

  for (const title of ["Colour", "Type", "Actions", "Surfaces", "Notices", "Motion"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }

  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.getByTestId("spark-burst")).toBeAttached();

  for (const moment of ["fit-reveal", "spark-wait", "idea-flight", "post-lift"]) {
    await expect(page.getByTestId(moment).first()).toBeAttached();
  }
});

test.describe("when someone asks for reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the celebration stays still and the page still works", async ({ page }) => {
    await page.goto("/system");

    await page.getByRole("button", { name: "Replay" }).click();

    await expect(page.getByText("Celebration, under 800 ms.")).toBeVisible();
    await expect(page.getByTestId("spark-burst")).toHaveCount(0);

    for (const moment of ["fit-reveal", "spark-wait", "idea-flight", "post-lift"]) {
      await expect(page.getByTestId(moment)).toHaveCount(0);
    }

    await expect(page.getByText("Finding the spark…")).toBeVisible();
    await expect(page.getByText("Saved to Buffer Ideas")).toBeVisible();
  });
});
