<script module lang="ts">
  import { validationFixture } from "#lib/application/auth/forms.fixture.js";
  import { validateEmailRequest, validateInvitationRequest, validateLogin } from "#lib/application/auth/forms.js";
  import { portraitPicture } from "#lib/application/profile/picture.fixture.js";
  import type { ShellViewModel } from "#lib/application/shell/types.js";
  import { createStorybookTranslator } from "#lib/i18n/storybook.js";

  import StoryHarness from "./story.svelte";

  import { reviewStoryGlobals } from "@a-novel-kit/uikit-storybook";
  import ScrollPreview from "@a-novel-kit/uikit-storybook/ScrollPreview.svelte";

  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { StoryContext } from "@storybook/sveltekit";
  import { expect, userEvent, within } from "storybook/test";

  const anonymous: ShellViewModel = {
    activeNavigation: "home",
    rail: "expanded",
    drawerOpen: false,
    authView: null,
    session: { status: "anonymous" },
  };
  const authenticated: ShellViewModel = {
    ...anonymous,
    session: {
      status: "authenticated",
      displayName: "Maya Chen",
      initials: "MC",
    },
  };
  const withPicture: ShellViewModel = {
    ...anonymous,
    session: { status: "authenticated", displayName: "Maya Chen", initials: "MC", picture: portraitPicture },
  };
  const loadingAccount: ShellViewModel = {
    ...anonymous,
    session: { status: "loading" },
  };
  const accountError: ShellViewModel = {
    ...anonymous,
    session: { status: "error" },
  };
  const maintenance: ShellViewModel = {
    ...anonymous,
    session: { status: "downtime" },
  };
  // Fixed times keep every rendering identical.
  const downtime = { start: new Date("2026-10-12T06:00:00Z"), end: new Date("2026-10-12T08:30:00Z") };
  const longAccountName: ShellViewModel = {
    ...anonymous,
    session: {
      status: "authenticated",
      displayName: "Alexandrine de la Bibliothèque des Mondes Imaginaires",
      initials: "AB",
    },
  };

  function withOpenMobileNavigation(model: ShellViewModel): ShellViewModel {
    return { ...model, drawerOpen: true };
  }

  const { Story } = defineMeta({
    title: "Shell/Account shell",
    tags: ["!autodocs"],
    parameters: {
      layout: "fullscreen",
    },
  });

  type PlayContext = Pick<StoryContext, "canvasElement" | "globals">;

  function clearFocus() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  async function verifyAnonymousAuthentication({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(canvas.getByRole("link", { name: t("shell.home") })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("img", { name: t("shell.brand") })).toHaveAttribute("width", "96");
    await expect(canvas.getByRole("link", { name: t("shell.register") })).toHaveAttribute("href", "#register");
    await expect(canvas.queryByRole("button", { name: t("shell.logout") })).not.toBeInTheDocument();

    const signIn = canvas.getByRole("link", { name: t("shell.signIn") });
    await expect(signIn).toHaveAttribute("href", "#login");
    await userEvent.click(signIn);
    await expect(canvas.queryByRole("dialog", { name: t("shell.auth.login.title") })).not.toBeInTheDocument();
    clearFocus();
  }

  async function verifyRailToggle({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(canvas.getByRole("img", { name: t("shell.brand") })).toHaveAttribute("width", "24");
    await expect(canvas.getByRole("link", { name: t("shell.signIn") })).toHaveAttribute("title", t("shell.signIn"));
    const toggle = canvas.getByRole("button", { name: t("shell.expandNavigation") });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    clearFocus();
  }

  async function verifyExpandedMobileNavigation({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const navigation = canvas.getByRole("dialog", { name: t("shell.brand") });
    await expect(navigation).toBeVisible();
    await expect(within(navigation).getByRole("img", { name: t("shell.brand") })).toHaveAttribute("width", "96");

    await userEvent.click(within(navigation).getByRole("link", { name: t("shell.closeNavigation") }));
    await expect(navigation).toBeVisible();
    clearFocus();
  }

  async function verifyCollapsedMobileNavigation({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const openNavigation = canvas.getByRole("link", { name: t("shell.openNavigation") });
    const mobileHeader = openNavigation.closest("header");
    if (!mobileHeader) throw new Error("The mobile navigation control must live in the shell header");
    const navigationRail = canvas.getByRole("complementary", { hidden: true });
    await expect(navigationRail).toHaveAttribute("aria-label", t("shell.navigation"));
    await expect(openNavigation).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByRole("dialog", { name: t("shell.brand") })).not.toBeInTheDocument();
    await expect(getComputedStyle(mobileHeader).backgroundColor).toBe(getComputedStyle(navigationRail).backgroundColor);

    await userEvent.click(openNavigation);
    await expect(canvas.queryByRole("dialog", { name: t("shell.brand") })).not.toBeInTheDocument();
    await expect(openNavigation).toHaveAttribute("aria-expanded", "false");
    clearFocus();
  }

  async function verifyAppList({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const apps = within(canvas.getByRole("complementary")).getByRole("navigation", { name: t("shell.apps.label") });
    await expect(apps).toBeVisible();
    await expect(within(apps).getByRole("link", { name: t("shell.apps.studio") })).toHaveAttribute("href", "#studio");
  }

  async function verifyAuthenticatedActions({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const account = canvas.getByRole("link", { name: "Maya Chen" });
    await expect(account).toHaveAttribute("href", "#account");
    // This platform serves the account page, so the link stays in the tab.
    await expect(account).not.toHaveAttribute("target");
    await expect(canvas.getByRole("button", { name: t("shell.logout") })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: t("shell.logout") }));
    await expect(account).toBeVisible();
    await expect(canvas.queryByRole("link", { name: t("shell.signIn") })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: t("shell.register") })).not.toBeInTheDocument();
    clearFocus();
  }

  async function verifyAuthenticatedMobileLayout({ canvasElement, globals }: PlayContext) {
    await verifyExpandedMobileNavigation({ canvasElement, globals });

    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const navigation = canvas.getByRole("dialog", { name: t("shell.brand") });
    const labelStarts = [
      within(navigation).getByText(t("shell.home")).getBoundingClientRect().left,
      within(navigation).getByText(t("shell.apps.studio")).getBoundingClientRect().left,
      within(navigation).getByText("Maya Chen").getBoundingClientRect().left,
      within(navigation).getByText(t("shell.logout")).getBoundingClientRect().left,
    ];

    await expect(Math.max(...labelStarts) - Math.min(...labelStarts)).toBeLessThanOrEqual(1);
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  }

  async function verifyMobileAuthenticationActions({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const forgotPassword = canvas.getByRole("link", { name: t("shell.auth.forgotPassword") });
    const register = canvas.getByRole("link", { name: t("shell.register") });
    const submit = canvas.getByRole("button", { name: t("shell.signIn") });
    const forgotPasswordBounds = forgotPassword.getBoundingClientRect();
    const password = canvasElement.querySelector('input[type="password"]');
    if (!password) throw new Error("Login form must hold a password input");
    const passwordBounds = password.getBoundingClientRect();
    const submitBounds = submit.getBoundingClientRect();

    await expect(forgotPasswordBounds.bottom).toBeLessThanOrEqual(passwordBounds.top);
    await expect(Math.abs(forgotPasswordBounds.right - submitBounds.right)).toBeLessThanOrEqual(1);
    await expect(register.getBoundingClientRect().top).toBeGreaterThanOrEqual(submitBounds.bottom);
    await expect(forgotPassword.scrollWidth).toBeLessThanOrEqual(forgotPassword.clientWidth);
    await expect(register.scrollWidth).toBeLessThanOrEqual(register.clientWidth);
  }

  async function verifyValidationFeedback({ canvasElement }: { canvasElement: HTMLElement }) {
    await expect(canvasElement.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    expect(canvasElement.querySelector('a[href$="-email"]')).toBeNull();
  }

  async function verifySubmittingIsLocked({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(
      canvas.getByRole("button", { name: t("authUi.authentication.journeys.login.submitting") })
    ).toBeDisabled();
    await expect(canvas.getByRole("textbox", { name: t("authUi.authentication.emailLabel") })).toHaveAttribute(
      "readonly"
    );
  }

  async function verifyRecordedInvitation({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const status = canvas.getByRole("status");
    const dialog = canvas.getByRole("dialog");
    await expect(status).toBeVisible();
    await expect(within(dialog).getAllByRole("heading")).toHaveLength(1);
    await expect(
      within(dialog).getByRole("heading", { name: t("authUi.authentication.journeys.register.recordedTitle") })
    ).toBeVisible();
    expect(getComputedStyle(status).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect(within(dialog).queryByRole("link", { name: t("shell.signIn") })).not.toBeInTheDocument();
  }
</script>

<Story
  name="Anonymous — desktop"
  exportName="AnonymousDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifyAnonymousAuthentication}
>
  <StoryHarness model={anonymous} />
</Story>

<Story
  name="Anonymous — mobile"
  exportName="AnonymousMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyExpandedMobileNavigation}
>
  <StoryHarness model={withOpenMobileNavigation(anonymous)} />
</Story>

<Story name="Collapsed rail" exportName="CollapsedRail" asChild play={verifyRailToggle}>
  <StoryHarness model={{ ...anonymous, rail: "collapsed" }} />
</Story>

<Story
  name="Collapsed rail (mobile)"
  exportName="CollapsedRailMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyCollapsedMobileNavigation}
>
  <StoryHarness model={{ ...anonymous, rail: "collapsed" }} />
</Story>

<Story name="App list" asChild play={verifyAppList}>
  <StoryHarness model={authenticated} />
</Story>

<Story name="Without the app list" exportName="WithoutTheAppList" asChild>
  <StoryHarness model={authenticated} apps={false} />
</Story>

<Story name="Collapsed authenticated" asChild>
  <StoryHarness model={{ ...authenticated, rail: "collapsed" }} />
</Story>

<Story name="Authenticated" asChild play={verifyAuthenticatedActions}>
  <StoryHarness model={authenticated} />
</Story>

<Story
  name="Authenticated — mobile"
  exportName="AuthenticatedMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyAuthenticatedMobileLayout}
>
  <StoryHarness model={withOpenMobileNavigation(authenticated)} />
</Story>

<Story name="Authenticated with a picture" asChild>
  <StoryHarness model={withPicture} />
</Story>

<Story name="Collapsed with a picture" asChild>
  <StoryHarness model={{ ...withPicture, rail: "collapsed" }} />
</Story>

<Story name="Authenticated with a picture, mobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness model={withOpenMobileNavigation(withPicture)} />
</Story>

<Story name="Loading account" asChild>
  <StoryHarness model={loadingAccount} />
</Story>

<Story
  name="Loading account — mobile"
  exportName="LoadingAccountMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyExpandedMobileNavigation}
>
  <StoryHarness model={withOpenMobileNavigation(loadingAccount)} />
</Story>

<Story name="Account error" asChild>
  <StoryHarness model={accountError} />
</Story>

<Story
  name="Account error — mobile"
  exportName="AccountErrorMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyExpandedMobileNavigation}
>
  <StoryHarness model={withOpenMobileNavigation(accountError)} />
</Story>

<Story name="Maintenance" asChild>
  <StoryHarness model={maintenance} {downtime}><ScrollPreview /></StoryHarness>
</Story>

<Story name="Maintenance — mobile" exportName="MaintenanceMobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness model={maintenance} {downtime}><ScrollPreview /></StoryHarness>
</Story>

<Story name="Upcoming maintenance" asChild>
  <StoryHarness model={anonymous} {downtime} started={false}><ScrollPreview /></StoryHarness>
</Story>

<Story name="Login modal during maintenance" asChild>
  <StoryHarness model={{ ...maintenance, authView: "login" }} {downtime} />
</Story>

<Story name="Login modal — desktop" exportName="LoginModalDesktop" globals={reviewStoryGlobals.desktop} asChild>
  <StoryHarness model={{ ...anonymous, authView: "login" }} />
</Story>

<Story
  name="Login modal — mobile"
  exportName="LoginModalMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyMobileAuthenticationActions}
>
  <StoryHarness model={{ ...anonymous, authView: "login" }} />
</Story>

<Story
  name="Login for another app (desktop)"
  exportName="LoginForAppDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
>
  <StoryHarness model={{ ...anonymous, authView: "login", authorizationRequest: true }} />
</Story>

<Story name="Login for another app (mobile)" exportName="LoginForAppMobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness model={{ ...anonymous, authView: "login", authorizationRequest: true }} />
</Story>

<Story name="Login with the password shown" exportName="LoginPasswordShown" asChild>
  <StoryHarness model={{ ...anonymous, authView: "login" }} passwordShown />
</Story>

<Story name="Login submitting" asChild play={verifySubmittingIsLocked}>
  <StoryHarness
    model={{ ...anonymous, authView: "login" }}
    authenticationModel={{ journey: "login", state: { status: "submitting" } }}
  />
</Story>

<Story name="Login validation error" asChild play={verifyValidationFeedback}>
  <StoryHarness
    model={{ ...anonymous, authView: "login" }}
    authenticationModel={{
      journey: "login",
      state: validationFixture(validateLogin, { email: "not-an-email", password: "" }),
    }}
  />
</Story>

<Story name="Login service error" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "login" }}
    authenticationModel={{
      journey: "login",
      state: {
        status: "service-error",
        feedback: "invalidCredentials",
      },
    }}
  />
</Story>

<Story name="Invitation list — desktop" exportName="InvitationListDesktop" globals={reviewStoryGlobals.desktop} asChild>
  <StoryHarness model={{ ...anonymous, authView: "register" }} />
</Story>

<Story name="Invitation list — mobile" exportName="InvitationListMobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness model={{ ...anonymous, authView: "register" }} />
</Story>

<Story name="Invitation request recorded" asChild play={verifyRecordedInvitation}>
  <StoryHarness
    model={{ ...anonymous, authView: "register" }}
    authenticationModel={{
      journey: "register",
      state: { status: "recorded", email: "maya.chen@example.test" },
    }}
  />
</Story>

<Story
  name="Password reset modal — desktop"
  exportName="PasswordResetModalDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
>
  <StoryHarness model={{ ...anonymous, authView: "reset" }} />
</Story>

<Story
  name="Password reset modal — mobile"
  exportName="PasswordResetModalMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
>
  <StoryHarness model={{ ...anonymous, authView: "reset" }} />
</Story>

<Story name="Password reset email pending" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "reset" }}
    authenticationModel={{
      journey: "reset",
      state: { status: "pending-email", targetHint: "maya.chen@example.test" },
    }}
  />
</Story>

<Story name="Login service unavailable" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "login" }}
    authenticationModel={{
      journey: "login",
      state: {
        status: "service-error",
        feedback: "serviceUnavailable",
      },
    }}
  />
</Story>

<Story name="Login too many attempts" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "login" }}
    authenticationModel={{
      journey: "login",
      state: { status: "service-error", feedback: "tooManyAttempts" },
    }}
  />
</Story>

<Story name="Invitation request submitting" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "register" }}
    authenticationModel={{ journey: "register", state: { status: "submitting" } }}
  />
</Story>

<Story name="Invitation request validation error" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "register" }}
    authenticationModel={{
      journey: "register",
      state: validationFixture(validateInvitationRequest, { email: "not-an-email" }),
    }}
  />
</Story>

<Story name="Invitation list unavailable" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "register" }}
    authenticationModel={{
      journey: "register",
      state: { status: "service-error", feedback: "serviceUnavailable" },
    }}
  />
</Story>

<Story name="Password reset submitting" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "reset" }}
    authenticationModel={{ journey: "reset", state: { status: "submitting" } }}
  />
</Story>

<Story name="Password reset validation error" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "reset" }}
    authenticationModel={{
      journey: "reset",
      state: validationFixture(validateEmailRequest, { email: "not-an-email" }),
    }}
  />
</Story>

<Story name="Password reset service unavailable" asChild>
  <StoryHarness
    model={{ ...anonymous, authView: "reset" }}
    authenticationModel={{
      journey: "reset",
      state: { status: "service-error", feedback: "serviceUnavailable" },
    }}
  />
</Story>

<Story name="Long account name" asChild>
  <StoryHarness model={longAccountName} />
</Story>

<Story
  name="Long account name — mobile"
  exportName="LongAccountNameMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyExpandedMobileNavigation}
>
  <StoryHarness model={withOpenMobileNavigation(longAccountName)} />
</Story>
