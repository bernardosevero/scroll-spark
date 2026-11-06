import { expect, test } from "@playwright/test";

test("connecting sends the user to Buffer with a protected request", async ({ page, request }) => {
  await page.goto("/");

  const link = page.getByRole("link", { name: "Connect your Buffer account" });
  await expect(link).toHaveAttribute("href", "/api/auth/connect");

  // Stops at the redirect, since tests never reach real services.
  const response = await request.get("/api/auth/connect", { maxRedirects: 0 });
  const authorizeUrl = new URL(response.headers()["location"] ?? "");

  expect(response.status()).toBe(307);
  expect(authorizeUrl.origin).toBe("https://auth.buffer.com");
  expect(authorizeUrl.searchParams.get("client_id")).toBe("e2e-client");
  expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
  expect(authorizeUrl.searchParams.get("state")).toBeTruthy();
  expect(authorizeUrl.searchParams.get("scope")).toContain("offline_access");

  const cookie = response.headers()["set-cookie"] ?? "";
  expect(cookie).toContain("ss_oauth_pending=");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=lax");
});

test("a failed connection explains itself and offers another try", async ({ page }) => {
  await page.goto("/api/auth/callback?error=access_denied");

  await expect(page.getByText("Nothing was saved")).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect your Buffer account" })).toBeVisible();
});
