import { endSessionCheckWindow, expect, login, stableScreenshot, test } from "./fixtures";

import type { Browser, Locator, Page, TestInfo } from "playwright/test";

/** The second device each journey logs in from, which the list names "Safari on iOS". */
const iPhone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

interface Account {
  email: string;
  password: string;
}

/** Logs the account in from an iPhone, in a browser of its own, and returns that browser's page. */
async function loginElsewhere(browser: Browser, info: TestInfo, account: Account): Promise<Page> {
  const { baseURL, locale, timezoneId } = info.project.use;
  const context = await browser.newContext({ baseURL, locale, timezoneId, userAgent: iPhone });
  const phone = await context.newPage();
  await phone.goto("/account");
  await login(phone, account);
  await expect(phone).toHaveURL("/account");
  return phone;
}

/** The list of active devices. */
function activeDevices(page: Page) {
  return page.getByRole("region", { name: "Devices", exact: true });
}

/** The row of a device list that names `name`. */
function deviceRow(group: Locator, name: string) {
  return group.getByRole("listitem").filter({ hasText: name });
}

test("a device logs another out after a confirmation, then removes it", async ({ page, browser, account }, info) => {
  // The account's own session opened before the test began.
  const accountSession = Date.now();
  await page.goto("/account/devices");
  await login(page, account);
  await expect(page).toHaveURL("/account/devices");
  await expect(page).toHaveTitle("Devices | Agora");
  // Authentication records activity to the second and orders a tie by a random ID, so the phone logs
  // in a second after the account's session for the list to keep one order.
  await expect.poll(() => Date.now() - accountSession).toBeGreaterThanOrEqual(1000);
  const phone = await loginElsewhere(browser, info, account);

  await page.reload();
  await expect(deviceRow(activeDevices(page), "This device")).toContainText("Active now");
  await expect(deviceRow(activeDevices(page), "Safari on iOS")).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "Locations are off" })).toBeVisible();
  await stableScreenshot(page, info, "account-devices");

  await page.getByRole("link", { name: "Log out Safari on iOS", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Log out Safari on iOS?", exact: true });
  await expect(dialog).toContainText("It can take up to 15 minutes for a logged-out device to lose access.");
  await stableScreenshot(page, info, "account-device-logout");
  await dialog.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByText("That device is logged out", { exact: true })).toBeVisible();
  const loggedOut = page.getByRole("region", { name: "Logged out", exact: true });
  await expect(deviceRow(loggedOut, "Safari on iOS")).toBeVisible();
  await expect(deviceRow(activeDevices(page), "Safari on iOS")).toHaveCount(0);

  // The platform trusts a recent check for five minutes, then the phone's next request finds it logged out.
  await endSessionCheckWindow(phone.context());
  await phone.reload();
  await expect(phone).toHaveURL(/auth=login&returnTo=%2Faccount/);
  await phone.context().close();

  await loggedOut.getByRole("button", { name: "Remove Safari on iOS", exact: true }).click();
  await expect(page.getByText("Device removed", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Safari on iOS" })).toHaveCount(0);
});

test("logging out all devices keeps only this one", async ({ page, browser, account }, info) => {
  await page.goto("/account/devices");
  await login(page, account);
  const phone = await loginElsewhere(browser, info, account);

  await page.reload();
  await page.getByRole("link", { name: "Log out all devices", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Log out all devices?", exact: true });
  await expect(dialog).toContainText("Every device but this one will be logged out.");
  await dialog.getByRole("button", { name: "Log out all devices", exact: true }).click();
  await expect(page.getByText("Your other devices are logged out", { exact: true })).toBeVisible();

  await endSessionCheckWindow(phone.context());
  await phone.reload();
  await expect(phone).toHaveURL(/auth=login&returnTo=%2Faccount/);
  await phone.context().close();
  await page.goto("/account/devices");
  await expect(deviceRow(activeDevices(page), "This device")).toBeVisible();
});

test("the location consent records where devices log in until it is withdrawn", async ({
  page,
  browser,
  account,
}, info) => {
  await page.goto("/account/devices");
  await login(page, account);
  await page.getByRole("link", { name: "Open Privacy", exact: true }).click();
  await expect(page).toHaveURL("/account/privacy");
  await expect(page).toHaveTitle("Privacy | Agora");

  const consent = page.getByRole("switch", { name: "Record where my devices log in" });
  await expect(consent).not.toBeChecked();
  await consent.click();
  await expect(consent).toBeChecked();
  await page.reload();
  await expect(consent).toBeChecked();
  await stableScreenshot(page, info, "account-privacy");

  // Only a login after the consent records its address.
  const phone = await loginElsewhere(browser, info, account);
  await phone.context().close();
  await page.goto("/account/devices");
  await expect(page.getByRole("note").filter({ hasText: "Locations are off" })).toHaveCount(0);
  const phoneRow = deviceRow(activeDevices(page), "Safari on iOS");
  await expect(phoneRow).toContainText(/127\.0\.0\.1|::1/);

  await page.goto("/account/privacy");
  await consent.click();
  await expect(consent).not.toBeChecked();
  await page.goto("/account/devices");
  await expect(phoneRow).toBeVisible();
  await expect(phoneRow).not.toContainText(/127\.0\.0\.1|::1/);
});

test("the public privacy page sends a logged-in visitor to the account's privacy tab", async ({ page, account }) => {
  await page.goto("/privacy");
  await expect(page).toHaveURL("/privacy");
  await expect(page.getByRole("switch", { name: "Record where my devices log in" })).toHaveCount(0);

  await page.goto("/?auth=login&returnTo=%2Fprivacy");
  await login(page, account);
  await expect(page).toHaveURL("/account/privacy");
  await expect(page.getByRole("switch", { name: "Record where my devices log in" })).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a confirmation page logs another device out", async ({ page, browser, account }, info) => {
    await page.goto("/account/devices");
    await login(page, account);
    const phone = await loginElsewhere(browser, info, account);

    await page.goto("/account/devices");
    await page.getByRole("link", { name: "Log out Safari on iOS", exact: true }).click();
    await expect(page).toHaveURL(/\/account\/devices\?confirm=[0-9a-f-]{36}$/);
    const dialog = page.getByRole("dialog", { name: "Log out Safari on iOS?", exact: true });
    await dialog.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page.getByText("That device is logged out", { exact: true })).toBeVisible();

    await endSessionCheckWindow(phone.context());
    await phone.reload();
    await expect(phone).toHaveURL(/auth=login&returnTo=%2Faccount/);
    await phone.context().close();
  });

  test("the location consent saves through its form", async ({ page, account }) => {
    await page.goto("/account/privacy");
    await login(page, account);
    await expect(page).toHaveURL("/account/privacy");

    await page.getByRole("switch", { name: "Record where my devices log in" }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Record where my devices log in" })).toBeChecked();
    await page.goto("/account/devices");
    await expect(page.getByRole("note").filter({ hasText: "Locations are off" })).toHaveCount(0);
  });
});
