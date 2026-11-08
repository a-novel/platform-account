<!-- @component The flag that marks a language in the language select, at an icon's size. -->
<script lang="ts">
  import type { Locale } from "#lib/i18n/config.js";

  let { locale }: { locale: Locale } = $props();

  // Thirteen stripes, red at the top and the bottom.
  const stripeHeight = 20 / 13;
  const redStripes = [0, 2, 4, 6, 8, 10, 12];
</script>

<!-- A flag is an image, so it keeps its own colors. English takes the United States' flag. -->
<svg class="flag" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  {#if locale === "fr"}
    <rect width="10" height="20" fill="#0055a4" />
    <rect x="10" width="10" height="20" fill="#ffffff" />
    <rect x="20" width="10" height="20" fill="#ef4135" />
  {:else}
    <rect width="30" height="20" fill="#ffffff" />
    {#each redStripes as stripe (stripe)}
      <rect y={stripe * stripeHeight} width="30" height={stripeHeight} fill="#b22234" />
    {/each}
    <rect width="12" height={7 * stripeHeight} fill="#3c3b6e" />
  {/if}
</svg>

<style>
  .flag {
    display: block;
    flex: none;
    box-shadow: var(--shadow-ring);
    border-radius: var(--radius-sm);
    inline-size: var(--icon-size-md);
    block-size: var(--icon-size-sm);
  }
</style>
