<script lang="ts">
  import { getTelemetryPreference, hasTelemetryPreference } from "#lib/ui/telemetry-preference.js";

  import { createLocationConsentController } from "./controller.svelte";
  import Screen from "./screen.svelte";

  import { untrack } from "svelte";

  let { data, form } = $props();
  // Only a platform that collects browser telemetry asks for consent, so only it has an answer to change.
  const telemetry = hasTelemetryPreference() ? getTelemetryPreference() : null;
  // A change's result replaces the loaded consent until the next load.
  const location = createLocationConsentController(untrack(() => form?.account ?? data.account));

  $effect(() => {
    const account = form?.account ?? data.account;
    untrack(() => location.synchronize(account));
  });
</script>

<Screen {telemetry} {location} />
