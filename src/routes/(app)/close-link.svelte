<!-- @component A dialog's close control: a link to the page without the dialog, which closes it in place. -->
<script lang="ts">
  import { followInPlace } from "./link-transition";

  import { IconButton } from "@a-novel-kit/uikit";

  import { X } from "@lucide/svelte";

  let { label, href, onclose }: { label: string; href: string; onclose: () => void } = $props();
</script>

<IconButton
  {label}
  variant="ghost"
  tone="neutral"
  size="sm"
  {href}
  onclick={(event: MouseEvent) => followInPlace(event, onclose)}
>
  <X size="var(--icon-size-sm)" aria-hidden="true" />
</IconButton>
