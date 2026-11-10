<script lang="ts">
  import AccessBoundary from "#lib/ui/AccessBoundary.svelte";
  import PageTitle from "#lib/ui/PageTitle.svelte";
  import { resolve } from "$app/paths";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  const { t } = getI18nContext();
</script>

<!-- Only a form posted without JavaScript renders here: its result shows over the locked account page. -->
<PageTitle title={t("shell.auth.login.title")} />

<AccessBoundary
  homeHref={resolve("/(app)/account/(information)")}
  retryHref={resolve("/(app)/account/(information)")}
/>
