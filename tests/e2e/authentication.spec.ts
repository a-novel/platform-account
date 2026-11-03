import { compose, emailLink, expect, login, test } from "./fixtures";
import { accountCaller, callerFetch } from "./service-token";

import { screenshot } from "@a-novel-kit/nodelib-test/playwright";

import type { Page } from "playwright/test";

async function choosePassword(page: Page, password: string) {
  await page.getByLabel(/^New password/).fill(password);
  await page.getByLabel(/^Confirm new password/).fill(password);
}

/** Opens the menu that holds the account controls on a phone. The rail shows them on a desktop. */
async function openAccountControls(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("link", { name: "Open navigation", exact: true }).click();
}

/** The account controls: the rail on a wide screen, the open menu on a phone. Pages repeat "Log in". */
function accountControls(page: Page, isMobile: boolean) {
  return isMobile ? page.getByRole("dialog") : page.getByRole("complementary");
}

async function authenticationResponds(): Promise<boolean> {
  try {
    return (await fetch("http://127.0.0.1:14100/v2/ping")).ok;
  } catch {
    return false;
  }
}

test("login returns to the protected account, survives reload and logout protects it again", async ({
  page,
  context,
  account,
}, info) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/auth=login&returnTo=%2Faccount/);
  await expect(page).toHaveTitle("Log in | Agora");

  await login(page, account);
  await expect(page).toHaveURL("/account");
  await expect(page).toHaveTitle("Account settings | Agora");
  await expect(page.getByRole("heading", { name: "Manage your account", exact: true })).toBeVisible();
  await expect(page.getByText("auth:user", { exact: true })).toBeVisible();

  const cookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith("account_"));
  expect(cookies.map((cookie) => cookie.name)).toEqual(
    expect.arrayContaining(["account_access_token", "account_refresh_token"])
  );
  expect(cookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);

  await page.reload();
  await expect(page.getByText("auth:user", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Account settings | Agora");
  const perRunValues = ["Account ID", "Current email", "Access expires", "Session expires"].map((label) =>
    page.getByText(label, { exact: true }).locator("+ dd")
  );
  await screenshot(page, info, "authenticated-account", perRunValues);

  await page.getByRole("button", { name: "Log out", exact: true }).last().click();
  await expect(page).toHaveURL("/");
  await expect(page).toHaveTitle("Your Agora account | Agora");
  expect((await context.cookies()).filter((cookie) => cookie.name.startsWith("account_"))).toEqual([]);

  // Logout revoked the refresh token, so the service refuses to renew the session with it.
  const tokens = Object.fromEntries(cookies.map((cookie) => [cookie.name, cookie.value]));
  const renewal = await callerFetch(accountCaller)("http://127.0.0.1:14100/v2/session", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: tokens.account_access_token, refreshToken: tokens.account_refresh_token }),
  });
  expect(renewal.status).toBe(403);

  await page.goto("/account");
  await expect(page).toHaveURL(/auth=login&returnTo=%2Faccount/);
  await expect(page.getByLabel(/^Current password/)).toHaveCount(0);
});

test("a real invitation creates an account and cannot be reused", async ({ page, invitation }, info) => {
  await page.goto(invitation.link);
  await expect(page.getByRole("heading", { name: "Create your Agora account" })).toBeVisible();
  await expect(page).toHaveTitle("Create account | Agora");
  await screenshot(page, info, "invitation-password-form");

  await choosePassword(page, "Invitation-password-42!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL("/ext/account/create?result=success");
  await expect(page.getByText("Your account is ready.", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Account created | Agora");
  await screenshot(page, info, "invitation-completed");

  await page.getByRole("link", { name: "Continue to your account" }).click();
  await expect(page).toHaveURL("/account");
  await expect(page.getByText("auth:user", { exact: true })).toBeVisible();

  await page.goto(invitation.link);
  await choosePassword(page, "Another-password-42!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL("/ext/account/create?result=invalid");
  await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
  await expect(page).toHaveTitle("Create account: Invalid link | Agora");
});

test("password recovery follows the delivered email and replaces the old password", async ({ page, account }, info) => {
  await page.goto("/?auth=reset");
  await expect(page).toHaveTitle("Reset password | Agora");
  await page.getByLabel(/^Email address/).fill(account.email);
  await page.getByRole("button", { name: "Send link", exact: true }).click();
  await expect(page.getByText(account.email, { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Reset password: Check your inbox | Agora");

  const link = await emailLink(account.email, "/ext/password/reset");
  await page.goto(link);
  await expect(page).toHaveTitle("Reset password | Agora");
  await screenshot(page, info, "password-reset-form");

  await choosePassword(page, "Recovered-password-42!");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page).toHaveURL("/ext/password/reset?result=success");
  await expect(page.getByText("Your password was reset.", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Password reset | Agora");
  await screenshot(page, info, "password-recovered");

  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await login(page, account);
  await expect(page.getByText("The email address or password is incorrect.", { exact: true })).toBeVisible();
  await login(page, { ...account, password: "Recovered-password-42!" });
  // The account page is the only screen, so a signed-in visitor lands on it.
  await expect(page).toHaveURL("/account");
  await expect(page.getByText("auth:user", { exact: true })).toBeVisible();
});

test("account forms change the password and confirm an email update", async ({ page, account }, info) => {
  await page.goto("/?auth=login&returnTo=%2Faccount");
  await login(page, account);

  await page.getByLabel(/^Current password/).fill(account.password);
  await choosePassword(page, "Changed-password-42!");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.getByText("Your password was changed.", { exact: true })).toBeVisible();

  const email = `updated-${account.email}`;
  await page.getByLabel(/^New email address/).fill(email);
  await page.getByRole("button", { name: "Send link", exact: true }).click();
  await expect(page.getByText("Check your inbox", { exact: true })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  await page.goto(await emailLink(email, "/ext/email/validate"));
  await expect(page).toHaveURL("/ext/email/validate?result=success");
  await expect(page.getByText("Your email address was updated.", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Email updated | Agora");
  await screenshot(page, info, "email-confirmed");

  await page.goto("/account");
  await page.getByRole("button", { name: "Log out", exact: true }).last().click();
  await page.goto("/?auth=login&returnTo=%2Faccount");
  await login(page, { email, password: "Changed-password-42!" });
  await expect(page).toHaveURL("/account");
  await expect(page.getByText("auth:user", { exact: true })).toBeVisible();
});

test("dialog history and keyboard dismissal restore the shell focus", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Your Agora account | Agora");

  // On a phone, the menu closes as the dialog opens, so its control takes the focus back.
  const trigger = isMobile
    ? page.getByRole("link", { name: "Open navigation", exact: true })
    : page.getByRole("complementary").getByRole("link", { name: "Log in", exact: true });
  await openAccountControls(page, isMobile);
  await accountControls(page, isMobile).getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Log in", exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Log in | Agora");
  await expect(page.getByRole("dialog")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^Email address/)).toBeFocused();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL("/?auth=reset");
  await expect(page).toHaveTitle("Reset password | Agora");

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page).toHaveTitle("Your Agora account | Agora");
  await expect(page.getByRole("dialog", { name: /^(Log in|Reset your password)$/ })).toHaveCount(0);

  await page.goForward();
  await expect(page.getByRole("dialog", { name: "Reset your password" })).toBeVisible();
  await expect(page).toHaveTitle("Reset password | Agora");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /^(Log in|Reset your password)$/ })).toHaveCount(0);
  await expect(page).toHaveURL("/");
  await expect(page).toHaveTitle("Your Agora account | Agora");
  await expect(trigger).toBeFocused();
});

test("the navigation opens each Agora app at its sign-in page", async ({ page, isMobile }) => {
  await page.goto("/");
  await openAccountControls(page, isMobile);
  const apps = page.getByRole("navigation", { name: "Agora apps" });
  await expect(apps).toBeVisible();
  await expect(apps.getByRole("link", { name: "Studio", exact: true })).toHaveAttribute(
    "href",
    "https://studio.example.test/auth/sign-in"
  );
});

test("navigation controls preserve the rail preference and drawer focus", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("link", { name: "Open navigation", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open navigation", exact: true })).toBeFocused();
    return;
  }

  await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand navigation", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Expand navigation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Expand navigation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Collapse navigation", exact: true })).toBeVisible();
});

test("an authentication outage preserves the session and recovers after reload", async ({
  page,
  context,
  account,
}, info) => {
  await page.goto("/?auth=login&returnTo=%2Faccount");
  await login(page, account);
  await expect(page.getByText("auth:user", { exact: true })).toBeVisible();

  const cookies = await context.cookies();
  try {
    await compose("stop", "authentication");
    await page.reload();
    await expect(page.getByText("Session details unavailable", { exact: true })).toBeVisible();
    await expect(page).toHaveTitle("Account settings: Session details unavailable | Agora");
    expect(await context.cookies()).toEqual(cookies);
    await screenshot(page, info, "recoverable-service-outage");
  } finally {
    await compose("start", "authentication");
    await expect.poll(authenticationResponds, { timeout: 30_000 }).toBe(true);
  }

  await page.reload();
  await expect(page.getByText("auth:user", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Account settings | Agora");
});

test.describe("native forms without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("shell links open, switch and close usable authentication forms", async ({ page, isMobile }) => {
    await page.goto("/?returnTo=%2Faccount");

    await openAccountControls(page, isMobile);
    await accountControls(page, isMobile).getByRole("link", { name: "Log in", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(/^Email address/)).toBeVisible();

    await dialog.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveTitle("Reset password | Agora");
    await page.getByRole("button", { name: "Send link", exact: true }).click();
    await expect(dialog.getByText("Enter a valid email address.", { exact: true })).toBeVisible();

    await dialog.getByRole("link", { name: "Log in", exact: true }).click();
    await dialog.getByRole("link", { name: "Register", exact: true }).click();
    await expect(page).toHaveTitle("Join the Agora invitation list | Agora");
    await dialog.getByLabel(/^Email address/).fill("invalid");
    await dialog.getByRole("button", { name: "Join the list", exact: true }).click();
    await expect(dialog.getByText("Enter a valid email address.", { exact: true })).toBeVisible();

    await dialog.getByRole("link", { name: "Close dialog" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL("/?returnTo=%2Faccount");
  });

  test("login validates on the server and returns to the protected destination", async ({ page, account }) => {
    await page.goto("/account");
    await expect(page.getByRole("dialog", { name: "Log in", exact: true })).toBeVisible();
    await login(page, { ...account, password: "Incorrect-password-42!" });
    await expect(page.getByText("The email address or password is incorrect.", { exact: true })).toBeVisible();

    await login(page, account);
    await expect(page).toHaveURL("/account");
    await expect(page.getByText("auth:user", { exact: true })).toBeVisible();
  });

  test("an invitation, password change and logout work with server-rendered forms", async ({ page, invitation }) => {
    const password = "Native-form-password-42!";
    await page.goto(invitation.link);
    await expect(page).toHaveTitle("Create account | Agora");
    await choosePassword(page, password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page).toHaveURL("/ext/account/create?result=success");
    await expect(page).toHaveTitle("Account created | Agora");

    await page.goto("/account");
    await expect(page).toHaveTitle("Account settings | Agora");
    await expect(page.getByText("auth:user", { exact: true })).toBeVisible();

    await page.getByLabel(/^Current password/).fill(password);
    await choosePassword(page, "Updated-native-password-42!");
    await page.getByRole("button", { name: "Change password", exact: true }).click();
    await expect(page.getByText("Your password was changed.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Log out", exact: true }).last().click();
    await page.goto("/account");
    await expect(page).toHaveURL(/auth=login&returnTo=%2Faccount/);
  });
});
