import { expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

export const ADMIN_PASSWORD = "e2e-admin-pass-2";

export async function signIn(page: Page, username: string, password: string) {
  await page.goto("/#/login");
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}

/** Signs in as admin. On the very first sign-in, completes the forced password change. */
export async function signInAdmin(page: Page) {
  await signIn(page, "admin", ADMIN_PASSWORD);
  const wrong = page.getByText("Wrong username or password");
  const factories = page.getByRole("heading", { name: "Factories" });
  await expect(wrong.or(factories)).toBeVisible();
  if (await wrong.isVisible()) {
    await signIn(page, "admin", "e2e-first-pass");
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
    await page.fill("#current", "e2e-first-pass");
    await page.fill("#new", ADMIN_PASSWORD);
    await page.fill("#repeat", ADMIN_PASSWORD);
    await page.click("button[type=submit]");
  }
  await expect(factories).toBeVisible();
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function sheet(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Daily status");
  ws.addRow(["Date", "Shift", "Machine ID", "Status", "Abort Count", "Remarks"]);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Fails the test if the page is wider than the window (sideways scrolling). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
