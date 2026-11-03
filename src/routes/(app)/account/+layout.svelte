<script lang="ts">
  import { loginHref } from "#lib/application/auth/navigation.js";
  import AccessBoundary from "#lib/ui/AccessBoundary.svelte";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { type AccountTab, createAccountLayoutController } from "./controller.svelte";
  import Screen from "./screen.svelte";

  import { untrack } from "svelte";

  let { data, children } = $props();

  const routeTabs: Record<string, AccountTab> = {
    "/(app)/account/(information)": "information",
    "/(app)/account/devices": "devices",
    "/(app)/account/privacy": "privacy",
  };
  const currentTab = () => routeTabs[page.route.id ?? ""] ?? null;

  const controller = createAccountLayoutController({
    summary: untrack(() => data.summary),
    logoutAction: resolve("/auth/logout"),
    tabs: {
      information: resolve("/(app)/account/(information)"),
      devices: resolve("/(app)/account/devices"),
      privacy: resolve("/(app)/account/privacy"),
    },
    currentTab: untrack(currentTab),
  });

  $effect(() => {
    const summary = data.summary;
    const tab = currentTab();
    untrack(() => controller.synchronize(summary, tab));
  });

  const currentPath = $derived(page.url.pathname + page.url.search);
</script>

{#snippet frame()}
  <Screen {controller}>{@render children()}</Screen>
{/snippet}

<AccessBoundary
  loginHref={loginHref(currentPath)}
  homeHref={resolve("")}
  retryHref={currentPath}
  children={frame}
  unavailable={frame}
/>
