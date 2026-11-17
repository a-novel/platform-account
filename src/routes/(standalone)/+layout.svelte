<script lang="ts">
  import Screen from "./screen.svelte";

  import { getPlatformDowntime } from "@a-novel-kit/nodelib-svelte";

  let { children } = $props();
</script>

<Screen platformDowntime={getPlatformDowntime()}>
  {@render children()}
</Screen>
