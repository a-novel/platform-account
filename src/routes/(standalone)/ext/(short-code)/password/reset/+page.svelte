<script lang="ts">
  import PageTitle from "#lib/ui/PageTitle.svelte";

  import { createShortCodeScreenController, shortCodeControllerState } from "../../controller.svelte";
  import { shortCodePageTitle } from "../../page-title";
  import Screen from "../../screen.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  let { data, form } = $props();
  const { t } = getI18nContext();
  const controller = createShortCodeScreenController({ getState: () => shortCodeControllerState(data, form) });
</script>

<PageTitle title={shortCodePageTitle(t, controller.state.model)} />

<Screen {controller} />
