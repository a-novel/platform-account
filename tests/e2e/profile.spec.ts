import { expect, login, stableScreenshot, test } from "./fixtures";

import { createRequire } from "node:module";

import type { Locator, Page } from "playwright/test";

const images = createRequire(import.meta.url);
/** A wide picture the journeys frame, and a square one that replaces it. */
const banner = images.resolve("@a-novel-kit/ui-images/files/banner/240h/agora-banner.png");
const icon = images.resolve("@a-novel-kit/ui-images/files/icon/1024x1024/agora-icon.png");

/** The card that holds the public profile. */
function profileCard(page: Page) {
  return page.getByRole("region", { name: "Public profile", exact: true });
}

/** The address of the picture an image shows, which names its version. */
async function pictureUrl(image: Locator): Promise<string> {
  const source = await image.getAttribute("src");
  expect(source).toMatch(/^\/profile\/picture\/[0-9a-f-]{36}\?v=/);
  return source as string;
}

/** Chooses an image file in the open picture dialog, then drags and zooms it into its frame. */
async function frame(page: Page, file: string) {
  const dialog = page.getByRole("dialog", { name: "Change your picture", exact: true });
  await dialog.getByLabel("Choose", { exact: false }).setInputFiles(file);
  const frameArea = dialog.getByRole("application", { name: "Picture frame" });
  await expect(frameArea).toBeVisible();

  const box = await frameArea.boundingBox();
  if (!box) throw new Error("The frame has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await frameArea.focus();
  await page.keyboard.press("+");
  await page.keyboard.press("ArrowRight");
  return dialog;
}

test("a visitor sets their username, then clears it", async ({ page, account }, info) => {
  await page.goto("/account");
  await login(page, account);
  await expect(profileCard(page)).toContainText("Not set");

  await profileCard(page).getByRole("link", { name: "Change username", exact: true }).click();
  await expect(page).toHaveURL("/account?edit=username");
  const dialog = page.getByRole("dialog", { name: "Choose your username", exact: true });
  const field = dialog.getByLabel("Username", { exact: true });
  await field.fill("Maya⁨ Chen");
  await dialog.getByRole("button", { name: "Save username", exact: true }).click();
  await expect(field).toHaveAccessibleDescription(
    /Remove line breaks, tabs, special spaces and text direction marks\.$/
  );

  await field.fill("Maya Chen 👩🏽‍💻");
  await expect(field).toHaveAccessibleDescription(/remove your username\. 11 \/ 32/);
  await stableScreenshot(page, info, "account-username-dialog");
  await dialog.getByRole("button", { name: "Save username", exact: true }).click();

  await expect(page).toHaveURL("/account");
  await expect(dialog).toHaveCount(0);
  await expect(profileCard(page)).toContainText("Maya Chen 👩🏽‍💻");
  await expect(page.getByRole("heading", { level: 1, name: "Maya Chen 👩🏽‍💻", exact: true })).toBeVisible();
  await expect(page.locator(".account-widget").first()).toContainText("Maya Chen 👩🏽‍💻");

  await page.reload();
  await profileCard(page).getByRole("link", { name: "Change username", exact: true }).click();
  await expect(field).toHaveValue("Maya Chen 👩🏽‍💻");
  await field.fill("");
  await dialog.getByRole("button", { name: "Save username", exact: true }).click();
  await expect(profileCard(page)).toContainText("Not set");
  await expect(page.getByRole("heading", { level: 1, name: account.email, exact: true })).toBeVisible();
  await expect(page.locator(".account-widget").first()).not.toContainText("Maya Chen 👩🏽‍💻");
});

test("a visitor uploads, frames, replaces and removes their picture", async ({ page, account }, info) => {
  await page.goto("/account");
  await login(page, account);

  await page.getByRole("link", { name: "Change picture", exact: true }).first().click();
  await expect(page).toHaveURL("/account?edit=picture");
  const dialog = await frame(page, banner);
  await stableScreenshot(page, info, "account-picture-framing");
  await dialog.getByRole("button", { name: "Save picture", exact: true }).click();

  await expect(page).toHaveURL("/account");
  const cardPicture = profileCard(page).getByRole("img", { name: "Your current picture", exact: true });
  const uploaded = await pictureUrl(cardPicture);
  await expect(page.locator(`header img[src="${uploaded}"]`)).toBeVisible();
  await expect(page.locator(".account-widget img").first()).toHaveAttribute("src", uploaded);
  const served = await page.request.get(uploaded);
  expect(served.status()).toBe(200);
  expect(served.headers()).toMatchObject({
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": "image/webp",
    "x-content-type-options": "nosniff",
  });
  await stableScreenshot(page, info, "account-profile-picture");

  // The top bar shows the picture on every page of the platform.
  await page.goto("/account/devices");
  await expect(page.locator(".account-widget img").first()).toHaveAttribute("src", uploaded);
  await expect(page.locator(`header img[src="${uploaded}"]`)).toBeVisible();

  await page.goto("/account");
  await profileCard(page).getByRole("link", { name: "Change picture", exact: true }).click();
  await (await frame(page, icon)).getByRole("button", { name: "Save picture", exact: true }).click();
  await expect(page).toHaveURL("/account");
  const replaced = await pictureUrl(cardPicture);
  expect(replaced).not.toBe(uploaded);
  const square = await page.request.get(replaced);
  expect(square.headers()["content-type"]).toBe("image/webp");

  await profileCard(page).getByRole("link", { name: "Change picture", exact: true }).click();
  await dialog.getByRole("button", { name: "Remove picture", exact: true }).click();
  await expect(page).toHaveURL("/account");
  await expect(profileCard(page)).toContainText("No picture");
  // The tester's address, account.tester+<id>@example.com, gives the initials.
  await expect(page.getByRole("link", { name: "Change picture", exact: true }).first()).toContainText("AT");
  expect((await page.request.get(replaced)).status()).toBe(404);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the username saves through its form, and the picture dialog asks for JavaScript", async ({ page, account }) => {
    await page.goto("/account");
    await login(page, account);
    await expect(page).toHaveURL("/account");

    await page.getByRole("link", { name: "Change username", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose your username", exact: true });
    await dialog.getByLabel("Username", { exact: true }).fill("Maya");
    await dialog.getByRole("button", { name: "Save username", exact: true }).click();
    await expect(page).toHaveURL("/account");
    await expect(profileCard(page)).toContainText("Maya");

    await page.getByRole("link", { name: "Change picture", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: "Change your picture", exact: true })).toContainText(
      "Framing a picture needs JavaScript."
    );
  });
});
