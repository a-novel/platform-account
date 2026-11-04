import type { AccountDevice, AccountDevicesModel } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { submitForm } from "#lib/ui/forms.fixture.js";

import { createAccountDevicesController } from "./controller.svelte";
import Screen from "./screen.svelte";

import { createRawSnippet } from "svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import { Button } from "@a-novel-kit/uikit";
import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const thisDevice: AccountDevice = {
  id: "0c6f2bde-3d1e-4f5b-9a57-61f4c3e1b0a1",
  current: true,
  loggedOut: false,
  browser: "Firefox",
  system: "Linux",
  form: "desktop",
  lastActiveAt: "Nov 3, 2026, 6:40 PM",
  place: "Lyon, France",
  ipAddress: "203.0.113.24",
};

const phone: AccountDevice = {
  id: "5a1d9e0c-8b7f-4c2a-b3e4-2f9d6c8a7e10",
  current: false,
  loggedOut: false,
  browser: "Safari",
  system: "iOS",
  form: "phone",
  lastActiveAt: "Nov 2, 2026, 9:15 PM",
};

const oldTablet: AccountDevice = {
  id: "9e4b2c7a-1f3d-4e6b-8a0c-5d7f2b9e1c34",
  current: false,
  loggedOut: true,
  system: "Android",
  form: "tablet",
  lastActiveAt: "Oct 12, 2026, 8:05 AM",
};

const model: AccountDevicesModel = {
  devices: { status: "ready", devices: [thisDevice, phone, oldTablet] },
  locationConsent: true,
  confirmation: null,
  action: { status: "ready" },
};

function controller(patch: Partial<AccountDevicesModel> = {}) {
  return createAccountDevicesController({
    model: { ...model, ...patch },
    actions: {
      logoutDevice: "?/logoutDevice",
      logoutOtherDevices: "?/logoutOtherDevices",
      removeDevice: "?/removeDevice",
      logout: "/auth/logout",
    },
    privacyHref: "/account/privacy",
    allowNativeSubmission: false,
  });
}

const devices = (devices: AccountDevice[]) => ({ devices: { status: "ready" as const, devices } });

describe("devices screen", () => {
  it("groups the active devices apart from the logged-out ones", async () => {
    await render(Screen, { controller: controller() }, withLocale());

    const active = page.getByRole("region", { name: "Devices" });
    const current = active.getByRole("listitem").nth(0);
    await expect
      .element(current)
      .toMatchTextContent(/^Firefox on Linux\s*This device\s*Active now\s*Lyon, France · 203\.0\.113\.24/);
    await expect
      .element(active.getByRole("listitem").nth(1))
      .toMatchTextContent(/^Safari on iOS\s*Last active Nov 2, 2026, 9:15 PM/);
    expect(active.getByRole("listitem").elements()).toHaveLength(2);

    const loggedOut = page.getByRole("region", { name: "Logged out" });
    await expect
      .element(loggedOut.getByRole("listitem"))
      .toMatchTextContent(/^Browser on Android\s*Last active Oct 12, 2026/);
    await expect
      .element(loggedOut.getByText("Each one disappears about a month later.", { exact: false }))
      .toBeVisible();
    await expect
      .element(loggedOut.getByText("It can take up to 15 minutes for a logged-out device to lose access."))
      .toBeVisible();
  });

  it("asks before logging another device out, and logs this one out through the shell", async () => {
    await render(Screen, { controller: controller() }, withLocale());

    await expect
      .element(page.getByRole("link", { name: "Log out Safari on iOS" }))
      .toHaveAttribute("href", `?confirm=${phone.id}`);
    await expect
      .element(page.getByRole("link", { name: "Log out all devices" }))
      .toHaveAttribute("href", "?confirm=others");
    await expect.element(page.getByRole("link", { name: "Log out Firefox on Linux" })).not.toBeInTheDocument();

    const form = await submitForm("Log out Firefox on Linux");
    expect(form.getAttribute("action")).toBe("/auth/logout");
    expect(Object.fromEntries(new FormData(form))).toEqual({});
  });

  it("removes a logged-out device by its session", async () => {
    const tab = controller();
    await render(Screen, { controller: tab }, withLocale());

    const form = await submitForm("Remove Browser on Android");

    expect(form.getAttribute("action")).toBe("?/removeDevice");
    expect(Object.fromEntries(new FormData(form))).toEqual({ sessionID: oldTablet.id });
    expect(tab.state.model.action).toEqual({ status: "submitting" });
    await expect.element(page.getByRole("button", { name: "Remove Browser on Android" })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "Log out Firefox on Linux" })).toBeDisabled();
  });

  it("offers to log out every other device only while another one is active", async () => {
    await render(Screen, { controller: controller(devices([thisDevice, oldTablet])) }, withLocale());

    await expect.element(page.getByRole("button", { name: "Log out Firefox on Linux" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Log out all devices" })).not.toBeInTheDocument();
  });

  it("tips the way to turn locations on while the account records none", async () => {
    await render(Screen, { controller: controller({ locationConsent: false }) }, withLocale());

    const note = page.getByRole("note");
    await expect.element(note).toMatchTextContent(/^Locations are off/);
    await expect.element(note.getByRole("link", { name: "Open Privacy" })).toHaveAttribute("href", "/account/privacy");
  });

  it.each([true, null])("gives no location tip when the consent reads %s", async (locationConsent) => {
    await render(Screen, { controller: controller({ locationConsent }) }, withLocale());

    await expect.element(page.getByRole("region", { name: "Devices" })).toBeVisible();
    await expect.element(page.getByText("Locations are off")).not.toBeInTheDocument();
  });

  it.each([
    ["logged-out", "That device is logged out"],
    ["logged-out-others", "Your other devices are logged out"],
    ["removed", "Device removed"],
  ] as const)("confirms a %s change", async (status, message) => {
    await render(Screen, { controller: controller({ action: { status } }) }, withLocale());

    await expect.element(page.getByRole("status")).toMatchTextContent(message);
  });

  it("says why a change failed and keeps the list", async () => {
    await render(
      Screen,
      { controller: controller({ action: { status: "service-error", feedback: "tooManyAttempts" } }) },
      withLocale()
    );

    await expect.element(page.getByRole("alert")).toMatchTextContent(/Too many attempts/);
    await expect.element(page.getByRole("link", { name: "Log out Safari on iOS" })).toBeVisible();
  });

  it("says so when the devices cannot be shown", async () => {
    await render(Screen, { controller: controller({ devices: { status: "unavailable" } }) }, withLocale("fr"));

    await expect
      .element(page.getByRole("region", { name: "Appareils" }))
      .toMatchTextContent(/Vos appareils ne peuvent pas être affichés pour le moment\./);
    await expect.element(page.getByRole("region", { name: "Déconnectés" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Déconnecter tous mes appareils" })).not.toBeInTheDocument();
  });
});

describe("logout dialog", () => {
  it("opens in place from another device's logout link", async () => {
    const tab = controller();
    await render(Screen, { controller: tab }, withLocale());

    await page.getByRole("link", { name: "Log out Safari on iOS" }).click();

    await expect.element(page.getByRole("dialog", { name: "Log out Safari on iOS?" })).toBeVisible();
    expect(tab.state.model.confirmation).toEqual({ kind: "device", id: phone.id });
  });

  it("warns of the 15-minute delay before logging one device out", async () => {
    const tab = controller({ confirmation: { kind: "device", id: phone.id } });
    await render(Screen, { controller: tab }, withLocale());
    const label = createRawSnippet(() => ({ render: () => "<span>Reference</span>" }));
    await render(Button, { tone: "danger", children: label, "data-testid": "danger" });

    const dialog = page.getByRole("dialog", { name: "Log out Safari on iOS?" });
    await expect
      .element(dialog.getByText("It can take up to 15 minutes for a logged-out device to lose access."))
      .toBeVisible();
    await expect.element(dialog.getByText("Every device but this one will be logged out.")).not.toBeInTheDocument();
    const submit = dialog.getByRole("button", { name: "Log out", exact: true });
    const danger = getComputedStyle(page.getByTestId("danger").element()).backgroundColor;
    expect(getComputedStyle(submit.element()).backgroundColor).toBe(danger);

    await submit.click();

    const form = (submit.element() as HTMLButtonElement).form;
    expect(form?.getAttribute("action")).toBe("?/logoutDevice");
    expect(form && Object.fromEntries(new FormData(form))).toEqual({ sessionID: phone.id });
    expect(tab.state.model.action).toEqual({ status: "submitting" });
    await expect.element(submit).toBeDisabled();
  });

  it("asks before logging out every other device", async () => {
    await render(Screen, { controller: controller({ confirmation: { kind: "others" } }) }, withLocale());

    const dialog = page.getByRole("dialog", { name: "Log out all devices?" });
    await expect.element(dialog.getByText("Every device but this one will be logged out.")).toBeVisible();
    await expect
      .element(dialog.getByText("It can take up to 15 minutes for a logged-out device to lose access."))
      .toBeVisible();

    const form = await submitForm("Log out all devices");
    expect(form.getAttribute("action")).toBe("?/logoutOtherDevices");
    expect(Object.fromEntries(new FormData(form))).toEqual({});
  });

  it("cancels in place", async () => {
    const tab = controller({ confirmation: { kind: "others" } });
    await render(Screen, { controller: tab }, withLocale());

    const dialog = page.getByRole("dialog", { name: "Log out all devices?" });
    const cancel = dialog.getByRole("link", { name: "Cancel" });
    await expect.element(cancel).toHaveAttribute("href", "?");
    await cancel.click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(tab.state.model.confirmation).toBeNull();
  });

  it.each([
    ["this device", thisDevice.id],
    ["a logged-out device", oldTablet.id],
    ["an unknown device", "11111111-1111-4111-8111-111111111111"],
  ])("asks nothing about %s", async (_, id) => {
    await render(Screen, { controller: controller({ confirmation: { kind: "device", id } }) }, withLocale());

    await expect.element(page.getByRole("region", { name: "Devices" })).toBeVisible();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});
