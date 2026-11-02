import type { AccountScreenModel } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { expectFormActionLayout, submitForm } from "#lib/ui/forms.fixture.js";

import { createAccountScreenController } from "./controller.svelte";
import AccountScreen from "./screen.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const readyAccount: AccountScreenModel = {
  claims: {
    status: "ready",
    userId: "verified-user-id",
    roles: ["auth:user"],
    accessExpiresAt: "18 Aug 2026, 19:30",
    refreshExpiresAt: "25 Aug 2026, 18:30",
  },
  credentials: { status: "ready", email: "creator@example.test" },
  passwordState: { status: "ready" },
  emailState: { status: "ready" },
  logoutState: "ready",
};

describe("account screen", () => {
  const currentPasswordRejections = [
    ["en", "Current password", "Your current password is incorrect."],
    ["fr", "Mot de passe actuel", "Votre mot de passe actuel est incorrect."],
  ] as const;

  it.each(currentPasswordRejections)(
    "associates the %s current-password rejection with its field only",
    async (locale, label, message) => {
      render(
        AccountScreen,
        {
          controller: createAccountScreenController({
            model: {
              ...readyAccount,
              passwordState: {
                status: "validation-error",
                issues: [{ field: "currentPassword", feedback: "invalidCurrentPassword" }],
              },
            },
            actions: { password: "?/password", email: "?/email", logout: "?/logout" },
          }),
        },
        withLocale(locale)
      );
      const field = page.getByLabelText(label, { exact: false });
      await expect.element(field).toHaveAttribute("aria-invalid", "true");
      await expect.element(field).toHaveAccessibleDescription(message);
      expect(page.getByText(message).elements()).toHaveLength(1);
      expect(page.getByRole("alert").elements()).toHaveLength(0);
    }
  );

  it("keeps account actions independently mockable", async () => {
    await page.viewport(390, 844);
    const controller = createAccountScreenController({
      model: readyAccount,
      actions: {
        password: "/account?/password",
        email: "/account?/email",
        logout: "/account?/logout",
      },
      allowNativeSubmission: false,
    });

    render(AccountScreen, { controller }, withLocale());

    await page.getByLabelText(/Current password/).fill("old-password");
    await page.getByLabelText(/^New password/).fill("new-password");
    await page.getByLabelText(/Confirm new password/).fill("new-password");
    await page.getByLabelText(/New email address/).fill("creator@example.test");
    const accountForms = [
      ["Change password", "/account?/password"],
      ["Send link", "/account?/email"],
      ["Log out", "/account?/logout"],
    ] as const;

    for (const [label, action] of accountForms) {
      const form = await submitForm(label);
      expect(form.getAttribute("action")).toBe(action);
      if (label === "Change password")
        expect(Object.fromEntries(new FormData(form))).toEqual({
          currentPassword: "old-password",
          password: "new-password",
          confirmPassword: "new-password",
        });
      if (label === "Send link")
        expect(Object.fromEntries(new FormData(form))).toEqual({ email: "creator@example.test" });
      await expectFormActionLayout(form);
      const section = form.closest("section");
      if (!section) throw new Error("Account forms must belong to a section");
      const outer = page.getByRole("region", { name: "Your session" }).element().getBoundingClientRect();
      const inner = form.getBoundingClientRect();
      expect(outer.left).toBe(8);
      const inset = label === "Log out" ? 0 : 16;
      expect(inner.left - outer.left).toBe(inset);
      expect(outer.right - inner.right).toBe(inset);
      expect(section.getBoundingClientRect().left).toBe(inner.left);
    }
    expect(controller.state.model).toMatchObject({
      passwordState: { status: "submitting" },
      emailState: { status: "submitting" },
      logoutState: "submitting",
    });
  });

  it.each(["en", "fr"] as const)("groups the %s logout explanation with its action", async (locale) => {
    await render(
      AccountScreen,
      {
        controller: createAccountScreenController({
          model: readyAccount,
          actions: { password: "/account?/password", email: "/account?/email", logout: "/account?/logout" },
          allowNativeSubmission: false,
        }),
      },
      withLocale(locale)
    );
    const button = page.getByRole("button", { name: locale === "fr" ? "Me déconnecter" : "Log out" });
    const description =
      locale === "fr"
        ? "Vous serez déconnecté de votre compte Agora sur cet appareil."
        : "You’ll be logged out of your Agora account on this device.";
    await expect.element(button).toHaveAccessibleDescription(description);
    const note = page.getByText(description).element();
    const details = page.getByRole("definition").elements().at(-1);
    if (!details) throw new Error("Expected session details");
    const originalViewport = { width: window.innerWidth, height: window.innerHeight };
    try {
      for (const width of [320, 390, 1280]) {
        await page.viewport(width, 844);
        const noteBounds = note.getBoundingClientRect();
        const actionGap = button.element().getBoundingClientRect().top - noteBounds.bottom;
        expect(actionGap).toBe(16);
        expect(noteBounds.top - details.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(actionGap * 2);
      }
    } finally {
      await page.viewport(originalViewport.width, originalViewport.height);
    }
  });

  it.each(["loading", "error"] as const)("keeps account forms usable while the recap is %s", async (status) => {
    const controller = createAccountScreenController({
      model: {
        ...readyAccount,
        claims: status === "loading" ? { status } : { status, feedback: "sessionUnavailable" },
      },
      actions: { password: "/account?/password", email: "/account?/email", logout: "/account?/logout" },
      allowNativeSubmission: false,
    });
    render(AccountScreen, { controller }, withLocale());
    const recap = page.getByRole("region", { name: "Your session" });
    await expect.element(recap).toBeVisible();
    await expect.element(page.getByLabelText(/Current password/)).toBeEnabled();
    await expect.element(page.getByLabelText(/New email address/)).toBeEnabled();
    await page.getByLabelText(/New email address/).fill("creator@example.test");
    await page.getByRole("button", { name: "Send link" }).click();
    await expect.element(page.getByRole("button", { name: /Sending link/ })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "Change password" })).toBeEnabled();
    await expect.element(page.getByRole("button", { name: "Log out" })).toBeEnabled();
    expect(controller.state.model.claims.status).toBe(status);
  });

  it.each(["password", "email"] as const)(
    "places %s confirmation between the fields and submit button",
    async (setting) => {
      const model: AccountScreenModel = {
        ...readyAccount,
        ...(setting === "password"
          ? { passwordState: { status: "success", feedback: "passwordChanged" } }
          : { emailState: { status: "pending-email" } }),
      };
      render(
        AccountScreen,
        {
          controller: createAccountScreenController({
            model,
            actions: { password: "/account?/password", email: "/account?/email", logout: "/account?/logout" },
            allowNativeSubmission: false,
          }),
        },
        withLocale()
      );

      const status = page.getByRole("status");
      await expect.element(status).toBeVisible();
      const feedback = status.element();
      const form = feedback.closest("form");
      expect(form?.getAttribute("action")).toBe(`/account?/${setting}`);
      if (setting === "password") expect(feedback.textContent?.trim()).toBe("Your password was changed.");
      if (!form) throw new Error("Confirmation must stay inside its form");
      await expectFormActionLayout(form);
    }
  );

  it("keeps service errors with their submit actions", async () => {
    await render(
      AccountScreen,
      {
        controller: createAccountScreenController({
          model: {
            ...readyAccount,
            passwordState: { status: "service-error", feedback: "serviceUnavailable" },
            emailState: { status: "service-error", feedback: "serviceUnavailable" },
          },
          actions: { password: "/account?/password", email: "/account?/email", logout: "/account?/logout" },
          allowNativeSubmission: false,
        }),
      },
      withLocale()
    );
    for (const form of document.querySelectorAll("form")) await expectFormActionLayout(form);
  });

  const passwordLabels = [/^Current password/, /^New password/, /^Confirm new password/];

  it.each([0, 1, 2])("reveals only password field %i from its own toggle", async (index) => {
    const actions = { password: "?/password", email: "?/email", logout: "?/logout" };
    render(
      AccountScreen,
      { controller: createAccountScreenController({ model: readyAccount, actions }) },
      withLocale()
    );
    await page.getByRole("button", { name: "Show password" }).nth(index).click();

    for (const [field, label] of passwordLabels.entries()) {
      await expect.element(page.getByLabelText(label)).toHaveAttribute("type", field === index ? "text" : "password");
    }
  });
});
