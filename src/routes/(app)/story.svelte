<script module lang="ts">
  import type { AuthenticationPanelModel } from "#lib/application/auth/types.js";
  import type { ShellViewModel } from "#lib/application/shell/types.js";

  import type { Snippet } from "svelte";

  /** Fixed-state Storybook harness around the pure shell. */
  export interface ShellStoryProps {
    model: ShellViewModel;
    authenticationModel?: AuthenticationPanelModel;
    /** Whether the password field shows its text. */
    passwordShown?: boolean;
    /** Whether the server could read where the apps live, which the app list needs. */
    apps?: boolean;
    /** Whether the platform collects browser telemetry, which the Privacy link needs. */
    collectsTelemetry?: boolean;
    /** A planned downtime, which the shell announces and, once started, locks the sign-in dialog for. */
    downtime?: { start: Date; end: Date };
    /** Whether that downtime has started. */
    started?: boolean;
    /** Page content, such as filler to scroll past sticky elements. */
    children?: Snippet;
  }
</script>

<script lang="ts">
  import { type ShellController, readyAuthenticationModel } from "./controller.svelte";
  import Screen from "./screen.svelte";

  let {
    model,
    authenticationModel,
    passwordShown = false,
    apps = true,
    collectsTelemetry = false,
    downtime,
    started = true,
    children,
  }: ShellStoryProps = $props();

  const controller: ShellController = {
    get state() {
      return {
        model,
        homeHref: "#home",
        accountHref: "#account",
        privacyHref: collectsTelemetry ? "#privacy" : null,
        logoutAction: "#logout",
        apps: apps ? { studio: "#studio" } : null,
        platformDowntime: downtime && {
          downtime: { components: ["service-authentication.database"], ...downtime },
          started,
          timeZone: "UTC",
        },
      };
    },
    authentication: {
      get state() {
        return {
          model: authenticationModel ?? readyAuthenticationModel(model.authView ?? "login"),
          action: "#auth",
        };
      },
      passwordVisibility: {
        get state() {
          return { pressed: passwordShown };
        },
        setPressed: () => {},
        toggle: () => {},
      },
      submit: () => false,
    },
    authenticationDialog: {
      get state() {
        return { open: model.authView !== null };
      },
      open: () => {},
      close: () => {},
      toggle: () => {},
    },
    navigationDialog: {
      get state() {
        return { open: model.drawerOpen };
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
