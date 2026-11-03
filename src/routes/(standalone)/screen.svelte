<!-- @component The frame of the pages an email link opens, outside the shell: the page and any planned downtime. -->
<script lang="ts">
  import type { PlatformDowntime } from "#lib/ui/downtime.svelte.js";

  import type { Snippet } from "svelte";

  import { DowntimeBanner } from "@a-novel-kit/uikit";

  let {
    platformDowntime,
    children,
  }: {
    /** The planned downtime the frame announces, absent where nothing tracks it. */
    platformDowntime?: PlatformDowntime;
    children?: Snippet;
  } = $props();
</script>

<div class="page">
  {#if platformDowntime?.downtime}
    <div class="downtime">
      <DowntimeBanner
        start={platformDowntime.downtime.start}
        end={platformDowntime.downtime.end}
        started={platformDowntime.started}
        timeZone={platformDowntime.timeZone}
      />
    </div>
  {/if}
  <div class="content">{@render children?.()}</div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    min-block-size: 100dvb;
  }

  .content {
    flex: 1;
  }

  /* The maintenance banner stays above the page while it scrolls. */
  .downtime {
    position: sticky;
    z-index: var(--layer-sticky);
    inset-block-start: 0;
  }

  /* On narrow screens it waits at the bottom, away from where reading starts, and never covers the end. */
  @media (max-width: 47.999rem) {
    .downtime {
      order: 1;
      inset-block-end: 0;
      inset-block-start: auto;
    }
  }
</style>
