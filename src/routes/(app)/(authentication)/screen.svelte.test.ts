import type { AuthenticationPanelModel } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { expectFormActionLayout, submitForm } from "#lib/ui/forms.fixture.js";

import { createAuthenticationPanelController } from "./controller.svelte";
import AuthenticationPanel from "./screen.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

function authenticationController(model: AuthenticationPanelModel) {
  return createAuthenticationPanelController({
    model,
    action: `/auth?/${model.journey}`,
    allowNativeSubmission: false,
  });
}

describe("authentication panel", () => {
  it("delegates login submission without owning credential state", async () => {
    const controller = authenticationController({ journey: "login", state: { status: "ready" } });

    render(AuthenticationPanel, { controller }, withLocale());

    await page.getByLabelText(/Email address/).fill("creator@example.test");
    await page.getByLabelText(/Password/).fill("valid-example-password");
    const form = await submitForm("Log in");

    await expectFormActionLayout(form);
    expect(form.getAttribute("action")).toBe("/auth?/login");
    expect(form.getAttribute("method")).toBe("POST");
    expect(controller.state.model.state.status).toBe("submitting");
    expect(Object.fromEntries(new FormData(form))).toEqual({
      email: "creator@example.test",
      password: "valid-example-password",
    });
    await expect.element(page.getByLabelText(/Email address/)).toHaveAttribute("name", "email");
    await expect.element(page.getByLabelText(/Password/)).toHaveAttribute("name", "password");
  });

  it("locks an in-flight login at the pure view boundary", async () => {
    render(
      AuthenticationPanel,
      {
        controller: authenticationController({ journey: "login", state: { status: "submitting" } }),
      },
      withLocale()
    );

    const button = page.getByRole("button", { name: /Logging in/ });
    await expect.element(button).toBeDisabled();
    expect(button.element().querySelector('[role="status"]')).toBeNull();
    await expect.element(page.getByLabelText(/Email address/)).toHaveAttribute("readonly");
    await expect.element(page.getByLabelText(/Password/)).toHaveAttribute("readonly");
  });

  it("keeps validation feedback beside fields and places service failures before submit", async () => {
    const validation = await render(
      AuthenticationPanel,
      {
        controller: authenticationController({
          journey: "login",
          state: {
            status: "validation-error",
            issues: [
              { field: "email", feedback: "email" },
              { field: "password", feedback: "password" },
            ],
          },
        }),
      },
      withLocale()
    );

    await expect.element(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect.element(page.getByText("Enter your password.")).toBeVisible();
    expect(document.querySelector('a[href$="-email"]')).toBeNull();
    validation.unmount();

    await render(
      AuthenticationPanel,
      {
        controller: authenticationController({
          journey: "login",
          state: { status: "service-error", feedback: "serviceUnavailable" },
        }),
      },
      withLocale()
    );

    const alert = page.getByRole("alert").element();
    const submit = page.getByRole("button", { name: "Log in" }).element();
    expect(alert.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    await expect.element(page.getByRole("alert")).toMatchTextContent("Temporarily unavailable");
    await expect.element(page.getByRole("alert")).toMatchTextContent("Please try again in a few minutes.");
    const form = (submit as HTMLButtonElement).form;
    if (!form) throw new Error("Submit button must belong to a form");
    await expectFormActionLayout(form);
  });

  it("translates stable feedback codes through the active locale", async () => {
    const validation = await render(
      AuthenticationPanel,
      {
        controller: authenticationController({
          journey: "login",
          state: {
            status: "validation-error",
            issues: [
              { field: "email", feedback: "email" },
              { field: "password", feedback: "password" },
            ],
          },
        }),
      },
      withLocale("fr")
    );

    await expect.element(page.getByText("Saisissez un courriel valide.")).toBeVisible();
    await expect.element(page.getByText("Saisissez votre mot de passe.")).toBeVisible();
    validation.unmount();

    render(
      AuthenticationPanel,
      {
        controller: authenticationController({
          journey: "login",
          state: { status: "service-error", feedback: "invalidCredentials" },
        }),
      },
      withLocale("fr")
    );

    await expect.element(page.getByText("Le courriel ou le mot de passe est incorrect.")).toBeVisible();
  });

  it("shows the complete address the user just submitted without a redundant label", async () => {
    render(
      AuthenticationPanel,
      {
        controller: authenticationController({
          journey: "register",
          state: { status: "recorded", email: "maya.chen@example.test" },
        }),
      },
      withLocale()
    );

    const status = page.getByRole("status");
    await expect.element(status).toBeVisible();
    expect(getComputedStyle(status.element()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect.element(page.getByText("maya.chen@example.test")).toBeVisible();
    await expect.element(page.getByText("Delivery address")).not.toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll("strong")).some(
        (element) => element.textContent === "maya.chen@example.test"
      )
    ).toBe(true);
  });

  const waitlistConflicts = [
    ["en", "account_exists", "This email is already registered. You can log in to your account."],
    ["en", "already_waitlisted", "This email is already on the invitation list."],
    ["fr", "account_exists", "Ce courriel est déjà associé à un compte. Vous pouvez vous connecter."],
    ["fr", "already_waitlisted", "Ce courriel figure déjà sur la liste d’invitation."],
  ] as const;

  it.each(waitlistConflicts)("renders %s %s as a correctable warning", async (locale, code, message) => {
    const controller = authenticationController({ journey: "register", state: { status: "conflict", code } });
    render(AuthenticationPanel, { controller }, withLocale(locale));
    const alert = page.getByRole("status");
    await expect.element(alert).toMatchTextContent(message);
    const submit = page.getByRole("button", { name: locale === "fr" ? "Rejoindre la liste" : "Join the list" });
    await expect.element(submit).toBeEnabled();
    expect(alert.element().compareDocumentPosition(submit.element()) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    await page.getByRole("textbox").fill("another@example.test");
    await submit.click();
    expect(controller.state.model.state).toEqual({ status: "submitting" });
  });
});
