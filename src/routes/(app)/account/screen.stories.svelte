<script module lang="ts">
  import { validationFixture } from "#lib/application/auth/forms.fixture.js";
  import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
  import type {
    AccountDevice,
    AccountDevicesModel,
    AccountInformationModel,
    AccountSummaryState,
  } from "#lib/application/auth/types.js";
  import { landscapeSource, portraitPicture } from "#lib/application/profile/picture.fixture.js";
  import type { ProfileState } from "#lib/application/profile/types.js";
  import { createStorybookTranslator } from "#lib/i18n/storybook.js";

  import { createInformationModel } from "./(information)/account-action";
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
    profile: {},
  } satisfies AccountSummaryState;

  const credentials = { status: "ready", email: summary.email, locationConsent: false } as const;

  const noProfile = { status: "ready" } satisfies ProfileState;
  const fullProfile = { status: "ready", username: "Maya Chen", picture: portraitPicture } satisfies ProfileState;
  const information: AccountInformationModel = createInformationModel(credentials, noProfile, null);

  /** The tab with one profile dialog open, as the URL opens it. */
  function profileEditor(
    editor: "username" | "picture",
    patch: Partial<AccountInformationModel> = {},
    profile: ProfileState = fullProfile
  ): AccountInformationModel {
    return { ...createInformationModel(credentials, profile, editor), ...patch };
  }

  /** The landscape framed around its sun, a little closer than the whole height. */
  const framed = {
    status: "cropping",
    name: "harbor-sunset.jpg",
    source: landscapeSource,
    crop: { zoom: 1.4, x: 719, y: 59 },
  } as const;

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

  async function verifyProfile({ canvasElement, globals }: PlayContext) {
    const canvas = within(canvasElement);
    const t = createStorybookTranslator(globals);
    await expect(canvas.getByRole("heading", { level: 1, name: "Maya Chen" })).toBeVisible();
    const pictureLinks = canvas.getAllByRole("link", { name: t("authUi.account.picture.changeLabel") });
    for (const link of pictureLinks) await expect(link).toHaveAttribute("href", "?edit=picture");
    const profile = within(canvas.getByRole("region", { name: t("authUi.account.profile.title") }));
    await expect(profile.getByText("Maya Chen")).toBeVisible();
    await expect(profile.getByRole("img", { name: t("authUi.account.picture.current") })).toBeVisible();
  }

  async function verifyCounterAtLimit({ globals }: PlayContext) {
    const dialog = within(document.body).getByRole("dialog");
    const t = createStorybookTranslator(globals);
    const field = within(dialog).getByLabelText(t("authUi.account.username.label"));
    await expect(field).toHaveAccessibleDescription(new RegExp("32 / 32"));
  }
</script>

<Story name="My information: desktop" globals={reviewStoryGlobals.desktop} asChild play={verifyHeader}>
  <StoryHarness {summary} tab="information" {information} />
</Story>

<Story name="My information: mobile" globals={reviewStoryGlobals.mobile} asChild play={verifyHeader}>
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
    summary={{ status: "loading" }}
    tab="information"
    information={{ ...information, credentials: { status: "unavailable" } }}
  />
</Story>

<Story name="Email editor" asChild>
  <StoryHarness {summary} tab="information" information={{ ...information, editor: "email" }} />
</Story>

<Story name="Email editor: wrong password" asChild>
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

<Story name="Email editor: invalid" asChild>
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

<Story name="Email editor: link sent" asChild>
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

<Story name="Password editor: invalid" asChild>
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

<Story name="Password editor: changed" asChild>
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

<Story name="Public profile: username only" asChild>
  <StoryHarness
    summary={{ ...summary, profile: { username: "Maya Chen" } }}
    tab="information"
    information={createInformationModel(credentials, { status: "ready", username: "Maya Chen" }, null)}
  />
</Story>

<Story name="Public profile: picture only" asChild>
  <StoryHarness
    summary={{ ...summary, profile: { picture: portraitPicture } }}
    tab="information"
    information={createInformationModel(credentials, { status: "ready", picture: portraitPicture }, null)}
  />
</Story>

<Story name="Public profile: username and picture" asChild play={verifyProfile}>
  <StoryHarness
    summary={{ ...summary, profile: { username: "Maya Chen", picture: portraitPicture } }}
    tab="information"
    information={createInformationModel(credentials, fullProfile, null)}
  />
</Story>

<Story name="Public profile: username and picture, mobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness
    summary={{ ...summary, profile: { username: "Maya Chen", picture: portraitPicture } }}
    tab="information"
    information={createInformationModel(credentials, fullProfile, null)}
  />
</Story>

<Story name="Public profile: long username" asChild>
  <StoryHarness
    summary={{ ...summary, profile: { username: "Alexandrine de la Bibliothèque" } }}
    tab="information"
    information={createInformationModel(
      credentials,
      { status: "ready", username: "Alexandrine de la Bibliothèque" },
      null
    )}
  />
</Story>

<Story name="Public profile: unavailable" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={createInformationModel(credentials, { status: "unavailable" }, null)}
  />
</Story>

<Story name="Username editor" asChild>
  <StoryHarness {summary} tab="information" information={profileEditor("username")} />
</Story>

<Story name="Username editor: empty" asChild>
  <StoryHarness {summary} tab="information" information={profileEditor("username", {}, noProfile)} />
</Story>

<Story name="Username editor: at the limit" asChild play={verifyCounterAtLimit}>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("username", {
      username: { draft: "Maya Chen 👩🏽‍💻 storyteller of seas!", state: { status: "ready" } },
    })}
  />
</Story>

<Story name="Username editor: too long" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("username", {
      username: {
        draft: "Maya Chen 👩🏽‍💻 tells tales of the sea",
        state: { status: "validation-error", issue: "length" },
      },
    })}
  />
</Story>

<Story name="Username editor: refused characters" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("username", {
      username: { draft: "Maya\tChen", state: { status: "validation-error", issue: "characters" } },
    })}
  />
</Story>

<Story name="Username editor: refused by the service" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("username", {
      username: { draft: "Maya Chen", state: { status: "validation-error", issue: "refused" } },
    })}
  />
</Story>

<Story name="Username editor: saving" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("username", { username: { draft: "Maya Chen", state: { status: "submitting" } } })}
  />
</Story>

<Story name="Username editor: service unavailable" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("username", {
      username: { draft: "Maya Chen", state: { status: "service-error", feedback: "serviceUnavailable" } },
    })}
  />
</Story>

<Story name="Picture editor: no picture yet" asChild>
  <StoryHarness {summary} tab="information" information={profileEditor("picture", {}, noProfile)} />
</Story>

<Story name="Picture editor: with a picture" asChild>
  <StoryHarness
    summary={{ ...summary, profile: { picture: portraitPicture } }}
    tab="information"
    information={profileEditor("picture")}
  />
</Story>

<Story name="Picture editor: opening" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("picture", { picture: { status: "opening" } }, noProfile)}
  />
</Story>

<Story name="Picture editor: framing" asChild>
  <StoryHarness {summary} tab="information" information={profileEditor("picture", { picture: framed }, noProfile)} />
</Story>

<Story name="Picture editor: framing, mobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness {summary} tab="information" information={profileEditor("picture", { picture: framed })} />
</Story>

<Story name="Picture editor: saving" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("picture", { picture: { ...framed, status: "saving" } }, noProfile)}
  />
</Story>

<Story name="Picture editor: unreadable file" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("picture", { picture: { status: "choosing", refusal: "unreadable" } }, noProfile)}
  />
</Story>

<Story name="Picture editor: refused format" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("picture", { picture: { status: "choosing", refusal: "format" } }, noProfile)}
  />
</Story>

<Story name="Picture editor: refused ratio" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("picture", { picture: { status: "choosing", refusal: "ratio" } }, noProfile)}
  />
</Story>

<Story name="Picture editor: refused dimensions" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("picture", { picture: { status: "choosing", refusal: "dimensions" } }, noProfile)}
  />
</Story>

<Story name="Picture editor: too large" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("picture", { picture: { status: "choosing", refusal: "tooLarge" } }, noProfile)}
  />
</Story>

<Story name="Picture editor: removing" asChild>
  <StoryHarness
    summary={{ ...summary, profile: { picture: portraitPicture } }}
    tab="information"
    information={profileEditor("picture", { picture: { status: "removing" } })}
  />
</Story>

<Story name="Picture editor: service unavailable" asChild>
  <StoryHarness
    {summary}
    tab="information"
    information={profileEditor("picture", { picture: { status: "service-error", feedback: "serviceUnavailable" } })}
  />
</Story>

<Story name="Picture editor: without JavaScript" asChild>
  <StoryHarness {summary} tab="information" scripted={false} information={profileEditor("picture")} />
</Story>

<Story name="Devices: locations off" asChild>
  <StoryHarness {summary} tab="devices" {devices} />
</Story>

<Story name="Devices: locations on, mobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness {summary} tab="devices" devices={located} />
</Story>

<Story name="Devices: confirm one" asChild>
  <StoryHarness {summary} tab="devices" devices={{ ...located, confirmation: { kind: "device", id: phone.id } }} />
</Story>

<Story name="Devices: confirm all" asChild>
  <StoryHarness {summary} tab="devices" devices={{ ...located, confirmation: { kind: "others" } }} />
</Story>

<Story name="Devices: device logged out" asChild>
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

<Story name="Devices: device removed" asChild>
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

<Story name="Devices: only this one" asChild>
  <StoryHarness
    {summary}
    tab="devices"
    devices={{ ...located, devices: { status: "ready", devices: [thisDeviceLocated] } }}
  />
</Story>

<Story name="Devices: change failed" asChild>
  <StoryHarness
    {summary}
    tab="devices"
    devices={{ ...devices, action: { status: "service-error", feedback: "serviceUnavailable" } }}
  />
</Story>

<Story name="Devices: unavailable" asChild>
  <StoryHarness {summary} tab="devices" devices={{ ...devices, devices: { status: "unavailable" } }} />
</Story>

<Story name="Privacy: locations off" asChild>
  <StoryHarness {summary} tab="privacy" privacy={{ status: "ready", locationConsent: false }} />
</Story>

<Story name="Privacy: locations on" asChild>
  <StoryHarness {summary} tab="privacy" privacy={{ status: "ready", locationConsent: true }} />
</Story>

<Story name="Privacy: change failed" asChild>
  <StoryHarness
    {summary}
    tab="privacy"
    privacy={{ status: "ready", locationConsent: false, feedback: "serviceUnavailable" }}
  />
</Story>

<Story name="Preferences: browser language" asChild>
  <StoryHarness {summary} tab="preferences" />
</Story>

<Story name="Preferences: language chosen" asChild>
  <StoryHarness {summary} tab="preferences" language="fr" />
</Story>

<Story name="Preferences: language list" asChild>
  <StoryHarness {summary} tab="preferences" language="fr" languageOpen />
</Story>

<Story name="Preferences: mobile" globals={reviewStoryGlobals.mobile} asChild>
  <StoryHarness {summary} tab="preferences" language="en" />
</Story>
