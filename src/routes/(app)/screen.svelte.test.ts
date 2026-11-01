import type { AuthenticationPanelModel } from "#lib/application/auth/types.js";
import type { ShellViewModel } from "#lib/application/shell/types.js";
import { createI18n } from "#lib/i18n/instance.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";

import { createAuthenticationPanelController } from "./(authentication)/controller.svelte";
import { createShellController, readyAuthenticationModel } from "./controller.svelte";
import Screen from "./screen.svelte";
import ShellStory from "./story.svelte";

import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

function model(patch: Partial<ShellViewModel> = {}): ShellViewModel {
  return { authView: null, session: { status: "anonymous" }, ...patch };
}

function controller(
  patch: Partial<ShellViewModel> = {},
  options: { authenticationModel?: AuthenticationPanelModel } = {}
) {
  const shellModel = model(patch);
  const authentication = createAuthenticationPanelController({
    model: options.authenticationModel ?? readyAuthenticationModel(shellModel.authView ?? "login"),
    action: "/auth",
    allowNativeSubmission: false,
  });

  return createShellController({
    model: shellModel,
    homeHref: "/",
    accountHref: "/account",
    logoutAction: "/auth/logout",
    privacyHref: "/privacy",
    apps: { studio: "https://studio.example.test" },
    authentication,
    resolveAuthentication: (view) => ({ model: readyAuthenticationModel(view), action: "/auth" }),
    allowNativeLogout: false,
  });
}

const maya = { status: "authenticated", displayName: "Maya Chen", initials: "MC" } as const;

describe("account shell screen", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  it("brands the header with Agora and opens the login dialog for an anonymous visitor", async () => {
    const shell = controller();
    render(Screen, { controller: shell }, withLocale());

    await expect.element(page.getByRole("banner")).toBeVisible();
    await expect.element(page.getByRole("main")).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Agora" })).toHaveAttribute("href", "/");
    await expect.element(page.getByRole("navigation")).not.toBeInTheDocument();
    await page.getByRole("link", { name: "Log in" }).click();

    expect(shell.state.model.authView).toBe("login");
  });

  it("lists the Agora apps behind one header control", async () => {
    render(Screen, { controller: controller() }, withLocale("fr"));

    await page.getByRole("button", { name: "Applications Agora" }).click();
    const apps = page.getByRole("navigation", { name: "Applications Agora" });
    await expect.element(apps).toBeVisible();
    await expect
      .element(apps.getByRole("link", { name: "Studio" }))
      .toHaveAttribute("href", "https://studio.example.test");
  });

  it("links Privacy from the header only while the platform collects browser telemetry", async () => {
    const view = await render(ShellStory, { initialModel: model() }, withLocale());
    await expect.element(page.getByRole("link", { name: "Privacy" })).not.toBeInTheDocument();
    await view.unmount();

    render(ShellStory, { initialModel: model(), collectsTelemetry: true }, withLocale("fr"));
    await expect
      .element(page.getByRole("banner").getByRole("link", { name: "Confidentialité" }))
      .toHaveAttribute("href", "#privacy");
  });

  it("links the account name to the account page and keeps logout in reach", async () => {
    const shell = controller({ session: maya });
    render(Screen, { controller: shell }, withLocale());

    await expect.element(page.getByRole("link", { name: "Maya Chen" })).toHaveAttribute("href", "/account");
    await expect.element(page.getByRole("link", { name: "Log in" })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Log out" }).click();
    expect(shell.state.model.session.status).toBe("anonymous");
  });

  it.each([320, 390, 767])("fits the header in one row at %ipx with every control named", async (width) => {
    await page.viewport(width, 844);
    const displayName = "Alexandrine de la Bibliothèque des Mondes Imaginaires";
    render(Screen, { controller: controller({ session: { ...maya, displayName } }) }, withLocale());

    const brand = page.getByRole("img", { name: "Agora" });
    await expect.element(brand).toHaveAttribute("width", "96");
    expect(brand.element().getBoundingClientRect().left).toBeGreaterThanOrEqual(16);
    const account = page.getByRole("link", { name: displayName });
    await expect.element(account).toBeVisible();

    const header = page.getByRole("banner").element().getBoundingClientRect();
    for (const control of [brand, account, page.getByRole("button", { name: "Agora apps" })]) {
      const bounds = control.element().getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(header.top);
      expect(bounds.bottom).toBeLessThanOrEqual(header.bottom);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });

  it("fits the wordmark beside the login control at 320px", async () => {
    await page.viewport(320, 844);
    render(Screen, { controller: controller() }, withLocale("fr"));
    await expect.element(page.getByRole("img", { name: "Agora" })).toBeVisible();

    const header = page.getByRole("banner").element().getBoundingClientRect();
    const login = page
      .getByRole("banner")
      .getByRole("link", { name: "Se connecter" })
      .element()
      .getBoundingClientRect();
    expect(login.right).toBeLessThanOrEqual(header.right);
    expect(login.bottom).toBeLessThanOrEqual(header.bottom);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
  });

  it("renders URL-controlled auth views and delegates view changes", async () => {
    const shell = controller({ authView: "register" });
    render(Screen, { controller: shell }, withLocale());

    const registrationDialog = page.getByRole("dialog", { name: "Join the Agora invitation list" });
    await expect.element(registrationDialog).toBeVisible();
    await registrationDialog.getByRole("link", { name: "Log in" }).click();

    expect(shell.state.model.authView).toBe("login");
  });

  it.each([320, 390, 768, 1280])("aligns dialog headings, close controls, and actions at %ipx", async (width) => {
    await page.viewport(width, 568);
    const { t } = createI18n("fr");
    render(Screen, { controller: controller({ authView: "login" }) }, withLocale("fr"));

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toBeVisible();
    const heading = dialog.getByRole("heading").element().getBoundingClientRect();
    const close = dialog
      .getByRole("link", { name: t("shell.closeAuthentication") })
      .element()
      .getBoundingClientRect();
    const submit = dialog.getByRole("button", { name: t("shell.signIn"), exact: true }).element() as HTMLButtonElement;
    if (!submit.form) throw new Error("Submit button must belong to a form");
    const form = submit.form.getBoundingClientRect();
    const secondaryButton = dialog.getByRole("link", { name: t("shell.auth.forgotPassword") }).element();
    const secondary = secondaryButton.getBoundingClientRect();
    const outer = dialog.element().getBoundingClientRect();

    if (width < 768) expect(outer.left).toBe(8);
    expect(form.left - outer.left).toBe(width < 768 ? 16 : 20);
    expect(outer.right - form.right).toBe(width < 768 ? 16 : 20);
    expect(heading.left).toBeCloseTo(form.left);
    expect(close.top + close.height / 2).toBeCloseTo(heading.top + heading.height / 2);
    expect(close.right).toBeCloseTo(form.right);
    if (width < 560) expect(secondary.left).toBeCloseTo(form.left);
    else expect(secondary.left).toBeGreaterThanOrEqual(form.left);
    expect(secondary.right).toBeLessThanOrEqual(form.right);
    expect(getComputedStyle(secondaryButton).paddingInlineStart).toBe("12px");
    expect(getComputedStyle(secondaryButton).paddingInlineEnd).toBe("12px");
    expect(secondary.top - submit.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(24);
    expect(dialog.element().scrollWidth).toBeLessThanOrEqual(dialog.element().clientWidth);
  });

  it("centers the close control beside a wrapped French reset heading", async () => {
    await page.viewport(320, 568);
    const { t } = createI18n("fr");
    render(Screen, { controller: controller({ authView: "reset" }) }, withLocale("fr"));

    const dialog = page.getByRole("dialog", { name: t("shell.auth.reset.title") });
    await expect.element(dialog).toBeVisible();
    await document.fonts.ready;
    const title = dialog.getByRole("heading").element();
    const heading = title.getBoundingClientRect();
    const close = dialog
      .getByRole("link", { name: t("shell.closeAuthentication") })
      .element()
      .getBoundingClientRect();

    expect(heading.height).toBeGreaterThan(parseFloat(getComputedStyle(title).lineHeight));
    expect(close.top + close.height / 2).toBeCloseTo(heading.top + heading.height / 2);
    expect(close.left - heading.right).toBeGreaterThanOrEqual(16);
    expect(dialog.element().scrollWidth).toBeLessThanOrEqual(dialog.element().clientWidth);
  });

  it.each(["en", "fr"] as const)(
    "tells a visitor logging in for another app that the login returns them there in %s",
    async (locale) => {
      const { t } = createI18n(locale);
      render(Screen, { controller: controller({ authView: "login", authorizationRequest: true }) }, withLocale(locale));

      const dialog = page.getByRole("dialog", { name: t("shell.auth.login.title") });
      await expect.element(dialog).toHaveAccessibleDescription(t("shell.auth.login.authorizationDescription"));
      await expect.element(dialog.getByRole("link", { name: t("shell.auth.forgotPassword") })).toBeVisible();
      await expect.element(dialog.getByRole("link", { name: t("shell.auth.createAccount") })).toBeVisible();
    }
  );

  it("keeps a review dialog open when its controller rejects dismissal", async () => {
    const shell = controller({ authView: "login" });
    shell.authenticationDialog.close = () => {};
    render(Screen, { controller: shell }, withLocale());

    await page.getByRole("link", { name: "Close dialog" }).click();

    expect(shell.state.model.authView).toBe("login");
    await expect.element(page.getByRole("dialog", { name: "Log in" })).toBeVisible();
  });

  it("omits journey actions from completed authentication dialogs", async () => {
    render(
      Screen,
      {
        controller: controller(
          { authView: "register" },
          {
            authenticationModel: {
              journey: "register",
              state: { status: "recorded", email: "maya.chen@example.test" },
            },
          }
        ),
      },
      withLocale()
    );

    const registrationDialog = page.getByRole("dialog", { name: "You’re on the invitation list" });
    await expect.element(registrationDialog).toBeVisible();
    expect(registrationDialog.element().querySelectorAll("h2")).toHaveLength(1);
    await expect.element(registrationDialog.getByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it.each([
    ["loading", "status", "Loading account"],
    ["error", "alert", "Account details are unavailable."],
    ["downtime", "status", "Account unavailable during maintenance."],
  ] as const)("names the %s session in the header instead of the account controls", async (status, role, message) => {
    render(Screen, { controller: controller({ session: { status } }) }, withLocale());

    await expect.element(page.getByRole("banner").getByRole(role)).toMatchTextContent(message);
    await expect.element(page.getByRole("button", { name: "Log out" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });
});
