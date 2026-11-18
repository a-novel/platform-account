<script lang="ts">
  import PageTitle from "#lib/ui/PageTitle.svelte";
  import { resolve } from "$app/paths";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { ProtectedPage } from "@a-novel-kit/uikit";

  const { t } = getI18nContext();
</script>

<!-- Only a form posted without JavaScript renders here: its result shows over the locked account page. -->
<PageTitle title={t("shell.auth.login.title")} />

<!-- An allowed visitor gets nothing here either: the form's result shows in the shell's dialog. -->
{#snippet nothing()}{/snippet}

<ProtectedPage
  homeHref={resolve("/(app)/account/(information)")}
  retryHref={resolve("/(app)/account/(information)")}
  children={nothing}
/>
