import { validForm } from "#lib/application/auth/forms.fixture.js";
import { validateNewPassword } from "#lib/application/auth/forms.js";
import type { ShortCodeState } from "#lib/application/auth/types.js";

import { createShortCodeScreenController, shortCodeControllerState } from "./controller.svelte";

import { describe, expect, it } from "vitest";

describe("createShortCodeScreenController", () => {
  it.each(["register", "password-reset"] as const)(
    "validates %s confirmation without retaining passwords",
    (journey) => {
      const controller = createShortCodeScreenController({
        getState: () => ({
          model: { journey, state: { status: "ready" } },
          action: "",
          restartHref: "/",
          continueHref: "/",
        }),
      });
      const invalid = validForm();
      invalid.set("confirmPassword", "different-password");
      const result = validateNewPassword(invalid);
      expect(controller.submit(invalid)).toBe(false);
      if (result.success) throw new Error("Expected invalid confirmation");
      expect(controller.state.model.state).toEqual({ status: "validation-error", issues: result.issues });
      expect(controller.submit(validForm())).toBe(true);
      expect(JSON.stringify(controller.state)).not.toContain("new-password");
      expect(JSON.stringify(controller.state)).not.toContain("different-password");
    }
  );

  const settledStates: ShortCodeState[] = [
    { status: "missing" },
    { status: "invalid" },
    { status: "submitting" },
    { status: "success", feedback: "registrationCompleted" },
  ];

  it.each(settledStates)("preserves a secure link in $status state", (state) => {
    const controller = createShortCodeScreenController({
      getState: () => ({
        model: { journey: "register", state },
        action: "",
        restartHref: "/register",
        continueHref: "/",
      }),
    });
    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state.model.state).toEqual(state);
  });

  it("confirms email without password fields and recovers from an outage", () => {
    const controller = createShortCodeScreenController({
      getState: () => ({
        model: { journey: "email-update", state: { status: "ready" } },
        action: "",
        restartHref: "/account",
        continueHref: "/account",
      }),
    });
    expect(controller.submit()).toBe(true);
    expect(controller.submit()).toBe(false);

    controller.fail("serviceUnavailable");
    expect(controller.state.model).toEqual({
      journey: "email-update",
      state: { status: "service-error", feedback: "serviceUnavailable" },
    });
    expect(controller.submit()).toBe(true);
    expect(controller.state.model.state).toEqual({ status: "submitting" });
  });

  it("shows the state the route sends and owns its submission", () => {
    let state = shortCodeControllerState({
      model: { journey: "password-reset", state: { status: "ready" } },
      links: { restartHref: "/restart", continueHref: "/" },
    });
    const controller = createShortCodeScreenController({ getState: () => state, allowNativeSubmission: false });

    state = shortCodeControllerState(
      {
        model: { journey: "register", state: { status: "ready" } },
        links: { restartHref: "/register", continueHref: "/" },
      },
      { shortCode: { journey: "register", state: { status: "success", feedback: "registrationCompleted" } } }
    );
    expect(controller.state).toEqual({
      model: { journey: "register", state: { status: "success", feedback: "registrationCompleted" } },
      action: "",
      restartHref: "/register",
      continueHref: "/",
    });
    expect(controller.submit(validForm())).toBe(false);

    state = { ...state, model: { journey: "register", state: { status: "ready" } } };
    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state.model.state.status).toBe("submitting");
  });
});
