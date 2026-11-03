<script module lang="ts">
  import type { AuthenticationPanelModel } from "#lib/application/auth/types.js";
  import type { ShellViewModel } from "#lib/application/shell/types.js";

  import type { Snippet } from "svelte";

  /** Fixed-state Storybook harness around the pure shell. */
  export interface ShellStoryProps {
    initialModel: ShellViewModel;
    initialAuthenticationModel?: AuthenticationPanelModel;
    /** Whether the platform collects browser telemetry, which adds the Privacy link. */
    collectsTelemetry?: boolean;
    /** A started planned downtime, which the shell announces and locks the sign-in dialog for. */
    downtime?: { start: Date; end: Date };
    /** Page content, such as filler to scroll past sticky elements. */
    children?: Snippet;
  }
</script>

<script lang="ts">
  import { setPlatformDowntime } from "#lib/ui/downtime.svelte.js";
  import { setTelemetryPreference } from "#lib/ui/telemetry-preference.js";

  import { type ShellController, readyAuthenticationModel } from "./controller.svelte";
  import Screen from "./screen.svelte";

  import { untrack } from "svelte";

  let { initialModel, initialAuthenticationModel, collectsTelemetry, downtime, children }: ShellStoryProps = $props();

  if (untrack(() => collectsTelemetry))
    setTelemetryPreference({ pending: false, choice: "accepted", choose: () => {} });

  const startedDowntime = untrack(() => downtime);
  if (startedDowntime) {
    setPlatformDowntime({
      downtime: { components: ["service-authentication.database"], ...startedDowntime },
      started: true,
      timeZone: "UTC",
    });
  }

  const controller: ShellController = {
    get state() {
      return {
        model: initialModel,
        homeHref: "#home",
        accountHref: "#account",
        logoutAction: "#logout",
        privacyHref: "#privacy",
        apps: { studio: "#studio" },
      };
    },
    authentication: {
      get state() {
        return {
          model: initialAuthenticationModel ?? readyAuthenticationModel(initialModel.authView ?? "login"),
          action: "#auth",
        };
      },
      passwordVisibility: { state: { pressed: false }, setPressed: () => {}, toggle: () => {} },
      synchronize: () => {},
      submit: () => false,
    },
    authenticationDialog: {
      get state() {
        return { open: initialModel.authView !== null };
      },
      open: () => {},
      close: () => {},
      toggle: () => {},
    },
    navigationDialog: {
      get state() {
        return { open: initialModel.drawerOpen };
      },
      open: () => {},
      close: () => {},
      toggle: () => {},
    },
    navigationHref: (open) => (open ? "#menu" : "#"),
    openAuthentication: () => {},
    authenticationHref: (view) => `#${view ?? "home"}`,
    toggleRail: () => {},
    logout: () => false,
    synchronizeRoute: () => {},
    synchronizeRail: () => {},
  };
</script>

<div class="story-frame">
  <Screen {controller}>
    {@render children?.()}
  </Screen>
</div>

<style>
  .story-frame {
    inline-size: 100%;
    min-block-size: 100dvb;
  }
</style>
