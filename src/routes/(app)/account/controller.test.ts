import { createAccountModel } from "#lib/application/auth/account-action.js";
import { validForm } from "#lib/application/auth/forms.fixture.js";
import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type { AccountScreenModel } from "#lib/application/auth/types.js";

import { createAccountScreenController } from "./controller.svelte";

import { describe, expect, it } from "vitest";

const actions = {
  password: "?/password",
  email: "?/email",
  logout: "?/logout",
};

describe("createAccountScreenController", () => {
  it("validates independent account forms without changing other actions", () => {
    const model = createAccountModel({ status: "error", feedback: "sessionUnavailable" }, { status: "unavailable" });
    const controller = createAccountScreenController({ model, actions });
    const invalid = new FormData();
    const accountForms = [
      [controller.submitPassword, validatePasswordChange, "passwordState"],
      [controller.submitEmail, validateEmailUpdate, "emailState"],
    ] as const;

    for (const [submit, validate, key] of accountForms) {
      controller.synchronize(model, actions);
      expect(submit(invalid)).toBe(false);
      const result = validate(invalid);
      if (result.success) throw new Error("Expected invalid form");
      expect(controller.state.model).toEqual({
        ...model,
        [key]: { status: "validation-error", issues: result.issues },
      });
      expect(submit(validForm())).toBe(true);
    }
  });

  it("keeps account actions independent while sharing one controller", () => {
    const controller = createAccountScreenController({
      model: {
        claims: {
          status: "ready",
          userId: "user-id",
          roles: [],
          accessExpiresAt: "later",
          refreshExpiresAt: "later",
        },
        credentials: { status: "ready", email: "creator@example.test" },
        passwordState: { status: "ready" },
        emailState: { status: "ready" },
        logoutState: "ready",
      },
      actions,
      allowNativeSubmission: false,
    });

    expect(controller.submitPassword(validForm())).toBe(false);
    expect(controller.submitEmail(validForm())).toBe(false);
    expect(controller.submitLogout()).toBe(false);
    expect(controller.state.model).toMatchObject({
      passwordState: { status: "submitting" },
      emailState: { status: "submitting" },
      logoutState: "submitting",
    });

    const nextActions = { ...actions, logout: "/logout" };
    const unavailable = createAccountModel(
      { status: "error", feedback: "sessionUnavailable" },
      { status: "unavailable" }
    );
    controller.synchronize(unavailable, nextActions);
    expect(controller.state).toEqual({
      model: unavailable,
      actions: nextActions,
    });
    expect(controller.submitPassword(validForm())).toBe(false);
    expect(controller.submitEmail(validForm())).toBe(false);
    expect(controller.submitLogout()).toBe(false);
    expect(controller.state.model).toMatchObject({
      claims: unavailable.claims,
      passwordState: { status: "submitting" },
      emailState: { status: "submitting" },
      logoutState: "submitting",
    });
  });

  it("allows native account submissions when only the recap failed", () => {
    const controller = createAccountScreenController({
      model: createAccountModel({ status: "error", feedback: "sessionUnavailable" }, { status: "unavailable" }),
      actions,
    });
    for (const submit of [controller.submitPassword, controller.submitEmail, controller.submitLogout]) {
      expect(submit(validForm())).toBe(true);
      expect(submit(validForm())).toBe(false);
    }
  });

  it.each(["completed", "unavailable"] as const)("allows another account change after %s actions", (outcome) => {
    const model: AccountScreenModel = {
      ...createAccountModel({ status: "error", feedback: "sessionUnavailable" }, { status: "unavailable" }),
      passwordState:
        outcome === "completed"
          ? { status: "success", feedback: "passwordChanged" }
          : { status: "service-error", feedback: "serviceUnavailable" },
      emailState:
        outcome === "completed"
          ? { status: "pending-email" }
          : { status: "service-error", feedback: "serviceUnavailable" },
    };
    const controller = createAccountScreenController({ model, actions });
    expect(controller.submitPassword(validForm())).toBe(true);
    expect(controller.state.model).toEqual({ ...model, passwordState: { status: "submitting" } });
    controller.synchronize(model, actions);
    expect(controller.submitEmail(validForm())).toBe(true);
    expect(controller.state.model).toEqual({ ...model, emailState: { status: "submitting" } });
    expect(JSON.stringify(controller.state)).not.toContain("new-password");
  });
});
