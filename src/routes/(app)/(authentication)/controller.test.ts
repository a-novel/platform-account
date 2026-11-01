import { validForm } from "#lib/application/auth/forms.fixture.js";
import { validateEmailRequest, validateInvitationRequest, validateLogin } from "#lib/application/auth/forms.js";

import { readyAuthenticationModel } from "../controller.svelte";
import { createAuthenticationPanelController } from "./controller.svelte";

import { describe, expect, it } from "vitest";

describe("createAuthenticationPanelController", () => {
  it.each(["login", "register", "reset"] as const)(
    "returns shared validation for %s before accepting corrected input",
    (journey) => {
      const controller = createAuthenticationPanelController({ model: readyAuthenticationModel(journey), action: "/" });
      const invalid = new FormData();
      const validate =
        journey === "login" ? validateLogin : journey === "register" ? validateInvitationRequest : validateEmailRequest;
      const expected = validate(invalid);
      expect(controller.submit(invalid)).toBe(false);
      if (expected.success) throw new Error("Expected invalid form");
      expect(controller.state.model.state).toEqual({ status: "validation-error", issues: expected.issues });
      expect(controller.submit(validForm())).toBe(true);
      expect(controller.state.model.state).toEqual({ status: "submitting" });
      expect(JSON.stringify(controller.state)).not.toContain("new-password");
    }
  );

  it("owns authentication submission without owning form fields", () => {
    const controller = createAuthenticationPanelController({
      model: readyAuthenticationModel("login"),
      action: "/auth",
      allowNativeSubmission: false,
    });

    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state.model).toEqual({ journey: "login", state: { status: "submitting" } });
    expect(controller.submit(validForm())).toBe(false);

    controller.synchronize(readyAuthenticationModel("register"), "/register");
    expect(controller.state).toEqual({
      model: { journey: "register", state: { status: "ready" } },
      action: "/register",
    });
  });

  it.each(["register", "reset"] as const)("keeps a completed %s request fixed until navigation", (journey) => {
    const model =
      journey === "register"
        ? ({ journey, state: { status: "recorded", email: "creator@example.test" } } as const)
        : ({ journey, state: { status: "pending-email", targetHint: "creator@example.test" } } as const);
    const controller = createAuthenticationPanelController({ model, action: "/" });
    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state.model).toEqual(model);

    controller.synchronize({ journey, state: { status: "service-error", feedback: "serviceUnavailable" } }, "/retry");
    expect(controller.submit(validForm())).toBe(true);
    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state).toEqual({ model: { journey, state: { status: "submitting" } }, action: "/retry" });
  });

  it.each(["account_exists", "already_waitlisted"] as const)("allows correction after %s", (code) => {
    const controller = createAuthenticationPanelController({
      model: { journey: "register", state: { status: "conflict", code } },
      action: "/?auth=register",
    });
    expect(controller.submit(validForm())).toBe(true);
    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state.model).toEqual({ journey: "register", state: { status: "submitting" } });
  });

  it("masks a shown password whenever it synchronizes", () => {
    const controller = createAuthenticationPanelController({ model: readyAuthenticationModel("login"), action: "/" });
    controller.passwordVisibility.toggle();
    expect(controller.passwordVisibility.state.pressed).toBe(true);

    controller.synchronize(readyAuthenticationModel("login"), "/");
    expect(controller.passwordVisibility.state.pressed).toBe(false);
  });
});
