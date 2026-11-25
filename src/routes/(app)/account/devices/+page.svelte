<script lang="ts">
  import { telemetry } from "#lib/client/telemetry.js";
  import { goto, invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { devicesData } from "../../dependencies";
  import { dialogUrl, localHref } from "../url-state";
  import type { DevicesActionData } from "./+page.server";
  import { confirmationParameter, confirmationValue, readConfirmation } from "./confirmation-state";
  import { type AccountDeviceConfirmation, createAccountDevicesController } from "./controller.svelte";
  import { devicePageUrl, readPages } from "./device-pages";
  import Screen from "./screen.svelte";

  import { retryWhile } from "@a-novel-kit/nodelib-svelte";

  let { data, form } = $props();
  const actions = {
    logoutDevice: "?/logoutDevice",
    logoutOtherDevices: "?/logoutOtherDevices",
    removeDevice: "?/removeDevice",
    removeLoggedOutDevices: "?/removeLoggedOutDevices",
    logout: resolve("/auth/logout"),
  };

  // The address bar: the URL of the latest shallow navigation, which Back and Forward restore, until a full one.
  const url = $derived(new URL((page.shallow?.url ?? page.url).href));
  /** The URL with a logout waiting for confirmation, or none, built on the address bar. */
  const confirmationUrl = (confirmation: AccountDeviceConfirmation | null) =>
    dialogUrl(url, confirmationParameter, confirmationValue(confirmation));
  // A list may stay missing, so it stops asking after a few tries and says so.
  const listRetries = retryWhile(
    () => data.devices.status === "unavailable",
    () => invalidate(devicesData),
    { maxRetries: 5, onError: (error) => telemetry.captureError(error) }
  );

  const controller = createAccountDevicesController({
    getModel: () => ({
      devices:
        data.devices.status === "unavailable" && !listRetries.exhausted ? { status: "loading" as const } : data.devices,
      pages: readPages(url.searchParams),
      locationConsent: data.locationConsent,
      action: (form as DevicesActionData | null)?.devicesAction ?? { status: "ready" as const },
    }),
    getConfirmation: () => readConfirmation(url.searchParams),
    actions,
    privacyHref: resolve("/(app)/account/privacy"),
    onConfirmationChange: showConfirmation,
    confirmationUrl: (confirmation) => localHref(confirmationUrl(confirmation)),
    pageUrl: (list, number) => localHref(devicePageUrl(url, list, number)),
  });

  /** Asks about a logout in the URL. Asking adds a history entry, so Back cancels. Cancelling replaces the entry. */
  function showConfirmation(confirmation: AccountDeviceConfirmation | null) {
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Shallow routing edits the current, resolved URL.
    goto(confirmationUrl(confirmation), { shallow: true, replace: confirmation === null, state: page.state });
  }
</script>

<Screen {controller} />
