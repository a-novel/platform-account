import type { AccountDevicesModel } from "#lib/application/auth/types.js";

import { type AccountDevicesControllerOptions, createAccountDevicesController } from "./controller.svelte";

import { describe, expect, it, vi } from "vitest";

const phoneID = "5a1d9e0c-8b7f-4c2a-b3e4-2f9d6c8a7e10";

const model: AccountDevicesModel = {
  devices: { status: "ready", devices: [] },
  locationConsent: false,
  confirmation: null,
  action: { status: "ready" },
};

function controller(initial: AccountDevicesModel = model, options: Partial<AccountDevicesControllerOptions> = {}) {
  return createAccountDevicesController({
    model: initial,
    actions: {
      logoutDevice: "?/logoutDevice",
      logoutOtherDevices: "?/logoutOtherDevices",
      removeDevice: "?/removeDevice",
      logout: "/auth/logout",
    },
    privacyHref: "/account/privacy",
    ...options,
  });
}

describe("createAccountDevicesController", () => {
  it("asks to confirm a logout in place and reports each change", () => {
    const onConfirmationChange = vi.fn();
    const devices = controller(model, { onConfirmationChange });

    devices.openConfirmation({ kind: "device", id: phoneID });
    expect(devices.state.model.confirmation).toEqual({ kind: "device", id: phoneID });
    expect(devices.confirmation.state.open).toBe(true);

    devices.confirmation.close();
    expect(devices.confirmation.state.open).toBe(false);

    devices.openConfirmation({ kind: "others" });
    devices.confirmation.toggle();
    expect(devices.state.model.confirmation).toBeNull();

    expect(onConfirmationChange.mock.calls).toEqual([
      [{ kind: "device", id: phoneID }],
      [null],
      [{ kind: "others" }],
      [null],
    ]);
  });

  it("links each confirmation from the route's URL", () => {
    expect(controller().confirmationHref({ kind: "device", id: phoneID })).toBe(`?confirm=${phoneID}`);
    expect(controller().confirmationHref({ kind: "others" })).toBe("?confirm=others");
    expect(controller().confirmationHref(null)).toBe("?");

    const confirmationUrl = () => "/account/devices?menu=open";
    expect(controller(model, { confirmationUrl }).confirmationHref(null)).toBe("/account/devices?menu=open");
  });

  it("submits one device change at a time", () => {
    const devices = controller();

    expect(devices.submitChange()).toBe(true);
    expect(devices.state.model.action).toEqual({ status: "submitting" });
    expect(devices.submitChange()).toBe(false);
  });

  it("keeps the change in place when the route sends it", () => {
    const devices = controller(model, { allowNativeSubmission: false });

    expect(devices.submitChange()).toBe(false);
    expect(devices.state.model.action).toEqual({ status: "submitting" });
  });

  it.each(["logged-out", "removed"] as const)("allows another change once the route shows it %s", (status) => {
    const devices = controller();
    devices.submitChange();

    devices.synchronize({ ...model, action: { status } });

    expect(devices.state.model.action).toEqual({ status });
    expect(devices.submitChange()).toBe(true);
  });
});
