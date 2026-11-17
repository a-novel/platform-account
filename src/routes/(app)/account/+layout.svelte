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
  import { editorParameter } from "./url-state";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  let { data, children } = $props();
  const { t } = getI18nContext();

  /** The route of each tab, which gives its address and tells whether it shows. */
  const tabRoutes = {
    information: "/(app)/account/(information)",
    devices: "/(app)/account/devices",
    privacy: "/(app)/account/privacy",
    preferences: "/(app)/account/preferences",
  } as const;
  const tabs = {
    information: resolve(tabRoutes.information),
    devices: resolve(tabRoutes.devices),
    privacy: resolve(tabRoutes.privacy),
    preferences: resolve(tabRoutes.preferences),
  };
  const currentTab = () =>
    (Object.keys(tabRoutes) as AccountTab[]).find((tab) => tabRoutes[tab] === page.route.id) ?? null;

  const controller = createAccountLayoutController({
    getSummary: () => data.summary,
    logoutAction: resolve("/auth/logout"),
    pictureEditorHref: `${tabs.information}?edit=picture`,
    tabs,
    getCurrentTab: currentTab,
  });

  const currentPath = $derived(page.url.pathname + page.url.search);

  function tabTitle(tab: AccountTab | null) {
    switch (tab) {
      case "devices":
        return t("pageTitles.devices");
      case "privacy":
        return t("pageTitles.privacy");
      case "preferences":
        return t("pageTitles.preferences");
      default:
        return t("pageTitles.account");
    }
  }

  /** Asks for the account's details again. New details reset an open editor's form, so a retry waits for it to close. */
  async function reloadDetails() {
    if (!(page.shallow?.url ?? page.url).searchParams.has(editorParameter)) await invalidate(accountData);
  }

  retryWhile(
    () =>
      data.summary.status === "loading" ||
      data.credentials.status === "unavailable" ||
      data.profile.status === "unavailable",
    reloadDetails
  );
</script>

<PageTitle title={tabTitle(currentTab())} />

{#snippet frame()}
  <Screen {controller}>{@render children()}</Screen>
{/snippet}

<AccessBoundary homeHref={resolve("")} retryHref={currentPath} children={frame} unavailable={frame} />
