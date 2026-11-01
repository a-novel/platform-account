import { createAuthenticationPanelController } from "./(authentication)/controller.svelte";
import { createShellController, readyAuthenticationModel } from "./controller.svelte";

import { describe, expect, it, vi } from "vitest";

const links = {
  homeHref: "/",
  accountHref: "/account",
  logoutAction: "/logout",
  privacyHref: "/privacy",
  apps: { studio: "https://studio.example.test" },
};

describe("createShellController", () => {
  it("accepts semantic shell transitions", () => {
    const onAuthViewChange = vi.fn();
    let url = new URL("https://account.example.test/base/?document=42&returnTo=%2Faccount#selection");
    const authentication = createAuthenticationPanelController({
      model: readyAuthenticationModel("login"),
      action: "/auth",
      allowNativeSubmission: false,
    });
    const controller = createShellController({
      ...links,
      model: { authView: "login", session: { status: "anonymous" } },
      authentication,
      allowNativeLogout: false,
      onAuthViewChange,
      getUrl: () => url,
    });

    expect(controller.state.apps).toEqual({ studio: "https://studio.example.test" });
    expect(controller.authenticationHref("register")).toBe(
      "/base/?document=42&returnTo=%2Faccount&auth=register#selection"
    );
    url = new URL("https://account.example.test/base/account?auth=login");
    expect(controller.authenticationHref(null)).toBe("/base/account");

    controller.authenticationDialog.close();
    expect(controller.state.model.authView).toBeNull();
    expect(controller.authenticationDialog.state.open).toBe(false);
    expect(onAuthViewChange).toHaveBeenCalledExactlyOnceWith(null);

    controller.appList.open();
    expect(controller.appList.state.open).toBe(true);
    controller.appList.close();
    expect(controller.appList.state.open).toBe(false);

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
      controller.synchronizeRoute({ authView: null, session });
      expect(controller.logout()).toBe(false);
      expect(controller.state.model.session).toEqual(session);
    }
  });

  it("synchronizes route state around accepted shell transitions", () => {
    const onAuthViewChange = vi.fn();
    const authentication = createAuthenticationPanelController({
      model: readyAuthenticationModel("login"),
      action: "/auth/login",
      allowNativeSubmission: false,
    });
    const controller = createShellController({
      ...links,
      model: { authView: null, session: { status: "anonymous" } },
      authentication,
      resolveAuthentication: (view) => ({
        model: readyAuthenticationModel(view),
        action: `/auth/${view}`,
      }),
      allowNativeLogout: false,
      onAuthViewChange,
    });

    controller.openAuthentication("register");
    expect(controller.state.model.authView).toBe("register");
    expect(controller.authentication.state).toEqual({
      model: { journey: "register", state: { status: "ready" } },
      action: "/auth/register",
    });
    expect(onAuthViewChange).toHaveBeenCalledExactlyOnceWith("register");

    controller.openAuthentication("register");
    controller.authenticationDialog.close();
    expect(onAuthViewChange).toHaveBeenLastCalledWith(null);

    controller.synchronizeRoute({
      authView: "reset",
      session: { status: "authenticated", displayName: "Maya Chen" },
      authorizationRequest: true,
      authentication: {
        model: readyAuthenticationModel("reset"),
        action: "/auth/reset",
      },
    });
    expect(controller.state.model).toEqual({
      authView: "reset",
      session: { status: "authenticated", displayName: "Maya Chen" },
      authorizationRequest: true,
    });
    expect(controller.authentication.state.action).toBe("/auth/reset");
    expect(onAuthViewChange.mock.calls).toEqual([["register"], [null]]);

    expect(controller.logout()).toBe(false);
    expect(controller.state.model.session.status).toBe("anonymous");
  });

  it("allows native logout without replacing the authenticated session", () => {
    const authentication = createAuthenticationPanelController({
      model: readyAuthenticationModel("login"),
      action: "/auth",
    });
    const controller = createShellController({
      ...links,
      model: { authView: null, session: { status: "authenticated", displayName: "Maya Chen" } },
      authentication,
    });

    expect(controller.logout()).toBe(true);
    expect(controller.state.model.session.status).toBe("authenticated");
  });
});
