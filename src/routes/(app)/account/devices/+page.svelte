<script lang="ts">
  import type { AccountDeviceConfirmation } from "#lib/application/auth/types.js";
  import { retryWhile } from "#lib/client/retry.svelte.js";
  import { afterNavigate, goto, invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { devicesData } from "../../dependencies";
  import { addressBar, dialogUrl, localHref } from "../url-state";
  import type { DevicesActionData } from "./+page.server";
  import { confirmationParameter, confirmationValue, readConfirmation } from "./confirmation-state";
  import { createAccountDevicesController } from "./controller.svelte";
  import { devicePageUrl, readPages } from "./device-pages";
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
  // A list may stay missing, so it stops asking after a few tries and says so.
  const listRetries = retryWhile(
    () => data.devices.status === "unavailable",
    () => invalidate(devicesData),
    { maxRetries: 5 }
  );

  const controller = createAccountDevicesController({
    getModel: () => ({
      devices:
        data.devices.status === "unavailable" && !listRetries.exhausted ? { status: "loading" as const } : data.devices,
      pages: readPages(new URL(currentHref).searchParams),
      locationConsent: data.locationConsent,
      action: (form as DevicesActionData | null)?.devicesAction ?? { status: "ready" as const },
    }),
    getConfirmation: () => readConfirmation(new URL(currentHref).searchParams),
    actions,
    privacyHref: resolve("/(app)/account/privacy"),
    onConfirmationChange: showConfirmation,
    confirmationUrl: (confirmation) => localHref(confirmationUrl(confirmation)),
    pageUrl: (list, number) => localHref(devicePageUrl(addressBar(page.url), list, number)),
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
