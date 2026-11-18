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
    await expect(canvas.getByRole("heading", { name: t("shortCode.journeys.register.title"), level: 1 })).toBeVisible();
    await expect(
      canvas.getByLabelText(t("shortCode.newPasswordLabel"), {
        exact: false,
        selector: 'input[name="password"]',
      })
    ).toBeVisible();
    await expect(
      canvas.getByLabelText(t("shortCode.confirmPasswordLabel"), {
        exact: false,
        selector: 'input[name="confirmPassword"]',
      })
    ).toBeVisible();
    await expect(canvas.getByText(t("shortCode.journeys.register.description"))).toBeVisible();
    await expect(canvas.getByText(t("form.passwordHint"))).toBeVisible();
    expect(canvasElement.textContent).not.toContain("@");

    const pageBounds = canvas.getByRole("main").getBoundingClientRect();
    const actionBounds = canvas
      .getByRole("region", { name: t("shortCode.journeys.register.title") })
      .getBoundingClientRect();
    const spaceBefore = actionBounds.top - pageBounds.top;
    const spaceAfter = pageBounds.bottom - actionBounds.bottom;
    expect(Math.abs(spaceBefore - spaceAfter)).toBeLessThanOrEqual(1);
  }

  async function verifyEmailConfirmation({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const submitting = t("shortCode.journeys.emailUpdate.submitting");
    await expect(canvas.getByRole("status")).toHaveTextContent(submitting);
    await expect(canvas.getByRole("heading", { level: 1, name: submitting })).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    expect(canvasElement.querySelector('input[type="password"]')).toBeNull();
  }

  async function verifyValidationFeedback({ canvasElement }: { canvasElement: HTMLElement }) {
    await expect(canvasElement.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    await expect(within(canvasElement).queryByRole("link")).not.toBeInTheDocument();
  }

  async function verifySubmittingLocked({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    const button = canvas.getByRole("button", { name: t("shortCode.journeys.passwordReset.submitting") });
    await expect(button).toBeDisabled();
    expect(button.querySelector('[role="status"]')).toBeNull();
    for (const name of ["password", "confirmPassword"]) {
      await expect(canvasElement.querySelector(`input[name="${name}"]`)).toHaveAttribute("readonly");
    }
    // The link's code and target stay in the address the form posts to.
    expect(canvasElement.querySelector('[name="shortCode"], [name="target"]')).toBeNull();
  }

  async function verifyServiceError({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    // The failure shows inside the form, above the submit that retries it.
    const alert = canvas.getByRole("alert");
    const submit = canvas.getByRole("button", { name: t("shortCode.journeys.passwordReset.submit") });
    await expect((submit as HTMLButtonElement).form?.contains(alert)).toBe(true);
    await expect(alert.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
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
  name="Complete registration on desktop"
  exportName="CompleteRegistrationDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifyRegistrationForm}
>
  <StoryHarness initialModel={{ journey: "register", state: { status: "ready" } }} />
</Story>

<Story
  name="Complete registration on mobile"
  exportName="CompleteRegistrationMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
  play={verifyRegistrationForm}
>
  <StoryHarness initialModel={{ journey: "register", state: { status: "ready" } }} />
</Story>

<Story
  name="Updating email on desktop"
  exportName="UpdatingEmailDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
  play={verifyEmailConfirmation}
>
  <StoryHarness initialModel={{ journey: "email-update", state: { status: "submitting" } }} />
</Story>

<Story
  name="Updating email on mobile"
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
  name="Complete password reset on desktop"
  exportName="CompletePasswordResetDesktop"
  globals={reviewStoryGlobals.desktop}
  asChild
>
  <StoryHarness initialModel={{ journey: "password-reset", state: { status: "ready" } }} />
</Story>

<Story
  name="Complete password reset on mobile"
  exportName="CompletePasswordResetMobile"
  globals={reviewStoryGlobals.mobile}
  asChild
>
  <StoryHarness initialModel={{ journey: "password-reset", state: { status: "ready" } }} />
</Story>

<Story name="Passwords shown" asChild>
  <StoryHarness initialModel={{ journey: "password-reset", state: { status: "ready" } }} passwordsShown />
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

<Story name="Service error" asChild play={verifyServiceError}>
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
