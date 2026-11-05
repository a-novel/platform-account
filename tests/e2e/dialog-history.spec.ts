import { expect, login, test } from "./fixtures";

import type { Locator, Page } from "playwright/test";

/** Opens a dialog from its link, then checks that Back closes it and Forward opens it again. */
async function expectHistoryToFollow(page: Page, link: Locator, dialog: Locator, open: string, closed: string) {
  await link.click();
  await expect(page).toHaveURL(open);
  await expect(dialog).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(closed);
  await expect(dialog).toHaveCount(0);

  await page.goForward();
  await expect(page).toHaveURL(open);
  await expect(dialog).toBeVisible();
}

test("Back closes the account dialogs that the URL opens, and Forward opens them again", async ({
  page,
  browser,
  account,
}, info) => {
  await page.goto("/?auth=login&returnTo=%2Faccount");
  await login(page, account);
  await expect(page).toHaveURL("/account");

  await expectHistoryToFollow(
    page,
    page.getByRole("link", { name: "Change password", exact: true }),
    page.getByRole("dialog", { name: "Change your password", exact: true }),
    "/account?edit=password",
    "/account"
  );

  // Logging out every other device needs a second one.
  const other = await browser.newContext({ baseURL: info.project.use.baseURL });
  const otherPage = await other.newPage();
  await otherPage.goto("/account");
  await login(otherPage, account);
  await expect(otherPage).toHaveURL("/account");
  await other.close();

  await page.goto("/account/devices");
  await expectHistoryToFollow(
    page,
    page.getByRole("link", { name: "Log out all devices", exact: true }),
    page.getByRole("dialog", { name: "Log out all devices?", exact: true }),
    "/account/devices?confirm=others",
    "/account/devices"
  );
});
