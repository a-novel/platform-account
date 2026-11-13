import type { AccountCredentialsState, AccountEditor, AccountInformationModel } from "#lib/application/auth/types.js";
import { portraitPicture } from "#lib/application/profile/picture.fixture.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { submitForm } from "#lib/ui/forms.fixture.js";

import { createInformationModel } from "./account-action";
import { type AccountInformationControllerOptions, createAccountInformationController } from "./controller.svelte";
import Screen from "./screen.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import { Alert } from "@a-novel-kit/uikit";
import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const credentials = { status: "ready", email: "maya.chen@example.test", locationConsent: false } as const;
const pendingCredentials: AccountCredentialsState = {
  ...credentials,
  pendingEmail: { email: "maya.writes@example.test", expiresAt: "Nov 4, 2026, 6:40 PM" },
};
const ready = createInformationModel(credentials, { status: "ready" }, null);

function controller(
  patch: Partial<AccountInformationModel> = {},
  options: Partial<AccountInformationControllerOptions> = {}
) {
  const { editor, ...model } = { ...ready, ...patch };
  return createAccountInformationController({
    getModel: () => model,
    getEditor: () => editor,
    actions: {
      password: "?edit=password&/password",
      email: "?edit=email&/email",
      cancelEmail: "?/cancelEmail",
      username: "?edit=username&/username",
      picture: "?edit=picture&/picture",
      removePicture: "?edit=picture&/removePicture",
    },
    devicesHref: "/account/devices",
    logoutOthersHref: "/account/devices?confirm=others",
    allowNativeSubmission: false,
    ...options,
  });
}

describe("my information screen", () => {
  it("shows the email and opens each editor in place", async () => {
    const information = controller();
    await render(Screen, { controller: information }, withLocale());

    const section = page.getByRole("region", { name: "Email and password" });
    await expect.element(section.getByText("maya.chen@example.test")).toBeVisible();
    await expect
      .element(section.getByRole("link", { name: "Change password" }))
      .toHaveAttribute("href", "?edit=password");
    const changeEmail = section.getByRole("link", { name: "Change email" });
    await expect.element(changeEmail).toHaveAttribute("href", "?edit=email");

    await changeEmail.click();

    await expect.element(page.getByRole("dialog", { name: "Change your email" })).toBeVisible();
    expect(information.state.model.editor).toBe("email");
  });

  it("shows a pending email in an info note, beside the current one", async () => {
    await render(Screen, { controller: controller({ credentials: pendingCredentials }) }, withLocale());
    await render(Alert, { tone: "info", title: "Reference", role: "note", "aria-label": "Reference" });

    const note = page.getByRole("note").filter({ hasText: "Awaiting confirmation" });
    await expect.element(note).toMatchTextContent(/maya\.writes@example\.test\s*Link expires Nov 4, 2026, 6:40 PM/);
    await expect.element(page.getByText("maya.chen@example.test", { exact: true })).toBeVisible();
    const reference = page.getByRole("note", { name: "Reference" }).element();
    expect(getComputedStyle(note.element()).backgroundColor).toBe(getComputedStyle(reference).backgroundColor);
  });

  it("cancels the pending email change from its note, once", async () => {
    await render(Screen, { controller: controller({ credentials: pendingCredentials }) }, withLocale());

    const note = page.getByRole("note").filter({ hasText: "Awaiting confirmation" });
    const cancel = note.getByRole("button", { name: "Cancel change" });
    expect(cancel.element().closest("form")?.getAttribute("action")).toBe("?/cancelEmail");

    await cancel.click();

    await expect.element(note.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
  });

  it("keeps the pending email change cancellable after the service refused it", async () => {
    const refused = { status: "service-error", feedback: "serviceUnavailable" } as const;
    const information = controller({ credentials: pendingCredentials, emailCancelState: refused });
    await render(Screen, { controller: information }, withLocale("fr"));

    await expect.element(page.getByRole("alert")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Annuler la modification" })).toBeEnabled();
  });

  it("holds the place of an email it cannot read yet, and still offers to change it", async () => {
    await render(Screen, { controller: controller({ credentials: { status: "unavailable" } }) }, withLocale("fr"));

    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Modifier mon courriel" })).toBeVisible();
  });
});

describe("credentials card", () => {
  it("holds each way to log in on a card of its own", async () => {
    await render(Screen, { controller: controller() }, withLocale("fr"));

    const credentials = page.getByRole("region", { name: "Identifiants", exact: true });
    await expect
      .element(credentials)
      .toMatchTextContent(/^Identifiants\s*Les informations avec lesquelles vous vous authentifiez\./);
    await expect
      .element(credentials.getByRole("heading", { level: 3, name: "Courriel et mot de passe" }))
      .toBeVisible();
    await expect.element(credentials.getByRole("region", { name: "Courriel et mot de passe" })).toBeVisible();
  });
});

describe("public profile card", () => {
  it("states that the profile is public, above the sign-in details, and opens each editor in place", async () => {
    const information = controller();
    await render(Screen, { controller: information }, withLocale());

    const card = page.getByRole("region", { name: "Public profile" });
    await expect
      .element(card)
      .toMatchTextContent(/Anyone on Agora can see this information\.\s+Username\s+Not set\s+Picture\s+No picture/);
    const signIn = page.getByRole("region", { name: "Email and password" }).element();
    expect(card.element().compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await expect.element(card.getByRole("link", { name: "Change picture" })).toHaveAttribute("href", "?edit=picture");
    await card.getByRole("link", { name: "Change username" }).click();
    await expect.element(page.getByRole("dialog", { name: "Choose your username" })).toBeVisible();
    expect(information.state.model.editor).toBe("username");
  });

  it("shows the username and the picture once set", async () => {
    const profile = { status: "ready", username: "Maya", picture: portraitPicture } as const;
    await render(Screen, { controller: controller({ profile }) }, withLocale("fr"));

    const card = page.getByRole("region", { name: "Profil public" });
    await expect.element(card.getByText("Maya", { exact: true })).toBeVisible();
    await expect
      .element(card.getByRole("img", { name: "Votre photo actuelle" }))
      .toHaveAttribute("src", portraitPicture);
  });

  it("holds the place of a profile it cannot read yet, and still offers to change it", async () => {
    await render(Screen, { controller: controller({ profile: { status: "unavailable" } }) }, withLocale());

    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Change username" })).toBeVisible();
  });
});

describe("email dialog", () => {
  it("submits the new email and the current password to its action", async () => {
    const information = controller({ editor: "email" });
    await render(Screen, { controller: information }, withLocale());

    const dialog = page.getByRole("dialog", { name: "Change your email" });
    await dialog.getByLabelText(/^New email address/).fill("maya.writes@example.test");
    await dialog.getByLabelText(/^Current password/).fill("current-password");
    const form = await submitForm("Send link");

    expect(form.getAttribute("action")).toBe("?edit=email&/email");
    expect(Object.fromEntries(new FormData(form))).toEqual({
      email: "maya.writes@example.test",
      currentPassword: "current-password",
    });
    await expect.element(dialog.getByRole("button", { name: "Sending link…" })).toBeDisabled();
    expect(information.state.model.emailState).toEqual({ status: "submitting" });
  });

  it("shows a rejected current password on its field", async () => {
    const issues = [{ field: "currentPassword", feedback: "invalidCurrentPassword" }] as const;
    await render(
      Screen,
      { controller: controller({ editor: "email", emailState: { status: "validation-error", issues } }) },
      withLocale()
    );

    const field = page.getByRole("dialog").getByLabelText(/^Current password/);
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
    await expect.element(field).toHaveAccessibleDescription("Your current password is incorrect.");
  });

  it("ends on a success screen that sets the new email apart from the current one", async () => {
    const information = controller({
      credentials: pendingCredentials,
      editor: "email",
      emailState: { status: "pending-email" },
    });
    await render(Screen, { controller: information }, withLocale());

    const dialog = page.getByRole("dialog", { name: "Check your inbox" });
    await expect.element(dialog).toBeVisible();
    expect(dialog.getByRole("heading").element().querySelector("svg")).not.toBeNull();
    await expect.element(dialog.getByRole("status")).toMatchTextContent(/The link expires on Nov 4, 2026, 6:40 PM\./);

    const sent = dialog.getByText("If no other account uses", { exact: false });
    const pending = sent.getByText("maya.writes@example.test", { exact: true }).element();
    expect(pending.tagName).toBe("STRONG");
    expect(getComputedStyle(pending).color).not.toBe(getComputedStyle(sent.element()).color);
    const current = dialog.getByText("maya.chen@example.test", { exact: true }).element();
    expect(current.tagName).toBe("STRONG");
    expect(Number(getComputedStyle(current).fontWeight)).toBeGreaterThanOrEqual(700);

    const gotIt = dialog.getByRole("link", { name: "Got it" });
    await expect.element(gotIt).toHaveAttribute("href", "?");
    await gotIt.click();
    await expect.element(dialog).not.toBeInTheDocument();
    expect(information.state.model).toEqual({ ...ready, credentials: pendingCredentials });
  });

  it("tells where the link goes even before the account shows the pending email", async () => {
    await render(
      Screen,
      {
        controller: controller({
          credentials: { status: "unavailable" },
          editor: "email",
          emailState: { status: "pending-email" },
        }),
      },
      withLocale()
    );

    await expect
      .element(page.getByRole("dialog", { name: "Check your inbox" }).getByRole("status"))
      .toMatchTextContent(
        /^If no other account uses the new address, you’ll receive a confirmation link there\.\s*Got it$/
      );
  });
  it("closes the editor it opened once the URL closes it, as Back does, and reopens it with Forward", async () => {
    let editor = $state<AccountEditor | null>(null);
    const information = controller({}, { getEditor: () => editor, onEditorChange: (next) => (editor = next) });
    await render(Screen, { controller: information }, withLocale());

    await page.getByRole("link", { name: "Change password" }).click();
    const dialog = page.getByRole("dialog", { name: "Change your password" });
    await expect.element(dialog).toBeVisible();

    editor = null;
    await expect.element(dialog).not.toBeInTheDocument();
    expect(information.state.model.editor).toBeNull();

    editor = "password";
    await expect.element(dialog).toBeVisible();
  });
});

describe("password dialog", () => {
  it("submits the current and new passwords to its action", async () => {
    const information = controller({ editor: "password" });
    await render(Screen, { controller: information }, withLocale());

    const dialog = page.getByRole("dialog", { name: "Change your password" });
    await dialog.getByLabelText(/^Current password/).fill("old-password");
    await dialog.getByLabelText(/^New password/).fill("new-password");
    await dialog.getByLabelText(/^Confirm new password/).fill("new-password");
    const form = await submitForm("Change password");

    expect(form.getAttribute("action")).toBe("?edit=password&/password");
    expect(Object.fromEntries(new FormData(form))).toEqual({
      currentPassword: "old-password",
      password: "new-password",
      confirmPassword: "new-password",
    });
    expect(information.state.model.passwordState).toEqual({ status: "submitting" });
  });

  it("ends on a success screen that offers to review or log out the other devices", async () => {
    const information = controller({
      editor: "password",
      passwordState: { status: "success", feedback: "passwordChanged" },
    });
    await render(Screen, { controller: information }, withLocale());

    const dialog = page.getByRole("dialog", { name: "Password changed" });
    await expect.element(dialog).toBeVisible();
    expect(dialog.getByRole("heading").element().querySelector("svg")).not.toBeNull();
    await expect.element(dialog.getByText("Use your new password the next time you log in.")).toBeVisible();
    await expect.element(dialog.getByText(/^Your other devices stay logged in\./)).toBeVisible();
    await expect
      .element(dialog.getByRole("link", { name: "Review your devices" }))
      .toHaveAttribute("href", "/account/devices");
    await expect
      .element(dialog.getByRole("link", { name: "Log out all devices" }))
      .toHaveAttribute("href", "/account/devices?confirm=others");

    await dialog.getByRole("link", { name: "Got it" }).click();
    await expect.element(dialog).not.toBeInTheDocument();
    expect(information.state.model).toEqual(ready);
  });
});
