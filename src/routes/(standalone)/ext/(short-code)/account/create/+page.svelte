<script lang="ts">
  import { shortCodePageTitle } from "#lib/i18n/page-titles.js";
  import PageTitle from "#lib/ui/PageTitle.svelte";

  import { createShortCodeScreenController, shortCodeControllerState } from "../../controller.svelte";
  import Screen from "../../screen.svelte";

  import { untrack } from "svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  let { data, form } = $props();
  const { t } = getI18nContext();
  const controller = createShortCodeScreenController(untrack(() => shortCodeControllerState(data, form)));

  $effect(() => {
    const state = shortCodeControllerState(data, form);
    untrack(() => controller.synchronize(state));
  });
</script>

<PageTitle title={shortCodePageTitle(t, controller.state.model)} />

<Screen {controller} />
