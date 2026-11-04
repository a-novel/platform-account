import type { PrivacyAccountState } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import type { TelemetryPreference } from "#lib/ui/telemetry-preference.js";

import { createLocationConsentController } from "./controller.svelte";
import Screen from "./screen.svelte";

import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

function declined(): TelemetryPreference {
  return { pending: false, choice: "declined", choose: vi.fn() };
}

async function screen(account: PrivacyAccountState | null, telemetry: TelemetryPreference | null = declined()) {
  const location = createLocationConsentController(() => account);
  await render(Screen, { telemetry, location }, withLocale());
  return location;
}

describe("account privacy screen", () => {
  it("submits the location consent as soon as the switch changes", async () => {
    const location = await screen({ status: "ready", locationConsent: false });
    const consent = page.getByRole("switch", { name: /^Record where my devices log in/ });
    await expect.element(consent).not.toBeChecked();
    // The JavaScript-free Save button stays out of a page that runs scripts.
    await expect.element(page.getByRole("button", { name: "Save" })).not.toBeInTheDocument();

    const form = (consent.element() as HTMLInputElement).form;
    if (!form) throw new Error("The switch must belong to its form");
    const submitted = new Promise<FormData>((resolve) =>
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        resolve(new FormData(form));
      })
    );
    await consent.click();

    expect(form.getAttribute("action")).toBe("?/locationConsent");
    expect(Object.fromEntries(await submitted)).toEqual({ enabled: "on" });
    await expect.element(consent).toBeChecked();
    expect(location.pending).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");
  });

  it("says why a change failed beside the switch it set back", async () => {
    await screen({ status: "ready", locationConsent: true, feedback: "tooManyAttempts" });

    await expect.element(page.getByRole("switch", { name: /^Record where my devices log in/ })).toBeChecked();
    await expect.element(page.getByRole("alert")).toMatchTextContent(/Too many attempts/);
  });

  it("says so when the account's settings cannot be shown, and keeps this device's", async () => {
    await screen({ status: "unavailable" }, null);

    const account = page.getByRole("region", { name: "Your account" });
    await expect.element(account).toMatchTextContent(/Your account settings can’t be shown right now\./);
    await expect.element(page.getByRole("switch")).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("region", { name: "This device" }))
      .toMatchTextContent(/We collect no metrics or logs on this device\./);
  });

  it("sets this device's telemetry below the account's settings", async () => {
    const telemetry = declined();
    await screen({ status: "ready", locationConsent: false }, telemetry);

    const account = page.getByRole("region", { name: "Your account" }).element().getBoundingClientRect();
    const device = page.getByRole("region", { name: "This device" });
    expect(device.element().getBoundingClientRect().top).toBeGreaterThan(account.bottom);
    await device.getByRole("switch", { name: /^Metrics and log collection/ }).click();
    expect(telemetry.choose).toHaveBeenCalledExactlyOnceWith("accepted");
  });
});
