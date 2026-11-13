<script lang="ts">
  import { countGlyphs, trimUsername, usernameGlyphsMax, usernameIssue } from "#lib/application/profile/username.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { followInPlace } from "../../link-transition";
  import type { AccountInformationController } from "./controller.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Button, Dialog, Field, FormActions, IconButton, Input } from "@a-novel-kit/uikit";

  import { X } from "@lucide/svelte";

  let { controller }: { controller: AccountInformationController } = $props();

  const editor = $derived(controller.state.model.username);
  const profile = $derived(controller.state.model.profile);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const glyphs = $derived(countGlyphs(editor.draft));
  const submitting = $derived(editor.state.status === "submitting");
  // A name that breaks the rule shows why as it is typed, since its save waits for a valid one; the service's own
  // refusal stays until the next try.
  const issue = $derived(editor.state.status === "validation-error" ? editor.state.issue : usernameIssue(editor.draft));
  const current = $derived(profile.status === "ready" ? (profile.username ?? "") : "");
  // Saving waits for a valid name other than the current one. Without scripts, the field reports no typing, so the
  // button stays on and the service checks the name.
  const idle = $derived(
    controller.state.scripted && (trimUsername(editor.draft) === trimUsername(current) || issue !== null)
  );
  const submit = (event: SubmitEvent) => submitThrough(event, (form) => controller.submitUsername(form));
  const close = (event: MouseEvent) => followInPlace(event, controller.editors.username.close);
  const edit = (event: Event & { currentTarget: HTMLInputElement }) =>
    controller.editUsername(event.currentTarget.value);

  const error = $derived.by(() => {
    switch (issue) {
      case "characters":
        return t("authUi.account.username.issues.characters");
      case "invisible":
        return t("authUi.account.username.issues.invisible");
      case "length":
        return t("authUi.account.username.issues.length", { limit: usernameGlyphsMax });
      case "size":
        return t("authUi.account.username.issues.size");
      case "refused":
        return t("authUi.account.username.issues.refused");
      default:
        return undefined;
    }
  });
</script>

<!-- The count reads with the hint, as the field's description, whenever the field takes focus. -->
{#snippet hint()}
  <span class="hint">
    <span>{t("authUi.account.username.hint")}</span>
    <span class="counter" class:over={glyphs > usernameGlyphsMax}>
      {t("authUi.account.username.counter", { glyphs, limit: usernameGlyphsMax })}
    </span>
  </span>
{/snippet}

<Dialog controller={controller.editors.username} title={t("authUi.account.username.dialogTitle")} size="sm">
  {#snippet headerActions()}
    <IconButton
      label={t("authUi.account.closeEditor")}
      variant="ghost"
      tone="neutral"
      size="sm"
      href={controller.editorHref(null)}
      onclick={close}
    >
      <X size="var(--icon-size-sm)" aria-hidden="true" />
    </IconButton>
  {/snippet}

  <form method="POST" action={controller.state.actions.username} aria-busy={submitting} novalidate onsubmit={submit}>
    <Field controlId={`${componentId}-username`} label={t("authUi.account.username.label")} {hint} {error}>
      {#snippet children(control)}
        <Input
          {...control}
          name="username"
          autocomplete="nickname"
          spellcheck="false"
          value={editor.draft}
          oninput={edit}
          readonly={submitting}
        />
      {/snippet}
    </Field>
    <FormActions>
      {#snippet feedback()}
        {#if editor.state.status === "service-error"}
          <AuthenticationError feedback={editor.state.feedback} />
        {/if}
      {/snippet}
      <Button type="submit" disabled={submitting || idle}>
        {submitting ? t("authUi.account.username.submitting") : t("authUi.account.username.submit")}
      </Button>
    </FormActions>
  </form>
</Dialog>

<style>
  form {
    display: grid;
    gap: var(--space-4);
  }

  .hint {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
  }

  .counter {
    flex: none;
    font-variant-numeric: tabular-nums;
  }

  .counter.over {
    color: var(--color-feedback-error-text);
  }
</style>
