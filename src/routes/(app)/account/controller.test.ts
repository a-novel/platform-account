import type { AccountSummaryState } from "#lib/application/auth/types.js";

import { createAccountLayoutController } from "./controller.svelte";

import { describe, expect, it } from "vitest";

const tabs = { information: "/account", devices: "/account/devices", privacy: "/account/privacy" };
const summary: AccountSummaryState = { status: "ready", roles: ["auth:user"], email: "creator@example.test" };

describe("createAccountLayoutController", () => {
  it("follows the loads and navigations that change the header or the tab", () => {
    const controller = createAccountLayoutController({
      summary,
      logoutAction: "/auth/logout",
      pictureEditorHref: "/account?edit=picture",
      tabs,
      currentTab: "information",
    });
    expect(controller.state).toEqual({
      summary,
      logoutState: "ready",
      logoutAction: "/auth/logout",
      pictureEditorHref: "/account?edit=picture",
      tabs,
      currentTab: "information",
    });

    const unavailable: AccountSummaryState = { status: "error", feedback: "sessionUnavailable" };
    controller.synchronize(unavailable, "devices");
    expect(controller.state).toMatchObject({ summary: unavailable, currentTab: "devices" });

    controller.synchronize(summary, null);
    expect(controller.state.currentTab).toBeNull();
  });

  it("submits one logout at a time", () => {
    const controller = createAccountLayoutController({
      summary,
      logoutAction: "/auth/logout",
      pictureEditorHref: "/account?edit=picture",
      tabs,
      currentTab: "information",
    });

    expect(controller.submitLogout()).toBe(true);
    expect(controller.state.logoutState).toBe("submitting");
    expect(controller.submitLogout()).toBe(false);
  });
});
