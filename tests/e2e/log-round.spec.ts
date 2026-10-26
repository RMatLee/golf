import type { Page } from "@playwright/test";
import { test, expect, course } from "./fixtures";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@example.test");
  await page.locator('input[type="password"]').fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/log-round");
  await expect(page.getByRole("heading", { name: "Log a Round" })).toBeVisible();
}

async function details(page: Page, holes: 9 | 18, score: number) {
  await page.getByRole("button", { name: `${holes} Holes`, exact: true }).click();
  await page.locator('input[type="date"]').fill("2026-10-20");
  await page.locator('input[type="number"]').nth(0).fill(String(score));
  await page.locator('input[type="number"]').nth(1).fill(holes === 9 ? "15" : "30");
  await page.getByRole("button", { name: "Next — Select Course" }).click();
  await page.getByRole("combobox").selectOption(course.id);
}

test("admin logs an 18-hole round, invalidates cache, and can reset the form", async ({ page, backend }) => {
  await signIn(page);
  await details(page, 18, 84);
  await page.getByRole("button", { name: "Log Round", exact: true }).click();
  await expect(page.getByText("Round Logged", { exact: true })).toBeVisible();
  expect(backend.roundWrites).toEqual([{
    date: "2026-10-20", course_id: course.id, score: 84, par: 72, holes: 18,
    putts: 30, handicap: 11.3,
  }]);
  expect(backend.invalidations).toBe(1);
  await expect(page.getByText("+12 over par", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log Another Round" }).click();
  await expect(page.locator('input[type="number"]').nth(0)).toHaveValue("");
});

for (const [side, par, handicap] of [["Front", 35, 7.4], ["Back", 37, 5.7]] as const) {
  test(`admin logs a ${side.toLowerCase()} nine using the course split`, async ({ page, backend }) => {
    await signIn(page);
    await details(page, 9, 43);
    await page.getByRole("button", { name: `${side.toLowerCase()} 9`, exact: true }).click();
    await page.getByRole("button", { name: "Log Round", exact: true }).click();
    await expect(page.getByText("Round Logged", { exact: true })).toBeVisible();
    expect(backend.roundWrites).toEqual([{
      date: "2026-10-20", course_id: course.id, score: 43, par, holes: 9, putts: 15,
      handicap, nine_hole_type: side.toLowerCase(),
    }]);
    expect(backend.invalidations).toBe(1);
  });
}

test("a failed round insert displays an error and allows retry without invalidation", async ({ page, backend }) => {
  backend.failRoundWrite = true;
  await signIn(page);
  await details(page, 18, 84);
  await page.getByRole("button", { name: "Log Round", exact: true }).click();
  await expect(page.getByText("Failed to save round", { exact: true })).toBeVisible();
  expect(backend.invalidations).toBe(0);
  await expect(page.getByText("Round Logged", { exact: true })).toHaveCount(0);
  backend.failRoundWrite = false;
  await page.getByRole("button", { name: "Log Round", exact: true }).click();
  await expect(page.getByText("Round Logged", { exact: true })).toBeVisible();
  expect(backend.roundWrites).toHaveLength(2);
  expect(backend.invalidations).toBe(1);
});

test("required round details prevent advancing an empty form", async ({ page, backend }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Next — Select Course" }).click();
  await expect(page.locator('input[type="number"]').nth(0)).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  expect(backend.roundWrites).toEqual([]);
});
