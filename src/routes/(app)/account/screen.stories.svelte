<script module lang="ts">
  import { validationFixture } from "#lib/application/auth/forms.fixture.js";
  import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
  import type { AccountScreenModel } from "#lib/application/auth/types.js";
  import { createStorybookTranslator } from "#lib/i18n/storybook.js";

  import StoryHarness from "./story.svelte";

  import { reviewStoryGlobals } from "@a-novel-kit/uikit-storybook";

  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { StoryContext } from "@storybook/sveltekit";
  import { expect, within } from "storybook/test";

  const ready = {
    claims: {
      status: "ready",
      userId: "2f798f4a-0694-4f68-9928-42f3e906e871",
      roles: ["auth:user"],
      accessExpiresAt: "2026-08-18T19:30:00Z",
      refreshExpiresAt: "2026-08-25T18:30:00Z",
    },
    credentials: { status: "ready", email: "maya.chen@example.test" },
    passwordState: { status: "ready" },
    emailState: { status: "ready" },
    logoutState: "ready",
  } satisfies AccountScreenModel;

  const pendingChange = {
    ...ready,
    credentials: {
      ...ready.credentials,
      pendingEmail: { email: "maya.writes@example.test", expiresAt: "2026-08-18T20:30:00Z" },
    },
  } satisfies AccountScreenModel;

  const { Story } = defineMeta({
    title: "Authentication/Account screen",
    tags: ["!autodocs"],
    parameters: {
      layout: "fullscreen",
    },
  });

  type PlayContext = Pick<StoryContext, "canvasElement" | "globals">;

  async function verifySessionFits({ canvasElement, globals }: PlayContext) {
    const t = createStorybookTranslator(globals);
    const recap = within(canvasElement).getByRole("region", { name: t("authUi.account.claims.title") });
    const bounds = recap.getBoundingClientRect();
    const summary = within(recap);
    await expect(summary.queryByRole("note")).not.toBeInTheDocument();
    for (const value of [summary.getByRole("heading"), ...summary.getAllByRole("definition")]) {
      const box = value.getBoundingClientRect();
      await expect(box.left).toBeGreaterThanOrEqual(bounds.left);
      await expect(box.right).toBeLessThanOrEqual(bounds.right);
      await expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
    }
  }

  async function verifyReadyAccount({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await verifySessionFits({ canvasElement, globals });
    await expect(canvas.getByRole("heading", { name: t("authUi.account.title"), level: 1 })).toBeVisible();
    await expect(canvas.getByText("2f798f4a-0694-4f68-9928-42f3e906e871")).toBeVisible();
    const locale = globals.locale === "fr" ? "fr" : "en";
    const accessExpiry = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(ready.claims.accessExpiresAt));
    await expect(canvas.getByText(accessExpiry)).toBeVisible();
    const emailInput = canvas.getByRole("textbox", { name: t("authUi.account.email.label") });
    await expect(emailInput).toBeVisible();
    if (window.matchMedia("(width < 35rem)").matches) {
      const submit = canvas.getByRole<HTMLButtonElement>("button", { name: t("authUi.account.email.submit") });
      if (!submit.form) throw new Error("Submit button must belong to a form");
      await expect(submit.getBoundingClientRect().width).toBeCloseTo(submit.form.getBoundingClientRect().width);
    }

    const password = canvas.getByRole("region", { name: t("authUi.account.password.title") }).getBoundingClientRect();
    await expect(password.width).toBeLessThanOrEqual(640);
    const email = canvas.getByRole("region", { name: t("authUi.account.email.title") }).getBoundingClientRect();
    const session = canvas.getByRole("region", { name: t("authUi.account.claims.title") });
    await expect(email.top).toBeGreaterThan(password.bottom);
    await expect(session.getBoundingClientRect().top).toBeGreaterThan(email.bottom);
    await expect(within(session).getByRole("button", { name: t("authUi.account.logout.submit") })).toBeVisible();
  }

  async function verifyPendingEmail({ canvasElement, globals }: PlayContext) {
    const t = createStorybookTranslator(globals);
    const email = within(within(canvasElement).getByRole("region", { name: t("authUi.account.email.title") }));
    const current = email.getByLabelText(t("authUi.account.email.current"));
    await expect(current).toHaveValue(ready.credentials.email);
    await expect(current).toHaveAttribute("readonly");
    const pending = email.getByRole("note");
    await expect(pending).toHaveTextContent(t("authUi.account.email.pending"));
    await expect(pending).toHaveTextContent(pendingChange.credentials.pendingEmail.email);
  }

  async function verifyPasswordValidation({ canvasElement }: { canvasElement: HTMLElement }) {
    await expect(canvasElement.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    expect(canvasElement.querySelector('a[href$="-confirm-password"]')).toBeNull();
  }

  async function verifyFormsAvailable({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const recap = canvas.getByRole("region", { name: t("authUi.account.claims.title") });
    await expect(within(recap).getByRole("alert")).toBeVisible();
    const submitKeys = [
      "authUi.account.password.submit",
      "authUi.account.email.submit",
      "authUi.account.logout.submit",
    ] as const;

    for (const key of submitKeys) {
      await expect(canvas.getByRole("button", { name: t(key) })).toBeEnabled();
    }
    await expect(canvas.getByRole("textbox", { name: t("authUi.account.email.label") })).toBeEnabled();
  }

  async function verifyPasswordLocked({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(canvas.getByRole("button", { name: t("authUi.account.password.submitting") })).toBeDisabled();
    await expect(
      canvas.getByLabelText(t("authUi.account.password.currentLabel"), {
        exact: false,
        selector: 'input[name="currentPassword"]',
      })
    ).toHaveAttribute("readonly");
  }
</script>

<Story
  name="Ready — desktop"
  exportName="ReadyDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifyReadyAccount}
>
  <StoryHarness initialModel={ready} />
</Story>

<Story
  name="Ready — mobile"
  exportName="ReadyMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyReadyAccount}
>
  <StoryHarness initialModel={ready} />
</Story>

<Story
  name="Email change pending — desktop"
  exportName="EmailChangePendingDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifyPendingEmail}
>
  <StoryHarness initialModel={pendingChange} />
</Story>

<Story
  name="Email change pending — mobile"
  exportName="EmailChangePendingMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyPendingEmail}
>
  <StoryHarness initialModel={pendingChange} />
</Story>

<Story name="Email unavailable" asChild>
  <StoryHarness initialModel={{ ...ready, credentials: { status: "unavailable" } }} />
</Story>

<Story name="No roles" asChild>
  <StoryHarness initialModel={{ ...ready, claims: { ...ready.claims, roles: [] } }} />
</Story>

<Story name="Passwords shown" asChild>
  <StoryHarness initialModel={ready} passwordsShown />
</Story>

<Story name="Loading" asChild>
  <StoryHarness initialModel={{ ...ready, claims: { status: "loading" } }} />
</Story>

<Story name="Load error" asChild play={verifyFormsAvailable}>
  <StoryHarness
    initialModel={{
      ...ready,
      claims: { status: "error", feedback: "sessionUnavailable" },
      credentials: { status: "unavailable" },
    }}
  />
</Story>

<Story name="Password validation error" asChild play={verifyPasswordValidation}>
  <StoryHarness
    initialModel={{
      ...ready,
      passwordState: validationFixture(validatePasswordChange, {
        currentPassword: "",
        password: "a-long-example-password",
        confirmPassword: "different-example-password",
      }),
    }}
  />
</Story>

<Story name="Password submitting" asChild play={verifyPasswordLocked}>
  <StoryHarness initialModel={{ ...ready, passwordState: { status: "submitting" } }} />
</Story>

<Story name="Password service error" asChild>
  <StoryHarness
    initialModel={{
      ...ready,
      passwordState: {
        status: "service-error",
        feedback: "serviceUnavailable",
      },
    }}
  />
</Story>

<Story name="Incorrect current password" asChild>
  <StoryHarness
    initialModel={{
      ...ready,
      passwordState: {
        status: "validation-error",
        issues: [{ field: "currentPassword", feedback: "invalidCurrentPassword" }],
      },
    }}
  />
</Story>

<Story name="Password success" asChild>
  <StoryHarness
    initialModel={{
      ...ready,
      passwordState: { status: "success", feedback: "passwordChanged" },
    }}
  />
</Story>

<Story name="Email validation error" asChild>
  <StoryHarness
    initialModel={{
      ...ready,
      emailState: validationFixture(validateEmailUpdate, { email: "not-an-email" }),
    }}
  />
</Story>

<Story name="Email submitting" asChild>
  <StoryHarness initialModel={{ ...ready, emailState: { status: "submitting" } }} />
</Story>

<Story name="Email service error" asChild>
  <StoryHarness
    initialModel={{
      ...ready,
      emailState: {
        status: "service-error",
        feedback: "serviceUnavailable",
      },
    }}
  />
</Story>

<Story name="Email confirmation pending" asChild>
  <StoryHarness initialModel={{ ...pendingChange, emailState: { status: "pending-email" } }} />
</Story>

<Story name="Logout submitting" asChild>
  <StoryHarness initialModel={{ ...ready, logoutState: "submitting" }} />
</Story>

<Story name="Long content — mobile" globals={reviewStoryGlobals.mobile} asChild play={verifySessionFits}>
  <StoryHarness
    initialModel={{
      ...ready,
      claims: {
        ...ready.claims,
        roles: ["auth:user", "auth:admin"],
        accessExpiresAt: "2026-09-18T19:30:00Z",
        refreshExpiresAt: "2026-09-25T18:30:00Z",
      },
      credentials: {
        status: "ready",
        email: "maya.chen.writing-under-a-long-pen-name@studio-correspondence.example.test",
        pendingEmail: {
          email: "maya.chen.after-the-move@a-much-longer-regional-provider.example.test",
          expiresAt: "2026-09-18T20:30:00Z",
        },
      },
      emailState: {
        status: "service-error",
        feedback: "serviceUnavailable",
      },
    }}
  />
</Story>
