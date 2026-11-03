<script module lang="ts">
  import Screen from "./screen.svelte";

  import { reviewStoryGlobals } from "@a-novel-kit/uikit-storybook";
  import ScrollPreview from "@a-novel-kit/uikit-storybook/ScrollPreview.svelte";

  import { defineMeta } from "@storybook/addon-svelte-csf";

  // Fixed times keep every rendering identical.
  const downtime = {
    components: ["service-authentication.database"],
    start: new Date("2026-10-12T06:00:00Z"),
    end: new Date("2026-10-12T08:30:00Z"),
  };

  const { Story } = defineMeta({
    title: "Authentication/Email link frame",
    component: Screen,
    tags: ["!autodocs"],
    parameters: { layout: "fullscreen" },
  });
</script>

<Story name="Upcoming maintenance" args={{ platformDowntime: { downtime, started: false, timeZone: "UTC" } }}>
  {#snippet template(args)}
    <Screen {...args}><ScrollPreview /></Screen>
  {/snippet}
</Story>

<Story name="Maintenance" args={{ platformDowntime: { downtime, started: true, timeZone: "UTC" } }}>
  {#snippet template(args)}
    <Screen {...args}><ScrollPreview /></Screen>
  {/snippet}
</Story>

<Story
  name="Maintenance — mobile"
  exportName="MaintenanceMobile"
  globals={reviewStoryGlobals.mobile}
  args={{ platformDowntime: { downtime, started: true, timeZone: "UTC" } }}
>
  {#snippet template(args)}
    <Screen {...args}><ScrollPreview /></Screen>
  {/snippet}
</Story>
