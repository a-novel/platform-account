<script lang="ts">
  import { loginHref } from "#lib/application/auth/navigation.js";
  import PageTitle from "#lib/ui/PageTitle.svelte";

  import Screen from "./screen.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  const { t } = getI18nContext();
</script>

<PageTitle title={t("home.title")} />

<Screen loginHref={loginHref("/account")} />
