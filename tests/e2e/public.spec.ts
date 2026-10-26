import { test, expect } from "./fixtures";

test("public navigation displays each main page without admin write controls", async ({ page, backend }) => {
  expect(backend.roundWrites).toEqual([]);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Come Follow Ryan's Growth");
  await expect(page.getByText("Last Score", { exact: true })).toBeVisible();

  for (const [link, path, heading] of [
    ["Rounds", "/rounds", "Rounds"],
    ["Stats", "/stats", "Stats"],
    ["Courses", "/courses", "My Courses"],
    ["Clubs", "/clubs", "My Bag"],
    ["Scrambles", "/scrambles", "Scrambles"],
    ["Home", "/", "Come Follow Ryan's Growth"],
  ]) {
    await page.getByRole("link", { name: link, exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByRole("button", { name: /add course|add club|log match/i })).toHaveCount(0);
  }
});

test("home shows a useful error when data cannot load", async ({ page, backend }) => {
  backend.failHome = true;
  await page.goto("/");
  await expect(page.getByText("Could not load recent rounds. Check your connection and refresh.")).toBeVisible();
});

test("unauthenticated round logging redirects to login", async ({ page, backend }) => {
  await page.goto("/log-round");
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  expect(backend.roundWrites).toEqual([]);
});

test("invalid login shows an error and stays on login", async ({ page, backend }) => {
  backend.failLogin = true;
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@example.test");
  await page.locator('input[type="password"]').fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("form").getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled();
});
