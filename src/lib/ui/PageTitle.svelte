<script module lang="ts">
  import { createContext } from "svelte";

  /** Reads, installs and detects the open authentication dialog's title, which the tab shows in place of the route's own. */
  export const [getAuthenticationTitle, setAuthenticationTitle, hasAuthenticationTitle] =
    createContext<() => string | undefined>();
</script>

<script lang="ts">
  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  let { title }: { title: string } = $props();
  const authenticationTitle = hasAuthenticationTitle() ? getAuthenticationTitle() : undefined;
  const { t } = getI18nContext();
</script>

<svelte:head>
  <title>{authenticationTitle?.() ?? title} | {t("pageTitles.brand")}</title>
</svelte:head>
