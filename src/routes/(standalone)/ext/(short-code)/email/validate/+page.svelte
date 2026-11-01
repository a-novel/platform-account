<script lang="ts">
  import { shortCodePageTitle } from "#lib/i18n/page-titles.js";
  import PageTitle from "#lib/ui/PageTitle.svelte";
  import { applyAction, deserialize } from "$app/forms";
  import { goto } from "$app/navigation";

  import { createShortCodeScreenController, shortCodeControllerState } from "../../controller.svelte";
  import Screen from "../../screen.svelte";

  import { onMount, untrack } from "svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  let { data, form } = $props();
  const { t } = getI18nContext();
  const controller = createShortCodeScreenController(untrack(() => shortCodeControllerState(data, form)));

  $effect(() => {
    const state = shortCodeControllerState(data, form);
    untrack(() => controller.synchronize(state));
  });

  onMount(() => {
    const request = new AbortController();
    void validateEmail(request.signal);
    return () => request.abort();
  });

  async function validateEmail(signal: AbortSignal) {
    if (controller.state.model.state.status !== "ready" || !controller.submit()) return;

    try {
      // GET and prefetch stay read-only. Only the mounted route consumes the link, through its action.
      const response = await fetch("", {
        method: "POST",
        headers: { accept: "application/json", "x-sveltekit-action": "true" },
        body: new FormData(),
        signal,
      });
      const result = deserialize(await response.text());
      if (signal.aborted) return;

      // eslint-disable-next-line svelte/no-navigation-without-resolve -- The action redirects to an app-resolved URL.
      if (result.type === "redirect") return await goto(result.location, { replace: true, refreshAll: true });
      await applyAction(result);
    } catch {
      if (signal.aborted) return;

      controller.synchronize({
        ...controller.state,
        model: { journey: "email-update", state: { status: "service-error", feedback: "serviceUnavailable" } },
      });
    }
  }
</script>

<PageTitle title={shortCodePageTitle(t, controller.state.model)} />

<Screen {controller} />
