<script lang="ts">
  import type { AccountPasswordField } from "#lib/application/auth/types.js";
  import { translateFieldIssue } from "#lib/i18n/auth-feedback.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { followInPlace } from "../../link-transition";
  import type { AccountInformationController } from "./controller.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Button, Dialog, Field, FormActions, IconButton, Link, PasswordInput } from "@a-novel-kit/uikit";

  import { ShieldCheck, X } from "@lucide/svelte";

  let { controller }: { controller: AccountInformationController } = $props();

  const model = $derived(controller.state.model);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const changed = $derived(model.passwordState.status === "success");
  const submitting = $derived(model.passwordState.status === "submitting");
  const issues = $derived(model.passwordState.status === "validation-error" ? model.passwordState.issues : []);
  const error = (field: AccountPasswordField) => translateFieldIssue(t, issues, field);
  const submit = (event: SubmitEvent) => submitThrough(event, (form) => controller.submitPassword(form));
  const close = (event: MouseEvent) => followInPlace(event, controller.editors.password.close);
</script>

{#snippet changedTitle()}
  <span class="success-title">
    <ShieldCheck size="var(--icon-size-md)" aria-hidden="true" />
    {t("authUi.account.password.success.title")}
  </span>
{/snippet}

<Dialog
  controller={controller.editors.password}
  title={changed ? changedTitle : t("authUi.account.password.dialogTitle")}
  size="sm"
>
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

  {#if changed}
    <!-- A password change keeps every session, so the screen says so and offers to end the others. -->
    <div class="success" role="status">
      <p>{t("authUi.account.password.success.description")}</p>
      <p class="secondary">
        {t("authUi.account.password.success.devices")}
        <Link href={controller.state.devicesHref}>{t("authUi.account.password.success.review")}</Link>
      </p>
      <FormActions>
        <!-- Logging every device out asks for confirmation on the devices tab, as it does there. -->
        <Button href={controller.state.logoutOthersHref} variant="outline" tone="neutral">
          {t("authUi.account.devices.logoutOthers")}
        </Button>
        <Button href={controller.editorHref(null)} onclick={close}>{t("authUi.account.gotIt")}</Button>
      </FormActions>
    </div>
  {:else}
    <form method="POST" action={controller.state.actions.password} aria-busy={submitting} novalidate onsubmit={submit}>
      <Field
        controlId={`${componentId}-current-password`}
        label={t("authUi.account.password.currentLabel")}
        error={error("currentPassword")}
        required
      >
        {#snippet children(control)}
          <PasswordInput
            {...control}
            controller={controller.passwordVisibility.currentPassword}
            name="currentPassword"
            autocomplete="current-password"
            readonly={submitting}
          />
        {/snippet}
      </Field>
      <Field
        controlId={`${componentId}-new-password`}
        label={t("authUi.account.password.newLabel")}
        hint={t("authUi.account.password.hint")}
        error={error("newPassword")}
        required
      >
        {#snippet children(control)}
          <PasswordInput
            {...control}
            controller={controller.passwordVisibility.newPassword}
            name="password"
            autocomplete="new-password"
            readonly={submitting}
          />
        {/snippet}
      </Field>
      <Field
        controlId={`${componentId}-confirm-password`}
        label={t("authUi.account.password.confirmLabel")}
        error={error("confirmPassword")}
        required
      >
        {#snippet children(control)}
          <PasswordInput
            {...control}
            controller={controller.passwordVisibility.confirmPassword}
            name="confirmPassword"
            autocomplete="new-password"
            readonly={submitting}
          />
        {/snippet}
      </Field>
      <FormActions>
        {#snippet feedback()}
          {#if model.passwordState.status === "service-error"}
            <AuthenticationError feedback={model.passwordState.feedback} />
          {/if}
        {/snippet}
        <Button type="submit" disabled={submitting}>
          {submitting ? t("authUi.account.password.submitting") : t("authUi.account.password.submit")}
        </Button>
      </FormActions>
    </form>
  {/if}
</Dialog>

<style>
  form,
  .success {
    display: grid;
    gap: var(--space-4);
  }

  .success-title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .success-title > :global(svg) {
    flex: none;
    color: var(--color-text-accent);
  }

  p {
    margin: 0;
    color: var(--color-text-primary);
    line-height: var(--line-height-normal);
  }

  .secondary {
    color: var(--color-text-secondary);
  }
</style>
