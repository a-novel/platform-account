import type { ShortCodeScreenModel } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { expectFormActionLayout } from "#lib/ui/forms.fixture.js";

import { createShortCodeScreenController } from "./controller.svelte";
import ShortCodeScreen from "./screen.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";
import { PasswordSchema } from "@a-novel/service-authentication-rest";

function shortCodeController(model: ShortCodeScreenModel) {
  return createShortCodeScreenController({
    getState: () => ({ model, action: "/ext/complete", restartHref: "/?auth=reset", continueHref: "/" }),
    allowNativeSubmission: false,
  });
}

describe("secure-link screen", () => {
  it.each(["en", "fr"] as const)("shows localized API length errors on real %s submissions", async (locale) => {
    const controller = shortCodeController({ journey: "register", state: { status: "ready" } });
    await render(ShortCodeScreen, { controller }, withLocale(locale));
    const form = document.querySelector("form");
    if (!form) throw new Error("Expected password form");
    expect(form.noValidate).toBe(true);
    // The two show-password toggles are buttons too.
    const submit = page.getByRole("button", { name: /account|compte/ });
    const minimum = Number(PasswordSchema.minLength);
    const password = "x".repeat(minimum - 1);
    await page.getByLabelText(locale === "fr" ? /^Nouveau mot de passe/ : /^New password/).fill(password);
    await page
      .getByLabelText(locale === "fr" ? /Confirmez votre nouveau mot de passe/ : /Confirm new password/)
      .fill("different-password");
    await submit.click();
    const message =
      locale === "fr" ? `Utilisez au moins ${minimum} caractères.` : `Use at least ${minimum} characters.`;
    await expect.element(page.getByText(message)).toBeVisible();
    await expect
      .element(page.getByLabelText(locale === "fr" ? /^Nouveau mot de passe/ : /^New password/))
      .toHaveFocus();
    expect(controller.state.model.state.status).toBe("validation-error");
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    expect(form.elements.namedItem("password")).toHaveValue(password);
    await page.getByLabelText(locale === "fr" ? /^Nouveau mot de passe/ : /^New password/).fill("valid-password");
    await page
      .getByLabelText(locale === "fr" ? /Confirmez votre nouveau mot de passe/ : /Confirm new password/)
      .fill("valid-password");
    await submit.click();
    await expect.element(submit).toBeDisabled();
    expect(controller.state.model.state).toEqual({ status: "submitting" });
    expect(Object.fromEntries(new FormData(form))).toEqual({
      password: "valid-password",
      confirmPassword: "valid-password",
    });
  });

  it("never renders secure-link material and locks completion while submitting", async () => {
    render(
      ShortCodeScreen,
      {
        controller: shortCodeController({
          journey: "password-reset",
          state: { status: "submitting" },
        }),
      },
      withLocale()
    );

    const button = page.getByRole("button", { name: /Resetting password/ });
    await expect.element(button).toBeDisabled();
    const form = (button.element() as HTMLButtonElement).form;
    expect(form).not.toBeNull();
    if (form) await expectFormActionLayout(form);
    expect(button.element().querySelector('[role="status"]')).toBeNull();
    await expect.element(page.getByLabelText(/New password/)).toHaveAttribute("readonly");
    await expect.element(page.getByLabelText(/Confirm new password/)).toHaveAttribute("readonly");
    expect(document.querySelector('[name="shortCode"]')).toBeNull();
    expect(document.querySelector('[name="target"]')).toBeNull();
  });

  const completedLinks = [
    ["register", "registrationCompleted", "Your account is ready.", "Continue to your account"],
    ["email-update", "emailUpdated", "Your email address was updated.", "Continue to your account"],
    ["password-reset", "passwordReset", "Your password was reset.", "Log in"],
  ] as const;

  it.each(completedLinks)("uses the %s outcome as the only page heading", async (journey, feedback, title, action) => {
    render(
      ShortCodeScreen,
      {
        controller: shortCodeController({
          journey,
          state: { status: "success", feedback },
        }),
      },
      withLocale()
    );

    const status = page.getByRole("status");
    await expect.element(status).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    expect(page.getByRole("heading").elements()).toHaveLength(1);
    await expect.element(page.getByRole("link", { name: action, exact: true })).toHaveAttribute("href", "/");
    expect(document.querySelector("form")).toBeNull();
    const heading = page.getByRole("heading", { level: 1 }).element();
    expect(getComputedStyle(heading).textAlign).toBe("center");
  });

  const invalidLinks = [
    ["register", "Request an invitation"],
    ["email-update", "Request a new link"],
    ["password-reset", "Request a new link"],
  ] as const;

  it.each(invalidLinks)("offers the %s journey's way to get a new link", async (journey, action) => {
    render(
      ShortCodeScreen,
      { controller: shortCodeController({ journey, state: { status: "invalid" } }) },
      withLocale()
    );

    await expect.element(page.getByRole("heading", { level: 1, name: "This link is not valid" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: action, exact: true })).toBeVisible();
  });

  it("keeps a service error with its submit action", async () => {
    await render(
      ShortCodeScreen,
      {
        controller: shortCodeController({
          journey: "password-reset",
          state: { status: "service-error", feedback: "serviceUnavailable" },
        }),
      },
      withLocale()
    );
    for (const form of document.querySelectorAll("form")) await expectFormActionLayout(form);
  });

  it.each(["ready", "submitting"] as const)(
    "renders %s email validation without a confirmation form",
    async (status) => {
      const controller = createShortCodeScreenController({
        getState: () => ({
          model: { journey: "email-update", state: { status } },
          action: "/ext/email/validate",
          restartHref: "/account",
          continueHref: "/account",
        }),
        allowNativeSubmission: false,
      });

      render(ShortCodeScreen, { controller }, withLocale());

      await expect.element(page.getByRole("status")).toMatchTextContent("Updating email…");
      await expect.element(page.getByRole("heading", { level: 1, name: "Updating email…" })).toBeVisible();
      await expect.element(page.getByRole("button")).not.toBeInTheDocument();
      expect(document.querySelector('input[type="password"]')).toBeNull();
      expect(controller.state.model.state.status).toBe(status);
    }
  );

  it("shows the result the route returns in place of the email validation it started", async () => {
    let model = $state<ShortCodeScreenModel>({ journey: "email-update", state: { status: "ready" } });
    const controller = createShortCodeScreenController({
      getState: () => ({ model, action: "/ext/email/validate", restartHref: "/account", continueHref: "/account" }),
      allowNativeSubmission: false,
    });
    render(ShortCodeScreen, { controller }, withLocale());

    expect(controller.submit()).toBe(false);
    await expect.element(page.getByRole("status")).toMatchTextContent("Updating email…");

    model = { journey: "email-update", state: { status: "service-error", feedback: "serviceUnavailable" } };
    await expect.element(page.getByRole("heading", { level: 1, name: "Email update unavailable" })).toBeVisible();
    expect(controller.submit()).toBe(false);
    expect(controller.state.model.state.status).toBe("submitting");
  });

  it("renders failed automatic email validation as a page outcome", async () => {
    render(
      ShortCodeScreen,
      {
        controller: shortCodeController({
          journey: "email-update",
          state: { status: "service-error", feedback: "serviceUnavailable" },
        }),
      },
      withLocale()
    );
    await expect.element(page.getByRole("heading", { level: 1, name: "Email update unavailable" })).toBeVisible();
    await expect.element(page.getByRole("alert")).toMatchTextContent("Please try again in a few minutes.");
    await expect.element(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
    await expect.element(page.getByRole("button")).not.toBeInTheDocument();
  });
});
