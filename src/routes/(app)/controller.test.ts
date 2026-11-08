import { validForm } from "#lib/application/auth/forms.fixture.js";
import { validateEmailRequest, validateInvitationRequest, validateLogin } from "#lib/application/auth/forms.js";

import { withAuthView } from "./auth-dialog-state";
import {
  type AuthenticationPanelControllerState,
  type ShellControllerOptions,
  type ShellData,
  createAuthenticationPanelController,
  createShellController,
  readyAuthenticationModel,
} from "./controller.svelte";

import { describe, expect, it, vi } from "vitest";

const links = {
  homeHref: "/",
  accountHref: "/account",
  privacyHref: "/privacy",
  logoutAction: "/logout",
};

const anonymous: ShellData = {
  activeNavigation: null,
  rail: "expanded",
  session: { status: "anonymous" },
  apps: { studio: "https://studio.example.test" },
};

function shell(options: Partial<ShellControllerOptions> = {}) {
  return createShellController({
    ...links,
    getData: () => anonymous,
    authentication: createAuthenticationPanelController({
      getState: () => ({ model: readyAuthenticationModel("login"), action: "/" }),
    }),
    ...options,
  });
}

describe("createShellController", () => {
  it("accepts semantic shell transitions", () => {
    const onAuthViewChange = vi.fn();
    let data = anonymous;
    let url = new URL("https://account.example.test/base/?document=42&returnTo=%2Faccount&auth=login#selection");
    const controller = shell({
      getData: () => data,
      allowNativeLogout: false,
      // The layout shows each view in the URL, which the shell then reads back.
      onAuthViewChange: (view) => {
        onAuthViewChange(view);
        url = withAuthView(url, view);
      },
      getUrl: () => url,
    });

    expect(controller.state.apps).toEqual({ studio: "https://studio.example.test" });
    expect(controller.state.model.authView).toBe("login");
    expect(controller.authenticationHref("register")).toBe(
      "/base/?document=42&returnTo=%2Faccount&auth=register#selection"
    );
    url = new URL("https://account.example.test/base/account?auth=login");
    expect(controller.authenticationHref(null)).toBe("/base/account");

    controller.authenticationDialog.close();
    expect(controller.state.model.authView).toBeNull();
    expect(controller.authenticationDialog.state.open).toBe(false);
    expect(onAuthViewChange).toHaveBeenCalledExactlyOnceWith(null);

    controller.authenticationDialog.open();
    controller.authenticationDialog.open();
    expect(controller.authenticationDialog.state.open).toBe(true);
    expect(onAuthViewChange).toHaveBeenCalledTimes(2);
    controller.authenticationDialog.toggle();
    expect(controller.authenticationDialog.state.open).toBe(false);
    controller.authenticationDialog.toggle();
    expect(controller.state.model.authView).toBe("login");
    expect(onAuthViewChange.mock.calls).toEqual([[null], ["login"], [null], ["login"]]);

    for (const session of [{ status: "anonymous" }, { status: "loading" }, { status: "error" }] as const) {
      data = { ...data, session };
      expect(controller.logout()).toBe(false);
      expect(controller.state.model.session).toEqual(session);
    }
  });

  it("toggles the rail and the mobile menu", () => {
    const onRailChange = vi.fn();
    const onDrawerChange = vi.fn();
    const controller = shell({ onRailChange, onDrawerChange });

    controller.navigationDialog.open();
    expect(onDrawerChange).toHaveBeenCalledExactlyOnceWith(true);
    controller.toggleRail();
    expect(controller.state.model).toMatchObject({ drawerOpen: true, rail: "collapsed" });
    expect(controller.navigationDialog.state.open).toBe(true);
    expect(onRailChange).toHaveBeenCalledExactlyOnceWith("collapsed");

    controller.navigationDialog.close();
    expect(controller.state.model.drawerOpen).toBe(false);
    controller.navigationDialog.toggle();
    controller.navigationDialog.open();
    expect(controller.navigationDialog.state.open).toBe(true);
    controller.navigationDialog.toggle();
    expect(controller.navigationDialog.state.open).toBe(false);
    expect(onDrawerChange.mock.calls).toEqual([[true], [false], [true], [false]]);

    controller.toggleRail();
    expect(controller.state.model.rail).toBe("expanded");
    expect(onRailChange.mock.calls).toEqual([["collapsed"], ["expanded"]]);
  });

  it("links the menu and authentication views without the open menu", () => {
    const url = new URL("https://account.example.test/base/?document=42&menu=open#selection");
    const controller = shell({ getUrl: () => url });

    expect(controller.state.model.drawerOpen).toBe(true);
    expect(controller.navigationHref(false)).toBe("/base/?document=42#selection");
    expect(controller.navigationHref(true)).toBe("/base/?document=42&menu=open#selection");
    expect(controller.authenticationHref("login")).toBe("/base/?document=42&auth=login#selection");
    expect(controller.authenticationHref(null)).toBe("/base/?document=42#selection");
  });

  it("closes the mobile menu before it shows an authentication journey", () => {
    const changes = vi.fn();
    const controller = shell({
      getUrl: () => new URL("https://account.example.test/?menu=open"),
      onDrawerChange: (open) => changes("drawer", open),
      onAuthViewChange: (view) => changes("auth", view),
    });

    controller.openAuthentication("register");
    expect(controller.state.model).toMatchObject({ drawerOpen: false, authView: "register" });
    expect(controller.navigationDialog.state.open).toBe(false);
    expect(changes.mock.calls).toEqual([
      ["drawer", false],
      ["auth", "register"],
    ]);

    controller.openAuthentication("login");
    expect(changes).toHaveBeenLastCalledWith("auth", "login");
    expect(changes).toHaveBeenCalledTimes(3);
  });

  it("derives the menu, the dialog and the authorization request from the URL, the rest from the load data", () => {
    let data: ShellData = { ...anonymous, rail: "collapsed" };
    let url = new URL("https://account.example.test/?menu=open");
    const controller = shell({ getData: () => data, allowNativeLogout: false, getUrl: () => url });

    expect(controller.state.model).toEqual({
      activeNavigation: null,
      rail: "collapsed",
      drawerOpen: true,
      authView: null,
      session: { status: "anonymous" },
      authorizationRequest: false,
    });

    data = {
      activeNavigation: null,
      rail: "collapsed",
      session: { status: "authenticated", displayName: "Maya Chen" },
      apps: null,
    };
    url = new URL("https://account.example.test/?auth=reset&returnTo=%2Fauthorize%3Fclient_id%3Dstudio");
    expect(controller.state).toEqual({
      model: {
        activeNavigation: null,
        rail: "collapsed",
        drawerOpen: false,
        authView: "reset",
        session: { status: "authenticated", displayName: "Maya Chen" },
        authorizationRequest: true,
      },
      ...links,
      apps: null,
      platformDowntime: undefined,
    });

    expect(controller.logout()).toBe(false);
    expect(controller.state.model.session.status).toBe("anonymous");
  });

  it("allows native logout without replacing the authenticated session", () => {
    const controller = shell({
      getData: () => ({ ...anonymous, session: { status: "authenticated", displayName: "Maya Chen" } }),
    });

    expect(controller.logout()).toBe(true);
    expect(controller.state.model.session.status).toBe("authenticated");
  });
});

describe("createAuthenticationPanelController", () => {
  it.each(["login", "register", "reset"] as const)(
    "returns shared validation for %s before accepting corrected input",
    (journey) => {
      const controller = createAuthenticationPanelController({
        getState: () => ({ model: readyAuthenticationModel(journey), action: "/" }),
      });
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

  it("shows the route's form, then owns its submission without owning form fields", () => {
    let state: AuthenticationPanelControllerState = { model: readyAuthenticationModel("login"), action: "/auth" };
    const controller = createAuthenticationPanelController({ getState: () => state, allowNativeSubmission: false });

    state = { model: readyAuthenticationModel("register"), action: "/register" };
    expect(controller.state).toEqual(state);

    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state.model).toEqual({ journey: "register", state: { status: "submitting" } });
    expect(controller.submit(validForm())).toBe(false);
  });

  it.each(["register", "reset"] as const)("keeps a completed %s request fixed until navigation", (journey) => {
    const model =
      journey === "register"
        ? ({ journey, state: { status: "recorded", email: "creator@example.test" } } as const)
        : ({ journey, state: { status: "pending-email", targetHint: "creator@example.test" } } as const);
    let state: AuthenticationPanelControllerState = { model, action: "/" };
    const controller = createAuthenticationPanelController({ getState: () => state });
    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state.model).toEqual(model);

    state = {
      model: { journey, state: { status: "service-error", feedback: "serviceUnavailable" } },
      action: "/retry",
    };
    expect(controller.submit(validForm())).toBe(true);
    expect(controller.submit(validForm())).toBe(false);
    expect(controller.state).toEqual({ model: { journey, state: { status: "submitting" } }, action: "/retry" });
  });
});
