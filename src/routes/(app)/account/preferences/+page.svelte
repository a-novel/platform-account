<script lang="ts">
  import Screen from "./screen.svelte";

  import { untrack } from "svelte";

  import { createSelectController } from "@a-novel-kit/uikit";

  let { data } = $props();
  // The choice stays in the form until it is saved, which reloads the page.
  const language = createSelectController({ initialValue: untrack(() => data.language) });
</script>

<Screen {language} savedLanguage={data.language} />
