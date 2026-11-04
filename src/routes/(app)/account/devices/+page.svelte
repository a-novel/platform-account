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

  import { onMount, untrack } from "svelte";

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

  const model = (confirmation: AccountDeviceConfirmation | null) => ({
    devices: data.devices,
    locationConsent: data.locationConsent,
    confirmation,
    action: (form as DevicesActionData | null)?.devicesAction ?? { status: "ready" as const },
  });

  const controller = createAccountDevicesController({
    model: untrack(() => model(readConfirmation(new URL(page.url.href).searchParams))),
    actions,
    privacyHref: resolve("/(app)/account/privacy"),
    // Asking adds a history entry, so Back cancels. Cancelling replaces the entry.
    onConfirmationChange: (confirmation) =>
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- Shallow routing edits the current, resolved URL.
      goto(confirmationUrl(confirmation), { shallow: true, replace: confirmation === null, state: page.state }),
    confirmationUrl: (confirmation) => localHref(confirmationUrl(confirmation)),
  });

  $effect(() => {
    const next = model(untrack(() => controller.state.model.confirmation));
    untrack(() => controller.synchronize(next));
  });

  /** Asks about the logout the address bar names, after Back, Forward or a navigation from a link. */
  function synchronizeConfirmation() {
    const confirmation = readConfirmation(new URL(window.location.href).searchParams);
    controller.synchronize({ ...controller.state.model, confirmation });
  }

  afterNavigate(({ shallow }) => {
    if (!shallow) synchronizeConfirmation();
  });

  onMount(() => {
    window.addEventListener("popstate", synchronizeConfirmation);
    return () => window.removeEventListener("popstate", synchronizeConfirmation);
  });
</script>

<Screen {controller} />
