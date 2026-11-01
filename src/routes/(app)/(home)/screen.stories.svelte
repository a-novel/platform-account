<script module lang="ts">
  import Screen from "./screen.svelte";

  import { reviewStoryGlobals } from "@a-novel-kit/uikit-storybook";

  import { defineMeta } from "@storybook/addon-svelte-csf";

  const { Story } = defineMeta({
    title: "Shell/Welcome",
    component: Screen,
    parameters: {
      layout: "fullscreen",
      docs: {
        description: {
          component:
            "The welcome page an anonymous visitor sees, with the way to log in. A signed-in visitor goes straight to the account page.",
        },
      },
    },
  });
</script>

<Story
  name="Default — desktop"
  exportName="DefaultDesktop"
  args={{ loginHref: "/?auth=login" }}
  globals={reviewStoryGlobals.desktop}
/>

<Story
  name="Default — mobile"
  exportName="DefaultMobile"
  args={{ loginHref: "/?auth=login" }}
  globals={reviewStoryGlobals.mobile}
/>
