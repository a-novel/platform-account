<script lang="ts">
  import { createLocationConsentController } from "./controller.svelte";
  import Screen from "./screen.svelte";

  import { getTelemetryPreference, hasTelemetryPreference } from "@a-novel-kit/nodelib-svelte";

  let { data, form } = $props();
  // Only a platform that collects browser telemetry asks for consent, so only it has an answer to change.
  const telemetry = hasTelemetryPreference() ? getTelemetryPreference() : null;
  // A change's result replaces the loaded consent until the next load.
  const location = createLocationConsentController(() => form?.account ?? data.account);
</script>

<Screen {telemetry} {location} />
