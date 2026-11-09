import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Demo@1234";
export const USERS = {
  admin: "admin@brandx.test",
  ucm: "ucm@brandx.test",
  consultant: "asha.consultant@brandx.test",
  buyer: "buyer1@brandx.test",
} as const;

/** Sign in through the real /login form. Waits until we have left /login. */
export async function login(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** The visible city <select> (header and page may each render one). */
export async function chooseCity(page: Page, slug: string) {
  const select = page.locator("select:visible").filter({ has: page.locator(`option[value="${slug}"]`) }).first();
  await select.selectOption(slug);
  await expect(select).toHaveValue(slug);
}

/** Parse "₹12,45,000" → 1245000. */
export function inr(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}

/** Walk the 3-step wizard up to the details step. dayIndex 0 = today. Returns the chosen slot label. */
export async function wizardToDetails(page: Page, dayIndex: number, slotIndex = 0): Promise<string> {
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await page.locator("label:has(input[name=date])").nth(dayIndex).click();
  const slots = page.locator("fieldset button:not([disabled])");
  await expect(slots.first()).toBeVisible({ timeout: 15_000 });
  const slot = slots.nth(slotIndex);
  const label = (await slot.textContent())!.trim();
  await slot.click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  return label;
}

export async function fillDetails(page: Page, name: string, phone: string) {
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Mobile number").fill(phone);
}
