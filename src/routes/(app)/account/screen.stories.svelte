<script module lang="ts">
  import { validationFixture } from "#lib/application/auth/forms.fixture.js";
  import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
  import type {
    AccountDevice,
    AccountDevicesModel,
    AccountInformationModel,
    AccountSummaryState,
  } from "#lib/application/auth/types.js";
  import { createStorybookTranslator } from "#lib/i18n/storybook.js";

  import StoryHarness from "./story.svelte";

  import { reviewStoryGlobals } from "@a-novel-kit/uikit-storybook";

  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { StoryContext } from "@storybook/sveltekit";
  import { expect, within } from "storybook/test";

  const summary = {
    status: "ready",
    roles: ["auth:user"],
    email: "maya.chen@example.test",
    loggedInUntil: "2026-11-10T18:40:00Z",
  } satisfies AccountSummaryState;

  const credentials = { status: "ready", email: summary.email, locationConsent: false } as const;

  const information = {
    credentials,
    editor: null,
    passwordState: { status: "ready" },
    emailState: { status: "ready" },
  } satisfies AccountInformationModel;

  const pendingCredentials = {
    ...credentials,
    pendingEmail: { email: "maya.writes@example.test", expiresAt: "2026-11-04T18:40:00Z" },
  };

  const thisDevice = {
    id: "0c6f2bde-3d1e-4f5b-9a57-61f4c3e1b0a1",
    current: true,
    loggedOut: false,
    browser: "Firefox",
    system: "Linux",
    form: "desktop",
    lastActiveAt: "2026-11-03T18:40:00Z",
  } satisfies AccountDevice;

  const phone = {
    id: "5a1d9e0c-8b7f-4c2a-b3e4-2f9d6c8a7e10",
    current: false,
    loggedOut: false,
    browser: "Safari",
    system: "iOS",
    form: "phone",
    lastActiveAt: "2026-11-02T21:15:00Z",
  } satisfies AccountDevice;

  const oldTablet = {
    id: "9e4b2c7a-1f3d-4e6b-8a0c-5d7f2b9e1c34",
    current: false,
    loggedOut: true,
    system: "Android",
    form: "tablet",
    lastActiveAt: "2026-10-12T08:05:00Z",
  } satisfies AccountDevice;

  const thisDeviceLocated = { ...thisDevice, place: "Lyon, France", ipAddress: "203.0.113.24" } satisfies AccountDevice;
  const phoneLocated = {
    ...phone,
    place: "Paris, France",
    ipAddress: "2001:db8:85a3::8a2e:370:7334",
  } satisfies AccountDevice;

  const devices = {
    devices: { status: "ready", devices: [thisDevice, phone, oldTablet] },
    locationConsent: false,
    confirmation: null,
    action: { status: "ready" },
  } satisfies AccountDevicesModel;

  const located = {
    ...devices,
    locationConsent: true,
    devices: { status: "ready", devices: [thisDeviceLocated, phoneLocated, oldTablet] },
  } satisfies AccountDevicesModel;

  const { Story } = defineMeta({
    title: "Authentication/Account",
    tags: ["!autodocs"],
    parameters: { layout: "fullscreen" },
  });

  type PlayContext = Pick<StoryContext, "canvasElement" | "globals">;

  async function verifyHeader({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(canvas.getByRole("heading", { level: 1, name: summary.email })).toBeVisible();
    await expect(canvas.getByRole("button", { name: t("authUi.account.logout.submit") })).toBeEnabled();
    const tabs = within(canvas.getByRole("navigation", { name: t("authUi.account.tabs.label") }));
    const current = tabs.getByRole("link", { name: t("authUi.account.tabs.information") });
    await expect(current).toHaveAttribute("aria-current", "page");
  }
</script>

<Story name="My information — desktop" globals={reviewStoryGlobals.desktop} asChild play={verifyHeader}>
  <StoryHarness {summary} tab="information" {information} />
</Story>

<Story name="My information — mobile" globals={reviewStoryGlobals.mobile} asChild play={verifyHeader}>
  <StoryHarness {summary} tab="information" {information} />
</Story>

<Story name="Every role" asChild>
  <StoryHarness
    summary={{ ...summary, roles: ["auth:superadmin", "auth:admin", "auth:user"] }}
    tab="information"
    {information}
  />
</Story>

<Story name="Email change pending" asChild>
  <StoryHarness {summary} tab="information" information={{ ...information, credentials: pendingCredentials }} />
</Story>

<Story name="Header unavailable" asChild>
  <StoryHarness
    summary={{ status: "error", feedback: "sessionUnavailable" }}
    tab="information"
    information={{ ...information, credentials: { status: "unavailable" } }}
  />
</Story>

<Story name="Email editor" asChild>
  <StoryHarness {summary} tab="information" information={{ ...information, editor: "email" }} />
</Story>

<Story name="Email editor — wrong password" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={{
      ...information,
      editor: "email",
      emailState: {
        status: "validation-error",
        issues: [{ field: "currentPassword", feedback: "invalidCurrentPassword" }],
      },
    }}
  />
</Story>

<Story name="Email editor — invalid" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={{
      ...information,
      editor: "email",
      emailState: validationFixture(validateEmailUpdate, { email: "maya", currentPassword: "" }),
    }}
  />
</Story>

<Story name="Email editor — link sent" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={{
      ...information,
      credentials: pendingCredentials,
      editor: "email",
      emailState: { status: "pending-email" },
    }}
  />
</Story>

<Story name="Password editor" asChild>
  <StoryHarness {summary} tab="information" information={{ ...information, editor: "password" }} />
</Story>

<Story name="Password editor — invalid" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={{
      ...information,
      editor: "password",
      passwordState: validationFixture(validatePasswordChange, {
        currentPassword: "",
        password: "abc",
        confirmPassword: "abd",
      }),
    }}
  />
</Story>

<Story name="Password editor — changed" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={{
      ...information,
      editor: "password",
      passwordState: { status: "success", feedback: "passwordChanged" },
    }}
  />
</Story>

<Story name="Devices — locations off" asChild>
  <StoryHarness {summary} tab="devices" {devices} />
</Story>

<Story name="Devices — locations on, mobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness {summary} tab="devices" devices={located} />
</Story>

<Story name="Devices — confirm one" asChild>
  <StoryHarness {summary} tab="devices" devices={{ ...located, confirmation: { kind: "device", id: phone.id } }} />
</Story>

<Story name="Devices — confirm all" asChild>
  <StoryHarness {summary} tab="devices" devices={{ ...located, confirmation: { kind: "others" } }} />
</Story>

<Story name="Devices — device logged out" asChild>
  <StoryHarness
    {summary}
    tab="devices"
    devices={{
      ...located,
      devices: { status: "ready", devices: [thisDeviceLocated, { ...phoneLocated, loggedOut: true }, oldTablet] },
      action: { status: "logged-out" },
    }}
  />
</Story>

<Story name="Devices — device removed" asChild>
  <StoryHarness
    {summary}
    tab="devices"
    devices={{
      ...located,
      devices: { status: "ready", devices: [thisDeviceLocated, phoneLocated] },
      action: { status: "removed" },
    }}
  />
</Story>

<Story name="Devices — only this one" asChild>
  <StoryHarness
    {summary}
    tab="devices"
    devices={{ ...located, devices: { status: "ready", devices: [thisDeviceLocated] } }}
  />
</Story>

<Story name="Devices — change failed" asChild>
  <StoryHarness
    {summary}
    tab="devices"
    devices={{ ...devices, action: { status: "service-error", feedback: "serviceUnavailable" } }}
  />
</Story>

<Story name="Devices — unavailable" asChild>
  <StoryHarness {summary} tab="devices" devices={{ ...devices, devices: { status: "unavailable" } }} />
</Story>

<Story name="Privacy — locations off" asChild>
  <StoryHarness {summary} tab="privacy" privacy={{ status: "ready", locationConsent: false }} />
</Story>

<Story name="Privacy — locations on" asChild>
  <StoryHarness {summary} tab="privacy" privacy={{ status: "ready", locationConsent: true }} />
</Story>

<Story name="Privacy — change failed" asChild>
  <StoryHarness
    {summary}
    tab="privacy"
    privacy={{ status: "ready", locationConsent: false, feedback: "serviceUnavailable" }}
  />
</Story>
