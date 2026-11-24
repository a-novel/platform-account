import { portraitPicture } from "#lib/application/profile/picture.fixture.js";
import { createI18n } from "#lib/i18n/instance.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { interceptNativeSubmissions } from "#lib/ui/forms.fixture.js";

import {
  type AuthenticationPanelModel,
  type ShellApps,
  type ShellViewModel,
  createAuthenticationPanelController,
  createShellController,
  readyAuthenticationModel,
} from "./controller.svelte";
import { withNavigationOpen } from "./navigation-state";
import Screen from "./screen.svelte";
import { readAuthView, withAuthView } from "./url-state";

import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

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
  options: { authenticationModel?: AuthenticationPanelModel; apps?: ShellApps | null; privacyHref?: string } = {}
) {
  const shellModel = model(patch);
  let url = $state(shellUrl(shellModel));
  const authentication = createAuthenticationPanelController({
    getState: () => ({
      model: options.authenticationModel ?? readyAuthenticationModel(readAuthView(url.searchParams) ?? "login"),
      action: "/auth",
    }),
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
    privacyHref: options.privacyHref ?? null,
    logoutAction: "/auth/logout",
    authentication,
    onAuthViewChange: (view) => (url = withAuthView(url, view)),
    onDrawerChange: (open) => (url = withNavigationOpen(url, open)),
    getUrl: () => url,
    getAuthLocked: () => shellModel.authLocked ?? false,
  });
  return shell;
}

/** Reads the color painted behind an element: its own, or else its nearest ancestor's, as the shell's surface. */
function paintedBackground(element: Element | null): string {
  for (; element; element = element.parentElement) {
    const color = getComputedStyle(element).backgroundColor;
    if (color !== "rgba(0, 0, 0, 0)") return color;
  }
  return "rgba(0, 0, 0, 0)";
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

describe("account shell screen", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  it.each([
    ["Log in", "login", "Log in"],
    ["Register", "register", "Join the Agora invitation list"],
  ] as const)("opens the %s journey in place", async (link, view, title) => {
    const shell = controller();
    render(Screen, { controller: shell }, withLocale());

    await page.getByRole("link", { name: link }).click();

    expect(shell.state.model.authView).toBe(view);
    await expect.element(page.getByRole("dialog", { name: title })).toBeVisible();
  });

  it("lists no app while the server cannot read where the apps live", async () => {
    render(Screen, { controller: controller({}, { apps: null }) }, withLocale());

    await expect.element(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect.element(page.getByRole("navigation", { name: "Agora apps" })).not.toBeInTheDocument();
  });

  it("lists Privacy under the sign-in links only while it collects browser telemetry", async () => {
    const view = await render(Screen, { controller: controller() }, withLocale());
    await expect.element(page.getByRole("link", { name: "Privacy" })).not.toBeInTheDocument();
    await view.unmount();

    render(
      Screen,
      { controller: controller({ activeNavigation: "privacy" }, { privacyHref: "/privacy" }) },
      withLocale("fr")
    );
    await expect.element(page.getByRole("link", { name: "Confidentialité" })).toHaveAttribute("aria-current", "page");
    await expect.element(page.getByRole("link", { name: "Me connecter" })).not.toHaveAttribute("aria-current");
  });

  it("marks the account link current on the account pages, with its picture in full color", async () => {
    render(Screen, { controller: controller({ activeNavigation: "account", session: maya }) }, withLocale());

    const account = page.getByRole("link", { name: "Maya Chen" });
    await expect.element(account).toHaveAttribute("aria-current", "page");
    const picture = account.element().querySelector(".account-picture");
    if (!picture) throw new Error("The account link must show the picture");
    expect(getComputedStyle(picture).filter).toBe("none");
  });

  it("leaves Privacy to the account's tab once the visitor is logged in", async () => {
    render(Screen, { controller: controller({ session: maya }, { privacyHref: "/privacy" }) }, withLocale());

    await expect.element(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Privacy" })).not.toBeInTheDocument();
  });

  it("submits the logout natively", async () => {
    render(Screen, { controller: controller({ session: maya }) }, withLocale());
    const submitted = interceptNativeSubmissions();

    await page.getByRole("button", { name: "Log out" }).click();

    expect(submitted.map((form) => form.getAttribute("action"))).toEqual(["/auth/logout"]);
  });

  it("names the account in the collapsed rail without visible text", async () => {
    render(Screen, { controller: controller({ rail: "collapsed", session: maya }) }, withLocale("fr"));

    const account = page.getByRole("link", { name: "Maya Chen" });
    await expect.element(account).toHaveAttribute("title", "Maya Chen");
    // A link to a page the visitor is not on sits on the rail's own surface.
    expect(getComputedStyle(account.element()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
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
        const background = paintedBackground(surface.element());
        expect(hovered[1]?.background).not.toBe(background);
        presentations.push({ background, resting, hovered });
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
    expect(logoBounds.left).toBeGreaterThanOrEqual(12);
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
    const forgotAction = dialog.getByRole("link", { name: t("shell.auth.forgotPassword") }).element();
    const forgot = forgotAction.getBoundingClientRect();
    const forgotStyle = getComputedStyle(forgotAction);
    const forgotInset = parseFloat(forgotStyle.paddingInlineEnd) + parseFloat(forgotStyle.borderInlineEndWidth);
    const register = dialog
      .getByRole("link", { name: t("shell.register") })
      .element()
      .getBoundingClientRect();
    const outer = dialog.element().getBoundingClientRect();

    if (width < 768) expect(outer.left).toBe(6);
    // The dialog's own padding sets the inset: 12px on a phone, at least that elsewhere, equal on both sides.
    const inset = form.left - outer.left;
    if (width < 768) expect(inset).toBe(12);
    else expect(inset).toBeGreaterThanOrEqual(12);
    expect(outer.right - form.right).toBe(inset);
    expect(heading.left).toBeCloseTo(form.left);
    expect(close.top + close.height / 2).toBeCloseTo(heading.top + heading.height / 2);
    expect(close.right).toBeCloseTo(form.right);
    // uikit ends a label's action at the form's edge: its box there, or its label once the box overhangs by its inset.
    expect(forgot.right - form.right).toBeGreaterThanOrEqual(-0.5);
    expect(forgot.right - form.right).toBeLessThanOrEqual(forgotInset + 0.5);
    expect(forgot.bottom).toBeLessThanOrEqual(password.top);
    // The action ends the line: across it on a phone, at its own width elsewhere, as every form's and dialog's do.
    if (width < 560) expect(action.width).toBeCloseTo(form.width);
    else expect(action.width).toBeLessThan(form.width);
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
    expect(close.left - heading.right).toBeGreaterThanOrEqual(12);
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

  it("keeps the account link and the logout while the account's details load", async () => {
    render(Screen, { controller: controller({ session: { status: "loading" } }) }, withLocale());
    const rail = page.getByRole("complementary");

    await expect.element(rail.getByRole("link", { name: "Account" })).toBeVisible();
    await expect.element(rail.getByRole("button", { name: "Log out" })).toBeEnabled();
    await expect.element(rail.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(rail.getByRole("status")).not.toBeInTheDocument();
    await expect.element(rail.getByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("names the account link in the collapsed rail while the account's details load", async () => {
    render(Screen, { controller: controller({ session: { status: "loading" }, rail: "collapsed" }) }, withLocale());

    await expect.element(page.getByRole("complementary").getByRole("link", { name: "Account" })).toBeVisible();
  });

  it("keeps the login dialog open on a page that needs a login, with the public links it covers", async () => {
    const shell = controller(
      { session: { status: "anonymous" }, authView: "login", authLocked: true },
      { privacyHref: "/privacy" }
    );
    render(Screen, { controller: shell }, withLocale());
    const dialog = page.getByRole("dialog");

    await expect.element(dialog.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect.element(dialog.getByRole("link", { name: "Close dialog" })).not.toBeInTheDocument();
    await expect.element(dialog.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("offers to close the login dialog on a page that does not need a login", async () => {
    render(Screen, { controller: controller({ session: { status: "anonymous" }, authView: "login" }) }, withLocale());

    await expect.element(page.getByRole("dialog").getByRole("link", { name: "Close dialog" })).toBeVisible();
  });
});
