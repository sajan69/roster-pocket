import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function open(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for your week." }),
  ).toBeVisible();
  await page.getByLabel("Week starting", { exact: true }).fill("2026-11-02");
}
async function sample(page) {
  await open(page);
  await page.getByRole("button", { name: "Try a sample week" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Sample schedule loaded",
  );
}
async function proposal(page, label = "Extra shift") {
  await page.getByLabel("Job / workplace", { exact: true }).fill(label);
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-02");
  await page.getByLabel("End date", { exact: true }).fill("2026-11-02");
  await page
    .getByRole("button", { name: "Check this shift", exact: true })
    .click();
}
test("sample records survive reload and keep unknown actual work explicit", async ({
  page,
}) => {
  await sample(page);
  const summary = page.getByRole("region", { name: "Week summary" });
  await expect(summary).toContainText("11 h");
  await expect(summary).toContainText("6 h");
  await expect(summary).toContainText("1 work shift unconfirmed");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Demo · Bookshop", exact: true }),
  ).toBeVisible();
  await expect(page.locator("article.entry")).toHaveCount(4);
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
});
test("preview has no write and overlap requires explicit override; HTML labels stay inert", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await sample(page);
  await proposal(page, "<img src=x onerror=alert(1)>");
  await expect(
    page.getByRole("heading", { name: "A closer look needed" }),
  ).toBeVisible();
  await expect(page.locator("article.entry")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Add to my plan", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Keep these entries despite the clashes" })
    .check();
  await page
    .getByRole("button", { name: "Add to my plan", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Added to your plan");
  await expect(page.locator("article.entry")).toHaveCount(5);
  await expect(page.locator("img")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "<img src=x onerror=alert(1)>",
      exact: true,
    }),
  ).toBeVisible();
});
test("recorded zero actual hours never changes the original plan", async ({
  page,
}) => {
  await sample(page);
  await page
    .getByRole("button", { name: "Record actual hours", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Actual unpaid break (minutes)", { exact: true })
    .fill("360");
  await dialog.getByRole("button", { name: "Save actual hours" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "Week summary" }),
  ).toContainText("0 work shifts unconfirmed");
  const shop = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Demo · Bookshop", exact: true }),
    });
  await expect(shop).toContainText("Planned 5.5 h");
  await expect(shop).toContainText("Actual 0 h");
});
test("DST rejection and local-clock weekly commitments", async ({ page }) => {
  await open(page);
  await page
    .getByRole("combobox", { name: "View time zone", exact: true })
    .selectOption("Australia/Sydney");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved");
  await page
    .getByRole("combobox", { name: "Entry type" })
    .selectOption("commitment");
  await page
    .getByLabel("Commitment name", { exact: true })
    .fill("Sunday class");
  await page.getByLabel("Start date", { exact: true }).fill("2026-10-04");
  await page.getByLabel("End date", { exact: true }).fill("2026-10-04");
  await page.getByLabel("Start time", { exact: true }).fill("02:30");
  await page.getByLabel("End time", { exact: true }).fill("04:00");
  await page
    .getByRole("button", { name: "Check commitment", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("invalid or ambiguous");
  await page.getByLabel("Start date", { exact: true }).fill("2026-09-27");
  await page.getByLabel("End date", { exact: true }).fill("2026-09-27");
  await page.getByLabel("Start time", { exact: true }).fill("09:00");
  await page.getByLabel("End time", { exact: true }).fill("11:00");
  await page.getByLabel("Repeat weekly for (weeks)", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Check commitment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to my plan", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Added to your plan");
  await page.getByLabel("Week starting", { exact: true }).fill("2026-09-28");
  await expect(page.locator("article.entry")).toHaveCount(1);
  await expect(page.locator("article.entry")).toContainText("09:00 → 11:00");
});
test("backup round trip and invalid imports preserve saved records", async ({
  page,
}) => {
  await sample(page);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const file = await downloading;
  const backup = await readFile((await file.path())!);
  const json = JSON.parse(backup.toString());
  expect(json.entries.length).toBe(4);
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schemaVersion":3}'),
    });
  await expect(page.getByRole("alert")).toContainText(
    "no records were changed",
  );
  await expect(page.locator("article.entry")).toHaveCount(4);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete all entries", exact: true })
    .click();
  await expect(page.locator("article.entry")).toHaveCount(0);
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: backup,
    });
  await page
    .getByRole("button", { name: "Replace with backup", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await expect(page.locator("article.entry")).toHaveCount(4);
});
test("two tabs refuse stale writes instead of overwriting newer data", async ({
  page,
  context,
}) => {
  await open(page);
  const second = await context.newPage();
  await open(second);
  await page.getByRole("button", { name: "Try a sample week" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Sample schedule loaded",
  );
  await proposal(second, "Stale write");
  await second
    .getByRole("button", { name: "Add to my plan", exact: true })
    .click();
  await expect(second.getByRole("alert")).toContainText(
    "Another tab saved changes",
  );
  await second.reload();
  await expect(second.locator("article.entry")).toHaveCount(4);
  await expect(
    second.getByRole("heading", { name: "Stale write", exact: true }),
  ).toHaveCount(0);
});
test("mobile layout contains its content and has no third-party requests", async ({
  page,
}) => {
  const external = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:4173/")
    )
      external.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  expect(external).toEqual([]);
});
