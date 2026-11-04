import type { AccountSummaryState } from "#lib/application/auth/types.js";

import { type AccountTab, createAccountLayoutController } from "./controller.svelte";

import { describe, expect, it } from "vitest";

const tabs = { information: "/account", devices: "/account/devices", privacy: "/account/privacy" };
const summary: AccountSummaryState = { status: "ready", roles: ["auth:user"], email: "creator@example.test" };

describe("createAccountLayoutController", () => {
  it("follows the loads and navigations that change the header or the tab", () => {
    let current: AccountSummaryState = summary;
    let tab: AccountTab | null = "information";
    const controller = createAccountLayoutController({
      getSummary: () => current,
      logoutAction: "/auth/logout",
      pictureEditorHref: "/account?edit=picture",
      tabs,
      getCurrentTab: () => tab,
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
    current = unavailable;
    tab = "devices";
    expect(controller.state).toMatchObject({ summary: unavailable, currentTab: "devices" });

    tab = null;
    expect(controller.state.currentTab).toBeNull();
  });

  it("submits one logout at a time", () => {
    const controller = createAccountLayoutController({
      getSummary: () => summary,
      logoutAction: "/auth/logout",
      pictureEditorHref: "/account?edit=picture",
      tabs,
      getCurrentTab: () => "information",
    });

    expect(controller.submitLogout()).toBe(true);
    expect(controller.state.logoutState).toBe("submitting");
    expect(controller.submitLogout()).toBe(false);
  });
});
