import type { PrivacyAccountState } from "#lib/application/auth/types.js";

import { createLocationConsentController } from "./controller.svelte";

import { describe, expect, it } from "vitest";

describe("createLocationConsentController", () => {
  it("records the switch's answer as pending until the action returns", () => {
    const location = createLocationConsentController(() => ({ status: "ready", locationConsent: false }));

    location.consent.toggle();
    expect(location.account).toEqual({ status: "ready", locationConsent: true });
    expect(location.consent.state.checked).toBe(true);
    expect(location.pending).toBe(true);

    // The switch waits for the action, so a second change cannot race the first.
    location.consent.setChecked(false);
    expect(location.consent.state.checked).toBe(true);
  });

  it("shows the action's result, then accepts another change", () => {
    let account: PrivacyAccountState = { status: "ready", locationConsent: true };
    const location = createLocationConsentController(() => account);

    account = { status: "ready", locationConsent: false, feedback: "serviceUnavailable" };
    expect(location.pending).toBe(false);
    expect(location.consent.state.checked).toBe(false);

    location.consent.setChecked(true);
    expect(location.account).toEqual({ status: "ready", locationConsent: true });
  });

  it.each([
    ["unavailable credentials", { status: "unavailable" }],
    ["a logged-out visitor", null],
  ] as const)("offers no change for %s", (_, account) => {
    const location = createLocationConsentController(() => account);

    location.consent.toggle();

    expect(location.account).toEqual(account);
    expect(location.consent.state.checked).toBe(false);
    expect(location.pending).toBe(false);
  });
});
