<script module lang="ts">
  import type {
    AccountDevicesModel,
    AccountInformationModel,
    AccountSummaryState,
    PrivacyAccountState,
  } from "#lib/application/auth/types.js";

  import type { AccountTab } from "./controller.svelte";
  import type { LanguageChoice } from "./preferences/screen.svelte";

  /** Fixed-state Storybook harness: the account layout around one of its tabs. */
  export interface AccountStoryProps {
    summary: AccountSummaryState;
    tab: AccountTab;
    information?: AccountInformationModel;
    devices?: AccountDevicesModel;
    privacy?: PrivacyAccountState;
    /** The language chosen on the Preferences tab. */
    language?: LanguageChoice;
    /** Whether the password fields show their text. */
    passwordsShown?: boolean;
    /** Whether the page runs its scripts, which framing a picture needs. Defaults to true. */
    scripted?: boolean;
  }
</script>

<script lang="ts">
  import type { AccountEditor } from "#lib/application/auth/types.js";
  import type { TelemetryPreference } from "#lib/ui/telemetry-preference.js";

  import type { AccountInformationController } from "./(information)/controller.svelte";
  import InformationScreen from "./(information)/screen.svelte";
  import type { AccountLayoutController } from "./controller.svelte";
  import type { AccountDevicesController } from "./devices/controller.svelte";
  import DevicesScreen from "./devices/screen.svelte";
  import PreferencesScreen from "./preferences/screen.svelte";
  import type { LocationConsentController } from "./privacy/controller.svelte";
  import PrivacyScreen from "./privacy/screen.svelte";
  import AccountScreen from "./screen.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import type { OpenController, PasswordInputController } from "@a-novel-kit/uikit";

  let props: AccountStoryProps = $props();
  const i18n = getI18nContext();
  const noop = () => {};

  // Stories give dates as ISO strings; the harness formats them in the story's locale, as the server would.
  const dates = $derived(
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })
  );
  const localize = (value: string) => (Number.isNaN(Date.parse(value)) ? value : dates.format(Date.parse(value)));

  const tab = $derived(props.tab);
  const passwordsShown = $derived(props.passwordsShown ?? false);
  const scripted = $derived(props.scripted ?? true);
  const privacy = $derived(props.privacy);
  const summary = $derived.by(() => {
    const value = structuredClone(props.summary);
    if (value.status === "ready" && value.loggedInUntil) value.loggedInUntil = localize(value.loggedInUntil);
    return value;
  });
  const information = $derived.by(() => {
    const value = props.information && structuredClone(props.information);
    const pending = value?.credentials.status === "ready" ? value.credentials.pendingEmail : undefined;
    if (pending) pending.expiresAt = localize(pending.expiresAt);
    return value;
  });
  const devices = $derived.by(() => {
    const value = props.devices && structuredClone(props.devices);
    if (value?.devices.status === "ready") {
      for (const device of value.devices.devices) device.lastActiveAt = localize(device.lastActiveAt);
    }
    return value;
  });
  const telemetry: TelemetryPreference = { choice: "declined", choose: noop };
  const visibility: PasswordInputController = {
    get state() {
      return { pressed: passwordsShown };
    },
    setPressed: noop,
    toggle: noop,
  };

  const layout: AccountLayoutController = {
    get state() {
      return {
        summary,
        logoutState: "ready" as const,
        logoutAction: "/storybook/logout",
        pictureEditorHref: "?edit=picture",
        tabs: { information: "#information", devices: "#devices", privacy: "#privacy", preferences: "#preferences" },
        currentTab: tab,
      };
    },
    submitLogout: () => false,
  };

  const editor = (name: AccountEditor): OpenController => ({
    get state() {
      return { open: information?.editor === name };
    },
    open: noop,
    close: noop,
    toggle: noop,
  });

  const informationController: AccountInformationController | null = $derived(
    information
      ? {
          state: {
            model: information,
            actions: {
              password: "/storybook/account/password",
              email: "/storybook/account/email",
              username: "/storybook/account/username",
              picture: "/storybook/account/picture",
              removePicture: "/storybook/account/remove-picture",
            },
            devicesHref: "#devices",
            logoutOthersHref: "#devices?confirm=others",
            scripted,
          },
          passwordVisibility: {
            currentPassword: visibility,
            newPassword: visibility,
            confirmPassword: visibility,
            emailCurrentPassword: visibility,
          },
          editors: {
            email: editor("email"),
            password: editor("password"),
            username: editor("username"),
            picture: editor("picture"),
          },
          pictureZoom: {
            state: {
              value:
                information.picture.status === "cropping" || information.picture.status === "saving"
                  ? information.picture.crop.zoom
                  : 1,
            },
            setValue: noop,
          },
          editorHref: (name) => (name ? `?edit=${name}` : "?"),
          enableScripts: noop,
          submitPassword: () => false,
          submitEmail: () => false,
          editUsername: noop,
          submitUsername: () => false,
          choosePicture: async () => {},
          panPicture: noop,
          zoomPicture: noop,
          savePicture: async () => null,
          submitPictureRemoval: () => false,
        }
      : null
  );

  const devicesController: AccountDevicesController | null = $derived(
    devices
      ? {
          state: {
            model: devices,
            actions: {
              logoutDevice: "/storybook/devices/logout",
              logoutOtherDevices: "/storybook/devices/logout-others",
              removeDevice: "/storybook/devices/remove",
              logout: "/storybook/logout",
            },
            privacyHref: "#privacy",
          },
          confirmation: {
            state: { open: devices.confirmation !== null },
            open: noop,
            close: noop,
            toggle: noop,
          },
          confirmationHref: (confirmation) =>
            confirmation ? `?confirm=${confirmation.kind === "others" ? "others" : confirmation.id}` : "?",
          openConfirmation: noop,
          submitChange: () => false,
        }
      : null
  );

  const location: LocationConsentController | null = $derived(
    privacy
      ? {
          account: privacy,
          pending: false,
          consent: {
            state: { checked: privacy.status === "ready" && privacy.locationConsent },
            setChecked: noop,
            toggle: noop,
          },
        }
      : null
  );
</script>

<div class="story-frame">
  <AccountScreen controller={layout}>
    {#if tab === "information" && informationController}
      <InformationScreen controller={informationController} />
    {:else if tab === "devices" && devicesController}
      <DevicesScreen controller={devicesController} />
    {:else if tab === "privacy" && location}
      <PrivacyScreen {telemetry} {location} />
    {:else if tab === "preferences"}
      <PreferencesScreen language={{ state: { value: props.language ?? "browser" }, setValue: noop }} />
    {/if}
  </AccountScreen>
</div>

<style>
  .story-frame {
    background: var(--color-surface-canvas);
    inline-size: 100%;
    min-block-size: 100dvb;
  }
</style>
