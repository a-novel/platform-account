<script lang="ts">
  import { loginHref } from "#lib/application/auth/navigation.js";
  import AccessBoundary from "#lib/ui/AccessBoundary.svelte";
  import PageTitle from "#lib/ui/PageTitle.svelte";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { type AccountTab, createAccountLayoutController } from "./controller.svelte";
  import Screen from "./screen.svelte";

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
  // The tab names its section, then the outage that hides the account's details, as the header does.
  const title = $derived.by(() => {
    const section = t(tabTitles[currentTab() ?? "information"]);
    if (data.summary.status !== "error") return section;
    return t("pageTitles.withState", { title: section, status: t("authUi.account.loadErrorTitle") });
  });
</script>

<PageTitle {title} />

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
