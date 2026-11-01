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
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-desktop.png`,
    fullPage: true,
  });
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
  const shop = page.locator("article").filter({
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
  await page.locator("input[type=file]").setInputFiles({
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
  await page.locator("input[type=file]").setInputFiles({
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
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-mobile.png`,
    fullPage: true,
  });
  expect(external).toEqual([]);
});

test("offline shell reopens saved data and allows a new local shift", async ({
  page,
  context,
}) => {
  await sample(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
  });
  page.on("pageerror", (error) =>
    console.log("OFFLINE_PAGE_ERROR=" + error.message),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("article.entry"))
    .toHaveCount(4)
    .catch(async (error) => {
      console.log("OFFLINE_BODY=" + (await page.locator("body").innerText()));
      throw error;
    });
  await page
    .getByLabel("Job / workplace", { exact: true })
    .fill("Offline shift");
  await page.getByLabel("Start time", { exact: true }).fill("14:00");
  await page
    .getByRole("button", { name: "Check this shift", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fits your current plan" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add to my plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Offline shift", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Offline shift", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("a simulated storage write failure keeps the committed data and draft", async ({
  page,
}) => {
  await sample(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Simulated quota failure", "QuotaExceededError");
    };
  });
  await proposal(page, "Unsaved shift");
  await page
    .getByRole("checkbox", { name: "Keep these entries despite the clashes" })
    .check();
  await page
    .getByRole("button", { name: "Add to my plan", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Could not save");
  await expect(page.getByLabel("Job / workplace", { exact: true })).toHaveValue(
    "Unsaved shift",
  );
  await expect(page.locator("article.entry")).toHaveCount(4);
  await page.reload();
  await expect(page.locator("article.entry")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "Unsaved shift", exact: true }),
  ).toHaveCount(0);
});
test("unsupported stored schema is surfaced without resetting the database", async ({
  page,
}) => {
  await sample(page);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("roster-pocket", 1);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("workspace", "readwrite"),
          s = tx.objectStore("workspace"),
          get = s.get("current");
        get.onsuccess = () =>
          s.put(
            { ...get.result, data: { ...get.result.data, schemaVersion: 99 } },
            "current",
          );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("not supported");
  await expect(
    page.getByRole("button", { name: "Try a sample week" }),
  ).toHaveCount(0);
  const version = await page.evaluate(
    async () =>
      await new Promise((resolve) => {
        const r = indexedDB.open("roster-pocket", 1);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("workspace", "readonly"),
            q = tx.objectStore("workspace").get("current");
          q.onsuccess = () => resolve(q.result.data.schemaVersion);
          tx.oncomplete = () => db.close();
        };
      }),
  );
  expect(version).toBe(99);
});
test("CSV download exposes unconfirmed actuals as empty cells", async ({
  page,
}) => {
  await sample(page);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export hours CSV" }).click();
  const file = await downloading;
  const text = await readFile((await file.path())!, "utf8");
  expect(text.split("\r\n").length).toBe(5);
  expect(text).toContain('"Demo · Bookshop"');
  expect(text).toContain(',"","","",""');
});

test("sample preserves personal preferences and above-budget previews remain explicit", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Weekly hour budget", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved");
  await page.getByRole("button", { name: "Try a sample week" }).click();
  await expect(
    page.getByRole("region", { name: "Week summary" }),
  ).toContainText("10 h");
  await page
    .getByLabel("Job / workplace", { exact: true })
    .fill("Extra afternoon");
  await page.getByLabel("Start time", { exact: true }).fill("14:00");
  await page
    .getByRole("button", { name: "Check this shift", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Above your hour budget", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to my plan", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("region", { name: "Week summary" }),
  ).toContainText("11 h");
});
