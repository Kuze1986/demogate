import { expect, test } from "@playwright/test";

test("demo intake renders and navigation controls exist", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Build your personalized walkthrough" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo intake" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  expect(consoleErrors).toEqual([]);
});

