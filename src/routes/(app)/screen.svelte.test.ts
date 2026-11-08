import type { AuthenticationPanelModel } from "#lib/application/auth/types.js";
import { portraitPicture } from "#lib/application/profile/picture.fixture.js";
import type { ShellApps, ShellViewModel } from "#lib/application/shell/types.js";
import { createI18n } from "#lib/i18n/instance.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";

import { readAuthView, withAuthView } from "./auth-dialog-state";
import {
  createAuthenticationPanelController,
  createShellController,
  readyAuthenticationModel,
} from "./controller.svelte";
import { withNavigationOpen } from "./navigation-state";
import Screen from "./screen.svelte";
import ShellStory from "./story.svelte";

import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { Alert } from "@a-novel-kit/uikit";
import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

function model(patch: Partial<ShellViewModel> = {}): ShellViewModel {
  return {
    activeNavigation: null,
    rail: "expanded",
    drawerOpen: false,
    authView: null,
    session: { status: "anonymous" },
    ...patch,
  };
}

/** The address that opens the menu, the dialog and the authorization request of a model. */
function shellUrl({ drawerOpen, authView, authorizationRequest }: ShellViewModel): URL {
  const url = withAuthView(withNavigationOpen(new URL("https://account.example.test/"), drawerOpen), authView);
  if (authorizationRequest) url.searchParams.set("returnTo", "/authorize?client_id=studio");
  return url;
}

/** A shell whose transitions change its URL, as the layout's do. */
function controller(
  patch: Partial<ShellViewModel> = {},
  options: { authenticationModel?: AuthenticationPanelModel; apps?: ShellApps | null } = {}
) {
  const shellModel = model(patch);
  let url = $state(shellUrl(shellModel));
  const authentication = createAuthenticationPanelController({
    getState: () => ({
      model: options.authenticationModel ?? readyAuthenticationModel(readAuthView(url.searchParams) ?? "login"),
      action: "/auth",
    }),
    allowNativeSubmission: false,
  });

  const shell = createShellController({
    getData: () => ({
      activeNavigation: shellModel.activeNavigation,
      rail: shellModel.rail,
      session: shellModel.session,
      apps: options.apps === undefined ? { studio: "https://studio.example.test" } : options.apps,
    }),
    homeHref: "/",
    accountHref: "/account",
    privacyHref: null,
    logoutAction: "/auth/logout",
    authentication,
    allowNativeLogout: false,
    onAuthViewChange: (view) => (url = withAuthView(url, view)),
    onDrawerChange: (open) => (url = withNavigationOpen(url, open)),
    getUrl: () => url,
  });
  return shell;
}

/** Reads the styles that tell a control's states apart, once its transitions have settled. */
async function settledStyle(element: Element) {
  await new Promise(requestAnimationFrame);
  for (const animation of element.getAnimations()) animation.finish();
  await new Promise(requestAnimationFrame);
  const style = getComputedStyle(element);
  return {
    background: style.backgroundColor,
    color: style.color,
    opacity: style.opacity,
    weight: style.fontWeight,
    lineHeight: style.lineHeight,
    padding: style.padding,
  };
}

const maya = { status: "authenticated", displayName: "Maya Chen", initials: "MC" } as const;

const sessionFeedback = [
  [320, "loading"],
  [320, "error"],
  [1280, "loading"],
  [1280, "error"],
] as const;

describe("account shell screen", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  it("brands the rail with Agora and opens the login dialog for an anonymous visitor", async () => {
    const shell = controller();
    render(Screen, { controller: shell }, withLocale());

    await expect.element(page.getByRole("complementary", { name: "Agora navigation" })).toBeVisible();
    await expect.element(page.getByRole("main")).toBeVisible();
    await expect.element(page.getByRole("img", { name: "Agora" })).toHaveAttribute("width", "96");
    // The account page is the site's landing page, which the account link opens: the rail lists no Home.
    await expect.element(page.getByRole("link", { name: "Home" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Log out" })).not.toBeInTheDocument();

    const register = page.getByRole("link", { name: "Register" });
    await expect.element(register).toHaveAttribute("href", "/?auth=register");
    expect(getComputedStyle(register.element()).justifyContent).toBe("flex-start");

    const login = page.getByRole("link", { name: "Log in" });
    await expect.element(login).toHaveAttribute("href", "/?auth=login");
    expect(getComputedStyle(login.element()).justifyContent).toBe("flex-start");
    await login.click();

    expect(shell.state.model.authView).toBe("login");
  });

  it("opens the invitation request in place", async () => {
    const shell = controller();
    render(Screen, { controller: shell }, withLocale());

    await page.getByRole("link", { name: "Register" }).click();

    expect(shell.state.model.authView).toBe("register");
    await expect.element(page.getByRole("dialog", { name: "Join the Agora invitation list" })).toBeVisible();
  });

  it("lists the Agora apps in their own rail navigation", async () => {
    render(Screen, { controller: controller() }, withLocale("fr"));

    const apps = page.getByRole("complementary").getByRole("navigation", { name: "Applications Agora" });
    await expect.element(apps).toBeVisible();
    await expect
      .element(apps.getByRole("link", { name: "Studio" }))
      .toHaveAttribute("href", "https://studio.example.test");
  });

  it("lists no app while the server cannot read where the apps live", async () => {
    render(Screen, { controller: controller({}, { apps: null }) }, withLocale());

    await expect.element(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect.element(page.getByRole("navigation", { name: "Agora apps" })).not.toBeInTheDocument();
  });

  it("lists Privacy under the sign-in links only while it collects browser telemetry", async () => {
    const view = await render(ShellStory, { model: model() }, withLocale());
    await expect.element(page.getByRole("link", { name: "Privacy" })).not.toBeInTheDocument();
    await view.unmount();

    render(ShellStory, { model: model({ activeNavigation: "privacy" }), collectsTelemetry: true }, withLocale("fr"));
    await expect.element(page.getByRole("link", { name: "Confidentialité" })).toHaveAttribute("aria-current", "page");
    await expect.element(page.getByRole("link", { name: "Me connecter" })).not.toHaveAttribute("aria-current");
  });

  it("marks the account link current on the account pages, with its picture in full color", async () => {
    const maya = { status: "authenticated", displayName: "Maya Chen", initials: "MC" } as const;
    render(ShellStory, { model: model({ activeNavigation: "account", session: maya }) }, withLocale());

    const account = page.getByRole("link", { name: "Maya Chen" });
    await expect.element(account).toHaveAttribute("aria-current", "page");
    const picture = account.element().querySelector(".account-picture");
    if (!picture) throw new Error("The account link must show the picture");
    expect(getComputedStyle(picture).filter).toBe("none");
  });

  it("leaves Privacy to the account's tab once the visitor is logged in", async () => {
    const authenticated = model({ session: { status: "authenticated", displayName: "Maya Chen", initials: "MC" } });
    render(ShellStory, { model: authenticated, collectsTelemetry: true }, withLocale());

    await expect.element(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Privacy" })).not.toBeInTheDocument();
  });

  it("links the account name to the account page and keeps logout in reach", async () => {
    const shell = controller({ session: maya });
    render(Screen, { controller: shell }, withLocale());

    const account = page.getByRole("link", { name: "Maya Chen" });
    await expect.element(account).toHaveAttribute("href", "/account");
    // This platform serves the account page, so the link stays in the tab.
    await expect.element(account).not.toHaveAttribute("target");
    // The initials avatar leads the name.
    expect(account.element().textContent).toMatch(/MC\s*Maya Chen/);
    expect(getComputedStyle(account.element()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect.element(page.getByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Register" })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Log out" }).click();
    expect(shell.state.model.session.status).toBe("anonymous");
  });

  it("keeps the collapsed rail's destinations and account controls named", async () => {
    render(Screen, { controller: controller({ rail: "collapsed" }) }, withLocale("fr"));

    await expect.element(page.getByRole("link", { name: "Studio" })).toBeVisible();
    await expect.element(page.getByRole("img", { name: "Agora" })).toHaveAttribute("width", "24");
    await expect
      .element(page.getByRole("button", { name: "Développer la navigation" }))
      .toHaveAttribute("aria-expanded", "false");
    await expect.element(page.getByRole("link", { name: "Me connecter" })).toHaveAttribute("title", "Me connecter");
    await expect.element(page.getByRole("link", { name: "M’inscrire" })).toHaveAttribute("title", "M’inscrire");
  });

  it("names the account in the collapsed rail without visible text", async () => {
    render(Screen, { controller: controller({ rail: "collapsed", session: maya }) }, withLocale("fr"));

    const account = page.getByRole("link", { name: "Maya Chen" });
    await expect.element(account).toHaveAttribute("title", "Maya Chen");
    await expect.element(account).toHaveAttribute("href", "/account");
    await expect.element(page.getByRole("button", { name: "Me déconnecter" })).toBeVisible();
  });

  it("contains a long account name in the rail and the mobile drawer", async () => {
    const displayName = "Alexandrine de la Bibliothèque des Mondes Imaginaires";
    const view = await render(Screen, { controller: controller({ session: { ...maya, displayName } }) }, withLocale());

    const railName = page.getByRole("complementary").getByText(displayName).element();
    expect(railName.scrollWidth).toBeGreaterThan(railName.clientWidth);
    await view.unmount();

    await page.viewport(390, 844);
    render(Screen, { controller: controller({ drawerOpen: true, session: { ...maya, displayName } }) }, withLocale());

    const navigation = page.getByRole("dialog", { name: "Agora" });
    await expect.element(navigation).toBeVisible();
    const drawerName = navigation.getByText(displayName).element();
    expect(drawerName.scrollWidth).toBeGreaterThan(drawerName.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });

  it("shows the account's picture in its account link, and its initials without one", async () => {
    await page.viewport(1280, 844);
    await render(Screen, { controller: controller({ session: { ...maya, picture: portraitPicture } }) }, withLocale());

    const account = page.getByRole("complementary").getByRole("link", { name: "Maya Chen" });
    await expect.element(account).toBeVisible();
    const picture = account.element().querySelector("img");
    expect(picture?.getAttribute("src")).toBe(portraitPicture);
    await expect.poll(() => picture?.naturalWidth).toBe(256);
    expect(account.element().textContent).not.toContain("MC");

    await render(Screen, { controller: controller({ session: maya }) }, withLocale());
    await expect.element(page.getByRole("complementary").getByText("MC").last()).toBeVisible();
  });

  it.each(["anonymous", "authenticated"] as const)(
    "preserves %s navigation surfaces and control styles across desktop and mobile",
    async (status) => {
      const presentations = [];
      for (const width of [1280, 390, 320]) {
        await page.viewport(width, 844);
        const view = await render(
          Screen,
          {
            controller: controller({
              drawerOpen: width < 768,
              session: status === "authenticated" ? maya : { status },
            }),
          },
          withLocale()
        );
        const surface = page.getByRole(width < 768 ? "dialog" : "complementary", { name: /Agora/ });
        await expect.element(surface).toBeVisible();
        await surface.getByRole("img", { name: "Agora" }).hover();
        const controls = [surface.getByRole("link", { name: "Studio" })];
        if (status === "authenticated") {
          controls.push(surface.getByRole("link", { name: "Maya Chen" }));
          controls.push(surface.getByRole("button", { name: "Log out" }));
        } else {
          controls.push(surface.getByRole("link", { name: "Log in" }));
          controls.push(surface.getByRole("link", { name: "Register" }));
        }

        const resting = await Promise.all(controls.map((control) => settledStyle(control.element())));
        const hovered = [];
        for (const control of controls) {
          await control.hover();
          hovered.push(await settledStyle(control.element()));
        }
        expect(hovered[1]?.background).toBe(hovered[2]?.background);
        expect(hovered[1]?.background).not.toBe(resting[1]?.background);
        expect(hovered[1]?.background).not.toBe(getComputedStyle(surface.element()).backgroundColor);
        presentations.push({ background: getComputedStyle(surface.element()).backgroundColor, resting, hovered });
        await view.unmount();
      }
      expect(presentations[1]).toEqual(presentations[0]);
      expect(presentations[2]).toEqual(presentations[0]);
    }
  );

  it.each([320, 390, 767])("keeps mobile branding and controls aligned at %ipx", async (width) => {
    await page.viewport(width, 844);
    render(Screen, { controller: controller({ rail: "collapsed" }) }, withLocale());

    const logo = page.getByRole("img", { name: "Agora" });
    await expect.element(logo).toHaveAttribute("width", "96");
    const logoBounds = logo.element().getBoundingClientRect();
    const source = logo.element().getAttribute("src");
    const open = page.getByRole("banner").getByRole("link", { name: "Open navigation" });
    const controlBounds = open.element().getBoundingClientRect();
    expect(logoBounds.left).toBeGreaterThanOrEqual(16);
    expect(controlBounds.left).toBeGreaterThan(logoBounds.right);
    expect(
      Math.abs(logoBounds.top + logoBounds.height / 2 - controlBounds.top - controlBounds.height / 2)
    ).toBeLessThanOrEqual(1);

    await open.click();
    const menu = page.getByRole("dialog", { name: "Agora" });
    const menuLogo = menu.getByRole("img", { name: "Agora" });
    await expect.element(menuLogo).toHaveAttribute("src", source);
    const menuLogoBounds = menuLogo.element().getBoundingClientRect();
    const closeBounds = menu.getByRole("link", { name: "Close navigation" }).element().getBoundingClientRect();
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(menuLogoBounds[key]).toBeCloseTo(logoBounds[key], 0);
      expect(closeBounds[key]).toBeCloseTo(controlBounds[key], 0);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });

  const drawerLabels = [
    ["anonymous", ["Studio", "Me connecter", "M’inscrire"]],
    ["authenticated", ["Studio", "Maya Chen", "Me déconnecter"]],
  ] as const;

  it.each(drawerLabels)("aligns the mobile drawer labels of an %s visitor at 320px", async (status, labels) => {
    await page.viewport(320, 844);
    const session = status === "authenticated" ? maya : { status };
    render(Screen, { controller: controller({ drawerOpen: true, session }) }, withLocale("fr"));

    const navigation = page.getByRole("dialog", { name: "Agora" });
    await expect.element(navigation).toBeVisible();

    const labelStarts = labels.map((label) => navigation.getByText(label).element().getBoundingClientRect().left);
    expect(Math.max(...labelStarts) - Math.min(...labelStarts)).toBeLessThanOrEqual(1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
  });

  it("opens a journey from the mobile menu in its place and returns focus to the menu control", async () => {
    await page.viewport(390, 844);
    const shell = controller();
    render(Screen, { controller: shell }, withLocale());

    const open = page.getByRole("link", { name: "Open navigation" });
    await open.click();
    const menu = page.getByRole("dialog", { name: "Agora" });
    await expect.element(menu).toBeVisible();
    await expect.element(open).toHaveAttribute("aria-expanded", "true");

    await menu.getByRole("link", { name: "Log in" }).click();
    const login = page.getByRole("dialog", { name: "Log in" });
    await expect.element(login).toBeVisible();
    await expect.element(login).toHaveFocus();
    await expect.element(menu).not.toBeInTheDocument();
    expect(shell.state.model).toMatchObject({ drawerOpen: false, authView: "login" });

    await userEvent.keyboard("{Escape}");
    await expect.element(login).not.toBeInTheDocument();
    await expect.element(open).toHaveFocus();
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
    const action = submit.getBoundingClientRect();
    const passwordInput = submit.form.querySelector('input[type="password"]');
    if (!passwordInput) throw new Error("Login form must hold a password input");
    const password = passwordInput.getBoundingClientRect();
    const forgot = dialog
      .getByRole("link", { name: t("shell.auth.forgotPassword") })
      .element()
      .getBoundingClientRect();
    const register = dialog
      .getByRole("link", { name: t("shell.register") })
      .element()
      .getBoundingClientRect();
    const outer = dialog.element().getBoundingClientRect();

    if (width < 768) expect(outer.left).toBe(8);
    // The dialog's own padding sets the inset: 16px on a phone, at least that elsewhere, equal on both sides.
    const inset = form.left - outer.left;
    if (width < 768) expect(inset).toBe(16);
    else expect(inset).toBeGreaterThanOrEqual(16);
    expect(outer.right - form.right).toBe(inset);
    expect(heading.left).toBeCloseTo(form.left);
    expect(close.top + close.height / 2).toBeCloseTo(heading.top + heading.height / 2);
    expect(close.right).toBeCloseTo(form.right);
    expect(forgot.right).toBeCloseTo(form.right);
    expect(forgot.bottom).toBeLessThanOrEqual(password.top);
    expect(action.left).toBeCloseTo(form.left);
    expect(action.right).toBeCloseTo(form.right);
    expect(register.top - action.bottom).toBeGreaterThanOrEqual(24);
    expect(register.left).toBeGreaterThanOrEqual(form.left);
    expect(register.right).toBeLessThanOrEqual(form.right);
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
      await expect.element(dialog.getByRole("link", { name: t("shell.register") })).toBeVisible();
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

    const registrationDialog = page.getByRole("dialog", { name: "Request received" });
    await expect.element(registrationDialog).toBeVisible();
    expect(registrationDialog.element().querySelectorAll("h2")).toHaveLength(1);
    await expect.element(registrationDialog.getByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it.each([
    ["loading", "status", "Loading account"],
    ["error", "alert", "Account details are unavailable."],
    ["downtime", "status", "Account unavailable during maintenance."],
  ] as const)("names the %s session in the rail instead of the account controls", async (status, role, message) => {
    render(Screen, { controller: controller({ session: { status } }) }, withLocale());

    await expect.element(page.getByRole("complementary").getByRole(role)).toMatchTextContent(message);
    await expect.element(page.getByRole("button", { name: "Log out" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it.each(sessionFeedback)("uses the shared section message for %s px %s feedback", async (width, status) => {
    await page.viewport(width, 800);
    render(Screen, { controller: controller({ session: { status }, drawerOpen: width < 768 }) }, withLocale());
    const role = status === "error" ? "alert" : "status";
    const message = page.getByRole(role);
    await expect.element(message).toBeVisible();
    const actual = getComputedStyle(message.element());
    render(Alert, { tone: status, title: "Reference", "aria-label": "Reference" });
    const reference = getComputedStyle(page.getByRole(role, { name: "Reference" }).element());

    for (const property of ["background-color", "border-width", "padding", "border-radius", "gap"]) {
      expect(actual.getPropertyValue(property)).toBe(reference.getPropertyValue(property));
    }
  });

  it.each(["loading", "error"] as const)("keeps collapsed %s feedback named without a custom box", async (status) => {
    render(Screen, { controller: controller({ session: { status }, rail: "collapsed" }) }, withLocale());
    const message = page.getByRole(status === "error" ? "alert" : "status", {
      name: status === "error" ? "Account details are unavailable." : "Loading account",
    });
    await expect.element(message).toBeVisible();
    const wrapper = message.element().parentElement;
    if (!wrapper) throw new Error("Missing compact feedback layout");
    expect(getComputedStyle(wrapper).borderWidth).toBe("0px");
    expect(getComputedStyle(wrapper).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });
});
