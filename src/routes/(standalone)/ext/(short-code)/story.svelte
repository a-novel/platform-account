<script module lang="ts">
  import type { ShortCodeScreenModel } from "#lib/application/auth/types.js";

  /** Fixed-state Storybook harness around the pure secure-link screen. */
  export interface ShortCodeScreenStoryProps {
    initialModel: ShortCodeScreenModel;
    /** Whether the password fields show their text. */
    passwordsShown?: boolean;
  }
</script>

<script lang="ts">
  import type { ShortCodeScreenController } from "./controller.svelte";
  import ShortCodeScreen from "./screen.svelte";

  import type { PasswordInputController } from "@a-novel-kit/uikit";

  let { initialModel, passwordsShown = false }: ShortCodeScreenStoryProps = $props();

  const visibility: PasswordInputController = {
    get state() {
      return { pressed: passwordsShown };
    },
    setPressed: () => {},
    toggle: () => {},
  };
  const controller: ShortCodeScreenController = {
    get state() {
      return { model: initialModel, action: "#complete", restartHref: "#restart", continueHref: "#continue" };
    },
    passwordVisibility: { newPassword: visibility, confirmPassword: visibility },
    synchronize: () => {},
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
