<script lang="ts">
  import { retryWhile } from "#lib/client/retry.svelte.js";
  import AccessBoundary from "#lib/ui/AccessBoundary.svelte";
  import PageTitle from "#lib/ui/PageTitle.svelte";
  import { invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { accountData } from "../dependencies";
  import { type AccountTab, createAccountLayoutController } from "./controller.svelte";
  import Screen from "./screen.svelte";
  import { addressBar, editorParameter } from "./url-state";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  let { data, children } = $props();
  const { t } = getI18nContext();

  const routeTabs: Record<string, AccountTab> = {
    "/(app)/account/(information)": "information",
    "/(app)/account/devices": "devices",
    "/(app)/account/privacy": "privacy",
    "/(app)/account/preferences": "preferences",
  };
  const currentTab = () => routeTabs[page.route.id ?? ""] ?? null;

  const controller = createAccountLayoutController({
    getSummary: () => data.summary,
    logoutAction: resolve("/auth/logout"),
    pictureEditorHref: `${resolve("/(app)/account/(information)")}?edit=picture`,
    tabs: {
      information: resolve("/(app)/account/(information)"),
      devices: resolve("/(app)/account/devices"),
      privacy: resolve("/(app)/account/privacy"),
      preferences: resolve("/(app)/account/preferences"),
    },
    getCurrentTab: currentTab,
  });

  const currentPath = $derived(page.url.pathname + page.url.search);

  const tabTitles = {
    information: "pageTitles.account",
    devices: "pageTitles.devices",
    privacy: "pageTitles.privacy",
    preferences: "pageTitles.preferences",
  } as const;
  /** Asks for the account's details again. New details reset an open editor's form, so a retry waits for it to close. */
  async function reloadDetails() {
    if (!addressBar(page.url).searchParams.has(editorParameter)) await invalidate(accountData);
  }

  retryWhile(
    () =>
      data.summary.status === "loading" ||
      data.credentials.status === "unavailable" ||
      data.profile.status === "unavailable",
    reloadDetails
  );
</script>

<PageTitle title={t(tabTitles[currentTab() ?? "information"])} />

{#snippet frame()}
  <Screen {controller}>{@render children()}</Screen>
{/snippet}

<AccessBoundary homeHref={resolve("")} retryHref={currentPath} children={frame} unavailable={frame} />
