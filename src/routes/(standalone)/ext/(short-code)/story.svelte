<script module lang="ts">
  import type { ShortCodeScreenModel } from "./controller.svelte";

  /** Fixed-state Storybook harness around the pure secure-link screen. */
  interface ShortCodeScreenStoryProps {
    initialModel: ShortCodeScreenModel;
    /** Whether the password fields show their text. */
    passwordsShown?: boolean;
  }
</script>

<script lang="ts">
  import type { ShortCodeScreenController } from "./controller.svelte";
  import ShortCodeScreen from "./screen.svelte";

  import { fixedPressed } from "@a-novel-kit/uikit-storybook";

  let { initialModel, passwordsShown = false }: ShortCodeScreenStoryProps = $props();

  const controller: ShortCodeScreenController = {
    get state() {
      return { model: initialModel, action: "#complete", restartHref: "#restart", continueHref: "#continue" };
    },
    get passwordVisibility() {
      const visibility = fixedPressed(passwordsShown);
      return { newPassword: visibility, confirmPassword: visibility };
    },
    fail: () => {},
    submit: () => false,
  };
</script>

<div class="story-frame">
  <ShortCodeScreen {controller} />
</div>

<style>
  .story-frame {
    inline-size: 100%;
    min-block-size: 100dvb;
  }
</style>
