import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { expectNoHorizontalScroll, sheet, signIn, signInAdmin, todayIso } from "./helpers";

/** Home page: the "Open" button on a factory's row. */
async function openFactory(page: Page, name: string) {
  await page.getByRole("button", { name: `Open ${name}` }).click();
  await expect(page.locator("[data-testid^=machine-tile-]").first()).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("pages that work without signing in", async ({ page }) => {
  await page.goto("/#/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await page.goto("/#/terms");
  await expect(page.getByRole("heading", { name: "Terms and Conditions" })).toBeVisible();
  await page.goto("/#/status");
  await expect(page.getByRole("cell", { name: "Database" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Database OK/ })).toBeVisible();
});

test("wrong password shows the error code", async ({ page }) => {
  await signIn(page, "admin", "not-the-password");
  await expect(page.getByText("Wrong username or password")).toBeVisible();
  await expect(page.getByText("Error code AUTH-001")).toBeVisible();
});

test("admin first sign-in, globe home, factory, machine", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signInAdmin(page);
  await expect(page.locator("[data-testid^=factory-row-]")).toHaveCount(6);
  await expect(page.getByRole("listitem").filter({ hasText: "Factories" })).toContainText("6");
  await expect(page.locator("[data-testid=globe] canvas")).toBeAttached();
  await expect(page.locator("[data-testid^=factory-row-]").first()).toContainText("Data from");

  // Showing a factory on the globe, then opening it from the card on the globe.
  await page.getByRole("button", { name: "Show Indore Plant on the globe" }).click();
  await expect(page).toHaveURL(/\?f=\d+/);
  await expect(page.getByTestId("selected-factory")).toContainText("Indore Plant");
  await page.getByTestId("selected-factory").getByRole("button", { name: "Open factory" }).click();
  await expect(page.getByRole("heading", { name: "Indore Plant" })).toBeVisible();
  await expect(page.locator("[data-testid^=machine-tile-]")).toHaveCount(6);
  await expect(page.locator("[data-testid=factory-floor]")).toBeAttached();

  // A tile opens the machine's details next to the 3D view; the address and breadcrumb follow.
  await page.getByTestId("machine-tile-M-03").click();
  await expect(page.getByRole("heading", { name: "Hydraulic Press" })).toBeVisible();
  await expect(page).toHaveURL(/\/machines\/\d+/);
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Hydraulic Press");
  await page.getByRole("button", { name: /Next machine/ }).click();
  await expect(page.getByRole("heading", { name: "Injection Moulding Machine" })).toBeVisible();

  // 3D toolbar: machine names can be switched off and on; "Whole floor" goes back to the overview.
  // With a machine chosen only its own name shows; on the whole floor all six do.
  await expect(page.locator(".floor-tag:visible")).toHaveCount(1);
  await expect(page.locator(".floor-tag:visible")).toHaveText("M-04");
  await page.getByTestId("floor-names").click();
  await expect(page.locator(".floor-tag")).toHaveCount(0);
  await page.getByTestId("floor-names").click();
  await expect(page.locator(".floor-tag:visible")).toHaveCount(1);
  await page.getByTestId("floor-show-all").click();
  await expect(page).not.toHaveURL(/\/machines\//);
  await expect(page.getByTestId("floor-show-all")).toHaveCount(0);
  await expect(page.locator(".floor-tag:visible")).toHaveCount(6);
  expect(errors).toEqual([]);
});

test("light and dark switch is remembered in this browser", async ({ page }) => {
  await signInAdmin(page);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-switch").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("[data-testid^=factory-row-]").first()).toBeVisible();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByTestId("theme-switch").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("viewer sees only assigned factories and no edit or upload controls", async ({ page }) => {
  await signIn(page, "viewer", "sample-pass-1");
  await expect(page.locator("[data-testid^=factory-row-]")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await page.getByRole("button", { name: /^Open / }).first().click();
  await page.getByRole("link", { name: "Uploads" }).click();
  await expect(page.getByText("Upload a day's sheet")).toHaveCount(0);
  await page.getByRole("link", { name: "Machines" }).click();
  await page.getByTestId("machine-tile-M-01").click();
  await expect(page.getByRole("heading", { name: "CNC Milling Centre" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update status" })).toHaveCount(0);
});

test("supervisor uploads a sheet: errors block saving, a correct file is saved", async ({ page }) => {
  await signIn(page, "supervisor", "sample-pass-1");
  await openFactory(page, "Indore Plant");
  await page.getByRole("link", { name: "Uploads" }).click();
  await page.getByRole("link", { name: "Upload a day's sheet" }).click();

  const day = todayIso();
  await page.getByTestId("upload-input").setInputFiles({
    name: "bad.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await sheet([[day, 1, "M-01", "Running"], [day, 1, "M-99", "Running"], [day, 2, "M-02", "Exploded"]]),
  });
  const preview = page.getByTestId("upload-preview");
  await expect(preview).toContainText('machine "M-99" does not exist in this factory');
  await expect(preview).toContainText("XL-006");
  await expect(page.getByRole("button", { name: "Confirm and save" })).toBeDisabled();

  const rows = ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06"].flatMap((m) => [
    [day, 1, m, "Running", 0, ""],
    [day, 2, m, m === "M-04" ? "Aborted" : "Running", m === "M-04" ? 3 : 0, m === "M-04" ? "Heater fault" : ""],
  ]);
  await page.getByTestId("upload-input").setInputFiles({
    name: "good.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await sheet(rows),
  });
  await expect(preview).toContainText("12 machine shifts will be updated");
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByText(/Saved\. Upload #\d+/)).toBeVisible();

  await page.getByRole("link", { name: "See the machines" }).click();
  await expect(page.getByTestId("machine-tile-M-04")).toContainText("Aborted");
  await expect(page.getByTestId("machine-tile-M-04")).toContainText("aborted 3 times");
  await page.getByRole("link", { name: "Uploads" }).click();
  await expect(page.getByRole("cell", { name: /^good\.xlsx/ })).toBeVisible();
});

test("supervisor edits a status by hand and the admin change log records it", async ({ page }) => {
  await signIn(page, "supervisor", "sample-pass-1");
  await openFactory(page, "Indore Plant");
  await page.getByTestId("machine-tile-M-02").click();
  await page.getByRole("button", { name: "Update status" }).click();
  await page.selectOption("#ed-shift", "2");
  await page.selectOption("#ed-status", "stopped");
  await page.fill("#ed-remarks", "Belt replacement");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByRole("heading", { name: "Turning Lathe" })).toBeVisible();
  await expect(page.getByText("Belt replacement")).toBeVisible();

  // A second tab: its own sign-in, the same data (in browser mode, the same browser database).
  const adminPage = await page.context().newPage();
  await signInAdmin(adminPage);
  await adminPage.goto("/#/admin?tab=log");
  await expect(adminPage.getByRole("row", { name: /Sample Supervisor Edited machine status/ }).first()).toBeVisible();
});

test("admin creates a user, who must change password and sees only their factory", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/#/admin");
  await page.getByRole("button", { name: "Add user" }).click();
  await page.fill("#u-name", "ravi");
  await page.fill("#u-display", "Ravi Kumar");
  await page.fill("#u-pass", "ravi-first-1");
  await page.getByRole("dialog").getByLabel("Pune Assembly").check();
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("cell", { name: "Ravi Kumar" })).toBeVisible();

  const ravi = await page.context().newPage();
  await signIn(ravi, "ravi", "ravi-first-1");
  await expect(ravi.getByRole("heading", { name: "Change password" })).toBeVisible();
  await ravi.fill("#current", "ravi-first-1");
  await ravi.fill("#new", "ravi-second-2");
  await ravi.fill("#repeat", "ravi-second-2");
  await ravi.click("button[type=submit]");
  await expect(ravi.locator("[data-testid^=factory-row-]")).toHaveCount(1);
  await expect(ravi.getByText("Pune Assembly")).toBeVisible();
});

test("admin uploads a factory photo and it shows on the card", async ({ page }) => {
  // A real 2x2 PNG image.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
    "base64",
  );
  await signInAdmin(page);
  await page.goto("/#/admin?tab=factories");
  await page.getByRole("button", { name: /Pune Assembly/ }).click();
  await page.locator("input[type=file][accept^='image']").setInputFiles({ name: "pune.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Replace photo")).toBeVisible();
  await page.goto("/#/");
  const card = page.getByTestId(/factory-row-/).filter({ hasText: "Pune Assembly" });
  await expect(card.getByRole("img", { name: "Photo of Pune Assembly" })).toBeVisible();
  await expect.poll(() => card.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(2);
});

test("history shows the grid and totals", async ({ page }) => {
  await signInAdmin(page);
  await openFactory(page, "Indore Plant");
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByText("Totals for this period")).toBeVisible();
  await expect(page.getByRole("row", { name: /M-04 Injection Moulding Machine/ })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("history-csv").click()]);
  expect(download.suggestedFilename()).toMatch(/^Indore-Plant-history-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = readFileSync(await download.path(), "utf8");
  expect(text.split("\r\n")[0]).toBe("\uFEFFDate,Shift,Machine code,Machine name,Status,Times aborted,Remarks,Entered by,Source");
  expect(text).toContain(",M-04,Injection Moulding Machine,");
});

for (const size of [
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1180, height: 820 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "tv-4k", width: 3840, height: 2160 },
]) {
  test(`layout fits on ${size.name}`, async ({ page }, info) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await signInAdmin(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath(`${size.name}-home.png`) });
    await openFactory(page, "Indore Plant");
    await expect(page.locator("[data-testid^=machine-tile-]")).toHaveCount(6);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath(`${size.name}-factory.png`) });
  });
}
