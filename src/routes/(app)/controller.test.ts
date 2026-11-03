import type { ShellViewModel } from "#lib/application/shell/types.js";

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

function model(patch: Partial<ShellViewModel> = {}): ShellViewModel {
  return {
    activeNavigation: "home",
    rail: "expanded",
    drawerOpen: false,
    authView: null,
    session: { status: "anonymous" },
    ...patch,
  };
}

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
      model: model({ authView: "login" }),
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
      controller.synchronizeRoute({ activeNavigation: "home", authView: null, session });
      expect(controller.logout()).toBe(false);
      expect(controller.state.model.session).toEqual(session);
    }
  });

  it("toggles the rail and the mobile menu", () => {
    const onRailChange = vi.fn();
    const onDrawerChange = vi.fn();
    const controller = createShellController({
      ...links,
      model: model(),
      authentication: createAuthenticationPanelController({ model: readyAuthenticationModel("login"), action: "/" }),
      onRailChange,
      onDrawerChange,
    });

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

    controller.synchronizeRail("expanded");
    controller.synchronizeRail("expanded");
    expect(controller.state.model.rail).toBe("expanded");
    expect(onRailChange).toHaveBeenCalledOnce();
  });

  it("links the menu and authentication views without the open menu", () => {
    const url = new URL("https://account.example.test/base/?document=42&menu=open#selection");
    const controller = createShellController({
      ...links,
      model: model({ drawerOpen: true }),
      authentication: createAuthenticationPanelController({ model: readyAuthenticationModel("login"), action: "/" }),
      getUrl: () => url,
    });

    expect(controller.navigationHref(false)).toBe("/base/?document=42#selection");
    expect(controller.navigationHref(true)).toBe("/base/?document=42&menu=open#selection");
    expect(controller.authenticationHref("login")).toBe("/base/?document=42&auth=login#selection");
    expect(controller.authenticationHref(null)).toBe("/base/?document=42#selection");
  });

  it("closes the mobile menu before it shows an authentication journey", () => {
    const changes = vi.fn();
    const controller = createShellController({
      ...links,
      model: model({ drawerOpen: true }),
      authentication: createAuthenticationPanelController({ model: readyAuthenticationModel("login"), action: "/" }),
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

  it("synchronizes route state around accepted shell transitions", () => {
    const onAuthViewChange = vi.fn();
    const authentication = createAuthenticationPanelController({
      model: readyAuthenticationModel("login"),
      action: "/auth/login",
      allowNativeSubmission: false,
    });
    const controller = createShellController({
      ...links,
      model: model(),
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

    controller.synchronizeRail("collapsed");
    controller.navigationDialog.open();
    controller.synchronizeRoute({
      activeNavigation: null,
      authView: "reset",
      session: { status: "authenticated", displayName: "Maya Chen" },
      authorizationRequest: true,
      authentication: {
        model: readyAuthenticationModel("reset"),
        action: "/auth/reset",
      },
    });
    expect(controller.state.model).toEqual({
      activeNavigation: null,
      rail: "collapsed",
      drawerOpen: true,
      authView: "reset",
      session: { status: "authenticated", displayName: "Maya Chen" },
      authorizationRequest: true,
    });
    expect(controller.authentication.state.action).toBe("/auth/reset");
    expect(onAuthViewChange.mock.calls).toEqual([["register"], [null]]);

    controller.synchronizeRoute({ activeNavigation: "home", authView: null, session: { status: "anonymous" } });
    expect(controller.state.model.drawerOpen).toBe(true);
    controller.synchronizeRoute({
      activeNavigation: "home",
      authView: null,
      session: { status: "authenticated", displayName: "Maya Chen" },
      drawerOpen: false,
    });
    expect(controller.state.model.drawerOpen).toBe(false);

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
      model: model({ session: { status: "authenticated", displayName: "Maya Chen" } }),
      authentication,
    });

    expect(controller.logout()).toBe(true);
    expect(controller.state.model.session.status).toBe("authenticated");
  });
});
