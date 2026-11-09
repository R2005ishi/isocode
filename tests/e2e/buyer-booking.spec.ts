import { expect, test } from "@playwright/test";
import { chooseCity, fillDetails, wizardToDetails } from "./helpers";

const VARIANT = "/cars/model-h/zx-automatic-petrol";

test.describe("buyer: variant page → on-road price → test drive", () => {
  test("price breakup follows the city, booking needs consent, confirmation shows a reference", async ({ page }, info) => {
    await page.goto(VARIANT);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ZX Automatic Petrol");

    // Change city → price card re-renders for Kanpur.
    await chooseCity(page, "kanpur");
    const card = page.locator("section", { has: page.getByRole("heading", { name: /On-road price/ }) }).first();
    await expect(card.getByRole("heading", { name: /in Kanpur/ })).toBeVisible({ timeout: 15_000 });

    for (const line of ["Ex-showroom price", "Road tax", "Registration (RTO)", "Insurance (1st year)"]) {
      await expect(card.getByRole("rowheader", { name: new RegExp(line.replace(/[()]/g, "\\$&")) })).toBeVisible();
    }
    await expect(card.getByRole("rowheader", { name: "On-road total" })).toBeVisible();
    await expect(card.locator("tfoot td")).toHaveText(/₹[\d,]+/);
    await expect(card.getByText(/Valid until/)).toBeVisible();
    await expect(card.getByText("Prices may change — confirm with the showroom.")).toBeVisible();

    // Primary CTA → wizard prefilled with this variant.
    await page.locator('a[href*="/test-drive?"]').filter({ hasText: /test drive/i }).first().click();
    await page.waitForURL(/\/test-drive\?/);
    await expect(page.getByText("Model H ZX Automatic Petrol").first()).toBeVisible();

    // desktop books tomorrow, mobile the day after, so the two projects never collide.
    await wizardToDetails(page, info.project.name === "mobile" ? 2 : 1);
    await fillDetails(page, "Test Buyer E2E", info.project.name === "mobile" ? "9800000902" : "9800000901");

    // Consent is unticked by default and required.
    const consent = page.getByRole("checkbox");
    await expect(consent).not.toBeChecked();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByText("Please tick the box so we can contact you")).toBeVisible();
    await expect(page).toHaveURL(/\/test-drive\?/);

    await consent.check();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await page.waitForURL(/\/test-drive\/confirmed\?ref=TD-/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Your test drive is booked" })).toBeVisible();
    await expect(page.getByText("Booking reference")).toBeVisible();
    await expect(page.getByText(/TD-[A-Z0-9]{4,}/).first()).toBeVisible();
  });

  test("varanasi has no published price for Model T SX Turbo (NEW-T-02)", async ({ page }) => {
    await page.goto("/cars/model-t/sx-turbo-automatic-petrol");
    await chooseCity(page, "varanasi");
    await expect(page.getByText("Price not yet published for this city")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Prices may change — confirm with the showroom.")).toHaveCount(0);
  });
});
