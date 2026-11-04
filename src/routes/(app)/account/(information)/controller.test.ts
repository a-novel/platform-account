import { validForm } from "#lib/application/auth/forms.fixture.js";
import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type { AccountInformationModel } from "#lib/application/auth/types.js";

import { createInformationModel } from "./account-action";
import { type AccountInformationControllerOptions, createAccountInformationController } from "./controller.svelte";

import { describe, expect, it, vi } from "vitest";

const ready = createInformationModel({ status: "ready", email: "creator@example.test", locationConsent: false }, null);

function controller(
  model: AccountInformationModel = ready,
  options: Partial<AccountInformationControllerOptions> = {}
) {
  return createAccountInformationController({
    model,
    actions: { password: "?edit=password&/password", email: "?edit=email&/email" },
    devicesHref: "/account/devices",
    logoutOthersHref: "/account/devices?confirm=others",
    ...options,
  });
}

describe("createAccountInformationController", () => {
  it("opens one editor at a time and reports each change once", () => {
    const onEditorChange = vi.fn();
    const information = controller(ready, { onEditorChange });

    information.editors.email.open();
    information.editors.email.open();
    expect(information.state.model.editor).toBe("email");
    expect(information.editors.email.state.open).toBe(true);
    expect(information.editors.password.state.open).toBe(false);

    information.editors.password.toggle();
    expect(information.state.model.editor).toBe("password");
    information.editors.password.toggle();
    expect(information.state.model.editor).toBeNull();
    information.editors.email.toggle();
    information.editors.email.close();

    expect(onEditorChange.mock.calls).toEqual([["email"], ["password"], [null], ["email"], [null]]);
  });

  it("starts a reopened editor from a blank form", () => {
    const information = controller({
      ...ready,
      editor: "password",
      passwordState: { status: "success", feedback: "passwordChanged" },
      emailState: { status: "validation-error", issues: [{ field: "newEmail", feedback: "email" }] },
    });

    information.editors.password.close();

    expect(information.state.model).toEqual(ready);
  });

  it("links each editor from the route's URL", () => {
    expect(controller().editorHref("email")).toBe("?edit=email");
    expect(controller().editorHref(null)).toBe("?");

    const editorUrl = (editor: string | null) => (editor ? `/account?menu=open&edit=${editor}` : "/account?menu=open");
    expect(controller(ready, { editorUrl }).editorHref("password")).toBe("/account?menu=open&edit=password");
    expect(controller(ready, { editorUrl }).editorHref(null)).toBe("/account?menu=open");
  });

  const forms = [
    ["password", "submitPassword", "passwordState", validatePasswordChange],
    ["email", "submitEmail", "emailState", validateEmailUpdate],
  ] as const;

  it.each(forms)("validates the %s form before it submits, once", (_, submit, key, validate) => {
    const information = controller();
    const invalid = new FormData();
    const expected = validate(invalid);
    if (expected.success) throw new Error("Expected an invalid form");

    expect(information[submit](invalid)).toBe(false);
    expect(information.state.model).toEqual({
      ...ready,
      [key]: { status: "validation-error", issues: expected.issues },
    });

    expect(information[submit](validForm())).toBe(true);
    expect(information.state.model[key]).toEqual({ status: "submitting" });
    expect(information[submit](validForm())).toBe(false);
    expect(JSON.stringify(information.state)).not.toContain("new-password");
  });

  it.each(forms)("keeps the %s submission in place when the route sends it", (_, submit, key) => {
    const information = controller(ready, { allowNativeSubmission: false });

    expect(information[submit](validForm())).toBe(false);
    expect(information.state.model[key]).toEqual({ status: "submitting" });
  });

  it("shows the action's result once the route synchronizes it", () => {
    const information = controller();
    information.submitEmail(validForm());

    const sent: AccountInformationModel = { ...ready, editor: "email", emailState: { status: "pending-email" } };
    information.synchronize(sent);

    expect(information.state.model).toEqual(sent);
    expect(information.editors.email.state.open).toBe(true);
  });

  it("shows each password field on its own", () => {
    const { passwordVisibility } = controller();

    passwordVisibility.emailCurrentPassword.toggle();

    expect(passwordVisibility.emailCurrentPassword.state.pressed).toBe(true);
    expect(passwordVisibility.currentPassword.state.pressed).toBe(false);
    expect(passwordVisibility.newPassword.state.pressed).toBe(false);
    expect(passwordVisibility.confirmPassword.state.pressed).toBe(false);
  });
});
