<script lang="ts">
  import type { AccountDeviceConfirmation } from "#lib/application/auth/types.js";
  import { afterNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { addressBar, dialogUrl, localHref } from "../url-state";
  import type { DevicesActionData } from "./+page.server";
  import { confirmationParameter, confirmationValue, readConfirmation } from "./confirmation-state";
  import { createAccountDevicesController } from "./controller.svelte";
  import Screen from "./screen.svelte";

  import { onMount } from "svelte";

  let { data, form } = $props();
  const actions = {
    logoutDevice: "?/logoutDevice",
    logoutOtherDevices: "?/logoutOtherDevices",
    removeDevice: "?/removeDevice",
    logout: resolve("/auth/logout"),
  };

  /** The URL with a logout waiting for confirmation, or none, built on the address bar. */
  const confirmationUrl = (confirmation: AccountDeviceConfirmation | null) =>
    dialogUrl(addressBar(page.url), confirmationParameter, confirmationValue(confirmation));

  // The address bar, which shallow routing changes without a navigation that page.url would follow.
  let currentHref = $state(page.url.href);
  const controller = createAccountDevicesController({
    getModel: () => ({
      devices: data.devices,
      locationConsent: data.locationConsent,
      action: (form as DevicesActionData | null)?.devicesAction ?? { status: "ready" as const },
    }),
    getConfirmation: () => readConfirmation(new URL(currentHref).searchParams),
    actions,
    privacyHref: resolve("/(app)/account/privacy"),
    onConfirmationChange: showConfirmation,
    confirmationUrl: (confirmation) => localHref(confirmationUrl(confirmation)),
  });

  /** Asks about a logout in the URL. Asking adds a history entry, so Back cancels. Cancelling replaces the entry. */
  function showConfirmation(confirmation: AccountDeviceConfirmation | null) {
    const next = confirmationUrl(confirmation);
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Shallow routing edits the current, resolved URL.
    goto(next, { shallow: true, replace: confirmation === null, state: page.state });
    currentHref = next.href;
  }

  /** Reads the logout the address bar names, after Back, Forward or a navigation from a link. */
  function synchronizeUrl() {
    currentHref = window.location.href;
  }

  afterNavigate(({ shallow }) => {
    if (!shallow) synchronizeUrl();
  });

  onMount(() => {
    window.addEventListener("popstate", synchronizeUrl);
    return () => window.removeEventListener("popstate", synchronizeUrl);
  });
</script>

<Screen {controller} />
