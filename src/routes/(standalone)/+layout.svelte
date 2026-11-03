<script lang="ts">
  import { getPlatformDowntime } from "#lib/ui/downtime.svelte.js";

  import Screen from "./screen.svelte";

  let { children } = $props();
</script>

<Screen platformDowntime={getPlatformDowntime()}>
  {@render children()}
</Screen>
