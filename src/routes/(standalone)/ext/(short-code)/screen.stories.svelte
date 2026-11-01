<script module lang="ts">
  import { validationFixture } from "#lib/application/auth/forms.fixture.js";
  import { validateNewPassword } from "#lib/application/auth/forms.js";
  import { createStorybookTranslator } from "#lib/i18n/storybook.js";

  import StoryHarness from "./story.svelte";

  import { reviewStoryGlobals } from "@a-novel-kit/uikit-storybook";
  import { PasswordSchema } from "@a-novel/service-authentication-rest";

  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { StoryContext } from "@storybook/sveltekit";
  import { expect, within } from "storybook/test";

  const { Story } = defineMeta({
    title: "Authentication/Secure email links",
    tags: ["!autodocs"],
    parameters: {
      layout: "fullscreen",
    },
  });

  type PlayContext = Pick<StoryContext, "canvasElement" | "globals">;

  async function verifyRegistrationForm({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(
      canvas.getByRole("heading", { name: t("authUi.shortCode.journeys.register.title"), level: 1 })
    ).toBeVisible();
    await expect(
      canvas.getByLabelText(t("authUi.shortCode.newPasswordLabel"), {
        exact: false,
        selector: 'input[name="password"]',
      })
    ).toBeVisible();
    await expect(
      canvas.getByLabelText(t("authUi.shortCode.confirmPasswordLabel"), {
        exact: false,
        selector: 'input[name="confirmPassword"]',
      })
    ).toBeVisible();
    await expect(canvas.getByText(t("authUi.shortCode.journeys.register.description"))).toBeVisible();
    await expect(canvas.queryByText(t("authUi.account.password.hint"))).not.toBeInTheDocument();
    expect(canvasElement.textContent).not.toContain("@");

    const pageBounds = canvas.getByRole("main").getBoundingClientRect();
    const actionBounds = canvas
      .getByRole("region", { name: t("authUi.shortCode.journeys.register.title") })
      .getBoundingClientRect();
    const spaceBefore = actionBounds.top - pageBounds.top;
    const spaceAfter = pageBounds.bottom - actionBounds.bottom;
    expect(Math.abs(spaceBefore - spaceAfter)).toBeLessThanOrEqual(1);
  }

  async function verifyEmailConfirmation({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(canvas.getByRole("status")).toHaveTextContent(t("authUi.shortCode.journeys.emailUpdate.submitting"));
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText(t("authUi.shortCode.newPasswordLabel"))).not.toBeInTheDocument();
  }

  async function verifyValidationFeedback({ canvasElement }: { canvasElement: HTMLElement }) {
    await expect(canvasElement.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    await expect(within(canvasElement).queryByRole("link")).not.toBeInTheDocument();
  }

  async function verifySubmittingLocked({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(
      canvas.getByRole("button", { name: t("authUi.shortCode.journeys.passwordReset.submitting") })
    ).toBeDisabled();
    await expect(
      canvas.getByLabelText(t("authUi.shortCode.newPasswordLabel"), {
        exact: false,
        selector: 'input[name="password"]',
      })
    ).toHaveAttribute("readonly");
  }

  async function verifySuccess({ canvasElement }: { canvasElement: HTMLElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeVisible();
    await expect(within(canvas.getByRole("status")).getByRole("heading", { level: 1 })).toBeVisible();
    expect(canvas.getAllByRole("heading")).toHaveLength(1);
    await expect(canvas.getByRole("link")).toBeVisible();
  }
</script>

<Story
  name="Complete registration — desktop"
  exportName="CompleteRegistrationDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifyRegistrationForm}
>
  <StoryHarness initialModel={{ journey: "register", state: { status: "ready" } }} />
</Story>

<Story
  name="Complete registration — mobile"
  exportName="CompleteRegistrationMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyRegistrationForm}
>
  <StoryHarness initialModel={{ journey: "register", state: { status: "ready" } }} />
</Story>

<Story
  name="Updating email — desktop"
  exportName="UpdatingEmailDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifyEmailConfirmation}
>
  <StoryHarness initialModel={{ journey: "email-update", state: { status: "submitting" } }} />
</Story>

<Story
  name="Updating email — mobile"
  exportName="UpdatingEmailMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyEmailConfirmation}
>
  <StoryHarness initialModel={{ journey: "email-update", state: { status: "submitting" } }} />
</Story>

<Story name="Email update unavailable" asChild>
  <StoryHarness
    initialModel={{ journey: "email-update", state: { status: "service-error", feedback: "serviceUnavailable" } }}
  />
</Story>

<Story
  name="Complete password reset — desktop"
  exportName="CompletePasswordResetDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
>
  <StoryHarness initialModel={{ journey: "password-reset", state: { status: "ready" } }} />
</Story>

<Story
  name="Complete password reset — mobile"
  exportName="CompletePasswordResetMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
>
  <StoryHarness initialModel={{ journey: "password-reset", state: { status: "ready" } }} />
</Story>

<Story name="Missing link details" asChild>
  <StoryHarness initialModel={{ journey: "register", state: { status: "missing" } }} />
</Story>

<Story name="Invalid link" asChild>
  <StoryHarness initialModel={{ journey: "email-update", state: { status: "invalid" } }} />
</Story>

<Story name="Password reset submitting" asChild play={verifySubmittingLocked}>
  <StoryHarness initialModel={{ journey: "password-reset", state: { status: "submitting" } }} />
</Story>

<Story name="Registration submitting" asChild>
  <StoryHarness initialModel={{ journey: "register", state: { status: "submitting" } }} />
</Story>

<Story name="Registration unavailable" asChild>
  <StoryHarness
    initialModel={{ journey: "register", state: { status: "service-error", feedback: "serviceUnavailable" } }}
  />
</Story>

<Story name="Password reset validation error" asChild>
  <StoryHarness
    initialModel={{
      journey: "password-reset",
      state: validationFixture(validateNewPassword, { password: "", confirmPassword: "" }),
    }}
  />
</Story>

<Story name="Password length limit" asChild>
  <StoryHarness
    initialModel={{
      journey: "register",
      state: validationFixture(validateNewPassword, {
        password: "x".repeat((PasswordSchema.maxLength ?? 0) + 1),
        confirmPassword: "x".repeat((PasswordSchema.maxLength ?? 0) + 1),
      }),
    }}
  />
</Story>

<Story name="Validation error" asChild play={verifyValidationFeedback}>
  <StoryHarness
    initialModel={{
      journey: "register",
      state: validationFixture(validateNewPassword, {
        password: "x".repeat((PasswordSchema.minLength ?? 1) - 1),
        confirmPassword: "different-example-password",
      }),
    }}
  />
</Story>

<Story name="Service error" asChild>
  <StoryHarness
    initialModel={{
      journey: "password-reset",
      state: {
        status: "service-error",
        feedback: "serviceUnavailable",
      },
    }}
  />
</Story>

<Story
  name="Registration success"
  exportName="RegistrationSuccess"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifySuccess}
>
  <StoryHarness
    initialModel={{
      journey: "register",
      state: { status: "success", feedback: "registrationCompleted" },
    }}
  />
</Story>

<Story
  name="Email update success"
  exportName="EmailUpdateSuccess"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifySuccess}
>
  <StoryHarness initialModel={{ journey: "email-update", state: { status: "success", feedback: "emailUpdated" } }} />
</Story>

<Story
  name="Password reset success"
  exportName="PasswordResetSuccess"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifySuccess}
>
  <StoryHarness initialModel={{ journey: "password-reset", state: { status: "success", feedback: "passwordReset" } }} />
</Story>
